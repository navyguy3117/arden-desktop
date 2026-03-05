import { useState, useRef, useEffect, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"

interface ArdenChatProps {
  apiBase: string
  gatewayUrl: string
  gatewayHealth: any
  onThought: (thought: any) => void
}

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  timestamp: string
  source: "arden" | "agent"
  agentsUsed?: string[]
}

type ChatMode = "arden" | "agent"

export function ArdenChat({ apiBase, gatewayUrl, gatewayHealth, onThought }: ArdenChatProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [isStreaming, setIsStreaming] = useState(false)
  const [mode, setMode] = useState<ChatMode>("arden")
  const [sessionId, setSessionId] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const gatewayConnected = gatewayHealth?.status === "ok"

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const sendMessage = useCallback(async () => {
    const text = input.trim()
    if (!text || isStreaming) return

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
      timestamp: new Date().toISOString(),
      source: mode,
    }
    setMessages(prev => [...prev, userMsg])
    setInput("")
    setIsStreaming(true)

    // Create placeholder assistant message
    const assistantId = crypto.randomUUID()
    const assistantMsg: Message = {
      id: assistantId,
      role: "assistant",
      content: "",
      timestamp: new Date().toISOString(),
      source: mode,
    }
    setMessages(prev => [...prev, assistantMsg])

    try {
      let url: string
      let body: string

      if (mode === "arden") {
        // Route through Gateway proxy
        url = `${apiBase}/api/gateway/chat`
        body = JSON.stringify({
          messages: [{ role: "user", content: text }],
          voiceEnabled: false,
        })
      } else {
        // Local Claude SDK agent
        url = `${apiBase}/api/agent/chat`
        body = JSON.stringify({
          sessionId,
          message: text,
        })
      }

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      })

      if (!res.ok) throw new Error(`Chat failed: ${res.status}`)

      const reader = res.body?.getReader()
      if (!reader) throw new Error("No response body")

      const decoder = new TextDecoder()
      let buffer = ""

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split("\n")
        buffer = lines.pop() || ""

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue
          const data = line.slice(6).trim()
          if (data === "[DONE]") continue

          try {
            const parsed = JSON.parse(data)

            if (parsed.content && !parsed.done) {
              setMessages(prev =>
                prev.map(m =>
                  m.id === assistantId ? { ...m, content: m.content + parsed.content } : m
                )
              )
            }

            if (parsed.type === "init" && parsed.sessionId) {
              setSessionId(parsed.sessionId)
            }

            if (parsed.type === "agent_start") {
              onThought({
                agent: parsed.agent || "unknown",
                action: "started",
                detail: parsed.description,
                timestamp: new Date().toISOString(),
              })
            }

            if (parsed.type === "agent_complete") {
              onThought({
                agent: parsed.agent || "unknown",
                action: "completed",
                timestamp: new Date().toISOString(),
              })
            }

            if (parsed.type === "tool_use") {
              onThought({
                agent: "tool",
                action: parsed.name || "tool",
                detail: JSON.stringify(parsed.input || {}).substring(0, 100),
                timestamp: new Date().toISOString(),
              })
            }

            if (parsed.done) {
              // Final metadata
              if (parsed.subconscious) {
                setMessages(prev =>
                  prev.map(m =>
                    m.id === assistantId ? { ...m, subconscious: parsed.subconscious } : m
                  )
                )
              }
            }
          } catch {}
        }
      }
    } catch (err: any) {
      setMessages(prev =>
        prev.map(m =>
          m.id === assistantId
            ? { ...m, content: `Error: ${err.message}` }
            : m
        )
      )
    } finally {
      setIsStreaming(false)
    }
  }, [input, isStreaming, mode, sessionId, apiBase, onThought])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <div className="glass-panel neon-border-cyan flex flex-col h-full">
      {/* Header with mode toggle */}
      <div className="panel-header">
        <div className="flex items-center gap-3">
          <span className="panel-title">
            {mode === "arden" ? "Arden" : "Agent"}
          </span>
          {/* Mode toggle */}
          <div className="flex rounded-full overflow-hidden border border-white/10">
            <button
              onClick={() => setMode("arden")}
              className={`px-3 py-0.5 text-[9px] uppercase tracking-wider transition-all ${
                mode === "arden"
                  ? "bg-neon-cyan/20 text-neon-cyan"
                  : "text-slate-500 hover:text-slate-300"
              }`}
            >
              Arden
            </button>
            <button
              onClick={() => setMode("agent")}
              className={`px-3 py-0.5 text-[9px] uppercase tracking-wider transition-all ${
                mode === "agent"
                  ? "bg-neon-magenta/20 text-neon-magenta"
                  : "text-slate-500 hover:text-slate-300"
              }`}
            >
              Agent
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {mode === "arden" && (
            <span
              className="panel-badge"
              style={{
                color: gatewayConnected ? "#00ff88" : "#ff3355",
                backgroundColor: gatewayConnected ? "rgba(0,255,136,0.1)" : "rgba(255,51,85,0.1)",
                border: `1px solid ${gatewayConnected ? "rgba(0,255,136,0.3)" : "rgba(255,51,85,0.3)"}`,
              }}
            >
              {gatewayConnected ? "Connected" : "Offline"}
            </span>
          )}
          {mode === "agent" && (
            <span
              className="panel-badge"
              style={{
                color: "#ff4be1",
                backgroundColor: "rgba(255,75,225,0.1)",
                border: "1px solid rgba(255,75,225,0.3)",
              }}
            >
              Claude SDK
            </span>
          )}
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-2">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="text-4xl mb-3">
              {mode === "arden" ? "🐾" : "🤖"}
            </div>
            <div className="text-[11px] text-slate-500 tracking-wide">
              {mode === "arden"
                ? "Talk to Arden — personality, memory, identity"
                : "Local Claude SDK Agent — desktop tasks, code, files"}
            </div>
          </div>
        )}

        <AnimatePresence initial={false}>
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className={`rounded-lg px-3 py-2 text-[12px] leading-relaxed ${
                msg.role === "user"
                  ? "chat-message-user ml-8"
                  : "chat-message-arden mr-8"
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[9px] uppercase tracking-wider font-medium" style={{
                  color: msg.role === "user" ? "var(--theme-primary)" : "#ff4be1",
                }}>
                  {msg.role === "user" ? "You" : msg.source === "arden" ? "Arden" : "Agent"}
                </span>
                <span className="text-[8px] text-slate-600">
                  {new Date(msg.timestamp).toLocaleTimeString()}
                </span>
              </div>
              <div className="whitespace-pre-wrap">{msg.content}</div>
              {msg.role === "assistant" && !msg.content && isStreaming && (
                <div className="flex gap-1 py-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-neon-magenta/60 animate-bounce" style={{ animationDelay: "0ms" }} />
                  <div className="w-1.5 h-1.5 rounded-full bg-neon-magenta/60 animate-bounce" style={{ animationDelay: "150ms" }} />
                  <div className="w-1.5 h-1.5 rounded-full bg-neon-magenta/60 animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Input area */}
      <div className="p-3 border-t border-white/5">
        <div className="chat-input-area rounded-lg flex items-end gap-2 p-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              mode === "arden"
                ? "Talk to Arden..."
                : "Ask the Agent to do something..."
            }
            className="flex-1 bg-transparent border-none outline-none resize-none text-[12px] text-slate-200 placeholder:text-slate-600 min-h-[24px] max-h-[120px]"
            rows={1}
            disabled={isStreaming}
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || isStreaming}
            className="px-3 py-1.5 rounded-md text-[10px] uppercase tracking-wider font-medium transition-all disabled:opacity-30"
            style={{
              backgroundColor: mode === "arden" ? "rgba(79,242,242,0.15)" : "rgba(255,75,225,0.15)",
              color: mode === "arden" ? "#4ff2f2" : "#ff4be1",
              border: `1px solid ${mode === "arden" ? "rgba(79,242,242,0.30)" : "rgba(255,75,225,0.30)"}`,
            }}
          >
            {isStreaming ? "..." : "Send"}
          </button>
        </div>
      </div>
    </div>
  )
}
