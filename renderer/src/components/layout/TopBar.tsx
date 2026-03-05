import { useState, useEffect } from "react"

interface TopBarProps {
  gatewayHealth?: any
}

export function TopBar({ gatewayHealth }: TopBarProps) {
  const [time, setTime] = useState(new Date())

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  return (
    <div className="topbar flex items-center justify-between px-4 py-1.5">
      <div className="flex items-center gap-3">
        <span className="text-neon-cyan text-[13px] font-bold tracking-[0.15em]">
          ARDEN
        </span>
        <span className="text-[9px] text-slate-500">DESKTOP v1.0.0</span>
      </div>

      <div className="flex items-center gap-4">
        {/* Status pills */}
        {[
          { label: "GW", ok: gatewayHealth?.status === "ok" },
          { label: "CTX", ok: gatewayHealth?.cortex?.healthy },
          { label: "LM", ok: gatewayHealth?.lmstudio?.healthy },
        ].map(({ label, ok }) => (
          <div key={label} className="flex items-center gap-1.5">
            <div
              className="w-1.5 h-1.5 rounded-full"
              style={{
                backgroundColor: ok ? "#00ff88" : "#6080a0",
                boxShadow: ok ? "0 0 4px #00ff88" : "none",
              }}
            />
            <span className="text-[9px] text-slate-500 uppercase tracking-wider">{label}</span>
          </div>
        ))}
      </div>

      <div className="text-[10px] text-slate-500 font-mono">
        {time.toLocaleTimeString()}
      </div>
    </div>
  )
}
