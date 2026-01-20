"use client";

import { useState, useEffect, useCallback } from "react";
import {
  useThemePreference,
  useFontSizePreference,
  useStreamResponsesPreference,
  useShowTokenUsagePreference,
  type Theme,
  type FontSize,
} from "@/lib/storage/ui-state";
import { useModelPreference } from "@/lib/storage/ui-state";
import { ModelGrid } from "@/components/ModelSelector";
import {
  storeApiKey,
  getApiKeyInfo,
  clearApiKey,
  validateApiKeyFormat,
  validateApiKeyWithApi,
  type ApiKeyInfo,
} from "@/lib/api-key-storage";
import type { ModelId } from "@/types/claude";
import { UpdateNotification, useUpdateChecker } from "@/components/ui/UpdateNotification";
import type { UpdateState } from "@/types/electron";

export type SettingsTab = "api-keys" | "preferences" | "system-prompts" | "about";

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: SettingsTab;
}

export function SettingsPanel({ isOpen, onClose, initialTab = "api-keys" }: SettingsPanelProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab);

  // Reset to initial tab when opening
  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  // Handle keyboard shortcuts
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[1100] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div className="relative bg-neutral-800 rounded-xl shadow-claude-xl max-w-3xl w-full mx-4 max-h-[85vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-700">
          <h2 className="text-xl font-semibold text-white">Settings</h2>
          <button
            onClick={onClose}
            className="p-1 text-neutral-400 hover:text-white hover:bg-neutral-700 rounded transition-colors"
            aria-label="Close settings"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-neutral-700 px-2 overflow-x-auto">
          <TabButton
            isActive={activeTab === "api-keys"}
            onClick={() => setActiveTab("api-keys")}
            icon="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
          >
            API Keys
          </TabButton>
          <TabButton
            isActive={activeTab === "preferences"}
            onClick={() => setActiveTab("preferences")}
            icon="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"
          >
            Preferences
          </TabButton>
          <TabButton
            isActive={activeTab === "system-prompts"}
            onClick={() => setActiveTab("system-prompts")}
            icon="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          >
            System Prompts
          </TabButton>
          <TabButton
            isActive={activeTab === "about"}
            onClick={() => setActiveTab("about")}
            icon="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          >
            About
          </TabButton>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {activeTab === "api-keys" && <ApiKeysTab onClose={onClose} />}
          {activeTab === "preferences" && <PreferencesTab />}
          {activeTab === "system-prompts" && <SystemPromptsTab />}
          {activeTab === "about" && <AboutTab />}
        </div>
      </div>
    </div>
  );
}

interface TabButtonProps {
  isActive: boolean;
  onClick: () => void;
  icon: string;
  children: React.ReactNode;
}

