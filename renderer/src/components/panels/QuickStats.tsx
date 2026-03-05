import { useState, useEffect } from "react"

interface QuickStatsProps {
  apiBase: string
  gatewayHealth: any
}

export function QuickStats({ apiBase, gatewayHealth }: QuickStatsProps) {
  const [localHealth, setLocalHealth] = useState<any>(null)

  useEffect(() => {
    fetch(`${apiBase}/health`)
      .then(r => r.json())
      .then(setLocalHealth)
      .catch(() => {})
  }, [apiBase])

  const formatUptime = (seconds: number): string => {
    if (!seconds) return "--"
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    return h > 0 ? `${h}h ${m}m` : `${m}m`
  }

  const stats = [
    {
      label: "Local Server",
      value: localHealth?.status === "ok" ? "Online" : "Down",
      color: localHealth?.status === "ok" ? "#00ff88" : "#ff3355",
    },
    {
      label: "Gateway",
      value: gatewayHealth?.status === "ok" ? "Online" : "Offline",
      color: gatewayHealth?.status === "ok" ? "#00ff88" : "#ff3355",
    },
    {
      label: "Cortex",
      value: gatewayHealth?.cortex?.healthy ? "Online" : "Offline",
      color: gatewayHealth?.cortex?.healthy ? "#00ff88" : "#6080a0",
    },
    {
      label: "LM Studio",
      value: gatewayHealth?.lmstudio?.healthy
        ? `${gatewayHealth.lmstudio.modelsLoaded || 0} models`
        : "Offline",
      color: gatewayHealth?.lmstudio?.healthy ? "#00ff88" : "#6080a0",
    },
    {
      label: "GW Uptime",
      value: formatUptime(gatewayHealth?.uptime),
      color: "#4ff2f2",
    },
    {
      label: "WS Clients",
      value: String(gatewayHealth?.websocket?.clients || 0),
      color: "#7c3aed",
    },
  ]

  return (
    <div className="glass-panel flex flex-col">
      <div className="panel-header">
        <span className="panel-title">Status</span>
      </div>
      <div className="p-2 grid grid-cols-2 gap-1.5">
        {stats.map((s) => (
          <div
            key={s.label}
            className="px-2 py-1.5 rounded-md border border-white/5 bg-white/[0.02]"
          >
            <div className="text-[8px] text-slate-500 uppercase tracking-wider">{s.label}</div>
            <div className="text-[11px] font-medium" style={{ color: s.color }}>
              {s.value}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
