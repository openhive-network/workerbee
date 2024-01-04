import type WorkerBeeT from "../../dist/bundle/web";

declare global {
  var WorkerBee: typeof WorkerBeeT;
}
