import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  // Load all env vars (empty prefix = no filter) so non-VITE_ vars are readable
  // in the config file, which runs in Node.js and doesn't have import.meta.env.
  const env = loadEnv(mode, process.cwd(), "");

  const backendUrl = env.VITE_API_URL || "http://localhost:3000";
  const port = parseInt(env.VITE_PORT || "5173", 10);

  return {
    plugins: [react()],
    server: {
      port,
      proxy: {
        "/graphql": { target: backendUrl, changeOrigin: true },
        "/export": { target: backendUrl, changeOrigin: true },
      },
    },
  };
});