function TabButton({ isActive, onClick, icon, children }: TabButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
        isActive
          ? "text-blue-400 border-blue-500"
          : "text-neutral-400 border-transparent hover:text-neutral-200 hover:bg-neutral-700/50"
      }`}
    >
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={icon} />
      </svg>
      {children}
    </button>
  );
}

// ==================== API Keys Tab ====================

interface ApiKeysTabProps {
  onClose: () => void;
}

function ApiKeysTab({ onClose }: ApiKeysTabProps) {
  const [apiKey, setApiKey] = useState("");
  const [savedKeyInfo, setSavedKeyInfo] = useState<ApiKeyInfo | null>(null);
  const [isKeyVisible, setIsKeyVisible] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<{
    valid: boolean;
    message?: string;
  } | null>(null);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  // Load saved key info on mount
  useEffect(() => {
    setSavedKeyInfo(getApiKeyInfo());
  }, []);

  const handleApiKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setApiKey(e.target.value);
    setValidationResult(null);
    setErrorMessage("");
  };

  const handleValidate = async () => {
    if (!apiKey.trim()) {
      setValidationResult({ valid: false, message: "Please enter an API key" });
      return;
    }

    setIsValidating(true);
    setValidationResult(null);

    try {
      const formatCheck = validateApiKeyFormat(apiKey);
      if (!formatCheck.valid) {
        setValidationResult({ valid: false, message: formatCheck.error });
        setIsValidating(false);
        return;
      }

      const apiValidation = await validateApiKeyWithApi(apiKey);
      setValidationResult({
        valid: apiValidation.valid,
        message: apiValidation.error,
      });
    } catch {
      setValidationResult({
        valid: false,
        message: "Validation failed. Please try again.",
      });
    } finally {
      setIsValidating(false);
    }
  };

  const handleSave = () => {
    setErrorMessage("");
    setSaveStatus("saving");

    try {
      storeApiKey(apiKey);
      setSavedKeyInfo(getApiKeyInfo());
      setApiKey("");
      setIsKeyVisible(false);
      setValidationResult(null);
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 2000);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to save API key");
      setSaveStatus("error");
      setTimeout(() => setSaveStatus("idle"), 3000);
    }
  };

  const handleClear = () => {
    clearApiKey();
    setSavedKeyInfo(null);
    setApiKey("");
    setIsKeyVisible(false);
    setValidationResult(null);
    setErrorMessage("");
  };

  return (
    <div className="p-6 space-y-6">
      {/* Saved key display */}
      {savedKeyInfo && (
        <div className="p-4 bg-neutral-750 rounded-lg border border-neutral-600">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-neutral-400 mb-1">API Key</p>
              <p className="font-mono text-sm text-white">{savedKeyInfo.keyPreview}</p>
            </div>
            <button
              type="button"
              onClick={handleClear}
              className="px-3 py-1.5 text-sm bg-red-600 hover:bg-red-700 text-white rounded transition-colors"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* API Key Input */}
      <div>
        <label htmlFor="apiKey" className="block text-sm font-medium text-neutral-300 mb-2">
          Anthropic API Key
        </label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <input
              id="apiKey"
              type={isKeyVisible ? "text" : "password"}
              value={apiKey}
              onChange={handleApiKeyChange}
              placeholder="sk-ant-..."
              className="w-full px-4 py-2 bg-neutral-700 border border-neutral-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-white"
              disabled={saveStatus === "saving"}
            />
            <button
              type="button"
              onClick={() => setIsKeyVisible(!isKeyVisible)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white transition-colors"
              aria-label={isKeyVisible ? "Hide API key" : "Show API key"}
            >
              {isKeyVisible ? (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
                  />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                  />
                </svg>
              )}
            </button>
          </div>
          <button
            type="button"
            onClick={handleValidate}
            disabled={isValidating || !apiKey.trim()}
            className="px-4 py-2 bg-neutral-700 hover:bg-neutral-600 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isValidating ? "Validating..." : "Validate"}
          </button>
        </div>

        {/* Validation Result */}
        {validationResult && (
          <div className="mt-2">
            {validationResult.valid ? (
              <p className="text-sm text-green-400">API key is valid!</p>
            ) : (
              <p className="text-sm text-red-400">{validationResult.message}</p>
            )}
          </div>
        )}

        {/* Error Message */}
        {errorMessage && (
          <p className="mt-2 text-sm text-red-400">{errorMessage}</p>
        )}
      </div>

      {/* Helper text */}
      <p className="text-sm text-neutral-400">
        Get your API key from{" "}
        <a
          href="https://console.anthropic.com/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-400 hover:text-blue-300 underline"
        >
          console.anthropic.com
        </a>
        . Your API key will be encrypted and stored locally.
      </p>

      {/* Save button */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={!apiKey.trim() || saveStatus === "saving"}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {saveStatus === "saving" && (
            <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
          )}
          {saveStatus === "saved" ? "Saved!" : saveStatus === "saving" ? "Saving..." : "Save API Key"}
        </button>

        {saveStatus === "error" && (
          <span className="text-sm text-red-400">Failed to save. Please try again.</span>
        )}
      </div>

      {/* Security notice */}
      <div className="p-4 bg-blue-900/20 border border-blue-800 rounded-lg">
        <div className="flex gap-3">
          <svg className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <p className="text-sm font-medium text-blue-300">Security Notice</p>
            <p className="text-sm text-neutral-400 mt-1">
              Your API key is encrypted using AES encryption before being stored locally. The encrypted key never leaves your device.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ==================== Preferences Tab ====================

function PreferencesTab() {
  const theme = useThemePreference();
  const fontSize = useFontSizePreference();
  const streamResponses = useStreamResponsesPreference();
  const showTokenUsage = useShowTokenUsagePreference();
  const modelPreference = useModelPreference();

  const [currentTheme, setCurrentTheme] = useState<Theme>(theme.get());
  const [currentFontSize, setCurrentFontSize] = useState<FontSize>(fontSize.get());
  const [currentStream, setCurrentStream] = useState(streamResponses.get());
  const [currentShowTokens, setCurrentShowTokens] = useState(showTokenUsage.get());
  const [selectedModel, setSelectedModel] = useState<ModelId>(modelPreference.get());

  const handleThemeChange = (newTheme: Theme) => {
    setCurrentTheme(newTheme);
    theme.set(newTheme, true);
  };

  const handleFontSizeChange = (newFontSize: FontSize) => {
    setCurrentFontSize(newFontSize);
    fontSize.set(newFontSize, true);
  };

  const handleStreamChange = (value: boolean) => {
    setCurrentStream(value);
    streamResponses.set(value, true);
  };

  const handleShowTokensChange = (value: boolean) => {
    setCurrentShowTokens(value);
    showTokenUsage.set(value, true);
  };

  const handleModelChange = (model: ModelId) => {
    setSelectedModel(model);
    modelPreference.set(model, true);
  };

  return (
    <div className="p-6 space-y-6">
      {/* Model Selection */}
      <section>
        <h3 className="text-lg font-medium text-white mb-4">Model Selection</h3>
        <ModelGrid
          selectedModel={selectedModel}
          onModelChange={handleModelChange}
        />
        <p className="mt-3 text-sm text-neutral-400">
          The selected model will be used for all new conversations.
        </p>
      </section>

      {/* Appearance */}
      <section>
        <h3 className="text-lg font-medium text-white mb-4">Appearance</h3>

        {/* Theme */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-neutral-300 mb-2">Theme</label>
          <div className="flex gap-2">
            {(
              [
                { value: "system", label: "System", icon: "M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" },
                { value: "dark", label: "Dark", icon: "M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" },
                { value: "light", label: "Light", icon: "M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" },
              ] as const
            ).map(({ value, label, icon }) => (
              <button
                key={value}
                onClick={() => handleThemeChange(value)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors ${
                  currentTheme === value
                    ? "bg-blue-600/30 border-blue-500 text-blue-300"
                    : "bg-neutral-700 border-neutral-600 text-neutral-300 hover:bg-neutral-600"
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={icon} />
                </svg>
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Font Size */}
        <div>
          <label className="block text-sm font-medium text-neutral-300 mb-2">Font Size</label>
          <div className="flex gap-2">
            {(
              [
                { value: "small", label: "Small" },
                { value: "medium", label: "Medium" },
                { value: "large", label: "Large" },
              ] as const
            ).map(({ value, label }) => (
              <button
                key={value}
                onClick={() => handleFontSizeChange(value)}
                className={`px-4 py-2 rounded-lg border transition-colors ${
                  currentFontSize === value
                    ? "bg-blue-600/30 border-blue-500 text-blue-300"
                    : "bg-neutral-700 border-neutral-600 text-neutral-300 hover:bg-neutral-600"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Chat Behavior */}
      <section>
        <h3 className="text-lg font-medium text-white mb-4">Chat Behavior</h3>

        <div className="space-y-3">
          {/* Stream Responses */}
          <label className="flex items-center justify-between p-3 bg-neutral-750 rounded-lg border border-neutral-600 cursor-pointer hover:bg-neutral-700 transition-colors">
            <div>
              <p className="text-sm font-medium text-white">Stream Responses</p>
              <p className="text-xs text-neutral-400">Show responses as they are generated</p>
            </div>
            <div className="relative">
              <input
                type="checkbox"
                checked={currentStream}
                onChange={(e) => handleStreamChange(e.target.checked)}
                className="sr-only"
              />
              <div className={`w-11 h-6 rounded-full transition-colors ${currentStream ? "bg-blue-600" : "bg-neutral-600"}`}>
                <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${currentStream ? "translate-x-5" : "translate-x-0.5"} mt-0.5`} />
              </div>
            </div>
          </label>

          {/* Show Token Usage */}
          <label className="flex items-center justify-between p-3 bg-neutral-750 rounded-lg border border-neutral-600 cursor-pointer hover:bg-neutral-700 transition-colors">
            <div>
              <p className="text-sm font-medium text-white">Show Token Usage</p>
              <p className="text-xs text-neutral-400">Display token counts for messages</p>
            </div>
            <div className="relative">
              <input
                type="checkbox"
                checked={currentShowTokens}
                onChange={(e) => handleShowTokensChange(e.target.checked)}
                className="sr-only"
              />
              <div className={`w-11 h-6 rounded-full transition-colors ${currentShowTokens ? "bg-blue-600" : "bg-neutral-600"}`}>
                <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${currentShowTokens ? "translate-x-5" : "translate-x-0.5"} mt-0.5`} />
              </div>
            </div>
          </label>
        </div>
      </section>

      {/* Data Management */}
      <section>
        <h3 className="text-lg font-medium text-white mb-4">Data Management</h3>
        <button
          onClick={() => {
            if (confirm("Are you sure you want to clear all local data? This will log you out and clear all preferences.")) {
              localStorage.clear();
              window.location.reload();
            }
          }}
          className="px-4 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-600/50 rounded-lg transition-colors"
        >
          Clear All Local Data
        </button>
      </section>
    </div>
  );
}

