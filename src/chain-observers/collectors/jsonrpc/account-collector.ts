import Long from "long";
import { AccountClassifier } from "../../classifiers";
import { IAccount } from "../../classifiers/account-classifier";
import { DataEvaluationContext } from "../../factories/data-evaluation-context";
import { CollectorBase, TAvailableClassifiers } from "../collector-base";

export interface IAccountCollectorOptions {
  account: string;
}

const MAX_ACCOUNT_GET_LIMIT = 1000;

export class AccountCollector extends CollectorBase {
  private readonly accounts: Record<string, number> = {};

  protected pushOptions(data: IAccountCollectorOptions): void {
    this.accounts[data.account] = (this.accounts[data.account] || 0) + 1;
  }

  protected popOptions(data: IAccountCollectorOptions): void {
    this.accounts[data.account] = (this.accounts[data.account] || 1) - 1;

    if (this.accounts[data.account] === 0)
      delete this.accounts[data.account];
  }

  public async get(data: DataEvaluationContext) {
    const accounts: Record<string, IAccount> = {};

    const tryParseJson = (jsonData: string) => {
      try {
        return JSON.parse(jsonData);
      } catch {
        return {};
      }
    }

    const accountNames = Object.keys(this.accounts);
    for (let i = 0; i < accountNames.length; i += MAX_ACCOUNT_GET_LIMIT) {
      const chunk = accountNames.slice(i, i + MAX_ACCOUNT_GET_LIMIT);

      const startFindAccounts = Date.now();
      const { accounts: apiAccounts } = await this.worker.chain!.api.database_api.find_accounts({ accounts: chunk });
      data.addTiming("database_api.find_accounts", Date.now() - startFindAccounts);

      const startAccountsAnalysis = Date.now();

      for(const account of apiAccounts) {
        let governanceVoteExpiration: Date | undefined = new Date(`${account.governance_vote_expiration_ts}Z`);

        if (governanceVoteExpiration.getTime() <= 0) // Null time
          governanceVoteExpiration = undefined;

        accounts[account.name] = {
          name: account.name,
          upvoteManabar: {
            currentMana: Long.fromValue(account.voting_manabar.current_mana),
            max: Long.fromValue(account.post_voting_power.amount),
            lastUpdateTime: new Date(account.voting_manabar.last_update_time * 1000)
          },
          downvoteManabar: {
            currentMana: Long.fromValue(account.downvote_manabar.current_mana),
            lastUpdateTime: new Date(account.downvote_manabar.last_update_time * 1000)
          },
          recoveryAccount: account.recovery_account,
          governanceVoteExpiration,
          postingJsonMetadata: tryParseJson(account.posting_json_metadata),
          jsonMetadata: tryParseJson(account.json_metadata),
          balance: {
            HBD: {
              liquid: account.hbd_balance,
              unclaimed: account.reward_hbd_balance,
              total: {
                amount: ( BigInt(account.hbd_balance.amount)
                        + BigInt(account.reward_hbd_balance.amount)
                ).toString(),
                precision: account.hbd_balance.precision,
                nai: account.hbd_balance.nai
              },
              savings: account.savings_hbd_balance
            },
            HIVE: {
              liquid: account.balance,
              unclaimed: account.reward_hive_balance,
              total: {
                amount: ( BigInt(account.balance.amount)
                        + BigInt(account.reward_hive_balance.amount)
                        + BigInt(account.savings_balance.amount)
                ).toString(),
                precision: account.balance.precision,
                nai: account.balance.nai
              },
              savings: account.savings_balance
            },
            HP: {
              liquid: account.vesting_shares,
              unclaimed: account.reward_vesting_balance,
              total: {
                amount: ( BigInt(account.vesting_shares.amount)
                        + BigInt(account.reward_vesting_balance.amount)
                        + BigInt(account.delegated_vesting_shares.amount)
                        + BigInt(account.received_vesting_shares.amount)
                        + BigInt(account.vesting_withdraw_rate.amount)
                ).toString(),
                precision: account.vesting_shares.precision,
                nai: account.vesting_shares.nai
              },
              delegated: account.delegated_vesting_shares,
              received: account.received_vesting_shares,
              poweringDown: account.vesting_withdraw_rate
            }
          }
        };
      }

      data.addTiming("accountsAnalysis", Date.now() - startAccountsAnalysis);
    }

    return {
      [AccountClassifier.name]: {
        accounts
      } as TAvailableClassifiers["AccountClassifier"]
    } satisfies Partial<TAvailableClassifiers>;
  };
}
