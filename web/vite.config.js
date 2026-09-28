import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        // React rarely changes while the app itself ships often -- keeping it
        // in its own file means an app update only re-downloads the app code,
        // not React too. (@line/liff and recharts are split off separately
        // by the dynamic imports in App.jsx / main.jsx.)
        manualChunks(id) {
          if (/[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/.test(id)) return "react-vendor";
        },
      },
    },
    // The only chunk above Vite's default 500KB warning is recharts, which is
    // lazy-loaded for the dashboard chart and never part of the first load.
    chunkSizeWarningLimit: 600,
  },
});
