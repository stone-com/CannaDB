import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Vite config.
export default defineConfig({
  plugins: [react()],
  server: {
    // Proxy API calls to backend during development.
    proxy: {
      "/api": "http://localhost:5000",
    },
  },
});
