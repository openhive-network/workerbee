// This is a workaround for https://github.com/microsoft/playwright/issues/18282#issuecomment-1612266345
import { defineConfig } from "@playwright/test";

export default defineConfig({
  fullyParallel: true,
  reporter: [
    [ "junit", { outputFile: "results.xml" } ],
    [ "json",  { outputFile: "results.json" } ]
  ],
  projects: [
    {
      name: "workerbee_testsuite",
      testDir: "./dist/tests/"
    },
    {
      name: "workerbee_testsuite_mock",
      testDir: "./dist/tests/",
      testMatch: "mock*",
      fullyParallel: false
    }
  ],
  // Run your local dev server before starting the tests
  webServer: {
    command: "npx http-server"
  }
});
