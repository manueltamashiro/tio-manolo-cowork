"use client";

import { useState, useEffect } from "react";
import { useOnboardingState } from "@/lib/storage/ui-state";
import { storeApiKey, hasApiKey } from "@/lib/api-key-storage";

type OnboardingStep = "welcome" | "features" | "api-key" | "complete";

interface FeatureCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
}

function FeatureCard({ icon, title, description }: FeatureCardProps) {
  return (
    <div className="bg-neutral-800 rounded-lg border border-neutral-700 p-4">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 text-blue-500">
          {icon}
        </div>
        <div>
          <h3 className="font-medium text-white">{title}</h3>
          <p className="text-sm text-neutral-400 mt-1">{description}</p>
        </div>
      </div>
    </div>
  );
}

export function FirstRunOnboarding({
  onComplete,
}: {
  onComplete: () => void;
}) {
  const [currentStep, setCurrentStep] = useState<OnboardingStep>("welcome");
  const [apiKey, setApiKey] = useState("");
  const [apiKeyError, setApiKeyError] = useState("");
  const [isValidating, setIsValidating] = useState(false);
  const [isKeyVisible, setIsKeyVisible] = useState(false);
  const { setCompleted } = useOnboardingState();

  // Check if API key is already set, skip to complete
  useEffect(() => {
    if (hasApiKey()) {
      setCurrentStep("features");
    }
  }, []);

  const handleNext = () => {
    if (currentStep === "welcome") {
      setCurrentStep("features");
    } else if (currentStep === "features") {
      if (!hasApiKey()) {
        setCurrentStep("api-key");
      } else {
        handleComplete();
      }
    }
  };

  const handleBack = () => {
    if (currentStep === "features") {
      setCurrentStep("welcome");
    } else if (currentStep === "api-key") {
      setCurrentStep("features");
    }
  };

  const handleSkipApiKey = () => {
    // Complete onboarding immediately when skipping
    setCompleted();
    onComplete();
  };

  const handleApiKeySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setApiKeyError("");

    if (!apiKey.trim()) {
      setApiKeyError("API key is required");
      return;
    }

    // Basic format validation
    if (!apiKey.startsWith("sk-ant-")) {
      setApiKeyError("Invalid API key format. It should start with 'sk-ant-'");
      return;
    }

    setIsValidating(true);

    try {
      storeApiKey(apiKey);
      setApiKey("");
      // Complete onboarding immediately after saving API key
      setCompleted();
      onComplete();
    } catch (error) {
      setApiKeyError(
        error instanceof Error ? error.message : "Failed to save API key"
      );
    } finally {
      setIsValidating(false);
    }
  };

  const handleComplete = () => {
    setCompleted();
    onComplete();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900" role="dialog" aria-modal="true" aria-labelledby="onboarding-title">
      <div className="w-full max-w-2xl mx-4">
        {/* Progress Indicator */}
        <div className="flex items-center justify-center gap-2 mb-6" role="progressbar" aria-valuenow={["welcome", "features", "api-key", "complete"].indexOf(currentStep) + 1} aria-valuemin={1} aria-valuemax={4} aria-label="Onboarding progress">
          <span className="sr-only">Step {["welcome", "features", "api-key", "complete"].indexOf(currentStep) + 1} of 4</span>
          <div
            className={`h-1.5 w-12 rounded-full transition-colors ${
              ["welcome", "features", "api-key", "complete"].includes(currentStep)
                ? "bg-blue-500"
                : "bg-neutral-700"
            }`}
            aria-hidden="true"
          />
          <div
            className={`h-1.5 w-12 rounded-full transition-colors ${
              ["features", "api-key", "complete"].includes(currentStep)
                ? "bg-blue-500"
                : "bg-neutral-700"
            }`}
            aria-hidden="true"
          />
          <div
            className={`h-1.5 w-12 rounded-full transition-colors ${
              ["api-key", "complete"].includes(currentStep)
                ? "bg-blue-500"
                : "bg-neutral-700"
            }`}
            aria-hidden="true"
          />
        </div>

        {/* Step Content */}
        <div className="bg-neutral-800 rounded-lg shadow-xl p-8">
          {currentStep === "welcome" && (
            <div className="text-center animate-fade-in">
              <div className="mx-auto w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mb-6" aria-hidden="true">
                <svg
                  className="w-8 h-8 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 10V3L4 14h7v7l9-11h-7z"
                  />
                </svg>
              </div>
              <h1 id="onboarding-title" className="text-3xl font-semibold text-white mb-3">
                Welcome to Tio Manolo Cowork
              </h1>
              <p className="text-neutral-400 mb-8 max-w-md mx-auto">
                Your AI-powered workspace companion. Let&apos;s get you set up in a few quick steps.
              </p>
              <button
                onClick={handleNext}
                className="px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                Get Started
              </button>
            </div>
          )}

          {currentStep === "features" && (
            <div className="animate-fade-in">
              <h2 id="features-title" className="text-2xl font-semibold text-white mb-2">
                Discover the Features
              </h2>
              <p className="text-neutral-400 mb-6">
                Here&apos;s what you can do with Tio Manolo Cowork:
              </p>

              <div className="grid grid-cols-1 gap-3 mb-8" role="list" aria-label="Application features">
                <FeatureCard
                  icon={
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                    </svg>
                  }
                  title="AI Chat Sessions"
                  description="Create multiple chat sessions to organize your conversations with Claude AI."
                />
                <FeatureCard
                  icon={
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  }
                  title="File Attachments"
                  description="Attach files from your workspace to provide context to your conversations."
                />
                <FeatureCard
                  icon={
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                    </svg>
                  }
                  title="File Explorer"
                  description="Browse and select files from your workspace directly in the app."
                />
                <FeatureCard
                  icon={
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  }
                  title="Search History"
                  description="Quickly find past conversations with our search functionality."
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleBack}
                  className="px-6 py-2.5 bg-neutral-700 text-white rounded-lg hover:bg-neutral-600 transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={handleNext}
                  className="flex-1 px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Continue
                </button>
              </div>
            </div>
          )}

          {currentStep === "api-key" && (
            <div className="animate-fade-in">
              <div className="text-center mb-6">
                <div className="mx-auto w-16 h-16 bg-blue-600/20 rounded-full flex items-center justify-center mb-4" aria-hidden="true">
                  <svg
                    className="w-8 h-8 text-blue-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
                    />
                  </svg>
                </div>
                <h2 id="api-key-title" className="text-2xl font-semibold text-white mb-2">
                  Set Up Your API Key
                </h2>
                <p className="text-neutral-400">
                  Enter your Anthropic API key to start chatting with Claude.
                </p>
              </div>

              <form onSubmit={handleApiKeySubmit} className="space-y-4 mb-6" noValidate>
                <div>
                  <label htmlFor="onboarding-api-key" className="sr-only">Anthropic API Key</label>
                  <div className="relative">
                    <input
                      id="onboarding-api-key"
                      type={isKeyVisible ? "text" : "password"}
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder="sk-ant-api03-..."
                      className="w-full px-4 py-3 bg-neutral-700 text-white rounded-lg border border-neutral-600 focus:outline-none focus:border-blue-500"
                      autoFocus
                      aria-invalid={apiKeyError ? "true" : undefined}
                      aria-describedby={apiKeyError ? "api-key-error" : undefined}
                    />
                    <button
                      type="button"
                      onClick={() => setIsKeyVisible(!isKeyVisible)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white"
                      aria-label={isKeyVisible ? "Hide API key" : "Show API key"}
                      aria-pressed={isKeyVisible}
                    >
                      {isKeyVisible ? (
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                        </svg>
                      ) : (
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      )}
                    </button>
                  </div>
                  {apiKeyError && (
                    <p id="api-key-error" className="mt-2 text-sm text-red-400" role="alert">{apiKeyError}</p>
                  )}
                </div>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={handleBack}
                    className="px-6 py-2.5 bg-neutral-700 text-white rounded-lg hover:bg-neutral-600 transition-colors"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={isValidating || !apiKey.trim()}
                    className="flex-1 px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    aria-busy={isValidating}
                  >
                    {isValidating ? "Saving..." : "Save API Key"}
                  </button>
                </div>
              </form>

              <div className="border-t border-neutral-700 pt-4">
                <p className="text-sm text-neutral-400 mb-3">
                  Get your API key from{" "}
                  <a
                    href="https://console.anthropic.com/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 hover:text-blue-300 underline"
                  >
                    console.anthropic.com
                  </a>
                </p>
                <button
                  type="button"
                  onClick={handleSkipApiKey}
                  className="text-sm text-neutral-500 hover:text-neutral-400 transition-colors"
                  data-testid="skip-api-key"
                >
                  Skip for now (can add later in Settings)
                </button>
              </div>
            </div>
          )}

          {currentStep === "complete" && (
            <div className="text-center animate-fade-in">
              <div className="mx-auto w-16 h-16 bg-green-600 rounded-full flex items-center justify-center mb-6" aria-hidden="true">
                <svg
                  className="w-8 h-8 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <h2 id="complete-title" className="text-2xl font-semibold text-white mb-3">
                You&apos;re All Set!
              </h2>
              <p className="text-neutral-400 mb-8 max-w-md mx-auto">
                Tio Manolo Cowork is ready to use. Start a conversation or explore the settings.
              </p>
              <button
                onClick={handleComplete}
                className="px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                Start Chatting
              </button>
            </div>
          )}
        </div>

        {/* Keyboard hint */}
        <div className="text-center mt-4">
          <p className="text-xs text-neutral-500">
            Press <kbd className="px-1.5 py-0.5 bg-neutral-800 rounded text-neutral-400">Enter</kbd> to continue
          </p>
        </div>
      </div>
    </div>
  );
}

export default FirstRunOnboarding;
