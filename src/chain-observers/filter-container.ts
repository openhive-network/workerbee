import { FilterBase } from "./filters/filter-base";
import { ProvidersData } from "./providers-mediator";

/**
 * Filter container that holds multiple filters
 * and waits for all of them to resolve before resolving itself
 */
export class FilterContainer extends FilterBase {
  private filters: FilterBase[] = [];

  private cachedAggregateData = new Set<keyof ProvidersData>();

  private forceResolve = () => {};

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
    // Either all filters resolve or the container is cancelled
    return Promise.race([
      new Promise<void>(resolve => {
        this.forceResolve = resolve; // Resolve instead of reject to prevent unnecessary error logging
      }),
      Promise.all(this.filters.map(filter => filter.match(data)))
    ]);
  }

  /**
   * Cancels the filter container and forces instant resolve
   */
  public cancel() {
    this.forceResolve();
  }
}
