// Use function as we later extract the function name in the jest-helpers
globalThis.createTestFor = async function createTestFor(env) {
  const locWorkerBee = env === "web" ? "../../dist/bundle/index.js" : "../../dist/bundle/index.js";

  // Import required libraries env-dependent
  const wb = await import(locWorkerBee);
  const beekeeper = await import("@hiveio/beekeeper");
  const wax = await import("@hiveio/wax");

  // Provide results
  return {
    beekeeperFactory: beekeeper.default,
    WorkerBee: wb.default,
    WorkerBeePackage: wb,
    wax
  };
};

export {};
