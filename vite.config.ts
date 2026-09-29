import path from "path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: true,
    // Sessão é cookie httpOnly (SameSite=Lax): se o front for aberto por um host diferente
    // do host da API (ex: localhost:5173 falando com 192.168.x.x:3000), o navegador trata
    // como domínios diferentes e não manda o cookie — login "funciona" mas some no primeiro
    // F5. Proxy faz toda chamada a /api sair do MESMO host:porta que o front, sempre.
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
    },
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
