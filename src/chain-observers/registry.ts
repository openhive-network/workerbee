import { type WorkerBee } from "../bot";
import { WorkerBeeError } from "../errors";
import { type IBlockData } from "../interfaces";
import { type CollectorsOptions, ListenerType, ProvidersMediator } from "./providers-mediator";

export class ObserversRegistry {
  private mediator = new ProvidersMediator();

  private constructor(
    private readonly worker: WorkerBee
  ) {
    this.worker.on("block", (blockData: IBlockData) => {
      this.block = blockData;
      this.notify();
    });
  }

  private block!: IBlockData;

  public get cachedBlock(): IBlockData {
    return this.block;
  }


  public registerListener(listener: ListenerType, options: CollectorsOptions = {} as CollectorsOptions) {
    this.mediator.registerListener(listener, options);
  }

  public unregisterListener(listener: ListenerType) {
    this.mediator.unregisterListener(listener);
  }

  private notify () {
    this.mediator.notify();
  }

  private static instance: ObserversRegistry;

  public get chain(): Exclude<WorkerBee["chain"], undefined> {
    return this.worker.chain!;
  }

  public static getInstance(): ObserversRegistry {
    if (this.instance === undefined)
      throw new WorkerBeeError("ObserversRegistry is not initialized");

    return ObserversRegistry.instance;
  }

  public static initialize(
    workerbee: WorkerBee
  ) {
    if(this.instance !== undefined)
      return;

    this.instance = new ObserversRegistry(workerbee);
  }
}
