import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig(({ mode }) => {
  const env = { ...loadEnv(mode, process.cwd(), ""), ...process.env };
  if (mode === "production" && env.VERCEL && !env.VITE_API_URL)
    throw new Error(
      "Set VITE_API_URL to the Render HTTPS API URL before deploying.",
    );
  if (
    mode === "production" &&
    env.VITE_API_URL &&
    env.VITE_API_URL !== "/api"
  ) {
    const url = new URL(env.VITE_API_URL);
    if (
      url.protocol !== "https:" ||
      ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) ||
      url.username ||
      url.password ||
      url.pathname.replace(/\/$/, "") !== "/api" ||
      url.search ||
      url.hash
    )
      throw new Error(
        "Production VITE_API_URL must be an HTTPS API URL ending in /api.",
      );
  }
  if (mode === "production" && env.VERCEL && env.VITE_API_URL === "/api")
    throw new Error(
      "Vercel requires the absolute Render API URL, not the local /api proxy.",
    );
  return {
    plugins: [react()],
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            charts: ["recharts"],
            react: ["react", "react-dom", "react-router-dom"],
          },
        },
      },
    },
    server: { proxy: { "/api": "http://127.0.0.1:5001" } },
  };
});
