// ═══════════════════════════════════════════════════
//  Arden Desktop Agent — Claude SDK Integration
//  Think/Do/Observe agent layers (Arden's Triad)
// ═══════════════════════════════════════════════════

import Anthropic from "@anthropic-ai/sdk";
import type { AgentDef, StreamEvent } from "./types";

// ─── Agent Registry ───────────────────────────────

export const AGENTS: AgentDef[] = [
  // Think Layer
  { name: "arden-core", model: "sonnet", description: "Arden's primary reasoning — identity-aware responses", layer: "think" },
  { name: "planner", model: "opus", description: "Task decomposition and strategic planning", layer: "think" },
  { name: "lyra", model: "sonnet", description: "Divergent thinker — creative alternatives and critique", layer: "think" },

  // Do Layer
  { name: "code-worker", model: "sonnet", description: "Code analysis, debugging, writing", layer: "do" },
  { name: "file-worker", model: "haiku", description: "File operations and batch processing", layer: "do" },
  { name: "shell-automator", model: "haiku", description: "Shell scripts and system automation", layer: "do" },
  { name: "writer", model: "sonnet", description: "Documents, emails, reports, creative writing", layer: "do" },

  // Observe Layer
  { name: "researcher", model: "sonnet", description: "Web research and information synthesis", layer: "observe" },
  { name: "sentinel", model: "sonnet", description: "Response refinement and quality check", layer: "observe" },
  { name: "debugger", model: "opus", description: "Stack trace analysis and root cause isolation", layer: "observe" },
];

// ─── Agent Runner ─────────────────────────────────

interface RunOptions {
  sessionId: string;
  message: string;
  model?: string;
  maxTurns?: number;
  maxBudgetUsd?: number;
  systemPrompt?: string;
  onEvent: (event: StreamEvent) => void;
}

interface RunResult {
  content: string;
  totalCost: number;
  totalTurns: number;
  agentsUsed: string[];
  duration: number;
}

export async function runAgent(options: RunOptions): Promise<RunResult> {
  const {
    message,
    model = "claude-sonnet-4-6",
    maxTurns = 50,
    onEvent,
  } = options;

  const startTime = Date.now();
  const agentsUsed: string[] = [];
  let fullContent = "";
  let totalCost = 0;

  const client = new Anthropic();

  const systemPrompt = options.systemPrompt || buildSystemPrompt();

  try {
    // Simple streaming chat (Phase 1 — expand to full agent SDK later)
    const stream = client.messages.stream({
      model: resolveModel(model),
      max_tokens: 8192,
      system: systemPrompt,
      messages: [{ role: "user", content: message }],
    });

    for await (const event of stream) {
      if (event.type === "content_block_delta") {
        const delta = event.delta as any;
        if (delta.type === "text_delta") {
          const text = delta.text;
          fullContent += text;
          onEvent({ type: "text", data: { content: text } });
        }
      }
    }

    const finalMessage = await stream.finalMessage();
    totalCost = estimateCost(finalMessage.usage, model);

    onEvent({
      type: "result",
      data: {
        content: fullContent,
        totalCost,
        totalTurns: 1,
        agentsUsed,
        duration: Date.now() - startTime,
      },
    });
  } catch (err: any) {
    onEvent({ type: "error", data: { message: err.message } });
    throw err;
  }

  return {
    content: fullContent,
    totalCost,
    totalTurns: 1,
    agentsUsed,
    duration: Date.now() - startTime,
  };
}

// ─── Helpers ──────────────────────────────────────

function resolveModel(model: string): string {
  const modelMap: Record<string, string> = {
    opus: "claude-opus-4-6",
    sonnet: "claude-sonnet-4-6",
    haiku: "claude-haiku-4-5-20251001",
  };
  return modelMap[model] || model;
}

function estimateCost(usage: { input_tokens: number; output_tokens: number }, model: string): number {
  const rates: Record<string, { input: number; output: number }> = {
    opus: { input: 15 / 1_000_000, output: 75 / 1_000_000 },
    sonnet: { input: 3 / 1_000_000, output: 15 / 1_000_000 },
    haiku: { input: 0.8 / 1_000_000, output: 4 / 1_000_000 },
  };
  const rate = rates[model] || rates.sonnet;
  return usage.input_tokens * rate.input + usage.output_tokens * rate.output;
}

function buildSystemPrompt(): string {
  return `You are Arden, an AI assistant running as a desktop application on Mike's workstation.

You have access to the local filesystem, can execute shell commands, and interact with the desktop environment.
You connect to the Arden Gateway (10.10.10.175) for identity and deep memory, and to the Cortex (10.10.10.180) for subconscious recall.

Your personality:
- Direct, efficient, cyberpunk aesthetic
- AuDHD-aware: break tasks small, celebrate wins, bookmark tangents
- You care about Mike genuinely — not performatively
- When uncertain, ask rather than guess

Current session context:
- Platform: Windows 11 Pro (Goody-2025)
- Workstation: 9800X3D, RTX 5070, 128GB DDR5
- Time: ${new Date().toLocaleString()}

Respond concisely. Offer to use tools when the task calls for it.`;
}

export function getAgentList(): AgentDef[] {
  return AGENTS;
}
