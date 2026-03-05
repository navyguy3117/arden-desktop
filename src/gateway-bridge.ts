// ═══════════════════════════════════════════════════
//  Gateway Bridge — Connects to remote Arden Gateway
//  on 10.10.10.175:18789 for identity, memory, and
//  Arden's personality-driven chat
// ═══════════════════════════════════════════════════

export interface GatewayBridgeConfig {
  url: string;
}

export class GatewayBridge {
  private url: string;

  constructor(config: GatewayBridgeConfig) {
    this.url = config.url.replace(/\/$/, "");
  }

  setUrl(url: string): void {
    this.url = url.replace(/\/$/, "");
  }

  getUrl(): string {
    return this.url;
  }

  async health(): Promise<any> {
    try {
      const res = await fetch(`${this.url}/health`, { signal: AbortSignal.timeout(5000) });
      return await res.json();
    } catch {
      return { status: "unreachable" };
    }
  }

  async getAvatar(): Promise<any> {
    try {
      const res = await fetch(`${this.url}/api/avatar`, { signal: AbortSignal.timeout(5000) });
      return await res.json();
    } catch {
      return null;
    }
  }

  async getAgents(): Promise<any[]> {
    try {
      const res = await fetch(`${this.url}/api/agents`, { signal: AbortSignal.timeout(5000) });
      const data = await res.json();
      return data.agents || [];
    } catch {
      return [];
    }
  }

  async getSubconsciousStatus(): Promise<any> {
    try {
      const res = await fetch(`${this.url}/api/chat/subconscious/status`, {
        signal: AbortSignal.timeout(5000),
      });
      return await res.json();
    } catch {
      return { healthy: false };
    }
  }

  async voiceHealth(): Promise<any> {
    try {
      const res = await fetch(`${this.url}/api/voice/health`, {
        signal: AbortSignal.timeout(5000),
      });
      return await res.json();
    } catch {
      return { enabled: false };
    }
  }

  // Stream chat with Arden (SSE)
  async *streamChat(
    messages: { role: string; content: string }[],
    options: { sessionId?: string; voiceEnabled?: boolean } = {}
  ): AsyncGenerator<{ content?: string; done?: boolean; subconscious?: any; voice?: any }> {
    const body = JSON.stringify({
      messages,
      stream: true,
      provider: "openrouter",
      injectIdentity: true,
      voiceEnabled: options.voiceEnabled || false,
      sessionId: options.sessionId,
    });

    const res = await fetch(`${this.url}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });

    if (!res.ok) {
      throw new Error(`Gateway chat failed: ${res.status}`);
    }

    const reader = res.body?.getReader();
    if (!reader) throw new Error("No response body");

    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const data = line.slice(6).trim();
          if (data === "[DONE]") return;
          try {
            yield JSON.parse(data);
          } catch {}
        }
      }
    }
  }

  // Voice TTS through gateway
  async synthesize(text: string): Promise<{ audioUrl: string; durationMs: number } | null> {
    try {
      const res = await fetch(`${this.url}/api/voice/tts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) return null;
      const data = await res.json();
      return {
        audioUrl: `${this.url}${data.audioUrl}`,
        durationMs: data.durationMs,
      };
    } catch {
      return null;
    }
  }

  getAudioUrl(audioId: string): string {
    return `${this.url}/api/voice/audio/${audioId}`;
  }
}
