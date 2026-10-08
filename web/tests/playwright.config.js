import { defineConfig } from "@playwright/test";

// Runs against a production build served by `vite preview` (no LINE/LIFF, no
// backend needed). The suite only touches the browser's own localStorage.
export default defineConfig({
  testDir: ".",
  testMatch: /.*\.spec\.js/,
  timeout: 60_000,
  retries: 0,
  // One worker by default. BJ_WORKERS=4 runs files in parallel (each test has its own browser context, so localStorage is
  // not shared) -- not tried across the whole suite yet, so watch for timing-sensitive tests (animations, back button).
  workers: Number(process.env.BJ_WORKERS) || 1,
  reporter: [["list"], ["html", { open: "never" }]],
  // BJ_WEBKIT=1 also runs everything in WebKit (iPhone Safari / LINE on iOS use it): needs `npx playwright install webkit`
  // once on the machine. Off by default because the cloud sandbox only ships Chromium.
  projects: [
    { name: "chromium" },
    ...(process.env.BJ_WEBKIT ? [{ name: "webkit", use: { browserName: "webkit" } }] : []),
  ],
  use: {
    baseURL: "http://localhost:4173",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    hasTouch: true,
    isMobile: true,
    viewport: { width: 390, height: 780 },
    // Mitr is served from /fonts now; this blocks Google Fonts so a regression to a third-party font fails the tests
    // (fonts.spec.js) instead of silently going to the network.
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
