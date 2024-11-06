import type { WorkerBee } from "../bot";
import type { ITransactionData, IBlockData, IDgpoData, IRcAccountData, IAccountData } from "../interfaces";
import { ApiAccountEmitter, RcAccountEmitter } from "./emmiters/account";
import { AbstractBaseEmitter, BaseEmitter } from "./emmiters/base";

export interface IWorkerBeeRegisterEvents {
  "block": (blockData: IBlockData) => void;
  "transaction": (transactionData: ITransactionData) => void;
  "dgpo": (dgpoData: IDgpoData) => void;
  "account": (accountData: IAccountData) => void;
  "rc": (rcAccountData: IRcAccountData) => void;
}

export class WorkerBeeRegister {
  private emitters: Record<keyof IWorkerBeeRegisterEvents, AbstractBaseEmitter>;

  public constructor(
    public readonly worker: WorkerBee
  ) {
    this.emitters = {
      block: new BaseEmitter<IBlockData>(this),
      transaction: new BaseEmitter<ITransactionData>(this),
      dgpo: new BaseEmitter<IDgpoData>(this),
      account: new ApiAccountEmitter(this),
      rc: new RcAccountEmitter(this)
    }

    this.worker.on("block", (blockData: IBlockData) => {
      this.emitters["block"].emit(blockData);

      for(let i = 0; i < blockData.block.transaction_ids.length; ++i)
        this.emitters["transaction"].emit({
          id: blockData.block.transaction_ids[i],
          transaction: blockData.block.transactions[i],
          block: blockData
        } satisfies ITransactionData);

      Promise.allSettled([
        this.parseDgpo(blockData).catch(error => { this.worker.emit("error", error); }),
        this.parseAccounts(blockData).catch(error => { this.worker.emit("error", error); }),
        this.parseRcAccounts(blockData).catch(error => { this.worker.emit("error", error); })
      ]).then(() => {
      });
    });
  }

  public on<U extends keyof IWorkerBeeRegisterEvents>(events: U, listener: (arg: IWorkerBeeRegisterEvents[U]) => void, options?: Record<string, any>): void {
    this.emitters[events].registerEvent(listener, options);
  }

  public off<U extends keyof IWorkerBeeRegisterEvents>(event: U, listener: (...args: any[]) => void, options?: Record<string, any>): void {
    this.emitters[event].unregisterEvent(listener, options);
  }

  private async parseDgpo(blockData: IBlockData): Promise<void> {
    const dgpo = await this.worker.chain!.api.database_api.get_dynamic_global_properties({});

    this.emitters["dgpo"].emit({
      block: blockData,
      dgpo
    } satisfies IDgpoData);
  }

  /* eslint-disable-next-line require-await */
  private async parseAccounts(blockData: IBlockData): Promise<void> {
    this.emitters["account"].emit({
      block: blockData
    } satisfies { block: IBlockData });
  }

  /* eslint-disable-next-line require-await */
  private async parseRcAccounts(blockData: IBlockData): Promise<void> {
    this.emitters["rc"].emit({
      block: blockData
    } satisfies { block: IBlockData });
  }
}
