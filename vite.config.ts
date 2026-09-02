import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

const dirname = import.meta.dirname;

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(dirname, "./src"),
      "@shared": path.resolve(dirname, "./shared"),
    },
  },
  build: {
    outDir: "dist",
  },
  server: {
    proxy: {
      "/api": {
        target: `http://localhost:${process.env.API_PORT ?? 8787}`,
        changeOrigin: true,
      },
    },
  },
});
