import type { WorkerBee } from "../../bot";
import { AccountClassifier } from "../classifiers";
import { IAccountBalance } from "../classifiers/account-classifier";
import type { TRegisterEvaluationContext } from "../classifiers/collector-classifier-base";
import type { DataEvaluationContext } from "../factories/data-evaluation-context";
import { FilterBase } from "./filter-base";

export class BalanceChangeFilter extends FilterBase {
  public constructor(
    worker: WorkerBee,
    private readonly account: string,
    private readonly includeInternalTransfers: boolean = false
  ) {
    super(worker);
  }

  public usedContexts(): Array<TRegisterEvaluationContext> {
    return [
      AccountClassifier.forOptions({
        account: this.account
      })
    ];
  }

  private previousBalance?: IAccountBalance;

  private parseInternalTransfers(balance: IAccountBalance): boolean {
    for(const asset in this.previousBalance)
      for(const type in this.previousBalance[asset])
        if (this.previousBalance[asset][type].amount !== balance[asset][type].amount) {
          this.previousBalance = balance;

          return true;
        }


    this.previousBalance = balance;

    return false;
  }

  public async match(data: DataEvaluationContext): Promise<boolean> {
    const { accounts } = await data.get(AccountClassifier);

    const account = accounts[this.account];

    if (this.previousBalance === undefined) {
      this.previousBalance = account.balance;

      return false;
    }

    if (this.includeInternalTransfers)
      return this.parseInternalTransfers(account.balance);

    const changedHP = this.previousBalance.HP.total.amount !== account.balance.HP.total.amount;
    const changedHIVE = this.previousBalance.HIVE.total.amount !== account.balance.HIVE.total.amount;
    const changedHBD = this.previousBalance.HBD.total.amount !== account.balance.HBD.total.amount;

    this.previousBalance = account.balance;

    return changedHP || changedHIVE || changedHBD;
  }
}
