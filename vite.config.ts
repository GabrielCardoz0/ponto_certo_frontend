import path from "path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  // maplibre-gl carrega um worker interno (maplibre-gl-worker) via new Worker(...);
  // o pre-bundling do esbuild quebra essa referência (404 em dev), então excluímos
  // o pacote da otimização de deps para ele ser servido na forma ESM original.
  optimizeDeps: {
    exclude: ["maplibre-gl"],
  },
})
