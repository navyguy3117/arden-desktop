// App.tsx v2.0 — Polished layout with session wiring + boot sequence
import { useState, useEffect, useCallback } from "react"
import { motion } from "framer-motion"
import { ArdenChat } from "./components/panels/ArdenChat"
import { AgentStatus } from "./components/panels/AgentStatus"
import { ThoughtLog } from "./components/panels/ThoughtLog"
import { QuickStats } from "./components/panels/QuickStats"
import { SessionList } from "./components/panels/SessionList"
import { CostTracker } from "./components/panels/CostTracker"

// Declare Electron preload API
declare global {
  interface Window {
    ardenDesktop?: {
      getServerPort: () => Promise<number>
      getGatewayUrl: () => Promise<string>
      checkGatewayHealth: () => Promise<any>
      onServerReady: (cb: (port: number) => void) => void
      minimize: () => void
      maximize: () => void
      close: () => void
    }
  }
}

export function App() {
  const [serverPort, setServerPort] = useState(3141)
  const [gatewayUrl, setGatewayUrl] = useState("http://10.10.10.175:18789")
  const [gatewayHealth, setGatewayHealth] = useState<any>(null)
  const [thoughts, setThoughts] = useState<any[]>([])
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const [booting, setBooting] = useState(true)
  const [bootPhase, setBootPhase] = useState(0)

  // Boot sequence
  useEffect(() => {
    const phases = [
      { delay: 200, phase: 1 },   // Identity check
      { delay: 600, phase: 2 },   // Gateway probe
      { delay: 1000, phase: 3 },  // Systems online
      { delay: 1400, phase: 4 },  // Ready
    ]
    phases.forEach(({ delay, phase }) => {
      setTimeout(() => setBootPhase(phase), delay)
    })
    setTimeout(() => setBooting(false), 1800)
  }, [])

  // Get server port from Electron or use default for web
  useEffect(() => {
    if (window.ardenDesktop) {
      window.ardenDesktop.getServerPort().then(setServerPort)
      window.ardenDesktop.getGatewayUrl().then(setGatewayUrl)
    }
    window.ardenDesktop?.onServerReady?.((port) => setServerPort(port))
  }, [])

  // Poll gateway health
  useEffect(() => {
    const check = () => {
      fetch(`http://localhost:${serverPort}/api/gateway/health`)
        .then(r => r.json())
        .then(setGatewayHealth)
        .catch(() => setGatewayHealth({ status: "unreachable" }))
    }
    check()
    const t = setInterval(check, 30000)
    return () => clearInterval(t)
  }, [serverPort])

  const apiBase = `http://localhost:${serverPort}`

  const handleSelectSession = useCallback((id: string) => {
    setActiveSessionId(id)
  }, [])

  const handleNewSession = useCallback(() => {
    setActiveSessionId(null)
    setThoughts([])
  }, [])

  const handleSessionCreated = useCallback((id: string) => {
    setActiveSessionId(id)
  }, [])

  // Boot sequence overlay
  if (booting) {
    return (
      <div className="flex flex-col h-screen items-center justify-center bg-bg-deep relative z-10">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className="flex flex-col items-center gap-6"
        >
          {/* Arden logo/avatar */}
          <div className="relative">
            <motion.div
              animate={{
                boxShadow: [
                  "0 0 20px rgba(79,242,242,0.2)",
                  "0 0 40px rgba(79,242,242,0.4)",
                  "0 0 20px rgba(79,242,242,0.2)",
                ],
              }}
              transition={{ duration: 2, repeat: Infinity }}
              className="w-20 h-20 rounded-full border-2 border-neon-cyan/40 flex items-center justify-center bg-bg-deep"
            >
              <span className="text-4xl">🐾</span>
            </motion.div>
          </div>

          {/* Boot text */}
          <div className="flex flex-col items-center gap-2 font-mono">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-[13px] text-neon-cyan tracking-[0.4em] uppercase font-medium"
            >
              Arden Desktop
            </motion.div>

            <div className="flex flex-col items-start gap-1 mt-4 min-w-[260px]">
              <BootLine phase={bootPhase} target={1} text="Identity matrix loaded" />
              <BootLine phase={bootPhase} target={2} text="Gateway probe → 10.10.10.175" />
              <BootLine phase={bootPhase} target={3} text="Agent layers initialized" />
              <BootLine phase={bootPhase} target={4} text="Systems online" />
            </div>
          </div>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen relative z-10">
      {/* Title bar drag region */}
      <div className="titlebar-drag h-9 flex items-center px-4 bg-bg-deep/90 border-b border-white/5">
        <span className="text-[11px] tracking-[0.3em] uppercase text-neon-cyan/80 font-medium titlebar-nodrag">
          Arden Desktop
        </span>
        <span className="text-[9px] text-slate-500 ml-2 titlebar-nodrag">v2.0</span>
        <div className="flex-1" />
        {/* Gateway status dot */}
        <div className="flex items-center gap-2 titlebar-nodrag mr-2">
          <div
            className="w-2 h-2 rounded-full animate-pulse-glow"
            style={{
              backgroundColor: gatewayHealth?.status === "ok" ? "#00ff88" : gatewayHealth?.status === "unreachable" ? "#ff3355" : "#6080a0",
              boxShadow: gatewayHealth?.status === "ok" ? "0 0 8px #00ff88" : "none",
            }}
          />
          <span className="text-[9px] text-slate-500">
            {gatewayHealth?.status === "ok" ? "Gateway" : "Offline"}
          </span>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden p-2 gap-2">
        {/* Left column — Chat (primary) */}
        <motion.div
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.05, duration: 0.4, ease: "easeOut" }}
          className="flex-1 flex flex-col min-w-0"
        >
          <ArdenChat
            apiBase={apiBase}
            gatewayUrl={gatewayUrl}
            gatewayHealth={gatewayHealth}
            onThought={(thought) => setThoughts(prev => [...prev.slice(-99), thought])}
            activeSessionId={activeSessionId}
            onSessionCreated={handleSessionCreated}
          />
        </motion.div>

        {/* Right column — Info panels */}
        <motion.div
          initial={{ opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1, duration: 0.4, ease: "easeOut" }}
          className="w-[280px] flex flex-col gap-2 overflow-y-auto panel-sidebar"
        >
          <div className="panel-entrance" style={{ animationDelay: "0.1s" }}>
            <QuickStats apiBase={apiBase} gatewayHealth={gatewayHealth} />
          </div>
          <div className="panel-entrance" style={{ animationDelay: "0.15s" }}>
            <CostTracker apiBase={apiBase} />
          </div>
          <div className="panel-entrance" style={{ animationDelay: "0.2s" }}>
            <SessionList
              apiBase={apiBase}
              activeSessionId={activeSessionId}
              onSelectSession={handleSelectSession}
              onNewSession={handleNewSession}
            />
          </div>
          <div className="panel-entrance" style={{ animationDelay: "0.25s" }}>
            <AgentStatus apiBase={apiBase} />
          </div>
          <div className="panel-entrance" style={{ animationDelay: "0.3s" }}>
            <ThoughtLog thoughts={thoughts} />
          </div>
        </motion.div>
      </div>
    </div>
  )
}

// Boot sequence line component
function BootLine({ phase, target, text }: { phase: number; target: number; text: string }) {
  const active = phase >= target
  const current = phase === target

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{
        opacity: active ? 1 : 0.15,
        x: active ? 0 : -8,
      }}
      transition={{ duration: 0.2 }}
      className="flex items-center gap-2"
    >
      <span
        className="text-[10px] font-mono"
        style={{
          color: active ? "#00ff88" : "#334155",
        }}
      >
        {active ? "✓" : "○"}
      </span>
      <span
        className="text-[10px] font-mono tracking-wide"
        style={{
          color: current ? "#4ff2f2" : active ? "#64748b" : "#1e293b",
        }}
      >
        {text}
      </span>
      {current && (
        <motion.span
          animate={{ opacity: [1, 0.3, 1] }}
          transition={{ duration: 0.8, repeat: Infinity }}
          className="text-[10px] text-neon-cyan font-mono"
        >
          _
        </motion.span>
      )}
    </motion.div>
  )
}
