import type { ApiAccount, ApiTransaction, GetDynamicGlobalPropertiesResponse, RcAccount } from "@hiveio/wax";
import type { WorkerBee } from "../bot";
import type { IBlockData, IOperationData, ITransactionDataBase } from "../interfaces";

const chunkArray = <T>(array: Array<T>, chunkSize: number): Array<Array<T>> => {
  const numberOfChunks = Math.ceil(array.length / chunkSize)

  return [...Array(numberOfChunks)].map((_value, index) => {
    return array.slice(index * chunkSize, (index + 1) * chunkSize)
  });
};

const CHAIN_MAX_ACCOUNTS_PARSE = 100;
export class WorkerBeeRegister {
  public cachedAccounts = new Map<string, ApiAccount>();
  public cachedRcAccounts = new Map<string, RcAccount>();
  public cachedDgpo!: GetDynamicGlobalPropertiesResponse;
  public cachedBlock!: IBlockData;
  public cachedTransactions!: ITransactionDataBase[];
  public cachedImpactedAccountTransactions: Record<string, ITransactionDataBase[]> = {};
  public cachedImpactedAccountOperations: Record<string, IOperationData[]> = {};

  public accounts: Record<string, { listenersCount: number }> = {};
  public rcAccounts: Record<string, { listenersCount: number }> = {};

  public listeners: Array<() => void> = [];

  public constructor(
    public readonly worker: WorkerBee
  ) {
    // TODO: Handle the case when not all of the listeners ended work, but cached data changed
    this.worker.on("block", (blockData: IBlockData) => {
      this.cachedBlock = blockData;

      this.cachedTransactions = blockData.block.transactions.map((transaction: ApiTransaction, index: number) => ({
        id: blockData.block.transaction_ids[index],
        transaction
      }));

      Promise.allSettled([
        this.parseDgpo().catch(error => { this.worker.emit("error", error); }),
        this.parseAccounts().catch(error => { this.worker.emit("error", error); }),
        this.parseRcAccounts().catch(error => { this.worker.emit("error", error); }),
        /* eslint-disable-next-line require-await */ // We want to analyze the transactions in parallel to network calls
        (async () => {
          this.cachedImpactedAccountTransactions = {};
          this.cachedImpactedAccountOperations = {};

          for(const transaction of this.cachedTransactions) {
            const impactedAccounts = new Set<string>();

            for(const operation of transaction.transaction.operations) {
              const impactedOperationAccounts = this.worker.chain!.operationGetImpactedAccounts(operation);

              for(const account of impactedOperationAccounts) {
                impactedAccounts.add(account);

                if (!this.cachedImpactedAccountOperations[account])
                  this.cachedImpactedAccountOperations[account] = [];

                this.cachedImpactedAccountOperations[account].push({
                  transaction,
                  operation
                });
              }

              for(const account of impactedAccounts) {
                if (!this.cachedImpactedAccountTransactions[account])
                  this.cachedImpactedAccountTransactions[account] = [];

                this.cachedImpactedAccountTransactions[account].push(transaction);
              }
            }
          }
        })
      ]).then(() => {
        this.listeners.forEach(listener => listener());
      })
    });
  }

  public registerListener(listener: () => void, options: TDataProviderOptions): void {
    if("account" in options)
      this.accounts[options.account] = { listenersCount: this.accounts[options.account]?.listenersCount + 1 || 1 };
    if("rcAccount" in options)
      this.rcAccounts[options.rcAccount] = { listenersCount: this.rcAccounts[options.rcAccount]?.listenersCount + 1 || 1 };

    this.listeners.push(listener);
  }

  public unregisterListener(listener: () => void, options: TDataProviderOptions): void {
    if("account" in options)
      if (this.accounts[options.account]?.listenersCount === 1)
        delete this.accounts[options.account];
      else
        this.accounts[options.account] = { listenersCount: this.accounts[options.account].listenersCount - 1 };

    if("rcAccount" in options)
      if (this.rcAccounts[options.rcAccount]?.listenersCount === 1)
        delete this.rcAccounts[options.rcAccount];
      else
        this.rcAccounts[options.rcAccount] = { listenersCount: this.rcAccounts[options.rcAccount].listenersCount - 1 };

    const index = this.listeners.findIndex(listener);

    this.listeners.splice(index, 1);
  }

