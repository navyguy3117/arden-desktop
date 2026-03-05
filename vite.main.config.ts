import { defineConfig } from "vite";

export default defineConfig({
  build: {
    rollupOptions: {
      external: ["electron", "path", "fs", "os", "url", "child_process", "crypto", "http", "https", "net", "stream", "events", "util"],
    },
  },
  resolve: {
    conditions: ["node"],
    mainFields: ["module", "jsnext:main", "jsnext"],
  },
});
