// ═══════════════════════════════════════════════════
//  VoiceWaveform — SVG ring of 32 bars
//  Driven by AnalyserNode frequency data via custom events
// ═══════════════════════════════════════════════════

import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";

const BAR_COUNT = 32;
const RING_RADIUS = 20;
const BAR_MIN_HEIGHT = 1;
const BAR_MAX_HEIGHT = 10;
const BAR_WIDTH = 2;

export function VoiceWaveform() {
  const [bars, setBars] = useState<number[]>(new Array(BAR_COUNT).fill(0));
  const barsRef = useRef<number[]>(new Array(BAR_COUNT).fill(0));

  useEffect(() => {
    function handleAnalyserData(e: CustomEvent<{ data: Uint8Array }>) {
      const data = e.detail.data;
      const newBars: number[] = [];

      for (let i = 0; i < BAR_COUNT; i++) {
        const binIndex = Math.min(i, data.length - 1);
        const value = data[binIndex] / 255;
        const height = BAR_MIN_HEIGHT + value * (BAR_MAX_HEIGHT - BAR_MIN_HEIGHT);
        const prev = barsRef.current[i] || 0;
        newBars.push(prev * 0.3 + height * 0.7);
      }

      barsRef.current = newBars;
      setBars(newBars);
    }

    window.addEventListener("arden:analyser-data", handleAnalyserData as EventListener);
    return () => {
      window.removeEventListener("arden:analyser-data", handleAnalyserData as EventListener);
    };
  }, []);

  return (
    <motion.svg
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.3 }}
      width="50"
      height="50"
      viewBox="0 0 50 50"
      style={{ pointerEvents: "none" }}
    >
      {bars.map((height, i) => {
        const angle = (i / BAR_COUNT) * Math.PI * 2 - Math.PI / 2;
        const cx = 25 + Math.cos(angle) * RING_RADIUS;
        const cy = 25 + Math.sin(angle) * RING_RADIUS;
        const dx = Math.cos(angle);
        const dy = Math.sin(angle);
        const x2 = cx + dx * height;
        const y2 = cy + dy * height;
        const intensity = Math.min(1, height / BAR_MAX_HEIGHT);
        const alpha = 0.3 + intensity * 0.7;

        return (
          <line
            key={i}
            x1={cx} y1={cy} x2={x2} y2={y2}
            stroke={`rgba(var(--theme-primary-rgb), ${alpha})`}
            strokeWidth={BAR_WIDTH}
            strokeLinecap="round"
            style={{
              filter: intensity > 0.5
                ? `drop-shadow(0 0 ${2 + intensity * 4}px rgba(var(--theme-primary-rgb), ${intensity * 0.6}))`
                : "none",
            }}
          />
        );
      })}
    </motion.svg>
  );
}
