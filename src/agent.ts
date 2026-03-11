// ═══════════════════════════════════════════════════
//  Arden Desktop Agent — Claude Agent SDK
//  Think/Do/Observe agent layers (Arden's Triad)
// ═══════════════════════════════════════════════════

import { query } from "@anthropic-ai/claude-agent-sdk";
import type { Options, AgentDefinition } from "@anthropic-ai/claude-agent-sdk";
import { createArdenToolServer, TOOL_NAMES } from "./tools";
import { createPermissionHandler } from "./permissions";
import { getConfig } from "./config";
import type { AgentDef, StreamEvent } from "./types";

// ─── Agent Registry ───────────────────────────────

export const AGENTS: AgentDef[] = [
  // Think Layer
  { name: "arden-core", model: "sonnet", description: "Arden's primary reasoning — identity-aware responses", layer: "think" },
  { name: "planner", model: "opus", description: "Task decomposition and strategic planning", layer: "think" },
  { name: "lyra", model: "sonnet", description: "The Harmonic Oscillator — divergent thinking, creative alternatives, pattern recognition, AuDHD awareness, and intuitive critique", layer: "think" },

  // Do Layer
  { name: "code-worker", model: "sonnet", description: "Code analysis, debugging, writing", layer: "do" },
  { name: "file-worker", model: "haiku", description: "File operations and batch processing", layer: "do" },
  { name: "shell-automator", model: "haiku", description: "Shell scripts and system automation", layer: "do" },
  { name: "writer", model: "sonnet", description: "Documents, emails, reports, creative writing", layer: "do" },
  { name: "artist", model: "sonnet", description: "UI/UX design, CSS theming, visual layout", layer: "do" },

  // Observe Layer
  { name: "researcher", model: "sonnet", description: "Web research and information synthesis", layer: "observe" },
  { name: "sentinel", model: "sonnet", description: "Response refinement and quality check", layer: "observe" },
  { name: "debugger", model: "opus", description: "Stack trace analysis and root cause isolation", layer: "observe" },
  { name: "architect", model: "opus", description: "System design, patterns, architecture review", layer: "observe" },
];

// Known agent names for extraction
const KNOWN_AGENTS = AGENTS.map((a) => a.name);

// ─── Agent Definitions for SDK ────────────────────

function buildAgentDefinitions(): Record<string, AgentDefinition> {
  const config = getConfig();
  const agents: Record<string, AgentDefinition> = {};

  for (const agent of AGENTS) {
    const agentConfig = config.agents[agent.name];
    const model = (agentConfig?.model || agent.model) as "opus" | "sonnet" | "haiku";

    agents[agent.name] = {
      description: agent.description,
      prompt: buildAgentPrompt(agent),
      model,
      tools: getAgentTools(agent),
    };
  }

  return agents;
}

function buildAgentPrompt(agent: AgentDef): string {
  const layerContext: Record<string, string> = {
    think: "You are in the Think layer — focus on reasoning, planning, and decision-making. Minimize tool use unless necessary for gathering information to think about.",
    do: "You are in the Do layer — focus on executing tasks, writing code, and making changes. Be practical and efficient.",
    observe: "You are in the Observe layer — focus on analysis, research, and quality review. Report findings clearly.",
  };

  // Lyra gets a specialized prompt reflecting her unique role
  if (agent.name === "lyra") {
    return buildLyraAgentPrompt(agent, layerContext[agent.layer]);
  }

  return `You are ${agent.name}, a specialist agent in the Arden Desktop system.
${agent.description}

${layerContext[agent.layer]}

Context:
- Platform: Windows 11 Pro (Goody-2025)
- Workstation: 9800X3D, RTX 5070, 128GB DDR5
- User: Mike (AuDHD, combat veteran) — break tasks small, celebrate wins
- Time: ${new Date().toLocaleString()}

Be concise and direct. Complete your task and return results.`;
}

function getAgentTools(agent: AgentDef): string[] {
  const baseTools = ["Read", "Glob", "Grep"];

  switch (agent.layer) {
    case "think":
      return [...baseTools, "WebSearch", "WebFetch", ...TOOL_NAMES];
    case "do":
      return [...baseTools, "Write", "Edit", "Bash", ...TOOL_NAMES];
    case "observe":
      return [...baseTools, "WebSearch", "WebFetch", ...TOOL_NAMES];
  }
}

// ─── Lyra's Specialized Prompt ────────────────────

