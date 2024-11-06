import { WorkerBee } from "../bot";

const bot = new WorkerBee();

const observer = bot.observe.accountMetadata("gtg");

observer.subscribe({
  next({ account }) {
    /* eslint-disable-next-line no-console */
    console.log(account);
  }
})

