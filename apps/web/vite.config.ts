import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

export default defineConfig({
  // On GitHub Pages the site lives at /DataChat/ — in dev/Vercel it's /
  base: process.env.VITE_BASE_PATH ?? "/",
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": { target: "http://localhost:3001", rewrite: (p) => p.replace(/^\/api/, "") },
      "/ws":  { target: "ws://localhost:3001",   ws: true },
    },
  },
});
