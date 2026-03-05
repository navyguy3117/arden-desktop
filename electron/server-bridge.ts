import { serve } from "@hono/node-server";
import { createApp } from "../src/server";

let server: ReturnType<typeof serve> | null = null;

export async function startServer(port: number, gatewayUrl: string): Promise<number> {
  const app = createApp({ port, gatewayUrl });

  return new Promise((resolve) => {
    server = serve({ fetch: app.fetch, port }, (info) => {
      console.log(`[server-bridge] Hono server listening on port ${info.port}`);
      resolve(info.port);
    });
  });
}

export async function stopServer(): Promise<void> {
  if (server) {
    server.close();
    server = null;
    console.log("[server-bridge] Server stopped");
  }
}
