import { transaction } from "@hiveio/wax";
import { BlockClassifier } from "../classifiers";
import { TRegisterEvaluationContext } from "../classifiers/collector-classifier-base";
import { DataEvaluationContext } from "../factories/data-evaluation-context";
import { ProviderBase } from "./provider-base";

export type TTransactionProvider<TIdOfTx extends Array<string>> = {
  [K in TIdOfTx[number]]: transaction;
};

export interface IAccountProviderData<TIdOfTx extends Array<string>> {
  transactions: Partial<TTransactionProvider<TIdOfTx>>;
};

export class TransactionByIdProvider<TIdOfTx extends Array<string> = Array<string>> extends ProviderBase {
  public constructor(
    private readonly transactionIds: TIdOfTx
  ) {
    super();
  }

  public usedContexts(): Array<TRegisterEvaluationContext> {
    return [
      BlockClassifier
    ];
  }

  public async provide(data: DataEvaluationContext): Promise<IAccountProviderData<TIdOfTx>> {
    const result = {
      transactions: {}
    };

    const block = await data.get(BlockClassifier);
    for(const txId of this.transactionIds)
      if (block.transactionsPerId.has(txId))
        result.transactions[txId] = block.transactionsPerId.get(txId);

    return result as IAccountProviderData<TIdOfTx>;
  }
}
