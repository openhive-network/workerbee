/**
 * A high-performance, bucketed queue for aggregating and retrieving values based on numeric keys.
 *
 * This queue groups values into "buckets" of a specified size, allowing efficient batch dequeue operations.
 * It is particularly useful for scenarios where you want to process or flush items in time-based or range-based batches.
 *
 * @template Value The type of values stored in the queue.
 *
 * @example
 * ```ts
 * // Create a queue with 100ms buckets
 * const queue = new BucketAggregateQueue<string>(100);
 * queue.enqueue(105, "foo");
 * queue.enqueue(110, "bar");
 * queue.enqueue(210, "baz");
 *
 * // Dequeue all items with keys <= 200
 * for (const item of queue.dequeueUntil(200)) {
 *   console.log(item); // "foo", "bar"
 * }
 *
 * // Remaining item ("baz") is still in the queue
 * ```
 */
export class BucketAggregateQueue<Value> {
  private buckets: Map<number, Array<Value>> = new Map(); // Key = bucketKey, value = array of any type
  private sortedKeys: number[] = []; // Keeps an always-sorted list of bucket keys

  /**
   * Constructs a new `BucketAggregateQueue`.
   *
   * @param bucketSize The size of each bucket, typically in milliseconds or another numeric unit.
   *                   All keys within the same bucket range are grouped together.
   */
  public constructor(
    private readonly bucketSize: number
  ) {}

  /**
   * Enqueues a value into the queue, grouping it into a bucket determined by the provided key.
   *
   * @param {number} key Numeric key used to determine the bucket. Often a timestamp or sequence number.
   * @param {Value} data The value to enqueue.
   */
  public enqueue(key: number, data: Value): void {
    const bucketKey = Math.floor(key / this.bucketSize) * this.bucketSize;
    let bucket = this.buckets.get(bucketKey);

    if (!bucket) {
      bucket = [];
      // Keep "sortedKeys" in ascending order for fast dequeue
      let pos = -1;
      for (let i = 0; i < this.sortedKeys.length; ++i)
        if (this.sortedKeys[i] > bucketKey) {
          pos = i;
          break;
        }
      if (pos === -1) this.sortedKeys.push(bucketKey);
      else this.sortedKeys.splice(pos, 0, bucketKey);
      this.buckets.set(bucketKey, bucket);
    }
    bucket.push(data);
  }

  /**
   * Dequeues and yields all values whose bucket keys are less than or equal to the specified maximum value.
   *
   * This method efficiently removes and returns all values in buckets up to and including the bucket containing `maxValue`.
   *
   * @param {number} maxValue The maximum bucket key to dequeue (inclusive).
   * @yields Values from all eligible buckets, in the order they were enqueued.
   */
  public *dequeueUntil(maxValue: number): Generator<Value> {
    const results: number[] = [];
    for (const bucketKey of this.sortedKeys) {
      if (bucketKey > maxValue) break;
      results.push(bucketKey);
    }
    // Remove keys
    this.sortedKeys = this.sortedKeys.slice(results.length);

    for (const bucketKey of results) {
      const postSet = this.buckets.get(bucketKey)!;
      this.buckets.delete(bucketKey);
      yield* postSet;
    }
  }

  /**
   * Returns the total number of values currently stored in the queue.
   *
   * @returns The number of enqueued values across all buckets.
   */
  public get size(): number {
    let count = 0;
    for (const posts of this.buckets.values())
      count += posts.length;
    return count;
  }
}
