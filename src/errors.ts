/**
 * @internal
 */
export class WorkerBeeError extends Error {
  public constructor(message: string, public readonly originator?: Error | any) {
    super(message);
    this.name = "WorkerBeeError";
  }
}