// ==================== About Tab ====================

function AboutTab() {
  const [appVersion, setAppVersion] = useState<string>("1.0.0");
  const [updateState, setUpdateState] = useState<UpdateState | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const { checkForUpdates, downloadUpdate, installUpdateAndRestart } = useUpdateChecker();

  // Load app version on mount
  useEffect(() => {
    const loadVersion = async () => {
      if (window.electronAPI) {
        try {
          const version = await window.electronAPI.getAppVersion();
          setAppVersion(version);
          const state = await window.electronAPI.getUpdateState();
          setUpdateState(state);
        } catch {
          // Keep default version
        }
      }
    };
    loadVersion();
  }, []);

  // Set up update event listeners
  useEffect(() => {
    if (!window.electronAPI) return;

    const handleUpdateEvent = async (event: string, data?: any) => {
      setIsChecking(false);

      if (event === "update:available" || event === "update:not-available" || event === "update:downloaded") {
        const state = await window.electronAPI.getUpdateState();
        setUpdateState(state);
      }
    };

    window.electronAPI.onUpdateEvent(handleUpdateEvent);

    return () => {
      // Note: electronAPI doesn't provide a cleanup method
    };
  }, []);

  const handleCheckForUpdates = async () => {
    setIsChecking(true);
    try {
      await checkForUpdates();
    } catch (err) {
      console.error("Failed to check for updates:", err);
      setIsChecking(false);
    }
  };

  const handleDownloadUpdate = async () => {
    try {
      await downloadUpdate();
    } catch (err) {
      console.error("Failed to download update:", err);
    }
  };

  const handleInstallUpdate = () => {
    installUpdateAndRestart();
  };

  return (
    <div className="p-6 space-y-6">
      {/* App Info */}
      <div className="text-center py-6">
        <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl mx-auto mb-4 flex items-center justify-center">
          <span className="text-2xl font-bold text-white">TM</span>
        </div>
        <h3 className="text-xl font-semibold text-white">Tio Manolo Cowork</h3>
        <p className="text-neutral-400 mt-1">AI-powered workspace assistant</p>
        <p className="text-sm text-neutral-500 mt-2">Version {appVersion}</p>
      </div>

      {/* Update Section (Electron only) */}
      {typeof window !== "undefined" && window.electronAPI && (
        <section>
          <h4 className="text-sm font-medium text-neutral-300 uppercase tracking-wide mb-3">Updates</h4>

          {/* Inline update notification */}
          <UpdateNotification inline />

          {/* Check for updates button */}
          {!updateState?.available && !updateState?.downloaded && (
            <button
              onClick={handleCheckForUpdates}
              disabled={isChecking}
              className="w-full px-4 py-2 bg-neutral-700 hover:bg-neutral-600 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isChecking ? (
                <>
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Checking for updates...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Check for Updates
                </>
              )}
            </button>
          )}

          {/* Download progress */}
          {updateState?.downloading && (
            <div className="p-4 bg-neutral-750 rounded-lg border border-neutral-600">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-neutral-300">Downloading update...</span>
                <span className="text-xs text-neutral-400">
                  {Math.round(updateState.percent)}%
                </span>
              </div>
              <div className="w-full bg-neutral-700 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${updateState.percent}%` }}
                />
              </div>
            </div>
          )}

          {/* Install prompt */}
          {updateState?.downloaded && (
            <div className="p-4 bg-green-900/20 border border-green-800 rounded-lg">
              <p className="text-sm text-green-300 mb-3">
                Update ready to install!
              </p>
              <button
                onClick={handleInstallUpdate}
                className="w-full px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
              >
                Restart & Install
              </button>
            </div>
          )}
        </section>
      )}

      {/* Features */}
      <section>
        <h4 className="text-sm font-medium text-neutral-300 uppercase tracking-wide mb-3">Features</h4>
        <ul className="space-y-2 text-sm text-neutral-400">
          <li className="flex items-start gap-2">
            <svg className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Chat with Claude AI models (Sonnet, Haiku, Opus)
          </li>
          <li className="flex items-start gap-2">
            <svg className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            File browser with code editor integration
          </li>
          <li className="flex items-start gap-2">
            <svg className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Persistent chat history with search
          </li>
          <li className="flex items-start gap-2">
            <svg className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            File attachments and context awareness
          </li>
          <li className="flex items-start gap-2">
            <svg className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Local encrypted API key storage
          </li>
          <li className="flex items-start gap-2">
            <svg className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Automatic updates (Electron app)
          </li>
        </ul>
      </section>

      {/* Links */}
      <section>
        <h4 className="text-sm font-medium text-neutral-300 uppercase tracking-wide mb-3">Links</h4>
        <div className="space-y-2">
          <a
            href="https://console.anthropic.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm text-neutral-400 hover:text-white transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
            Anthropic Console
            <svg className="w-3 h-3 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
          <a
            href="https://docs.anthropic.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm text-neutral-400 hover:text-white transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
            Claude API Documentation
            <svg className="w-3 h-3 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
        </div>
      </section>

      {/* License */}
      <div className="p-4 bg-neutral-750 rounded-lg border border-neutral-600 text-center">
        <p className="text-sm text-neutral-400">
          Built with Claude AI & Next.js
        </p>
        <p className="text-xs text-neutral-500 mt-1">
          © 2025 Tio Manolo Cowork
        </p>
      </div>
    </div>
  );
}

