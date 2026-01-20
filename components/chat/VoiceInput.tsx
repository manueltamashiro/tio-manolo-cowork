"use client";

import { useState, useEffect, useRef } from "react";

interface VoiceInputProps {
  onTranscript: (text: string) => void;
  disabled?: boolean;
  isRecording: boolean;
  onToggleRecording: () => void;
}

// Type declarations for Web Speech API
declare global {
  interface Window {
    SpeechRecognition?: {
      prototype: SpeechRecognition;
      new (): SpeechRecognition;
    };
    webkitSpeechRecognition?: {
      prototype: SpeechRecognition;
      new (): SpeechRecognition;
    };
  }
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  onresult: (event: SpeechRecognitionEvent) => void;
  onerror: (event: SpeechRecognitionErrorEvent) => void;
  onend: () => void;
}

interface SpeechRecognitionEvent {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
}

interface SpeechRecognitionResultList {
  readonly length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  readonly length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
  isFinal: boolean;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

export function VoiceInput({
  onTranscript,
  disabled = false,
  isRecording,
  onToggleRecording,
}: VoiceInputProps) {
  const [isSupported, setIsSupported] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const interimTranscriptRef = useRef("");

  useEffect(() => {
    // Check for browser support
    if (typeof window !== "undefined") {
      const SpeechRecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition;

      if (SpeechRecognitionCtor) {
        setIsSupported(true);
        const recognition = new SpeechRecognitionCtor();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = "en-US";

        recognition.onresult = (event: SpeechRecognitionEvent) => {
          let finalTranscript = "";
          let interimTranscript = "";

          for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
              finalTranscript += transcript;
            } else {
              interimTranscript += transcript;
            }
          }

          if (finalTranscript) {
            onTranscript(finalTranscript + " ");
            interimTranscriptRef.current = "";
          } else if (interimTranscript) {
            interimTranscriptRef.current = interimTranscript;
          }
        };

        recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
          console.error("Speech recognition error:", event.error);
          if (event.error === "not-allowed") {
            console.warn("Microphone permission denied");
          }
          stopRecording();
        };

        recognition.onend = () => {
          if (isRecording) {
            // Restart if still supposed to be recording (handles auto-stop)
            try {
              recognition.start();
            } catch {
              stopRecording();
            }
          }
        };

        recognitionRef.current = recognition;
      }
    }

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {
          // Ignore errors when stopping
        }
      }
    };
  }, [onTranscript]);

  const startRecording = () => {
    if (recognitionRef.current && !isRecording) {
      try {
        recognitionRef.current.start();
        onToggleRecording();
      } catch (error) {
        console.error("Failed to start recording:", error);
      }
    }
  };

  const stopRecording = () => {
    if (recognitionRef.current && isRecording) {
      try {
        recognitionRef.current.stop();
      } catch {
        // Ignore errors when stopping
      }
      onToggleRecording();
    }
  };

  const handleClick = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  if (!isSupported) {
    return null;
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled}
      className={`px-3 md:px-4 py-3 rounded-lg transition-colors flex items-center min-h-[48px] min-w-[48px] ${
        isRecording
          ? "bg-red-500 hover:bg-red-600 text-white animate-pulse"
          : "bg-neutral-200 dark:bg-neutral-700 text-neutral-700 dark:text-white hover:bg-neutral-300 dark:hover:bg-neutral-600"
      } disabled:opacity-50 disabled:cursor-not-allowed`}
      title={isRecording ? "Stop recording" : "Start voice input"}
      aria-label={isRecording ? "Stop recording" : "Start voice input"}
    >
      <svg
        className="w-5 h-5"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        {isRecording ? (
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        ) : (
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
          />
        )}
      </svg>
    </button>
  );
}
