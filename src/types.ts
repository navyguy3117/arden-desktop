// ═══════════════════════════════════════════════════
//  Arden Desktop — Shared Types
// ═══════════════════════════════════════════════════

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  attachments?: FileAttachment[];
  toolUses?: ToolUseRecord[];
  agentsUsed?: string[];
  cost?: number;
  thoughtLog?: ThoughtEntry[];
}

export interface FileAttachment {
  name: string;
  type: string;
  size: number;
  path: string;
}

export interface ToolUseRecord {
  name: string;
  input: Record<string, unknown>;
  result?: string;
  duration?: number;
}

export interface ThoughtEntry {
  agent: string;
  action: string;
  detail?: string;
  timestamp: string;
}

export interface ChatSession {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: ChatMessage[];
  totalCost: number;
  totalTurns: number;
  model?: string;
}

export interface SessionMeta {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
  totalCost: number;
}

export interface AgentDef {
  name: string;
  model: "opus" | "sonnet" | "haiku";
  description: string;
  layer: "think" | "do" | "observe";
}

export interface ArdenConfig {
  gatewayUrl: string;
  serverPort: number;
  model: "opus" | "sonnet" | "haiku";
  maxTurns: number;
  maxBudgetUsd: number;
  voiceEnabled: boolean;
  theme: string;
  agents: Record<string, { model: string; enabled: boolean }>;
}

export interface StreamEvent {
  type: "text" | "tool_use" | "agent_start" | "agent_complete" | "thought" | "result" | "error";
  data: unknown;
}

export interface GatewayHealth {
  status: string;
  uptime: number;
  websocket: { clients: number };
  cortex: { healthy: boolean };
  lmstudio: { healthy: boolean; modelsLoaded: number };
}
