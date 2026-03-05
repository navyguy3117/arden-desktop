import fs from "fs";
import path from "path";
import { v4 as uuid } from "uuid";
import type { ChatSession, ChatMessage, SessionMeta } from "./types";

const SESSIONS_DIR = ".arden-sessions";

export class SessionStore {
  private dir: string;

  constructor(baseDir: string) {
    this.dir = path.join(baseDir, SESSIONS_DIR);
    fs.mkdirSync(this.dir, { recursive: true });
  }

  /**
   * Validate session ID to prevent path traversal attacks.
   * Only allows UUID-format strings (hex + hyphens).
   */
  private validateId(id: string): boolean {
    return /^[a-f0-9\-]{1,64}$/i.test(id);
  }

  list(): SessionMeta[] {
    try {
      const files = fs.readdirSync(this.dir).filter((f) => f.endsWith(".json"));
      const sessions: SessionMeta[] = [];

      for (const file of files) {
        try {
          const data: ChatSession = JSON.parse(
            fs.readFileSync(path.join(this.dir, file), "utf-8")
          );
          sessions.push({
            id: data.id,
            title: data.title,
            createdAt: data.createdAt,
            updatedAt: data.updatedAt,
            messageCount: data.messages.length,
            totalCost: data.totalCost,
          });
        } catch {}
      }

      return sessions.sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      );
    } catch {
      return [];
    }
  }

  get(id: string): ChatSession | null {
    if (!this.validateId(id)) return null;
    try {
      const filePath = path.join(this.dir, `${id}.json`);
      if (!fs.existsSync(filePath)) return null;
      return JSON.parse(fs.readFileSync(filePath, "utf-8"));
    } catch {
      return null;
    }
  }

  create(title = "New Chat"): ChatSession {
    const session: ChatSession = {
      id: uuid(),
      title,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messages: [],
      totalCost: 0,
      totalTurns: 0,
    };
    this.save(session);
    return session;
  }

  addMessage(sessionId: string, message: ChatMessage): void {
    if (!this.validateId(sessionId)) return;
    const session = this.get(sessionId);
    if (!session) return;

    session.messages.push(message);
    session.updatedAt = new Date().toISOString();

    // Auto-title from first user message
    if (session.title === "New Chat" && message.role === "user") {
      session.title = message.content.substring(0, 60).trim();
    }

    if (message.cost) {
      session.totalCost += message.cost;
    }

    this.save(session);
  }

  delete(id: string): boolean {
    if (!this.validateId(id)) return false;
    try {
      const filePath = path.join(this.dir, `${id}.json`);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        return true;
      }
    } catch {}
    return false;
  }

  private save(session: ChatSession): void {
    const filePath = path.join(this.dir, `${session.id}.json`);
    fs.writeFileSync(filePath, JSON.stringify(session, null, 2));
  }
}
