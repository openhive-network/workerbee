import { IConstructibleFilterConfigurator, IFilterConfigurator, IFilterFactory, TAccountMutableProperty, TOperationType } from "../filter-factory";
import { IFilter } from "../filter";
import { TAccountName, TTransactionId } from "@hiveio/wax";
import { TReferencedDataCollectors} from "../data-collectors/collector";
import { AFilter } from "./filter-impl";
import { TBlockNumFilter, TBlockProducerFilter, TBlockTimeFilter } from "./block-filter-impl";
import { TLogicalAndFilter, TLogicalOrFilter } from "./composite-filter-impl";

class AFilterConfigurator implements IFilterConfigurator {
  protected constructor(protected readonly definedFilters: AFilter[]) {
  }

  public onBlock(arg: number|Date|TAccountName): IConstructibleFilterConfigurator {
    let blockFilter: AFilter;
    if (typeof arg === 'number')
      blockFilter = new TBlockNumFilter(arg);
    else if (typeof arg === 'string')
      blockFilter = new TBlockProducerFilter(arg);
    else
    blockFilter = new TBlockTimeFilter(arg);

    return new TFilterConfigurator(this.definedFilters, blockFilter);
  }

  /**
   * Allows to construct filter triggering when one of specified mutable properties of given account will change.
   * @param name name of observed account
   * @param property watched property
   */
  public onAccountPropertyChange(name: TAccountName, /*property*/_: TAccountMutableProperty): IConstructibleFilterConfigurator {
    /// TODO instantiate actual filter
    let accountFilter: AFilter = new TBlockProducerFilter(name);
    return new TFilterConfigurator(this.definedFilters, accountFilter);
  }

  /**
   * Constructs a filter to watch blockchain until it accepts the transaction identified by given id.
   * @param id observed transaction id.
   * 
   */
  public onTransaction(id: TTransactionId): IConstructibleFilterConfigurator {
    /// TODO instantiate actual filter
    let txFilter: AFilter = new TBlockNumFilter(id.length);
    return new TFilterConfigurator(this.definedFilters, txFilter);
  }

  public onOperation<T extends TOperationType, TPattern = Partial<T>>(/*first*/_?: TAccountName|TPattern, /*pattern*/_1?: TPattern): IConstructibleFilterConfigurator {
    /// TODO instantiate actual filter
    let opFilter: AFilter = new TBlockNumFilter(0);
    return new TFilterConfigurator(this.definedFilters, opFilter);
  }
};

class TFilterConfigurator extends AFilterConfigurator implements IConstructibleFilterConfigurator {

  public constructor(filters: AFilter[], newFilter: AFilter) {
    super(filters);
    this.definedFilters.push(newFilter);
  }

  public or(): AFilterConfigurator {
    const filter: AFilter = new TLogicalOrFilter(this.definedFilters);
    return new TFilterConfigurator(this.definedFilters, filter);
  }

  public and(): AFilterConfigurator {
    const filter: AFilter = new TLogicalAndFilter(this.definedFilters);
    return new TFilterConfigurator(this.definedFilters, filter);
  }

  public construct(): [IFilter, TReferencedDataCollectors] {

    let finalDataCollectorSet: TReferencedDataCollectors = new Set();

    for(const filter of this.definedFilters) {
      const requestedCollectors = filter.referencedCollectors();
      /// TODO replace with union
      for(const c of requestedCollectors)
        finalDataCollectorSet.add(c);
    }

    if(this.definedFilters.length > 1) {
      /// If filters have not been reduced explicitly, do it here
      const finalFilter: AFilter = new TLogicalAndFilter(this.definedFilters);
      return [finalFilter, finalDataCollectorSet];
    }
    else {
      return [this.definedFilters[0], finalDataCollectorSet];
    }
  }
};


class TFilterFactory extends AFilterConfigurator implements IFilterFactory {
  public constructor() {
    super([]);
  }
};

export const createFilterFactory = (): IFilterFactory => {
  return new TFilterFactory();
};
