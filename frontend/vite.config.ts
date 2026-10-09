/// <reference types="vitest/config" />
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

/**
 * Dev server proxies /api and /media to Django so the browser sees a single
 * origin — the same topology production gets from the Vercel rewrite
 * (see vercel.json). Cookies, CSRF and media URLs therefore behave
 * identically in development and production.
 */
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const backend = env.VITE_DEV_BACKEND ?? "http://127.0.0.1:8000";

  return {
    plugins: [react()],
    resolve: {
      alias: { "@": "/src" },
    },
    server: {
      // Listen on 0.0.0.0 so other devices on the LAN can open http://<lan-ip>:5173.
      // Keep changeOrigin: false so Django sees the browser Host (needed for
      // ALLOWED_HOSTS, CSRF and cookies). The proxy still talks to Django on
      // this machine via VITE_DEV_BACKEND (127.0.0.1), which is correct.
      host: true,
      port: 5173,
      allowedHosts: true,
      proxy: {
        "/api": { target: backend, changeOrigin: false },
        "/media": { target: backend, changeOrigin: false },
      },
    },
    preview: {
      host: true,
      port: 4173,
      allowedHosts: true,
    },
    build: {
      sourcemap: true,
      rollupOptions: {
        output: {
          // Keep heavy, mode-specific libraries out of the main bundle.
          manualChunks(id: string) {
            if (id.includes("node_modules/gsap") || id.includes("node_modules/lenis")) return "motion";
            if (id.includes("node_modules/animejs")) return "anime";
            if (id.includes("react-markdown") || id.includes("remark") || id.includes("micromark"))
              return "markdown";
            if (id.includes("@dnd-kit")) return "dnd";
            return undefined;
          },
        },
      },
    },
    test: {
      environment: "jsdom",
      globals: true,
      setupFiles: ["./src/test/setup.ts"],
      css: false,
    },
  };
});
