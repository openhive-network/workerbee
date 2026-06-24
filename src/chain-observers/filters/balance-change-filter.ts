import type { TAccountName } from "@hiveio/wax";
import { AccountClassifier } from "../classifiers";
import type { IAccountBalance } from "../classifiers/account-classifier";
import type { TRegisterEvaluationContext } from "../classifiers/collector-classifier-base";
import type { TFilterEvaluationContext } from "../factories/data-evaluation-context";
import { FilterBase } from "./filter-base";

export class BalanceChangeFilter extends FilterBase {
  private readonly includeInternalTransfers: boolean;

  public constructor(
    accounts: TAccountName[],
    includeInternalTransfers: boolean = false
  ) {
    super();

    this.includeInternalTransfers = includeInternalTransfers;

    this.accounts = new Set(accounts);
  }

  private readonly accounts: Set<TAccountName>;

  public usedContexts(): Array<TRegisterEvaluationContext> {
    const classifiers: Array<TRegisterEvaluationContext> = [];
    for(const account of this.accounts)
      classifiers.push(AccountClassifier.forOptions({
        account
      }));

    return classifiers;
  }

  private previousBalanceByAccount = new Map<TAccountName, IAccountBalance>();

  private parseInternalTransfers(accountName: TAccountName, balance: IAccountBalance): boolean {
    const previousBalance = this.previousBalanceByAccount.get(accountName);
    if (previousBalance === undefined)
      throw new Error("Cannot parse internal transfers before storing a previous balance");

    for(const asset in previousBalance)
      for(const type in previousBalance[asset])
        if (previousBalance[asset][type].amount !== balance[asset][type].amount) {
          this.previousBalanceByAccount.set(accountName, balance);

          return true;
        }


    this.previousBalanceByAccount.set(accountName, balance);

    return false;
  }

  public async match(data: TFilterEvaluationContext): Promise<boolean> {
    const { accounts } = await data.get(AccountClassifier);

    for(const accountName of this.accounts) {
      const account = accounts[accountName];

      if (account === undefined)
        return false;

      const previousBalance = this.previousBalanceByAccount.get(accountName);
      if (previousBalance === undefined) {
        this.previousBalanceByAccount.set(accountName, account.balance);

        continue;
      }

      if (this.includeInternalTransfers) {
        if (this.parseInternalTransfers(accountName, account.balance))
          return true;
        continue;
      }

      const changedHP = previousBalance.HP.total.amount !== account.balance.HP.total.amount;
      const changedHIVE = previousBalance.HIVE.total.amount !== account.balance.HIVE.total.amount;
      const changedHBD = previousBalance.HBD.total.amount !== account.balance.HBD.total.amount;

      this.previousBalanceByAccount.set(accountName, account.balance);

      if (changedHP || changedHIVE || changedHBD)
        return true;
    }

    return false;
  }
}
