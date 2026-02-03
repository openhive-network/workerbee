import Beekeeper from "@hiveio/beekeeper";
import {ITransaction, IOnlineSignatureProvider, FollowOperation, TAccountName} from "@hiveio/wax";
import BeekeeperProvider from "@hiveio/wax-signers-beekeeper";
import WorkerBee from "@hiveio/workerbee";
import type { IWorkerBee, Observer } from "@hiveio/workerbee";
import {
  TActionState,
  IFollowListState
} from "./optimistic-actions-interfaces";

class ChainDeferredActions {
  public constructor(private readonly bot: IWorkerBee) {
  }

  public async followBlog(
    signatureProvider: IOnlineSignatureProvider,
    workingAccount: TAccountName,
    blog: TAccountName,
    observer: Partial<Observer<IFollowListState>>
  ): Promise<void> {
    const tx = await this.bot.chain.createTransaction();
    tx.pushOperation(new FollowOperation().followBlog(workingAccount, blog));
    await tx.sign(signatureProvider);

    let checksCount = 2;

    /// todo missing implementation
    const followList: IFollowListState = {} as IFollowListState;

    const internalObserver: Partial<Observer<TActionState>> = {
      next: (_state: TActionState) => {
        /// todo update followList state object
        observer.next?.(followList);
      },
      error: (err: Error) => {
        observer.error?.(err);
      }
    };


    await this.deferredActionStateIndicator(tx, internalObserver, (): Promise<boolean> => {
      /*
       * TODO: Call the follow_api here to check if the follow was successful.
       * Now emulate some delay in L2 processing layer.
       */
      return Promise.resolve(--checksCount === 0);
    })
  }

  private deferredActionStateIndicator(
    tx: ITransaction,
    observer: Partial<Observer<TActionState>>,
    l2Acceptor?: () => Promise<boolean>
  ): Promise<void> {
    observer.next?.(TActionState.PENDING);

    let blockMargin = 3;

    return new Promise<void>((resolve, reject) => {
      const onL1Accept = () => {
        observer.next?.(TActionState.PROCESSED);

        if( l2Acceptor === undefined) {
          observer.next?.(TActionState.COMPLETED);
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
                  observer.next?.(TActionState.COMPLETED);
                  resolve();
                } else
                  if(--blockMargin == 0) {
                    listener.unsubscribe();
                    observer.next?.(TActionState.TIMEOUT);
                    reject(new Error(`Block: ${blockData.block.number} L2 layer didn't complete action in expected time`));
                  }

              })
              .catch((err) => {
                observer.error?.(err);
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
          observer.next?.(TActionState.REJECTED);
          reject(err);
        });
    });
  };


};

// eslint-disable-next-line no-console
const log = (message: string): void => console.log(`[${new Date().toISOString()}] ${message}`);

const beekeepperInstance = await Beekeeper();

const walletName = "myWallet";
const walletPassword = "myPassword";

const workingAccount = "small.minion";
const mysecretkey = "5J..."; // Replace with your actual secret key
const blogAccount = "medium.minion";

const session = beekeepperInstance.createSession("xxx");
const unlockedWallet = session.hasWallet("myWallet")
  ? session.openWallet(walletName).unlock(walletPassword)
  : (await session.createWallet(walletName, walletPassword, false)).wallet;

await unlockedWallet.importKey(mysecretkey);

const bot = new WorkerBee();
await bot.start();

const signatureProvider: IOnlineSignatureProvider = await BeekeeperProvider.for(unlockedWallet, workingAccount, "posting", bot.chain);

const optimisticUI = new ChainDeferredActions(bot);

await optimisticUI.followBlog(signatureProvider, workingAccount, blogAccount, {
  next: (data: IFollowListState) => {
    log(`Follow action state: ${TActionState[data.isSettled()]}`);
  },
  error: (err: Error) => {
    log(`Follow action error: ${err.message}`);
  }
});

bot.stop();
bot.delete();
