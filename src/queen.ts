import type { ApiAccount, operation } from "@hiveio/wax";
import type { Subscribable, Observer, Unsubscribable } from "rxjs";

import { WorkerBeeError } from "./errors";
import type { IBlockData, ITransactionData, IOperationData, IWorkerBee } from "./interfaces";

export class QueenBee {
  public constructor(
    private readonly worker: IWorkerBee
  ) {}

  public block(idOrNumber: string | number): Subscribable<IBlockData> {
    return {
      subscribe: (observer: Partial<Observer<IBlockData>>): Unsubscribable => {
        const complete = (): void => {
          try {
            observer.complete?.();
          } catch (error) {
            observer.error?.(error);
          } finally {
            this.worker.off("block", listener);
          }
        };

        const listener = (blockData: IBlockData): void => {
          const confirm = (): void => {
            try {
              observer.next?.(blockData);
            } catch (error) {
              observer.error?.(error);
            } finally {
              complete();
            }
          };

          if(typeof idOrNumber === "string") {
            if(idOrNumber === blockData.block.block_id)
              confirm();
          } else if(idOrNumber === blockData.number)
            confirm();
        };
        this.worker.on("block", listener);

        return {
          unsubscribe: (): void => {
            complete();
          }
        };
      }
    };
  }

  public transaction(txId: string, expireIn?: number): Subscribable<ITransactionData> {
    return {
      subscribe: (observer: Partial<Observer<ITransactionData>>): Unsubscribable => {
        let timeoutId: undefined | NodeJS.Timeout = undefined;

        const complete = (): void => {
          try {
            observer.complete?.();
          } catch (error) {
            observer.error?.(error);
          } finally {
            this.worker.off("transaction", listener);
            clearTimeout(timeoutId);
          }
        };

        const listener = (transactionData: ITransactionData): void => {
          const confirm = (): void => {
            try {
              observer.next?.(transactionData);
            } catch (error) {
              observer.error?.(error);
            } finally {
              complete();
            }
          };

          if(txId === transactionData.id)
            confirm();
        };
        this.worker.on("transaction", listener);

        if(typeof expireIn === "number")
          timeoutId = setTimeout(() => {
            try {
              observer.error?.(new WorkerBeeError("Transaction expired"));
            } catch (error) {
              observer.error?.(error);
            } finally {
              complete();
            }
          }, expireIn);

        return {
          unsubscribe: (): void => {
            complete();
          }
        };
      }
    };
  }

  public accountOperations(name: string): Subscribable<IOperationData> {
    return {
      subscribe: (observer: Partial<Observer<IOperationData>>): Unsubscribable => {
        const complete = (): void => {
          try {
            observer.complete?.();
          } catch (error) {
            observer.error?.(error);
          } finally {
            this.worker.off("transaction", listener);
          }
        };

        const listener = (transactionData: ITransactionData): void => {
          const confirm = (result: operation): void => {
            try {
              observer.next?.({ op: result, transaction: transactionData });
            } catch (error) {
              observer.error?.(error);
            }
          };

          const proto = this.worker.chain!.createTransactionFromJson(transactionData.transaction).transaction;

          for(const op of proto.operations)
            if(this.worker.chain!.operationGetImpactedAccounts(op).has(name))
              confirm(op);
        };
        this.worker.on("transaction", listener);

        return {
          unsubscribe: (): void => {
            complete();
          }
        };
      }
    };
  }

  public accountFullManabar(name: string): Subscribable<ApiAccount> {
    return {
      subscribe: (observer: Partial<Observer<ApiAccount>>): Unsubscribable => {
        const listener = async(): Promise<void> => {
          try {
            const { accounts: [ account ] } = await this.worker.chain!.api.database_api.find_accounts({
              accounts: [ name ]
            });
            const dgpo = await this.worker.chain!.api.database_api.get_dynamic_global_properties({});

            const { percent } = this.worker.chain!.calculateCurrentManabarValue(
              Math.round(new Date(`${dgpo.time}Z`).getTime() / 1000), // Convert API time to seconds
              account.post_voting_power.amount,
              account.voting_manabar.current_mana,
              account.voting_manabar.last_update_time
            );

            if(percent >= 98)
              observer.next?.(account);
          } catch (error) {
            observer.error?.(error);
          }
        };
        this.worker.on("block", listener);

        const complete = (): void => {
          try {
            observer.complete?.();
          } catch (error) {
            observer.error?.(error);
          } finally {
            this.worker.off("block", listener);
          }
        };

        return {
          unsubscribe: (): void => {
            complete();
          }
        };
      }
    };
  }
}
