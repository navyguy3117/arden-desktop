import { useRef, useEffect } from "react"

interface ThoughtEntry {
  agent: string
  action: string
  detail?: string
  timestamp: string
}

interface ThoughtLogProps {
  thoughts: ThoughtEntry[]
}

const LAYER_COLORS: Record<string, string> = {
  "arden-core": "#4ff2f2",
  "planner": "#7c3aed",
  "lyra": "#ff4be1",
  "code-worker": "#00ff88",
  "file-worker": "#00ff88",
  "shell-automator": "#00ff88",
  "writer": "#00ff88",
  "artist": "#00ff88",
  "researcher": "#ffaa00",
  "sentinel": "#ffaa00",
  "debugger": "#ffaa00",
  "architect": "#ffaa00",
  "tool": "#f97316",
  "system": "#6080a0",
}

export function ThoughtLog({ thoughts }: ThoughtLogProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [thoughts])

  return (
    <div className="glass-panel neon-border-purple flex flex-col">
      <div className="panel-header">
        <span className="panel-title">Thought Log</span>
        <span
          className="panel-badge"
          style={{
            color: "#7c3aed",
            backgroundColor: "rgba(124,58,237,0.1)",
            border: "1px solid rgba(124,58,237,0.3)",
          }}
        >
          {thoughts.length}
        </span>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-2 max-h-[200px]">
        {thoughts.length === 0 ? (
          <div className="text-[10px] text-slate-600 text-center py-4 italic">
            Agent thoughts will appear here...
          </div>
        ) : (
          <div className="space-y-1">
            {thoughts.map((t, i) => {
              const color = LAYER_COLORS[t.agent] || "#6080a0"
              return (
                <div
                  key={i}
                  className="flex items-start gap-2 text-[10px]"
                  style={{ borderLeft: `2px solid ${color}40`, paddingLeft: "6px" }}
                >
                  <span
                    className="font-medium shrink-0 uppercase tracking-wider"
                    style={{ color, fontSize: "8px", minWidth: "60px" }}
                  >
                    {t.agent}
                  </span>
                  <span className="text-slate-400">
                    {t.action}
                    {t.detail && (
                      <span className="text-slate-600 ml-1">— {t.detail}</span>
                    )}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
