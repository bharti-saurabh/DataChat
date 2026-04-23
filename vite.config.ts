import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

export default defineConfig({
  base: "/DataChat/",
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  optimizeDeps: {
    exclude: ["@duckdb/duckdb-wasm"],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: (id: string) => {
          if (id.includes("monaco-editor") || id.includes("@monaco-editor")) return "monaco";
          if (id.includes("node_modules/xlsx")) return "xlsx";
          if (id.includes("node_modules/recharts") || id.includes("node_modules/d3-")) return "recharts";
          if (id.includes("node_modules/framer-motion")) return "framer";
          if (id.includes("node_modules/react/") || id.includes("node_modules/react-dom/")) return "react";
        },
      },
    },
  },
  server: {
    headers: {
      "Cross-Origin-Embedder-Policy": "require-corp",
      "Cross-Origin-Opener-Policy": "same-origin",
    },
  },
});
