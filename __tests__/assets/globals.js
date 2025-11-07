// Use function as we later extract the function name in the jest-helpers
globalThis.createTestFor = async function createTestFor(env) {
  const locWorkerBee = env === "web" ? "../../dist/bundle/index.js" : "../../dist/bundle/index.js";

  // Import required libraries env-dependent
  const wb = await import(locWorkerBee);
  const beekeeper = await import("@hiveio/beekeeper");
  const wax = await import("@hiveio/wax");

  /** @type {import("../../dist/bundle/index.js").default} */
  const WorkerBee = wb.default;

  // Provide results
  return {
    beekeeperFactory: beekeeper.default,
    WorkerBee,
    WorkerBeePackage: wb,
    bot: new WorkerBee({
      chainOptions: {
        apiTimeout: 0,
        apiEndpoint: "https://api.hive.blog"
      }
    }),
    wax
  };
};

export {};