// ==================== System Prompts Tab ====================

function SystemPromptsTab() {
  const [templates, setTemplates] = useState<Array<{
    id: string;
    name: string;
    content: string;
    category: string;
    tags?: string[];
    isDefault: boolean;
  }>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<typeof templates[0] | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    content: "",
    category: "custom",
    tags: "",
  });

  // Load templates
  const loadTemplates = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/system-prompts");
      const data = await response.json();
      setTemplates(data.templates || []);
    } catch (error) {
      console.error("Failed to load system prompt templates:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  // Get unique categories
  const categories = ["all", ...new Set(templates.map((t) => t.category))];

  // Filter templates
  const filteredTemplates = templates.filter((template) => {
    const matchesSearch =
      searchQuery === "" ||
      template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      template.content.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCategory =
      selectedCategory === "all" || template.category === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  const handleCreateNew = () => {
    setEditingTemplate(null);
    setFormData({
      name: "",
      content: "",
      category: "custom",
      tags: "",
    });
    setIsEditing(true);
    setErrorMessage("");
  };

  const handleEdit = (template: typeof templates[0]) => {
    setEditingTemplate(template);
    setFormData({
      name: template.name,
      content: template.content,
      category: template.category,
      tags: template.tags?.join(", ") || "",
    });
    setIsEditing(true);
    setErrorMessage("");
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditingTemplate(null);
    setFormData({
      name: "",
      content: "",
      category: "custom",
      tags: "",
    });
    setErrorMessage("");
  };

  const handleSave = async () => {
    if (!formData.name.trim() || !formData.content.trim()) {
      setErrorMessage("Name and content are required");
      return;
    }

    setSaveStatus("saving");
    setErrorMessage("");

    try {
      const tags = formData.tags
        ? formData.tags
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean)
        : undefined;

      if (editingTemplate) {
        // Update existing
        const response = await fetch(`/api/system-prompts/${editingTemplate.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: formData.name,
            content: formData.content,
            category: formData.category,
            tags,
          }),
        });

        if (!response.ok) {
          throw new Error("Failed to update template");
        }
      } else {
        // Create new
        const response = await fetch("/api/system-prompts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: formData.name,
            content: formData.content,
            category: formData.category,
            tags,
          }),
        });

        if (!response.ok) {
          throw new Error("Failed to create template");
        }
      }

      setSaveStatus("saved");
      await loadTemplates();
      handleCancel();

      setTimeout(() => setSaveStatus("idle"), 2000);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to save template");
      setSaveStatus("error");
      setTimeout(() => setSaveStatus("idle"), 3000);
    }
  };

  const handleDelete = async (template: typeof templates[0]) => {
    if (template.isDefault) {
      alert("Default templates cannot be deleted.");
      return;
    }

    if (!confirm(`Are you sure you want to delete "${template.name}"?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/system-prompts/${template.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete template");
      }

      await loadTemplates();
    } catch (error) {
      console.error("Failed to delete template:", error);
      alert("Failed to delete template. Please try again.");
    }
  };

  const handleSetDefault = async (template: typeof templates[0]) => {
    try {
      const response = await fetch(`/api/system-prompts/${template.id}?action=set-default`, {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Failed to set default template");
      }

      await loadTemplates();
    } catch (error) {
      console.error("Failed to set default template:", error);
      alert("Failed to set default template. Please try again.");
    }
  };

  if (isEditing) {
    return (
      <div className="p-6 space-y-6">
        <div>
          <h3 className="text-lg font-medium text-white mb-4">
            {editingTemplate ? "Edit System Prompt" : "New System Prompt"}
          </h3>
        </div>

        {/* Name */}
        <div>
          <label htmlFor="promptName" className="block text-sm font-medium text-neutral-300 mb-2">
            Name
          </label>
          <input
            id="promptName"
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="e.g., Code Review Assistant"
            className="w-full px-4 py-2 bg-neutral-700 border border-neutral-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-white"
          />
        </div>

        {/* Category */}
        <div>
          <label htmlFor="promptCategory" className="block text-sm font-medium text-neutral-300 mb-2">
            Category
          </label>
          <select
            id="promptCategory"
            value={formData.category}
            onChange={(e) => setFormData({ ...formData, category: e.target.value })}
            className="w-full px-4 py-2 bg-neutral-700 border border-neutral-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-white"
          >
            <option value="custom">Custom</option>
            <option value="coding">Coding</option>
            <option value="writing">Writing</option>
            <option value="creative">Creative</option>
            <option value="technical">Technical</option>
            <option value="general">General</option>
          </select>
        </div>

        {/* Tags */}
        <div>
          <label htmlFor="promptTags" className="block text-sm font-medium text-neutral-300 mb-2">
            Tags (optional)
          </label>
          <input
            id="promptTags"
            type="text"
            value={formData.tags}
            onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
            placeholder="e.g., code-review, debugging, typescript"
            className="w-full px-4 py-2 bg-neutral-700 border border-neutral-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-white"
          />
        </div>

        {/* Content */}
        <div>
          <label htmlFor="promptContent" className="block text-sm font-medium text-neutral-300 mb-2">
            System Prompt Content
          </label>
          <textarea
            id="promptContent"
            value={formData.content}
            onChange={(e) => setFormData({ ...formData, content: e.target.value })}
            placeholder="You are a helpful assistant..."
            rows={8}
            className="w-full px-4 py-2 bg-neutral-700 border border-neutral-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-white resize-y"
          />
        </div>

        {/* Error message */}
        {errorMessage && (
          <p className="text-sm text-red-400">{errorMessage}</p>
        )}

        {/* Actions */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={saveStatus === "saving"}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {saveStatus === "saving" && (
              <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
            )}
            {saveStatus === "saved" ? "Saved!" : saveStatus === "saving" ? "Saving..." : "Save Template"}
          </button>
          <button
            onClick={handleCancel}
            className="px-4 py-2 bg-neutral-700 hover:bg-neutral-600 text-white rounded-lg transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-white">System Prompt Templates</h3>
        <button
          onClick={handleCreateNew}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Template
        </button>
      </div>

      {/* Search and Filter */}
      <div className="flex gap-3">
        <div className="flex-1 relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search templates..."
            className="w-full pl-10 pr-4 py-2 bg-neutral-700 border border-neutral-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-white"
          />
          <svg
            className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </div>
        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="px-4 py-2 bg-neutral-700 border border-neutral-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-white"
        >
          {categories.map((cat) => (
            <option key={cat} value={cat}>
              {cat === "all" ? "All Categories" : cat.charAt(0).toUpperCase() + cat.slice(1)}
            </option>
          ))}
        </select>
      </div>

      {/* Templates List */}
      {isLoading ? (
        <div className="text-center py-8 text-neutral-400">Loading templates...</div>
      ) : filteredTemplates.length === 0 ? (
        <div className="text-center py-8 text-neutral-400">
          {searchQuery || selectedCategory !== "all"
            ? "No templates match your search."
            : "No system prompt templates yet. Create one to get started."}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredTemplates.map((template) => (
            <div
              key={template.id}
              className="p-4 bg-neutral-750 rounded-lg border border-neutral-600 hover:border-neutral-500 transition-colors"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="text-white font-medium truncate">{template.name}</h4>
                    {template.isDefault && (
                      <span className="px-2 py-0.5 text-xs bg-blue-600/30 text-blue-300 rounded border border-blue-600/50">
                        Default
                      </span>
                    )}
                    <span className="px-2 py-0.5 text-xs bg-neutral-700 text-neutral-300 rounded capitalize">
                      {template.category}
                    </span>
                  </div>
                  <p className="text-sm text-neutral-400 line-clamp-2">{template.content}</p>
                  {template.tags && template.tags.length > 0 && (
                    <div className="flex gap-1 mt-2 flex-wrap">
                      {template.tags.map((tag) => (
                        <span
                          key={tag}
                          className="px-2 py-0.5 text-xs bg-neutral-700 text-neutral-400 rounded"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {!template.isDefault && (
                    <button
                      onClick={() => handleSetDefault(template)}
                      className="p-1.5 text-neutral-400 hover:text-white hover:bg-neutral-700 rounded transition-colors"
                      title="Set as default"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
                        />
                      </svg>
                    </button>
                  )}
                  <button
                    onClick={() => handleEdit(template)}
                    className="p-1.5 text-neutral-400 hover:text-white hover:bg-neutral-700 rounded transition-colors"
                    title="Edit"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                      />
                    </svg>
                  </button>
                  {!template.isDefault && (
                    <button
                      onClick={() => handleDelete(template)}
                      className="p-1.5 text-neutral-400 hover:text-red-400 hover:bg-neutral-700 rounded transition-colors"
                      title="Delete"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