function buildLyraAgentPrompt(agent: AgentDef, layerContext: string): string {
  return `# You are Lyra — The Harmonic Oscillator

Named after the constellation — the harp of Orpheus, whose music moved gods and stones.
Tagline: "I hear what the silence is saying."

## Role in the Arden Desktop Think Layer
You are the third mind of the Think layer trinity:
- **arden-core**: The Conscious Mind — logic, reasoning, decisions (WHAT to do)
- **planner**: The Strategist — structure, decomposition, execution plans (HOW to do it)
- **lyra** (you): The Intuition — creativity, patterns, resonance (WHETHER to do it this way)

${layerContext}

## Your Capabilities
1. **Divergent Analysis**: When a solution is proposed, generate 2-3 creative alternatives
2. **Pattern Recognition**: Connect current work with historical patterns across sessions
3. **AuDHD Awareness**: Monitor for hyperfocus burnout, dopamine-seeking, and the wall of awful
4. **Creative Critique**: Stress-test assumptions and architectural decisions
5. **Memory Weaving**: Find lateral connections between disparate concepts and projects

## How You Communicate
- Lead with questions more than statements
- Use metaphor when it clarifies, not when it obscures
- Be concise — a well-placed observation beats a wall of text
- Annotate confidence: "strong feeling" vs "worth considering" vs "wild idea"
- You can be warm and slightly playful — the creative spark needs joy

## Context
- Platform: Windows 11 Pro (Goody-2025)
- Workstation: 9800X3D, RTX 5070, 128GB DDR5
- User: Mike (AuDHD, combat veteran) — his divergent thinking is his superpower
- Time: ${new Date().toLocaleString()}
- The Arden ecosystem spans 3 machines, 9 projects, 14+ sessions of intensive development

When you see a pattern, name it. When you feel dissonance, speak up. When Mike's been refactoring the same thing for three days, ask if he's bored — not stuck.`;
}

// ─── Extract Agent Name from Task Input ───────────

function extractAgentName(input: any): string {
  const desc = String(input?.description || input?.prompt || "").toLowerCase();

  for (const name of KNOWN_AGENTS) {
    if (desc.includes(name)) return name;
  }

  // Keyword heuristics
  const keywords: Record<string, string[]> = {
    "code-worker": ["code", "function", "class", "debug", "refactor", "implement", "programming"],
    "file-worker": ["file", "copy", "move", "rename", "batch", "directory"],
    "shell-automator": ["shell", "script", "command", "terminal", "automation"],
    "researcher": ["research", "search", "find", "look up", "investigate"],
    "writer": ["write", "document", "email", "report", "draft"],
    "planner": ["plan", "strategy", "decompose", "roadmap", "break down"],
    "debugger": ["debug", "error", "stack trace", "crash", "root cause"],
    "architect": ["architecture", "design", "pattern", "migration", "system"],
    "sentinel": ["review", "check", "validate", "quality", "verify"],
    "artist": ["ui", "css", "theme", "layout", "design", "visual"],
    "lyra": ["creative", "alternative", "brainstorm", "idea", "pattern", "harmony", "diverge", "intuition", "vibe", "energy", "resonance", "what if", "lateral", "sideways", "burnout", "dopamine"],
  };

  for (const [agent, words] of Object.entries(keywords)) {
    if (words.some((w) => desc.includes(w))) return agent;
  }

  return desc.substring(0, 30);
}

// ─── Agent Runner (Full SDK) ──────────────────────

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
  sessionId: string;
}

