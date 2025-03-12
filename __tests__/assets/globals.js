// Use function as we later extract the function name in the jest-helpers
globalThis.createTestFor = async function createTestFor(env) {
  const locWorkerBee = env === "web" ? "../../dist/bundle/index.js" : "../../dist/bundle/index.js";
  const locBeekeeper = env === "web" ? "@hiveio/beekeeper/web" : "@hiveio/beekeeper/node";
  const locWax = env === "web" ? "@hiveio/wax/web" : "@hiveio/wax/node";

  // Import required libraries env-dependent
  const wb = await import(locWorkerBee);
  const beekeeper = await import(locBeekeeper);
  const wax = await import(locWax);

  // Provide results
  return {
    beekeeperFactory: beekeeper.default,
    WorkerBee: wb.default,
    wax
  };
};

export {};
