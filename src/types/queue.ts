import { WorkerBeeError } from "../errors";

export interface IOrderedItem<T, K extends Array<any>> {
  key: T;
  value: K;
}

/**
 * A sorted queue that allows enqueuing items and dequeuing them in sorted order.
 * Items are sorted in ascending order, and the queue can be drained until a specified value.
 * If an item is enqueued with a key that is less than the last enqueued key, an error is thrown.
 * If an item is enqueued with the same key, it is added to the existing array of values for that key.
 * Requires items to be comparable (e.g., numbers, Dates)
 */
export class OrderedQueue<K, V> {
  private buf: IOrderedItem<K, V[]>[] = [];
  private head = 0;
  private tail = 0;

  public enqueue(key: K, value: V): void {
    if (this.buf[this.tail] !== undefined) {
      if (this.buf[this.tail].key > key)
        throw new WorkerBeeError("Items must be enqueued in sorted order.");

      if (this.buf[this.tail].key === key)
        this.buf[this.tail].value.push(value);
      else
        this.buf[this.tail++] = {
          key,
          value: [value]
        };
    } else
      this.buf[this.tail++] = {
        key,
        value: [value]
      };

  }

  public *dequeueUntil(maxValue: K): Generator<IOrderedItem<K, V[]>> {
    while (this.head < this.tail && this.buf[this.head] !== undefined && this.buf[this.head].key <= maxValue) {
      const item = this.buf[this.head];
      this.buf[this.head++] = undefined as any;
      if (this.head === this.tail) {
        this.head = this.tail = 0;
        this.buf.length = 0;
      }

      yield item;
    }
  }

  public get size(): number {
    return this.tail - this.head;
  }
}
