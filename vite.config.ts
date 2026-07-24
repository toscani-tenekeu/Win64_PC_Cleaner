// @lovable.dev/vite-tanstack-config already installs the TanStack, React,
// Tailwind and Nitro plugins. Keep those plugins centralized here.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
  },
  vite: {
    server: {
      host: "127.0.0.1",
      port: 3000,
      strictPort: true,
      proxy: {
        "/api": {
          target: "http://127.0.0.1:3210",
          changeOrigin: false,
        },
      },
    },
  },
});
