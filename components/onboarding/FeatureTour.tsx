"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";

export interface TourStep {
  id: string;
  title: string;
  description: string;
  target: string; // CSS selector for the target element
  position?: "top" | "bottom" | "left" | "right" | "center";
}

interface FeatureTourProps {
  steps: TourStep[];
  isOpen: boolean;
  onClose: () => void;
  onComplete?: () => void;
}

export function FeatureTour({ steps, isOpen, onClose, onComplete }: FeatureTourProps) {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [highlightedRect, setHighlightedRect] = useState<DOMRect | null>(null);
  const [arrowPosition, setArrowPosition] = useState<"top" | "bottom" | "left" | "right" | "center">("bottom");

  const currentStep = steps[currentStepIndex];
  const isLastStep = currentStepIndex === steps.length - 1;
  const isFirstStep = currentStepIndex === 0;

  // Find and highlight target element
  useEffect(() => {
    if (!isOpen || !currentStep) {
      setHighlightedRect(null);
      return;
    }

    const targetElement = document.querySelector(currentStep.target);
    if (targetElement) {
      const rect = targetElement.getBoundingClientRect();
      setHighlightedRect(rect);

      // Determine arrow position based on step position or auto-detect
      const position = currentStep.position || detectBestPosition(rect);
      setArrowPosition(position);
    } else {
      console.warn(`Tour target not found: ${currentStep.target}`);
      // If target not found, center the tooltip
      setHighlightedRect(null);
    }
  }, [isOpen, currentStep, currentStepIndex]);

  // Handle keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "ArrowRight" || e.key === "Enter") {
        handleNext();
      } else if (e.key === "ArrowLeft") {
        handlePrevious();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, currentStepIndex, steps.length]);

  function detectBestPosition(rect: DOMRect): "top" | "bottom" | "left" | "right" {
    // const viewportWidth = window.innerWidth; // Reserved for future horizontal positioning logic
    const viewportHeight = window.innerHeight;

    // Prefer bottom or top based on vertical space
    const spaceBelow = viewportHeight - rect.bottom;
    const spaceAbove = rect.top;

    if (spaceBelow < 200 && spaceAbove > 200) {
      return "top";
    }
    return "bottom";
  }

  function handleNext() {
    if (isLastStep) {
      if (onComplete) {
        onComplete();
      }
      onClose();
    } else {
      setCurrentStepIndex((prev) => prev + 1);
    }
  }

  function handlePrevious() {
    if (!isFirstStep) {
      setCurrentStepIndex((prev) => prev - 1);
    }
  }

  function handleSkip() {
    onClose();
  }

  if (!isOpen) return null;

  // Tooltip position calculation
  const getTooltipStyle = (): React.CSSProperties => {
    if (!highlightedRect) {
      // Center in viewport if no target
      return {
        position: "fixed",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        maxWidth: "400px",
        width: "calc(100% - 2rem)",
      };
    }

    const margin = 12;
    const tooltipWidth = 350;
    // const tooltipHeight = 200; // Approximate - reserved for future calculations

    let top = 0;
    let left = 0;

    switch (arrowPosition) {
      case "bottom":
        top = highlightedRect.bottom + margin;
        left = highlightedRect.left + highlightedRect.width / 2;
        return {
          position: "fixed",
          top: `${top}px`,
          left: `${left}px`,
          transform: "translateX(-50%)",
          maxWidth: `${tooltipWidth}px`,
          width: "calc(100% - 2rem)",
        };
      case "top":
        top = highlightedRect.top - margin;
        left = highlightedRect.left + highlightedRect.width / 2;
        return {
          position: "fixed",
          top: `${top}px`,
          left: `${left}px`,
          transform: "translate(-50%, 100%)",
          maxWidth: `${tooltipWidth}px`,
          width: "calc(100% - 2rem)",
        };
      case "left":
        top = highlightedRect.top + highlightedRect.height / 2;
        left = highlightedRect.left - margin;
        return {
          position: "fixed",
          top: `${top}px`,
          left: `${left}px`,
          transform: "translate(-100%, -50%)",
          maxWidth: `${tooltipWidth}px`,
          width: "calc(100% - 2rem)",
        };
      case "right":
        top = highlightedRect.top + highlightedRect.height / 2;
        left = highlightedRect.right + margin;
        return {
          position: "fixed",
          top: `${top}px`,
          left: `${left}px`,
          transform: "translate(0, -50%)",
          maxWidth: `${tooltipWidth}px`,
          width: "calc(100% - 2rem)",
        };
      default:
        return {
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
        };
    }
  };

  // Arrow indicator
  const getArrowStyle = (): React.CSSProperties => {
    if (!highlightedRect) return { display: "none" };

    const arrowSize = 8;
    switch (arrowPosition) {
      case "bottom":
        return {
          position: "fixed",
          top: `${highlightedRect.bottom + arrowSize}px`,
          left: `${highlightedRect.left + highlightedRect.width / 2}px`,
          transform: "translateX(-50%) translateY(-100%) rotate(180deg)",
        };
      case "top":
        return {
          position: "fixed",
          top: `${highlightedRect.top - arrowSize}px`,
          left: `${highlightedRect.left + highlightedRect.width / 2}px`,
          transform: "translateX(-50%) translateY(100%)",
        };
      default:
        return { display: "none" };
    }
  };

  const tooltipStyle = getTooltipStyle();

  return createPortal(
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50 z-[1100]" onClick={onClose} />

      {/* Spotlight highlight */}
      {highlightedRect && (
        <div
          className="fixed z-[1101] pointer-events-none transition-all duration-300"
          style={{
            top: `${highlightedRect.top - 4}px`,
            left: `${highlightedRect.left - 4}px`,
            width: `${highlightedRect.width + 8}px`,
            height: `${highlightedRect.height + 8}px`,
            borderRadius: "8px",
            boxShadow: "0 0 0 4px rgba(59, 130, 246, 0.5), 0 0 0 9999px rgba(0, 0, 0, 0.5)",
          }}
        />
      )}

      {/* Arrow */}
      <div
        className="z-[1102] pointer-events-none"
        style={getArrowStyle()}
      >
        <svg width="16" height="8" viewBox="0 0 16 8" fill="none">
          <path d="M8 8L0 0H16L8 8Z" fill="#1f2937" />
        </svg>
      </div>

      {/* Tooltip */}
      <div
        className="fixed z-[1103] bg-neutral-800 rounded-lg shadow-xl border border-neutral-700 p-5 animate-fade-in"
        style={tooltipStyle}
      >
        {/* Progress indicator */}
        <div className="flex items-center gap-2 mb-3">
          {steps.map((_, index) => (
            <div
              key={index}
              className={`h-1 flex-1 rounded-full transition-colors ${
                index <= currentStepIndex ? "bg-blue-500" : "bg-neutral-700"
              }`}
            />
          ))}
        </div>

        {/* Title */}
        <h3 className="text-lg font-semibold text-white mb-2">
          {currentStep?.title || "Tour"}
        </h3>

        {/* Description */}
        <p className="text-sm text-neutral-400 mb-4">
          {currentStep?.description || ""}
        </p>

        {/* Buttons */}
        <div className="flex items-center justify-between">
          <button
            onClick={handleSkip}
            className="text-sm text-neutral-500 hover:text-neutral-400 transition-colors"
          >
            {isFirstStep ? "Skip tour" : "Close"}
          </button>
          <div className="flex gap-2">
            {!isFirstStep && (
              <button
                onClick={handlePrevious}
                className="px-3 py-1.5 bg-neutral-700 text-white rounded text-sm hover:bg-neutral-600 transition-colors"
              >
                Previous
              </button>
            )}
            <button
              onClick={handleNext}
              className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 transition-colors"
            >
              {isLastStep ? "Finish" : "Next"}
            </button>
          </div>
        </div>

        {/* Step indicator */}
        <div className="text-center mt-3">
          <span className="text-xs text-neutral-500">
            Step {currentStepIndex + 1} of {steps.length}
          </span>
        </div>
      </div>
    </>,
    document.body
  );
}

// Default tour steps for the app
export const defaultTourSteps: TourStep[] = [
  {
    id: "sidebar",
    title: "Sidebar Navigation",
    description: "Access your chat sessions and file explorer from the sidebar. Click the tabs to switch between sessions and files.",
    target: "[data-sidebar]",
    position: "right",
  },
  {
    id: "new-session",
    title: "Create New Session",
    description: "Click the + button to create a new chat session. Each session is a separate conversation with Claude.",
    target: "[data-new-session-button]",
    position: "bottom",
  },
  {
    id: "chat-input",
    title: "Send Messages",
    description: "Type your message here and press Enter to send. You can also attach files from your workspace.",
    target: "[data-chat-input]",
    position: "top",
  },
  {
    id: "settings",
    title: "Settings",
    description: "Manage your API key and application settings here. You can always update your API key later.",
    target: "[data-settings-link]",
    position: "left",
  },
];
