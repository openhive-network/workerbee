import WorkerBee from "@hiveio/workerbee";
import type { IWorkerBee, Observer } from "@hiveio/workerbee";
import {ITransaction, IOnlineSignatureProvider, IHiveChainInterface, FollowOperation, TAccountName} from "@hiveio/wax";
import BeekeeperProvider from "@hiveio/wax-signers-beekeeper";
import Beekeeper from "@hiveio/beekeeper";

enum TActionState {
  /// Indicates that the action is started and pending
  PENDING,
  /// Indicates that the action was processed (i.e. by L1 chain layer), but potentially not yet completed
  PROCESSED,
  /// Indicates that the action was processed and completed (i.e. by L2 chain layer)
  COMPLETED,
  /// Indicates that the action was rejected L1 chain layer
  REJECTED,
  /// Indicates that the action didn't change expected state in specified time (i.e. L2 chain layer didn't complete it)
  TIMEOUT
};

interface IApplicationMutableProperty<T> {
  value(): T;

  /**
   * Indicates whether the action is still pending or has been completed.
   * @returns {TActionState} The current state of the action, COMPLETED value means action is settled on the backend side.
   */
  isSettled(): TActionState;
};

interface IAccountListEntry {
  readonly account: IApplicationMutableProperty<TAccountName>;
};

interface IFollowListEntry extends IAccountListEntry {
  readonly isFollowedBlog: IApplicationMutableProperty<boolean>;
  readonly isMuted: IApplicationMutableProperty<boolean>;
};

interface IApplicationMutableList<T> {
  /**
   * Returns the number of entries in the list. Not settled, means that some upcoming change is processing.
   */
  count(): IApplicationMutableProperty<number>;
  entries(): Iterable<T>;
};

/**
 * Represents the application state of the follow list specific to given account
 */
interface IFollowListState extends IApplicationMutableList<IFollowListEntry> {
};

interface IBlacklistedUserListState extends IApplicationMutableList<IAccountListEntry> {
};

interface IMutedUserListState extends IApplicationMutableList<IAccountListEntry> {
};

class ChainDeferredActions {
  public constructor(private readonly bot: IWorkerBee) {
  }

  public async followBlog(signatureProvider: IOnlineSignatureProvider, workingAccount: TAccountName, blog: TAccountName, observer: Partial<Observer<IFollowListState>>): Promise<void> {
    const tx = await this.bot.chain.createTransaction();
    tx.pushOperation(new FollowOperation().followBlog(workingAccount, blog));
    await tx.sign(signatureProvider);

    let checksCount = 2;

    /// todo missing implementation
    const followList: IFollowListState = {} as IFollowListState;

    const internalObserver: Partial<Observer<TActionState>> = {
      next: (state: TActionState) => {
        /// todo update followList state object
        observer.next?.(followList);
      },
      error: (err: Error) => {
        observer.error?.(err);
      }
    };


    await this.deferredActionStateIndicator(tx, internalObserver, async (): Promise<boolean> => {
      /// todo: call the follow_api here to check if the follow was successful
      /// now emulate some delay in L2 processing layer
      return --checksCount === 0;
    })
  }

  private async deferredActionStateIndicator(tx: ITransaction, observer: Partial<Observer<TActionState>>, l2Acceptor?: () => Promise<boolean>): Promise<void> {
    observer.next(TActionState.PENDING);

    let blockMargin = 3;

    return new Promise<void>((resolve, reject) => {
      const onL1Accept = () => {
        observer.next(TActionState.PROCESSED);

        if( l2Acceptor === undefined) {
          observer.next(TActionState.COMPLETED);
          resolve();
          return;
        } 

        /// can be replaced with timeout, but it does not matter
        const listener = this.bot.observe.onBlock().subscribe({
            next(blockData) {
              l2Acceptor()
              .then((result) => {
                if (result) {
                  listener.unsubscribe();
                  observer.next(TActionState.COMPLETED);
                  resolve();
                } else {
                  if(--blockMargin == 0) {
                    listener.unsubscribe();
                    observer.next(TActionState.TIMEOUT);
                    reject(new Error(`Block: ${blockData.block.number} L2 layer didn't complete action in expected time`));
                  }
                }
              })
            .catch((err) => {
              observer.error(err);
              reject(err);
            });
          },
          error(val) {
            listener.unsubscribe();
            reject(val);
          }
        });

      };
      
      this.bot.broadcast(tx)
        .then(onL1Accept)
        .catch((err) => {
          observer.next(TActionState.REJECTED);
          reject(err);
        });
      });
  };


};

const log = (message: string): void => {
  const date = new Date();
  const formattedDate = date.toISOString();
  console.log(`[${formattedDate}] ${message}`);
};

const beekeepperInstance = await Beekeeper();

const walletName = 'myWallet';
const walletPassword = 'myPassword';

const workingAccount = 'small.minion';
const mysecretkey = '5J...'; // Replace with your actual secret key
const blogAccount = 'medium.minion';

const session = beekeepperInstance.createSession('xxx');
const unlockedWallet = session.hasWallet('myWallet') ? session.openWallet(walletName).unlock(walletPassword) : (await session.createWallet(walletName, walletPassword, false)).wallet;

await unlockedWallet.importKey(mysecretkey);

const bot = new WorkerBee();
await bot.start();

const signatureProvider: IOnlineSignatureProvider = await BeekeeperProvider.for(unlockedWallet, workingAccount, 'posting', bot.chain);

const optimisticUI = new ChainDeferredActions(bot);

const follow = await optimisticUI.followBlog(signatureProvider, workingAccount, blogAccount, {
  next: (state: TActionState) => {
    log(`Follow action state: ${TActionState[state]}`);
  },
  error: (err: Error) => {
    log(`Follow action error: ${err.message}`);
  }
});

bot.stop();
bot.delete();
