// ═══════════════════════════════════════════════════
//  Arden Desktop — Custom MCP Tools
//  Tools available to the Claude Agent SDK
// ═══════════════════════════════════════════════════

import { tool, createSdkMcpServer } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod/v4";
import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs";
import path from "path";
import os from "os";

const execAsync = promisify(exec);
const DATA_DIR = path.join(os.homedir(), ".arden-desktop");

// ─── Clipboard Tools ──────────────────────────────

const clipboardRead = tool(
  "clipboard_read",
  "Read the current contents of the system clipboard",
  {},
  async () => {
    try {
      const { stdout } = await execAsync("powershell -command Get-Clipboard");
      return { content: [{ type: "text" as const, text: stdout.trim() || "(clipboard is empty)" }] };
    } catch (err: any) {
      return { content: [{ type: "text" as const, text: `Clipboard error: ${err.message}` }], isError: true };
    }
  }
);

const clipboardWrite = tool(
  "clipboard_write",
  "Write text to the system clipboard",
  { text: z.string().describe("Text to copy to clipboard") },
  async ({ text }) => {
    try {
      await execAsync(`powershell -command "Set-Clipboard -Value '${text.replace(/'/g, "''")}'"`);
      return { content: [{ type: "text" as const, text: `Copied ${text.length} chars to clipboard` }] };
    } catch (err: any) {
      return { content: [{ type: "text" as const, text: `Clipboard error: ${err.message}` }], isError: true };
    }
  }
);

// ─── System Info ──────────────────────────────────

const systemInfo = tool(
  "system_info",
  "Get system information: hostname, platform, CPU, memory, uptime",
  {},
  async () => {
    const info = {
      hostname: os.hostname(),
      platform: `${os.type()} ${os.release()}`,
      arch: os.arch(),
      cpus: os.cpus().length,
      cpuModel: os.cpus()[0]?.model,
      totalMemoryGB: (os.totalmem() / 1073741824).toFixed(1),
      freeMemoryGB: (os.freemem() / 1073741824).toFixed(1),
      uptimeHours: (os.uptime() / 3600).toFixed(1),
      homeDir: os.homedir(),
      tempDir: os.tmpdir(),
    };
    return { content: [{ type: "text" as const, text: JSON.stringify(info, null, 2) }] };
  }
);

// ─── Notification ─────────────────────────────────

const notify = tool(
  "desktop_notify",
  "Show a Windows desktop notification/toast",
  {
    title: z.string().describe("Notification title"),
    message: z.string().describe("Notification body text"),
  },
  async ({ title, message }) => {
    try {
      const ps = `[void] [System.Reflection.Assembly]::LoadWithPartialName('System.Windows.Forms'); $n = New-Object System.Windows.Forms.NotifyIcon; $n.Icon = [System.Drawing.SystemIcons]::Information; $n.Visible = $true; $n.ShowBalloonTip(5000, '${title.replace(/'/g, "''")}', '${message.replace(/'/g, "''")}', 'Info'); Start-Sleep -Seconds 6; $n.Dispose()`;
      exec(`powershell -command "${ps}"`);
      return { content: [{ type: "text" as const, text: `Notification sent: ${title}` }] };
    } catch (err: any) {
      return { content: [{ type: "text" as const, text: `Notification error: ${err.message}` }], isError: true };
    }
  }
);

// ─── Memory (Persistent Notes) ────────────────────

const memoryDir = path.join(DATA_DIR, "memory");

const memoryRemember = tool(
  "memory_remember",
  "Save a persistent note/memory that survives across sessions. Use for user preferences, decisions, patterns, and important facts.",
  {
    category: z.enum(["preference", "project", "decision", "pattern", "entity", "fact"]).describe("Memory category"),
    key: z.string().describe("Short identifier for this memory"),
    value: z.string().describe("The content to remember"),
  },
  async ({ category, key, value }) => {
    try {
      fs.mkdirSync(memoryDir, { recursive: true });
      const memFile = path.join(memoryDir, "index.json");
      let memories: any[] = [];
      if (fs.existsSync(memFile)) {
        memories = JSON.parse(fs.readFileSync(memFile, "utf-8"));
      }
      const existing = memories.findIndex((m) => m.key === key);
      const entry = { category, key, value, updatedAt: new Date().toISOString() };
      if (existing >= 0) {
        memories[existing] = entry;
      } else {
        memories.push(entry);
      }
      fs.writeFileSync(memFile, JSON.stringify(memories, null, 2));
      return { content: [{ type: "text" as const, text: `Remembered: [${category}] ${key}` }] };
    } catch (err: any) {
      return { content: [{ type: "text" as const, text: `Memory error: ${err.message}` }], isError: true };
    }
  }
);

const memoryRecall = tool(
  "memory_recall",
  "Search persistent memories by keyword. Returns matching notes from previous sessions.",
  {
    query: z.string().describe("Search keyword or phrase").optional(),
    category: z.enum(["preference", "project", "decision", "pattern", "entity", "fact"]).optional(),
  },
  async ({ query, category }) => {
    try {
      const memFile = path.join(memoryDir, "index.json");
      if (!fs.existsSync(memFile)) {
        return { content: [{ type: "text" as const, text: "No memories stored yet." }] };
      }
      let memories: any[] = JSON.parse(fs.readFileSync(memFile, "utf-8"));
      if (category) memories = memories.filter((m) => m.category === category);
      if (query) {
        const q = query.toLowerCase();
        memories = memories.filter(
          (m) => m.key.toLowerCase().includes(q) || m.value.toLowerCase().includes(q)
        );
      }
      if (memories.length === 0) {
        return { content: [{ type: "text" as const, text: "No matching memories found." }] };
      }
      const text = memories
        .map((m) => `[${m.category}] ${m.key}: ${m.value}`)
        .join("\n");
      return { content: [{ type: "text" as const, text }] };
    } catch (err: any) {
      return { content: [{ type: "text" as const, text: `Memory error: ${err.message}` }], isError: true };
    }
  }
);

// ─── Gateway Query ────────────────────────────────

const gatewayQuery = tool(
  "gateway_query",
  "Query Arden's Gateway API for identity, deep memories, or agent status. Use for accessing Arden's subconscious recall or gateway health.",
  {
    endpoint: z.string().describe("Gateway API endpoint path, e.g. /health, /api/avatar, /api/chat/subconscious?q=something"),
  },
  async ({ endpoint }) => {
    try {
      const url = `http://10.10.10.175:18789${endpoint}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
      const data = await res.json();
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    } catch (err: any) {
      return { content: [{ type: "text" as const, text: `Gateway error: ${err.message}` }], isError: true };
    }
  }
);

// ─── Bundle All Tools ─────────────────────────────

const ALL_TOOLS = [
  clipboardRead,
  clipboardWrite,
  systemInfo,
  notify,
  memoryRemember,
  memoryRecall,
  gatewayQuery,
];

export const TOOL_NAMES = ALL_TOOLS.map((t) => `mcp__arden-tools__${(t as any).name || "unknown"}`);

export function createArdenToolServer() {
  return createSdkMcpServer({
    name: "arden-tools",
    version: "1.0.0",
    tools: ALL_TOOLS,
  });
}
