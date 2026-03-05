import { useState, useEffect, useCallback } from "react"

interface SessionMeta {
  id: string
  title: string
  createdAt: string
  updatedAt: string
  messageCount: number
  totalCost: number
}

interface SessionListProps {
  apiBase: string
  activeSessionId: string | null
  onSelectSession: (id: string) => void
  onNewSession: () => void
}

export function SessionList({ apiBase, activeSessionId, onSelectSession, onNewSession }: SessionListProps) {
  const [sessions, setSessions] = useState<SessionMeta[]>([])
  const [collapsed, setCollapsed] = useState(false)

  const refresh = useCallback(() => {
    fetch(`${apiBase}/api/sessions`)
      .then(r => r.json())
      .then(data => setSessions(data.sessions || []))
      .catch(() => {})
  }, [apiBase])

  useEffect(() => {
    refresh()
    const t = setInterval(refresh, 15000)
    return () => clearInterval(t)
  }, [refresh])

  const formatTime = (iso: string) => {
    const d = new Date(iso)
    const now = new Date()
    const diff = now.getTime() - d.getTime()
    if (diff < 60000) return "just now"
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
    return d.toLocaleDateString()
  }

  return (
    <div className="glass-panel flex flex-col">
      <div className="panel-header cursor-pointer" onClick={() => setCollapsed(!collapsed)}>
        <span className="panel-title">Sessions</span>
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => { e.stopPropagation(); onNewSession() }}
            className="text-[9px] px-2 py-0.5 rounded border border-neon-cyan/30 text-neon-cyan/80 hover:bg-neon-cyan/10 transition-all"
          >
            + New
          </button>
          <span className="text-[10px] text-slate-500">{collapsed ? "+" : "-"}</span>
        </div>
      </div>

      {!collapsed && (
        <div className="p-2 space-y-1 max-h-[200px] overflow-y-auto">
          {sessions.length === 0 ? (
            <div className="text-[10px] text-slate-600 text-center py-3 italic">
              No sessions yet
            </div>
          ) : (
            sessions.map((s) => (
              <button
                key={s.id}
                onClick={() => onSelectSession(s.id)}
                className="w-full text-left px-2 py-1.5 rounded-md transition-all"
                style={{
                  backgroundColor: s.id === activeSessionId ? "rgba(79,242,242,0.08)" : "rgba(255,255,255,0.02)",
                  border: s.id === activeSessionId ? "1px solid rgba(79,242,242,0.2)" : "1px solid transparent",
                }}
              >
                <div className="text-[10px] text-slate-300 truncate">{s.title}</div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[8px] text-slate-600">{s.messageCount} msgs</span>
                  <span className="text-[8px] text-slate-600">{formatTime(s.updatedAt)}</span>
                  {s.totalCost > 0 && (
                    <span className="text-[8px] text-neon-cyan/50">${s.totalCost.toFixed(4)}</span>
                  )}
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
