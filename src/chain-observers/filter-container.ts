import { WorkerBeeUnsatisfiedFilterError } from "../errors";
import { FilterBase } from "./filters/filter-base";
import { ProvidersData } from "./providers-mediator";

/**
 * Filter container that holds multiple filters
 * and waits for all of them to resolve before resolving itself
 */
export class FilterContainer extends FilterBase {
  private filters: FilterBase[] = [];

  private cachedAggregateData = new Set<keyof ProvidersData>();

  private forceReject = () => {};

  /**
   * Pushes the single filter to the container and caches aggregated data it requires
   */
  public pushFilter(
    filter: FilterBase
  ) {
    this.filters.push(filter);

    this.pushAggregatedData(filter);
  }

  /**
   * Determines whether the container has any underlying filters
   */
  public get hasUnderlyingFilters() {
    return this.filters.length > 0;
  }

  private pushAggregatedData(otherFilter: FilterBase) {
    for(const aggregateData of otherFilter.aggregate())
      this.cachedAggregateData.add(aggregateData);
  }

  public aggregate(): Array<keyof ProvidersData> {
    return [...this.cachedAggregateData];
  }

  public match(data: ProvidersData): Promise<any> {
    /*
     * If at least one of the filters resolves with undefined value,
     * throw to reject and ignore rest of the promises (Apply AND logic)
     */
    return Promise.race([
      new Promise((_, reject) => {
        this.forceReject = () => {
          reject(new WorkerBeeUnsatisfiedFilterError());
        };
      }),
      Promise.all(this.filters.map(filter => filter.match(data).then(node => {
        if(node === undefined)
          throw new WorkerBeeUnsatisfiedFilterError();

        return node;
      })))
    ]);
  }

  /**
   * Cancels the filter container and forces instant resolve
   */
  public cancel() {
    this.forceReject();
  }
}
