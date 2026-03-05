import { useState, useEffect } from "react"
import { TopBar } from "./components/layout/TopBar"
import { ArdenChat } from "./components/panels/ArdenChat"
import { AgentStatus } from "./components/panels/AgentStatus"
import { ThoughtLog } from "./components/panels/ThoughtLog"
import { QuickStats } from "./components/panels/QuickStats"

// Declare Electron preload API
declare global {
  interface Window {
    ardenDesktop?: {
      getServerPort: () => Promise<number>
      getGatewayUrl: () => Promise<string>
      checkGatewayHealth: () => Promise<any>
      onServerReady: (cb: (port: number) => void) => void
    }
  }
}

export function App() {
  const [serverPort, setServerPort] = useState(3141)
  const [gatewayUrl, setGatewayUrl] = useState("http://10.10.10.175:18789")
  const [gatewayHealth, setGatewayHealth] = useState<any>(null)
  const [thoughts, setThoughts] = useState<any[]>([])

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

  return (
    <div className="flex flex-col h-screen relative z-10">
      {/* Title bar drag region */}
      <div className="titlebar-drag h-9 flex items-center px-4 bg-bg-deep/90 border-b border-white/5">
        <span className="text-[11px] tracking-[0.3em] uppercase text-neon-cyan/80 font-medium titlebar-nodrag">
          Arden Desktop
        </span>
        <span className="text-[9px] text-slate-500 ml-2 titlebar-nodrag">v1.0.0</span>
        <div className="flex-1" />
        {/* Gateway status dot */}
        <div className="flex items-center gap-2 titlebar-nodrag">
          <div
            className="w-2 h-2 rounded-full"
            style={{
              backgroundColor: gatewayHealth?.status === "ok" ? "#00ff88" : gatewayHealth?.status === "unreachable" ? "#ff3355" : "#6080a0",
              boxShadow: gatewayHealth?.status === "ok" ? "0 0 6px #00ff88" : "none",
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
        <div className="flex-1 flex flex-col min-w-0">
          <ArdenChat
            apiBase={apiBase}
            gatewayUrl={gatewayUrl}
            gatewayHealth={gatewayHealth}
            onThought={(thought) => setThoughts(prev => [...prev.slice(-99), thought])}
          />
        </div>

        {/* Right column — Info panels */}
        <div className="w-[280px] flex flex-col gap-2 overflow-y-auto">
          <QuickStats apiBase={apiBase} gatewayHealth={gatewayHealth} />
          <AgentStatus apiBase={apiBase} />
          <ThoughtLog thoughts={thoughts} />
        </div>
      </div>
    </div>
  )
}
