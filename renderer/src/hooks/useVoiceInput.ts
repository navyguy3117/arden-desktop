// ═══════════════════════════════════════════════════
//  useVoiceInput — Web Speech API hook for STT
//  Chrome-native (Electron), no backend needed
// ═══════════════════════════════════════════════════

import { useState, useCallback, useRef, useEffect } from "react";

interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

export function useVoiceInput() {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const recognitionRef = useRef<any>(null);

  const isSupported =
    typeof window !== "undefined" &&
    ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);

  useEffect(() => {
    if (!isSupported) return;

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();

    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    recognition.maxAlternatives = 1;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let finalTranscript = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalTranscript += result[0].transcript;
        }
      }
      if (finalTranscript) {
        setTranscript((prev) => (prev + " " + finalTranscript).trim());
      }
    };

    recognition.onerror = (event: any) => {
      console.warn("[voice-input] Error:", event.error);
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        setIsListening(false);
      }
    };

    recognition.onend = () => {
      if (recognitionRef.current?._shouldRestart) {
        try { recognition.start(); } catch { setIsListening(false); }
      } else {
        setIsListening(false);
      }
    };

    recognitionRef.current = recognition;
    return () => { try { recognition.stop(); } catch {} };
  }, [isSupported]);

  const toggleListening = useCallback(() => {
    if (!recognitionRef.current) return;
    if (isListening) {
      recognitionRef.current._shouldRestart = false;
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      setTranscript("");
      recognitionRef.current._shouldRestart = true;
      try { recognitionRef.current.start(); setIsListening(true); }
      catch (err) { console.warn("[voice-input] Start failed:", err); }
    }
  }, [isListening]);

  const stopListening = useCallback(() => {
    if (!recognitionRef.current) return;
    recognitionRef.current._shouldRestart = false;
    try { recognitionRef.current.stop(); } catch {}
    setIsListening(false);
    setTranscript("");
  }, []);

  const clearTranscript = useCallback(() => setTranscript(""), []);

  return { isListening, isSupported, transcript, toggleListening, stopListening, clearTranscript };
}
