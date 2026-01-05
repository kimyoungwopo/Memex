import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import { crx } from "@crxjs/vite-plugin"
import manifest from "./manifest.json"

export default defineConfig({
  plugins: [
    react(),
    crx({ manifest }),
  ],
  base: "./",
  build: {
    modulePreload: false,
    rollupOptions: {
      input: {
        sidepanel: "src/sidepanel.html",
      },
      output: {
        // Chrome Extension 환경에서 crossorigin 제거
        format: "es",
      },
    },
  },
  // Transformers.js Worker 지원을 위한 설정
  worker: {
    format: "es",
  },
  optimizeDeps: {
    exclude: ["@xenova/transformers"],
  },
  server: {
    port: 5173,
    strictPort: true,
    hmr: {
      port: 5173,
    },
  },
})
