import type { EBotStatus, IStartConfiguration } from "./bot";

export interface IAutoBee {
  readonly status: EBotStatus;

  /**
   * Starts the automation with given configuration
   *
   * @param configuration Configuration for the automation
   */
  start(configuration: IStartConfiguration): Promise<void>;

  /**
   * Resumes the automation with the previously saved configuration
   */
  start(): Promise<void>;

  /**
   * Request automation stop
   */
  stop(): Promise<void>;

  /**
   * Triggers on any bot start
   *
   * @param event event name
   * @param handler handler to be called on error event
   */
  addListener(event: "start", handler: () => void): this;
  /**
   * Triggers on any bot stop
   *
   * @param event event name
   * @param handler handler to be called on error event
   */
  addListener(event: "stop", handler: () => void): this;
  /**
   * Triggers on any bot-related error
   *
   * @param event event name
   * @param handler handler to be called on error event
   */
  addListener(event: "error", handler: (error: Error) => void): this;
}

export interface IAutoBeeConstructor {
  /**
   * Constructs new AutoBee bot object
   */
  new(): IAutoBee;
}
