import { AutoBeeError } from "./errors";
import { Logger } from "./logger";

let running = false;

export const signalHandler = (): void => {
  Logger.warn("Stop requested! Please wait...");
  running = false;
};

/**
 * Bootstrap method (app entry point).
 */
export const bootstrap = async(): Promise<void> => {
  if(running)
    throw new AutoBeeError("Another bootstrap program has been already running, but its instance has been interrupted by this request.");

  try {
    running = true;

    await new Promise(res => { setTimeout(res, 0); });
  } finally {
    Logger.info("Program main loop terminated");
    // eslint-disable-next-line require-atomic-updates
    running = false;
  }
};
