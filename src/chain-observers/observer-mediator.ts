import { type Observer } from "../types/subscribable";
import { DataEvaluationContext } from "./factories/data-evaluation-context";
import { EClassifierOrigin, type FactoryBase } from "./factories/factory-base";
import { FilterBase } from "./filters/filter-base";
import { ProviderBase } from "./providers/provider-base";

export type ListenerType = (data: DataEvaluationContext) => void;

export class ObserverMediator {
  public constructor(
    private readonly factory: FactoryBase
  ) {}

  private filters = new Map<Partial<Observer<any>>, { filter: FilterBase; providers: Iterable<ProviderBase>; }>();

  public get timings () {
    return this.factory.getTimings();
  }

  /**
   * Extend the current mediator with another one, merging filters, providers and factory collectors.
   * See {@link FactoryBase.extend} for more details.
   */
  public extend(other: ObserverMediator) {
    for(const [listener, { filter, providers }] of other.filters.entries())
      this.registerListener(listener, filter, providers);

    this.factory.extend(other.factory);
  }

  public async notify() {
    try {
      const context = this.factory.collect();

      const shouldContinue = await this.factory.preNotify(context, this);

      if (!shouldContinue)
        return;

      const startFilter = Date.now();

      // Start providing parsed, cached data to filters
      for(const [listener, { filter, providers }] of this.filters.entries())
        filter.match(context).then(async(matched) => {
          this.factory.addTiming("filters", Date.now() - startFilter);

          if(!matched)
            return;

          const startProvider = Date.now();

          // Join all providers data for user (1 level nested)
          const providedData = {};

          // Launch all providers in parallel
          const allDataToProvide: Promise<any>[] = [];
          for(const provider of providers)
            allDataToProvide.push(provider.provide(context));

          const allDataResolved = await Promise.all(allDataToProvide);

          // Wait for all providers to finish and merge their results
          for(const providerResult of allDataResolved)
            for(const key in providerResult)
              if (providerResult[key] !== undefined)
                providedData[key] = providerResult[key];


          this.factory.addTiming("providers", Date.now() - startProvider);

          await (listener.next?.(providedData) as Promise<any> | any);
        }).catch(error => listener.error?.(error));

      await this.factory.postNotify(context, this);
    } catch (error) {
      // If any preNotify or postNotify error happens, we should notify all listeners
      for(const listener of this.filters.keys())
        listener.error?.(error);
    }
  }

  public registerListener(listener: Partial<Observer<any>>, filter: FilterBase, providers: Iterable<ProviderBase>) {
    this.filters.set(listener, { filter, providers });

    for(const classifier of filter.usedContexts())
      this.factory.pushClassifier(classifier, EClassifierOrigin.FILTER);

    for(const classifier of providers)
      for(const usedContext of classifier.usedContexts())
        this.factory.pushClassifier(usedContext, EClassifierOrigin.PROVIDER);
  }

  public unregisterListener(listener: Partial<Observer<any>>) {
    const filter = this.filters.get(listener);
    if (!filter)
      return;

    for(const classifier of filter.filter.usedContexts())
      this.factory.popClassifier(classifier, EClassifierOrigin.FILTER);

    for(const classifier of filter.providers)
      for(const usedContext of classifier.usedContexts())
        this.factory.popClassifier(usedContext, EClassifierOrigin.PROVIDER);

    this.filters.delete(listener);

    listener.complete?.();
  }

  public unregisterAllListeners() {
    for(const listener of this.filters.keys())
      this.unregisterListener(listener);
  }
}
