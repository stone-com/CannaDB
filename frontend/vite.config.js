import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Vite config file.
// defineConfig(...) adds editor type hints and clearer config structure.
export default defineConfig({
  plugins: [react()],
  server: {
    // Dev proxy: /api requests from frontend go to backend server on port 5000.
    // This avoids CORS issues and keeps fetch('/api/...') simple in React code.
    proxy: {
      "/api": "http://localhost:5000",
    },
  },
});
