import type bootstrapT from "../../dist/bundle";

declare global {
  var bootstrap: typeof bootstrapT;
}
