export interface ILoggerConfig {
  verbose: boolean;
}

export const DEFAULT_LOGGER_CONFIG: ILoggerConfig = {
  verbose: false
};

export class Logger {
  private static verbose: boolean = DEFAULT_LOGGER_CONFIG.verbose;

  /**
   * Changes the default logger config
   *
   * @param {ILoggerConfig} config config for Logger
   */
  public static init(config: Partial<ILoggerConfig>): void {
    Object.assign(Logger, config);
  }

  private static get console(): (typeof console | void) {
    if(Logger.verbose)
      return console;
  }

  /**
   * Display debug info if verbose is enabled
   *
   * @param args arguments to be displayed in console
   */
  public static debug(...args: any[]): void {
    Logger.console?.debug(...args);
  }

  /**
   * Display info if verbose is enabled
   *
   * @param args arguments to be displayed in console
   */
  public static info(...args: any[]): void {
    Logger.console?.info(...args);
  }

  /**
   * Display warn info if verbose is enabled
   *
   * @param args arguments to be displayed in console
   */
  public static warn(...args: any[]): void {
    Logger.console?.warn(...args);
  }

  /**
   * Display error info if verbose is enabled
   *
   * @param args arguments to be displayed in console
   */
  public static error(...args: any[]): void {
    Logger.console?.error(...args);
  }
}
