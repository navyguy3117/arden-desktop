import { useState, useEffect } from "react"

interface CostTrackerProps {
  apiBase: string
}

export function CostTracker({ apiBase }: CostTrackerProps) {
  const [totalCost, setTotalCost] = useState(0)
  const [sessionCount, setSessionCount] = useState(0)
  const [messageCount, setMessageCount] = useState(0)

  useEffect(() => {
    fetch(`${apiBase}/api/sessions`)
      .then(r => r.json())
      .then(data => {
        const sessions = data.sessions || []
        setSessionCount(sessions.length)
        setTotalCost(sessions.reduce((sum: number, s: any) => sum + (s.totalCost || 0), 0))
        setMessageCount(sessions.reduce((sum: number, s: any) => sum + (s.messageCount || 0), 0))
      })
      .catch(() => {})
  }, [apiBase])

  const budget = 5.0
  const pct = Math.min(100, (totalCost / budget) * 100)

  return (
    <div className="glass-panel flex flex-col">
      <div className="panel-header">
        <span className="panel-title">Cost</span>
        <span
          className="panel-badge"
          style={{
            color: pct > 80 ? "#ff3355" : "#00ff88",
            backgroundColor: pct > 80 ? "rgba(255,51,85,0.1)" : "rgba(0,255,136,0.1)",
            border: `1px solid ${pct > 80 ? "rgba(255,51,85,0.3)" : "rgba(0,255,136,0.3)"}`,
          }}
        >
          ${totalCost.toFixed(4)}
        </span>
      </div>
      <div className="p-2 space-y-2">
        {/* Budget bar */}
        <div>
          <div className="flex justify-between text-[8px] text-slate-500 mb-1">
            <span>Budget</span>
            <span>${totalCost.toFixed(4)} / ${budget.toFixed(2)}</span>
          </div>
          <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${pct}%`,
                backgroundColor: pct > 80 ? "#ff3355" : pct > 50 ? "#ffaa00" : "#00ff88",
              }}
            />
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-1">
          <div className="px-2 py-1 rounded-md border border-white/5">
            <div className="text-[8px] text-slate-500">Sessions</div>
            <div className="text-[11px] text-slate-300 font-medium">{sessionCount}</div>
          </div>
          <div className="px-2 py-1 rounded-md border border-white/5">
            <div className="text-[8px] text-slate-500">Messages</div>
            <div className="text-[11px] text-slate-300 font-medium">{messageCount}</div>
          </div>
        </div>
      </div>
    </div>
  )
}
