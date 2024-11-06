import { type ApiAccount, type RcAccount } from "@hiveio/wax";
import { AbstractBaseEmitter, type TListener } from "./base";

export interface IAccountEmitterOptions {
  account: string;
}

const chunkArray = <T>(array: Array<T>, chunkSize: number): Array<Array<T>> => {
  const numberOfChunks = Math.ceil(array.length / chunkSize)

  return [...Array(numberOfChunks)].map((_value, index) => {
    return array.slice(index * chunkSize, (index + 1) * chunkSize)
  });
};

const CHAIN_MAX_ACCOUNTS_PARSE = 100;

export abstract class AccountEmitter<CachedAccountT, EmitterData extends object> extends AbstractBaseEmitter {
  protected listeners = new Map<string, Array<TListener<EmitterData>>>();

  protected cachedAccounts: Record<string, CachedAccountT> = {};

  protected abstract parseAccounts(): Promise<void>;

  public emit(partialData: EmitterData): void {
    this.parseAccounts().then(() => {
      for(const [account, listeners] of this.listeners)
        for(const listener of listeners)
          listener({ ...partialData, account: this.cachedAccounts[account] });
    }).catch(error => {
      this.register.worker.emit("error", error);
    });
  }

  private getIndex(listeners: Array<TListener<EmitterData>>, listener: TListener<EmitterData>): number {
    return listeners.findIndex(data => data === listener);
  }

  public registerEvent(listener: TListener<EmitterData>, options: IAccountEmitterOptions): void {
    let listeners = this.listeners.get(options.account);

    if(!listeners)
      this.listeners.set(options.account, listeners = [listener]);

    const existing = this.getIndex(listeners, listener);
    if(existing === -1)
      listeners.push(listener);
  }

  public unregisterEvent(listener: TListener<EmitterData>, options: IAccountEmitterOptions): void {
    const listeners = this.listeners.get(options.account);

    if(!listeners)
      return;

    const existing = this.getIndex(listeners, listener);

    if(existing !== -1)
      if (listeners.length === 1)
        this.listeners.delete(options.account);
      else
        this.listeners.set(options.account, listeners.splice(existing, 1));

  }
}

export class ApiAccountEmitter<EmitterData extends object> extends AccountEmitter<ApiAccount, EmitterData> {
  protected async parseAccounts(): Promise<void> {
    const accounts = Array.from(this.listeners.keys());

    if (accounts.length === 0)
      return;

    for(const chunk of chunkArray(accounts, CHAIN_MAX_ACCOUNTS_PARSE)) {
      const { accounts } = await this.register.worker.chain!.api.database_api.find_accounts({ accounts: chunk });

      for(const account of accounts)
        this.cachedAccounts[account.name] = account;
    }
  }
}

export class RcAccountEmitter<EmitterData extends object> extends AccountEmitter<RcAccount, EmitterData> {
  protected async parseAccounts(): Promise<void> {
    const accounts = Array.from(this.listeners.keys());

    if (accounts.length === 0)
      return;

    for(const chunk of chunkArray(accounts, CHAIN_MAX_ACCOUNTS_PARSE)) {
      const { rc_accounts } = await this.register.worker.chain!.api.rc_api.find_rc_accounts({ accounts: chunk });

      for(const account of rc_accounts)
        this.cachedAccounts[account.account] = account;
    }
  }
}
