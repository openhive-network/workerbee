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
  readonly #iterable: Iterable<T>;

  public constructor (iterable: Iterable<T>) {
    this.#iterable = iterable;
  }

  public [Symbol.iterator](): Iterator<T> {
    return this.#iterable[Symbol.iterator]();
  }

  public values(): Iterable<T> {
    return this;
  }

  public forEach(callbackfn: (value: T) => void): void {
    for(const value of this.#iterable)
      callbackfn(value);
  }
}

export class WorkerBeeArrayIterable<T> extends WorkerBeeIterable<T> {
  readonly #array: Array<T>;

  public constructor (array: Array<T> = []) {
    super(array);
    this.#array = array;
  }

  public push(value: T): void {
    this.#array.push(value);
  }
}
