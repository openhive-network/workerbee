// Use function as we later extract the function name in the jest-helpers
globalThis.createTestFor = async function createTestFor(env) {
  const locWorkerBee = env === "web" ? "../../dist/bundle/web-full.js" : "../../dist/bundle/node.js";
  const locBeekeeper = env === "web" ? "@hiveio/beekeeper/web" : "@hiveio/beekeeper/node";

  // Import required libraries env-dependent
  const wb = await import(locWorkerBee);
  const beekeeper = await import(locBeekeeper);

  // Provide results
  return {
    beekeeperFactory: beekeeper.default,
    WorkerBee: wb.default
  };
};

export {};