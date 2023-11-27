import type WorkerBeeT from "../../dist/bundle";

declare global {
  var WorkerBee: typeof WorkerBeeT;
}
