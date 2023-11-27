/**
 * @internal
 */
export class WorkerBeeError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "WorkerBeeError";
  }
}
