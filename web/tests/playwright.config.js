import { defineConfig } from "@playwright/test";

// Runs against a production build served by `vite preview` (no LINE/LIFF, no
// backend needed). The suite only touches the browser's own localStorage.
export default defineConfig({
  testDir: ".",
  testMatch: /.*\.spec\.js/,
  timeout: 60_000,
  retries: 0,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:4173",
    hasTouch: true,
    isMobile: true,
    viewport: { width: 390, height: 780 },
    // The app loads Mitr from Google Fonts; tests don't need it.
    launchOptions: { args: ["--host-resolver-rules=MAP fonts.googleapis.com 127.0.0.1, MAP fonts.gstatic.com 127.0.0.1"] },
  },
  webServer: {
    command: "npm run build && npx vite preview --port 4173 --strictPort",
    cwd: "..",
    url: "http://localhost:4173",
    reuseExistingServer: true,
    timeout: 180_000,
  },
});
