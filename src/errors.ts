/**
 * @internal
 */
export class WorkerBeeError extends Error {
  public constructor(message: string, public readonly originator?: Error | any) {
    super(message);
  }
}

export class WorkerBeeUnsatisfiedFilterError extends WorkerBeeError {
  public constructor() {
    super("Unsatisfied filter");
  }
}
