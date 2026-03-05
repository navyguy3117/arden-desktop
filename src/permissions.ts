// ═══════════════════════════════════════════════════
//  Arden Desktop — Permission Handler
//  Safety checks for tool execution
// ═══════════════════════════════════════════════════

import type { ArdenConfig } from "./types";

const BLOCKED_COMMANDS = [
  /rm\s+-rf\s+\//,
  /rm\s+-rf\s+[A-Z]:\\/i,
  /:()\{\s*:\|:&\s*\};:/,      // fork bomb
  /mkfs\./,
  /dd\s+if=.*of=\/dev/,
  /format\s+[A-Z]:/i,
  /del\s+\/[sfq]\s+[A-Z]:\\/i,
  /shutdown/i,
  /net\s+user/i,
];

const SENSITIVE_PATHS = [
  /^\/etc\//,
  /^C:\\Windows\\/i,
  /\.ssh\//i,
  /\.env$/,
  /\.env\./,
  /credentials/i,
  /\.aws\//,
  /\.gnupg\//,
  /password/i,
  /secret/i,
];

export function createPermissionHandler(_config: ArdenConfig) {
  return async (
    toolName: string,
    input: Record<string, unknown>,
  ): Promise<
    | { behavior: "allow"; updatedInput: Record<string, unknown> }
    | { behavior: "deny"; message: string }
  > => {
    if (toolName === "Bash") {
      const command = (input.command as string) || "";
      for (const pattern of BLOCKED_COMMANDS) {
        if (pattern.test(command)) {
          return { behavior: "deny", message: `Blocked dangerous command pattern` };
        }
      }
    }

    if (toolName === "Write" || toolName === "Edit") {
      const filePath = (input.file_path as string) || "";
      for (const pattern of SENSITIVE_PATHS) {
        if (pattern.test(filePath)) {
          return { behavior: "deny", message: `Cannot write to sensitive path: ${filePath}` };
        }
      }
    }

    return { behavior: "allow", updatedInput: input };
  };
}