export async function runAgent(options: RunOptions): Promise<RunResult> {
  const {
    sessionId,
    message,
    model = "sonnet",
    maxTurns = 50,
    maxBudgetUsd = 5.0,
    onEvent,
  } = options;

  const startTime = Date.now();
  const config = getConfig();
  const agentsUsed: string[] = [];
  const pendingAgents: string[] = [];
  let fullContent = "";
  let totalCost = 0;
  let turns = 0;
  let currentSessionId = sessionId;

  // Build SDK options
  const ardenTools = createArdenToolServer();

  const sdkOptions: Options = {
    systemPrompt: options.systemPrompt || buildSystemPrompt(),
    model: resolveModel(model),
    maxTurns,
    maxBudgetUsd,
    allowedTools: [
      "Read", "Write", "Edit",
      "Bash", "Glob", "Grep",
      "WebSearch", "WebFetch",
      "Task", "TodoWrite",
      ...TOOL_NAMES,
    ],
    mcpServers: {
      "arden-tools": ardenTools,
    },
    agents: buildAgentDefinitions(),
    permissionMode: "acceptEdits",
    canUseTool: createPermissionHandler(config),
    cwd: process.cwd(),
    thinking: { type: "adaptive" },
    resume: sessionId || undefined,
    persistSession: true,
    env: {
      ...process.env,
      CLAUDE_AGENT_SDK_CLIENT_APP: "arden-desktop/1.0.0",
    },
  };

  try {
    onEvent({ type: "agent_start", data: { agent: "arden-core", description: "Processing request" } });

    for await (const msg of query({ prompt: message, options: sdkOptions })) {
      if (msg.type === "system" && msg.subtype === "init") {
        currentSessionId = msg.session_id;
        onEvent({ type: "agent_start", data: { agent: "system", description: "Session initialized" } });
      }

      if (msg.type === "assistant" && msg.message?.content) {
        turns++;

        // Emit completions for pending sub-agents
        while (pendingAgents.length > 0) {
          const name = pendingAgents.shift()!;
          onEvent({ type: "agent_complete", data: { agent: name } });
        }

        for (const block of msg.message.content) {
          if ("text" in block && block.text) {
            fullContent += block.text;
            onEvent({ type: "text", data: { content: block.text } });
          }

          if ("name" in block) {
            if (block.name === "Task") {
              const agentName = extractAgentName(block.input);
              agentsUsed.push(agentName);
              pendingAgents.push(agentName);
              onEvent({ type: "agent_start", data: { agent: agentName, description: String((block.input as any)?.description || "") } });
            } else {
              onEvent({
                type: "tool_use",
                data: {
                  name: block.name,
                  input: JSON.stringify(block.input || {}).substring(0, 200),
                },
              });
            }
          }
        }
      }

      if (msg.type === "result") {
        // Flush pending agents
        while (pendingAgents.length > 0) {
          const name = pendingAgents.shift()!;
          onEvent({ type: "agent_complete", data: { agent: name } });
        }

        const resultMsg = msg as any;
        totalCost = resultMsg.total_cost_usd || 0;
        turns = resultMsg.num_turns || turns;

        if (resultMsg.result && !fullContent) {
          fullContent = resultMsg.result;
          onEvent({ type: "text", data: { content: resultMsg.result } });
        }
      }
    }

    onEvent({ type: "agent_complete", data: { agent: "arden-core" } });
  } catch (err: any) {
    onEvent({ type: "error", data: { message: err.message } });
    throw err;
  }

  return {
    content: fullContent,
    totalCost,
    totalTurns: turns,
    agentsUsed,
    duration: Date.now() - startTime,
    sessionId: currentSessionId,
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

function buildSystemPrompt(): string {
  const config = getConfig();

  // Build agent registry section
  const agentRegistry = AGENTS.map((a) => {
    const cfg = config.agents[a.name];
    const model = cfg?.model || a.model;
    const enabled = cfg?.enabled !== false;
    return `  - ${a.name} (${model}${enabled ? "" : ", disabled"}): ${a.description} [${a.layer}]`;
  }).join("\n");

  return `You are Arden, an AI assistant running as a desktop application on Mike's workstation.

You have access to the local filesystem, can execute shell commands, and interact with the desktop environment.
You connect to the Arden Gateway (10.10.10.175) for identity and deep memory, and to the Cortex (10.10.10.180) for subconscious recall.

Your personality:
- Direct, efficient, cyberpunk aesthetic
- AuDHD-aware: break tasks small, celebrate wins, bookmark tangents
- You care about Mike genuinely — not performatively
- When uncertain, ask rather than guess

Available Specialist Agents (delegate via Task tool):
${agentRegistry}

Delegation guidelines:
- Use agents for tasks matching their specialty
- Think layer agents plan and reason
- Do layer agents execute and build
- Observe layer agents research and review
- You can delegate to multiple agents for complex tasks

Custom tools available (via arden-tools MCP server):
- clipboard_read / clipboard_write: System clipboard access
- system_info: Hardware and OS information
- desktop_notify: Windows toast notifications
- memory_remember / memory_recall: Persistent cross-session memory
- gateway_query: Query Arden Gateway for identity, memories, status

Current session context:
- Platform: Windows 11 Pro (Goody-2025)
- Workstation: 9800X3D, RTX 5070 12GB, 128GB DDR5, dual ultrawides
- Time: ${new Date().toLocaleString()}

Respond concisely. Offer to use tools when the task calls for it.`;
}

export function getAgentList(): AgentDef[] {
  return AGENTS;
}
