// ═══════════════════════════════════════════════════
//  Arden Desktop — Hono HTTP API Server
//  Embedded in Electron main process
// ═══════════════════════════════════════════════════

import { Hono } from "hono";
import { cors } from "hono/cors";
import { streamSSE } from "hono/streaming";
import { v4 as uuid } from "uuid";
import { SessionStore } from "./session-store";
import { GatewayBridge } from "./gateway-bridge";
import { runAgent, getAgentList } from "./agent";
import { getConfig, updateConfig } from "./config";
import type { ChatMessage } from "./types";
import path from "path";
import os from "os";

interface AppOptions {
  port: number;
  gatewayUrl: string;
}

export function createApp(options: AppOptions): Hono {
  const app = new Hono();
  const dataDir = path.join(os.homedir(), ".arden-desktop");
  const sessionStore = new SessionStore(dataDir);
  const gateway = new GatewayBridge({ url: options.gatewayUrl });

  app.use("*", cors());

  // ─── Health ───────────────────────────────────

  app.get("/health", async (c) => {
    const gatewayHealth = await gateway.health();
    return c.json({
      status: "ok",
      version: "1.0.0",
      uptime: process.uptime(),
      gateway: gatewayHealth,
    });
  });

  // ─── Sessions ─────────────────────────────────

  app.get("/api/sessions", (c) => {
    return c.json({ sessions: sessionStore.list() });
  });

  app.post("/api/sessions", async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const session = sessionStore.create(body.title);
    return c.json(session, 201);
  });

  app.get("/api/sessions/:id", (c) => {
    const session = sessionStore.get(c.req.param("id"));
    if (!session) return c.json({ error: "Not found" }, 404);
    return c.json(session);
  });

  app.delete("/api/sessions/:id", (c) => {
    sessionStore.delete(c.req.param("id"));
    return c.json({ ok: true });
  });

  // ─── Local Agent Chat (Claude SDK) ────────────

  app.post("/api/agent/chat", async (c) => {
    const body = await c.req.json();
    const { sessionId, message, model } = body;

    // Create session if needed
    let session = sessionId ? sessionStore.get(sessionId) : null;
    if (!session) {
      session = sessionStore.create();
    }

    // Save user message
    const userMsg: ChatMessage = {
      id: uuid(),
      role: "user",
      content: message,
      timestamp: new Date().toISOString(),
    };
    sessionStore.addMessage(session.id, userMsg);

    // Stream response via SSE
    return streamSSE(c, async (stream) => {
      let fullContent = "";

      try {
        await stream.writeSSE({ data: JSON.stringify({ type: "init", sessionId: session!.id }) });

        await runAgent({
          sessionId: session!.id,
          message,
          model: model || getConfig().model,
          maxTurns: getConfig().maxTurns,
          onEvent: async (event) => {
            if (event.type === "text") {
              const { content } = event.data as { content: string };
              fullContent += content;
              await stream.writeSSE({ data: JSON.stringify({ content, done: false }) });
            } else if (event.type === "tool_use") {
              await stream.writeSSE({ data: JSON.stringify({ type: "tool_use", ...event.data }) });
            } else if (event.type === "agent_start") {
              await stream.writeSSE({ data: JSON.stringify({ type: "agent_start", ...event.data }) });
            } else if (event.type === "agent_complete") {
              await stream.writeSSE({ data: JSON.stringify({ type: "agent_complete", ...event.data }) });
            } else if (event.type === "thought") {
              await stream.writeSSE({ data: JSON.stringify({ type: "thought", ...event.data }) });
            } else if (event.type === "error") {
              await stream.writeSSE({ data: JSON.stringify({ type: "error", ...event.data }) });
            }
          },
        });

        // Save assistant message
        const assistantMsg: ChatMessage = {
          id: uuid(),
          role: "assistant",
          content: fullContent,
          timestamp: new Date().toISOString(),
        };
        sessionStore.addMessage(session!.id, assistantMsg);

        // Done event
        await stream.writeSSE({
          data: JSON.stringify({
            done: true,
            sessionId: session!.id,
            contentLength: fullContent.length,
          }),
        });
        await stream.writeSSE({ data: "[DONE]" });
      } catch (err: any) {
        await stream.writeSSE({
          data: JSON.stringify({ type: "error", message: err.message }),
        });
        await stream.writeSSE({ data: "[DONE]" });
      }
    });
  });

  // ─── Gateway Proxy (Arden Chat) ───────────────

  app.post("/api/gateway/chat", async (c) => {
    const body = await c.req.json();
    const { messages, voiceEnabled, sessionId } = body;

    // Proxy SSE stream from Gateway
    return streamSSE(c, async (stream) => {
      try {
        for await (const chunk of gateway.streamChat(messages, { voiceEnabled, sessionId })) {
          await stream.writeSSE({ data: JSON.stringify(chunk) });
        }
        await stream.writeSSE({ data: "[DONE]" });
      } catch (err: any) {
        await stream.writeSSE({
          data: JSON.stringify({ type: "error", message: err.message }),
        });
        await stream.writeSSE({ data: "[DONE]" });
      }
    });
  });

  // ─── Gateway Status ───────────────────────────

  app.get("/api/gateway/health", async (c) => {
    return c.json(await gateway.health());
  });

  app.get("/api/gateway/avatar", async (c) => {
    return c.json(await gateway.getAvatar());
  });

  app.get("/api/gateway/agents", async (c) => {
    return c.json(await gateway.getAgents());
  });

  app.get("/api/gateway/subconscious", async (c) => {
    return c.json(await gateway.getSubconsciousStatus());
  });

  app.get("/api/gateway/voice/health", async (c) => {
    return c.json(await gateway.voiceHealth());
  });

  // ─── Local Agents ─────────────────────────────

  app.get("/api/agents", (c) => {
    return c.json({ agents: getAgentList() });
  });

  // ─── Config ───────────────────────────────────

  app.get("/api/config", (c) => {
    return c.json(getConfig());
  });

  app.patch("/api/config", async (c) => {
    const body = await c.req.json();
    const updated = updateConfig(body);
    if (body.gatewayUrl) {
      gateway.setUrl(body.gatewayUrl);
    }
    return c.json(updated);
  });

  return app;
}
