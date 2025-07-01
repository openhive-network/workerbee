/**
 * @internal
 */
export class WorkerBeeError extends Error {
  public constructor(message: string, public readonly originator?: Error | any) {
    super(message);
  }
}

export class BlockNotAvailableError extends WorkerBeeError {
  public constructor(public readonly blockNumber: number) {
    super(`Block ${blockNumber} is not available`);
  }
}

export class WorkerBeeUnsatisfiedFilterError extends WorkerBeeError {
  public constructor() {
    super("Unsatisfied filter");
  }
}