  private async parseDgpo(): Promise<void> {
    this.cachedDgpo = await this.worker.chain!.api.database_api.get_dynamic_global_properties({});
  }

  private async parseAccounts(): Promise<void> {
    const accounts = Object.keys(this.accounts);

    if (accounts.length === 0)
      return;

    for(const chunk of chunkArray(accounts, CHAIN_MAX_ACCOUNTS_PARSE)) {
      const { accounts } = await this.worker.chain!.api.database_api.find_accounts({ accounts: chunk });

      for(const account of accounts)
        this.cachedAccounts[account.name] = account;
    }
  }

  private async parseRcAccounts(): Promise<void> {
    const accounts = Object.keys(this.rcAccounts);

    if (accounts.length === 0)
      return;

    for(const chunk of chunkArray(accounts, CHAIN_MAX_ACCOUNTS_PARSE)) {
      const { rc_accounts } = await this.worker.chain!.api.rc_api.find_rc_accounts({ accounts: chunk });

      for(const account of rc_accounts)
        this.cachedRcAccounts[account.account] = account;
    }
  }
}

export interface IDataProviderOptionsBase {}

export interface IDataProviderOptionsForAccount extends IDataProviderOptionsBase {
  /**
   * Provide the account name if you want to subscribe to one specific account
   * and filter out any transaction and operation that is not connected to the provided account
   */
  account: string;
}
export interface IDataProviderOptionsForRcAccount extends IDataProviderOptionsBase {
  /**
   * Provide the account name if you want to subscribe to one specific account
   * and filter out anything that is not connected to the provided resource credits account
   */
  rcAccount: string;
}

export interface IDataProviderBase {
  block: IBlockData;
  transactions: ITransactionDataBase[];
}

export interface IDataProviderForAccount extends IDataProviderBase {
  account: ApiAccount;
  impactedTransactions: ITransactionDataBase[];
  impactedOperations: IOperationData[];
}

export interface IDataProviderForRcAccount extends IDataProviderBase {
  rcAccount: RcAccount;
}

export type TDataProviderOptions = IDataProviderOptionsBase | IDataProviderOptionsForRcAccount | IDataProviderOptionsForAccount;

export type TDataProviderForOptions<T> = T extends IDataProviderOptionsForAccount ? (
  T extends IDataProviderForRcAccount ? (IDataProviderForAccount & IDataProviderForRcAccount) : IDataProviderForAccount
) : (T extends IDataProviderForRcAccount ? IDataProviderForRcAccount : IDataProviderBase);

export class DataProvider implements IDataProviderBase, IDataProviderForAccount, IDataProviderForRcAccount {
  private constructor (
    private readonly register: WorkerBeeRegister,
    private readonly options: IDataProviderOptionsBase & IDataProviderOptionsForAccount & IDataProviderForRcAccount
  ) {}

  public get block(): IBlockData {
    return this.register.cachedBlock;
  }

  public get transactions(): ITransactionDataBase[] {
    return this.register.cachedTransactions;
  }

  public get account(): ApiAccount {
    return this.register.cachedAccounts.get(this.options.account)!;
  }

  public get rcAccount(): RcAccount {
    return this.register.cachedRcAccounts.get(this.options.account)!;
  }

  public get impactedTransactions(): ITransactionDataBase[] {
    return this.register.cachedImpactedAccountTransactions[this.options.account] || [];
  }

  public get impactedOperations(): IOperationData[] {
    return this.register.cachedImpactedAccountOperations[this.options.account] || [];
  }

  public static for<T extends object>(register: WorkerBeeRegister, options: T): TDataProviderForOptions<T> {
    return new DataProvider(register, options as any) as unknown as TDataProviderForOptions<T>;
  }
}
