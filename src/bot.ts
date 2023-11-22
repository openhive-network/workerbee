import EventEmitter from "events";
import beekeeperFactory, { IBeekeeperInstance, IBeekeeperUnlockedWallet } from "@hive-staging/beekeeper";
import { IHiveChainInterface, IWaxOptionsChain, createHiveChain } from "@hive-staging/wax";

import { IAutoBee } from "./interfaces";

export interface IStartConfiguration {
  /**
   * Posting private key in WIF format
   *
   * @type {string}
   */
  postingKey: string;

  /**
   * Wax chain options
   *
   * @type {?Partial<IWaxOptionsChain>}
   * @default {}
   */
  chainOptions?: Partial<IWaxOptionsChain>;
}

export const DEFAULT_AUTOBEE_OPTIONS = {
  chainOptions: {}
};

export const DEFAULT_BLOCK_INTERVAL_TIMEOUT = 1500;

export class AutoBee extends EventEmitter implements IAutoBee {
  public running: boolean = false;

  public configuration: IStartConfiguration;

  private chain?: IHiveChainInterface;

  private beekeeper?: IBeekeeperInstance;

  private wallet?: IBeekeeperUnlockedWallet;

  private headBlockNumber: number = 0;

  public constructor(
    configuration: IStartConfiguration
  ) {
    super();

    this.configuration = { ...DEFAULT_AUTOBEE_OPTIONS, ...configuration };

    // When halt is requested, indicate we are not going to do the task again
    super.on("halt", () => {
      this.running = false;
    });
  }

  public async start(): Promise<void> {
    // Initialize chain and beekepeer if required
    if(typeof this.chain === "undefined" || typeof this.beekeeper === "undefined" || typeof this.wallet === "undefined") {
      this.chain = await createHiveChain(this.configuration.chainOptions);
      this.beekeeper = await beekeeperFactory();

      const random = Math.random().toString(16)
        .slice(2);

      ({ wallet: this.wallet } = await this.beekeeper.createSession(random).createWallet(random));

      ({ head_block_number: this.headBlockNumber } = await this.chain.api.database_api.get_dynamic_global_properties({}));
    }

    // Ensure the app is not running
    await this.stop();

    // Do the first task and run the app
    this.running = true;
    super.emit("start");

    this.doTask();
  }

  public async doTask(): Promise<void> {
    try {
      // Get the head block, but wait at least DEFAULT_BLOCK_INTERVAL_TIMEOUT ms
      const [ { block } ] = await Promise.all([
        this.chain!.api.block_api.get_block({ block_num: this.headBlockNumber }),
        new Promise(res => { setTimeout(res, DEFAULT_BLOCK_INTERVAL_TIMEOUT); })
      ]);

      if(typeof block === "object") {
        super.emit("block", {
          number: this.headBlockNumber,
          block
        });

        ++this.headBlockNumber;
      } // Else -> no new block
    } catch(error) {
      // Ensure we are emitting the Error instance
      super.emit("error", error instanceof Error ? error : new Error(`Unknown error occurred during automation: ${String(error)}`));

      // Wait before any next operation is performed to reduce spamming the API
      await new Promise(res => { setTimeout(res, DEFAULT_BLOCK_INTERVAL_TIMEOUT); });
    } finally {
      // Do the task if running
      if(this.running)
        this.doTask();
      else // Inform about the application stop otherwise
        super.emit("stop");
    }
  }

  public stop(): Promise<void> {
    return new Promise<void>(res => {
      if(!this.running)
        res();

      // Request application stop
      super.emit("halt");

      // Wait for the stop and resolve
      super.once("stop", res);
    });
  }

  public async delete(): Promise<void> {
    // This function actually allows you to actually reset the bot instance
    await this.stop();

    this.chain?.delete();
    this.wallet?.close();
    await this.beekeeper?.delete();

    this.chain = undefined;
    this.beekeeper = undefined;
    this.wallet = undefined;
  }
}
