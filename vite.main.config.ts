import { defineConfig } from "vite";

export default defineConfig({
  build: {
    rollupOptions: {
      external: [
        "electron", "path", "fs", "os", "url", "child_process", "crypto",
        "http", "https", "net", "stream", "events", "util", "assert",
        "buffer", "querystring", "zlib", "tty", "readline", "worker_threads",
        "@anthropic-ai/claude-agent-sdk",
      ],
    },
  },
  resolve: {
    conditions: ["node"],
    mainFields: ["module", "jsnext:main", "jsnext"],
  },
});
