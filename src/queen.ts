import type { operation } from "@hive-staging/wax";
import type { Subscribable, Observer, Unsubscribable } from "rxjs";

import { AccountOperationVisitor } from "./account_observer";
import type { WorkerBee } from "./bot";
import { WorkerBeeError } from "./errors";
import type { IBlockData, ITransactionData, IOperationData } from "./interfaces";

export class QueenBee {
  public constructor(
    private readonly worker: WorkerBee
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

        const visitor = new AccountOperationVisitor(name);

        const listener = (transactionData: ITransactionData): void => {
          const confirm = (result: operation): void => {
            try {
              observer.next?.({ op: result, transaction: transactionData });
            } catch (error) {
              observer.error?.(error);
            }
          };

          const proto = this.worker.chain!.TransactionBuilder.fromApi(transactionData.transaction).build();

          for(const op of proto.operations) {
            const result = visitor.accept(op);

            if(typeof result === "object")
              confirm(result);
          }
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
}
