/**
 * Container that can be iterated over the elements of the collection.
 *
 * @example
 * ```typescript
 * for (const { transaction } of data.whaleOperations)
 *   console.log(`Got transaction: #${transaction.id}`);
 * ```
 *
 * @example
 * ```typescript
 * data.whaleOperations.forEach(({ transaction }) => console.log(`Got transaction: #${transaction.id}`)));
 * ```
 */
export class WorkerBeeIterable<T> implements Iterable<T> {
  public constructor (private readonly iterable: Iterable<T>) {}

  public [Symbol.iterator](): Iterator<T> {
    return this.iterable[Symbol.iterator]();
  }

  public values(): Iterable<T> {
    return this;
  }

  public forEach(callbackfn: (value: T) => void): void {
    for(const value of this.iterable)
      callbackfn(value);
  }
}
