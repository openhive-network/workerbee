/**
 * @internal
 */
export class WorkerBeeError extends Error {
  public readonly originator?: Error | any;

  public constructor(message: string, originator?: Error | any) {
    super(message);
    this.originator = originator;
  }
}

export class BlockNotAvailableError extends WorkerBeeError {
  public readonly blockNumber: number;

  public constructor(blockNumber: number) {
    super(`Block ${blockNumber} is not available`);
    this.blockNumber = blockNumber;
  }
}

export class WorkerBeeUnsatisfiedFilterError extends WorkerBeeError {
  public constructor() {
    super("Unsatisfied filter");
  }
}
