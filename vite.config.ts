import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

// Vite builds only the SPA. The Worker is bundled by Wrangler.
// Output goes to dist/web which is the directory bound to ASSETS in wrangler.toml.
export default defineConfig({
  root: "src/web",
  base: "/",
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@web": path.resolve(__dirname, "src/web"),
      "@shared": path.resolve(__dirname, "src/shared"),
    },
  },
  build: {
    outDir: path.resolve(__dirname, "dist/web"),
    emptyOutDir: true,
    sourcemap: false,
    target: "es2022",
    // Code-split vendor libs to keep first paint small.
    rollupOptions: {
      output: {
        manualChunks: {
          react: ["react", "react-dom"],
          arco: ["@arco-design/web-react"],
        },
      },
    },
  },
  server: {
    port: 5173,
    // During `bun run dev:web`, the Vite dev server proxies API calls
    // to the local Wrangler worker on :8787.
    proxy: {
      "/sub": "http://localhost:8787",
      "/api": "http://localhost:8787",
      "/s": "http://localhost:8787",
    },
  },
});
