import { defineConfig } from "@playwright/test";

// Run through scripts/e2e.sh, which starts Chrome and passes CDP_URL.
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 90_000,
  expect: { timeout: 30_000 },
  workers: 1,
  reporter: [["list"]],
  use: { baseURL: process.env.BASE_URL ?? "http://127.0.0.1:8090" },
});
