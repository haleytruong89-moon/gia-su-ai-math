import { defineConfig } from "@playwright/test";

// e2e runs in CI only: a local Supabase built from the Study Launcher migrations, and the fake model
// (TUTOR_FAKE_MODEL=1, lib/tutor/fakeClient.ts) so no API call and no cost.
const port = 3200;

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  // One database shared in order: start a problem → press buttons → save it.
  workers: 1,
  fullyParallel: false,
  retries: 0,
  reporter: [["list"]],
  use: { baseURL: `http://localhost:${port}`, trace: "retain-on-failure" },
  webServer: {
    command: `npm run start -- -p ${port}`,
    url: `http://localhost:${port}/gia-su`,
    reuseExistingServer: false,
    timeout: 60_000,
    env: { TUTOR_FAKE_MODEL: "1" },
  },
});
