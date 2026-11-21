import path from "node:path";
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(projectRoot, "client", "src"),
      "@shared": path.resolve(projectRoot, "shared"),
    },
  },
  root: path.resolve(projectRoot, "client"),
  server: {
    host: "127.0.0.1",
    port: 43473,
    strictPort: true,
  },
  optimizeDeps: {
    entries: ["e2e-performance-comercial.html"],
  },
});
