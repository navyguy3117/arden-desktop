import fs from "fs";
import path from "path";
import type { ArdenConfig } from "./types";

const CONFIG_FILE = "arden-desktop.json";

const DEFAULT_CONFIG: ArdenConfig = {
  gatewayUrl: "http://10.10.10.175:18789",
  serverPort: 3141,
  model: "sonnet",
  maxTurns: 50,
  maxBudgetUsd: 5.0,
  voiceEnabled: true,
  theme: "cyan",
  agents: {
    "file-worker": { model: "haiku", enabled: true },
    "code-worker": { model: "sonnet", enabled: true },
    "researcher": { model: "sonnet", enabled: true },
    "focus-coach": { model: "sonnet", enabled: true },
    "planner": { model: "opus", enabled: true },
    "shell-automator": { model: "haiku", enabled: true },
    "writer": { model: "sonnet", enabled: true },
    "debugger": { model: "opus", enabled: true },
    "architect": { model: "opus", enabled: true },
  },
};

let config: ArdenConfig = { ...DEFAULT_CONFIG };

export function loadConfig(configDir: string): ArdenConfig {
  const configPath = path.join(configDir, CONFIG_FILE);
  try {
    if (fs.existsSync(configPath)) {
      const loaded = JSON.parse(fs.readFileSync(configPath, "utf-8"));
      config = { ...DEFAULT_CONFIG, ...loaded };
    }
  } catch (err) {
    console.warn("[config] Failed to load config:", err);
  }
  return config;
}

export function saveConfig(configDir: string): void {
  const configPath = path.join(configDir, CONFIG_FILE);
  try {
    fs.mkdirSync(path.dirname(configPath), { recursive: true });
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  } catch (err) {
    console.warn("[config] Failed to save config:", err);
  }
}

export function getConfig(): ArdenConfig {
  return config;
}

export function updateConfig(partial: Partial<ArdenConfig>): ArdenConfig {
  config = { ...config, ...partial };
  return config;
}
