import { useState, useEffect } from "react"

interface AgentStatusProps {
  apiBase: string
}

interface Agent {
  name: string
  model: string
  description: string
  layer: string
}

const LAYER_STYLES: Record<string, { color: string; label: string }> = {
  think: { color: "#4ff2f2", label: "THINK" },
  do: { color: "#00ff88", label: "DO" },
  observe: { color: "#ffaa00", label: "OBSERVE" },
}

export function AgentStatus({ apiBase }: AgentStatusProps) {
  const [agents, setAgents] = useState<Agent[]>([])
  const [collapsed, setCollapsed] = useState(true)

  useEffect(() => {
    fetch(`${apiBase}/api/agents`)
      .then(r => r.json())
      .then(data => setAgents(data.agents || []))
      .catch(() => {})
  }, [apiBase])

  const grouped = agents.reduce((acc, a) => {
    const layer = a.layer || "think"
    if (!acc[layer]) acc[layer] = []
    acc[layer].push(a)
    return acc
  }, {} as Record<string, Agent[]>)

  return (
    <div className="glass-panel flex flex-col">
      <div
        className="panel-header cursor-pointer"
        onClick={() => setCollapsed(!collapsed)}
      >
        <span className="panel-title">Agents</span>
        <div className="flex items-center gap-2">
          <span
            className="panel-badge"
            style={{
              color: "#4ff2f2",
              backgroundColor: "rgba(79,242,242,0.1)",
              border: "1px solid rgba(79,242,242,0.3)",
            }}
          >
            {agents.length}
          </span>
          <span className="text-[10px] text-slate-500">
            {collapsed ? "+" : "-"}
          </span>
        </div>
      </div>

      {!collapsed && (
        <div className="p-2 space-y-2 max-h-[300px] overflow-y-auto">
          {Object.entries(grouped).map(([layer, layerAgents]) => {
            const style = LAYER_STYLES[layer] || LAYER_STYLES.think
            return (
              <div key={layer}>
                <div
                  className="text-[8px] uppercase tracking-[0.25em] font-medium mb-1 px-1"
                  style={{ color: style.color }}
                >
                  {style.label} Layer
                </div>
                <div className="space-y-1">
                  {layerAgents.map((a) => (
                    <div
                      key={a.name}
                      className="agent-card status-online px-2 py-1.5 flex items-center justify-between"
                    >
                      <div>
                        <div className="text-[10px] text-slate-300 font-medium">{a.name}</div>
                        <div className="text-[8px] text-slate-500">{a.description}</div>
                      </div>
                      <span className="text-[8px] text-slate-600 uppercase">{a.model}</span>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
