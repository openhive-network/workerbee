import EventEmitter from "events";
import { AutoBeeError } from "./errors";
import { IAutoBee } from "./interfaces";

export enum EBotStatus {
  STALE = 0,
  WAIT_STOP = 1,
  STOPPED = 2,
  RUNNING = 3
}

export interface IStartConfiguration {
  /**
   * Posting private key in WIF format
   *
   * @type {string}
   */
  postingKey: string;
}

export class AutoBee extends EventEmitter implements IAutoBee {
  public status: EBotStatus = EBotStatus.STALE;

  private runLoop!: Promise<void>;

  // @ts-expect-error Configuration is not used yet
  private configuration!: IStartConfiguration;

  public constructor() {
    super();
  }

  public async start(configuration?: IStartConfiguration): Promise<void> {
    if(this.status !== EBotStatus.STALE)
      throw new AutoBeeError("Bot is already configured. If you intend on resuming the automation call AutoBee#resume");

    if(typeof configuration === "undefined")
      return this.resume();

    this.configuration = configuration;
    this.status = EBotStatus.STOPPED;

    await this.resume();
  }

  public resume(): void {
    if(this.status !== EBotStatus.STOPPED)
      throw new AutoBeeError("Bot is not configured and stopped. If you intend on starting the automation call AutoBee#start");

    super.emit("start");
    this.status = EBotStatus.RUNNING;

    this.runLoop = new Promise<void>(res => {
      setTimeout(res, 2000);
    }).catch(error => {
      super.emit("error", error);
    })
      .finally(() => { this.status = EBotStatus.STOPPED; });
  }

  public async stop(): Promise<void> {
    if(this.status !== EBotStatus.RUNNING)
      throw new AutoBeeError("Bot is not running. Nothing to stop");

    this.status = EBotStatus.WAIT_STOP;

    await this.runLoop;
    super.emit("stop");

    this.status = EBotStatus.STOPPED;
  }
}
