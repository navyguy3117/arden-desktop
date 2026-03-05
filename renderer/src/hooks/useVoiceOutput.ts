// ═══════════════════════════════════════════════════
//  useVoiceOutput — Audio playback with AnalyserNode
//  for waveform visualization data
// ═══════════════════════════════════════════════════

import { useState, useCallback, useRef, useEffect } from "react";

export function useVoiceOutput() {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);

  const getAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext();
    }
    if (audioContextRef.current.state === "suspended") {
      audioContextRef.current.resume();
    }
    return audioContextRef.current;
  }, []);

  const broadcastAnalyserData = useCallback(() => {
    if (!analyserRef.current) return;
    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(dataArray);
    window.dispatchEvent(
      new CustomEvent("arden:analyser-data", { detail: { data: dataArray } })
    );
    rafRef.current = requestAnimationFrame(broadcastAnalyserData);
  }, []);

  const playAudio = useCallback(
    async (url: string) => {
      try {
        if (sourceRef.current) {
          try { sourceRef.current.stop(); } catch {}
        }

        const ctx = getAudioContext();
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Audio fetch failed: ${response.status}`);
        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await ctx.decodeAudioData(arrayBuffer);

        const analyser = ctx.createAnalyser();
        analyser.fftSize = 64;
        analyser.smoothingTimeConstant = 0.8;
        analyserRef.current = analyser;

        const source = ctx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(analyser);
        analyser.connect(ctx.destination);
        sourceRef.current = source;

        setIsSpeaking(true);
        window.dispatchEvent(new CustomEvent("arden:speaking-start"));
        broadcastAnalyserData();

        source.onended = () => {
          setIsSpeaking(false);
          window.dispatchEvent(new CustomEvent("arden:speaking-end"));
          if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
          sourceRef.current = null;
          analyserRef.current = null;
        };

        source.start(0);
      } catch (err) {
        console.warn("[voice-output] Playback failed:", err);
        setIsSpeaking(false);
        window.dispatchEvent(new CustomEvent("arden:speaking-end"));
      }
    },
    [getAudioContext, broadcastAnalyserData]
  );

  const stopAudio = useCallback(() => {
    if (sourceRef.current) {
      try { sourceRef.current.stop(); } catch {}
      sourceRef.current = null;
    }
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    setIsSpeaking(false);
    window.dispatchEvent(new CustomEvent("arden:speaking-end"));
  }, []);

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (sourceRef.current) { try { sourceRef.current.stop(); } catch {} }
      if (audioContextRef.current) { audioContextRef.current.close().catch(() => {}); }
    };
  }, []);

  return { isSpeaking, playAudio, stopAudio };
}
