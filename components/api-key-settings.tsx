'use client';

import { useState, useEffect } from 'react';
import {
  storeApiKey,
  getApiKeyInfo,
  clearApiKey,
  validateApiKeyFormat,
  validateApiKeyWithApi,
  type ApiKeyInfo,
} from '@/lib/api-key-storage';
import { useModelPreference } from '@/lib/storage/ui-state';
import { ModelGrid } from '@/components/ModelSelector';
import type { ModelId } from '@/types/claude';

export default function ApiKeySettings() {
  const [apiKey, setApiKey] = useState('');
  const [savedKeyInfo, setSavedKeyInfo] = useState<ApiKeyInfo | null>(null);
  const [isKeyVisible, setIsKeyVisible] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<{
    valid: boolean;
    message?: string;
  } | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [selectedModel, setSelectedModel] = useState<ModelId>('claude-3-7-sonnet-20250219');

  const modelPreference = useModelPreference();

  // Load saved key info and model preference on mount
  useEffect(() => {
    setSavedKeyInfo(getApiKeyInfo());
    setSelectedModel(modelPreference.get());
  }, [modelPreference]);

  const handleApiKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setApiKey(e.target.value);
    setValidationResult(null);
    setErrorMessage('');
  };

  const handleValidate = async () => {
    if (!apiKey.trim()) {
      setValidationResult({ valid: false, message: 'Please enter an API key' });
      return;
    }

    setIsValidating(true);
    setValidationResult(null);

    try {
      // First check format
      const formatCheck = validateApiKeyFormat(apiKey);
      if (!formatCheck.valid) {
        setValidationResult({ valid: false, message: formatCheck.error });
        setIsValidating(false);
        return;
      }

      // Then validate with API
      const apiValidation = await validateApiKeyWithApi(apiKey);
      setValidationResult({
        valid: apiValidation.valid,
        message: apiValidation.error,
      });
    } catch {
      setValidationResult({
        valid: false,
        message: 'Validation failed. Please try again.',
      });
    } finally {
      setIsValidating(false);
    }
  };

  const handleSave = () => {
    setErrorMessage('');
    setSaveStatus('saving');

    try {
      storeApiKey(apiKey);
      setSavedKeyInfo(getApiKeyInfo());
      setApiKey('');
      setIsKeyVisible(false);
      setValidationResult(null);
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to save API key');
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 3000);
    }
  };

  const handleClear = () => {
    clearApiKey();
    setSavedKeyInfo(null);
    setApiKey('');
    setIsKeyVisible(false);
    setValidationResult(null);
    setErrorMessage('');
  };

  const handleModelChange = (model: ModelId) => {
    setSelectedModel(model);
    modelPreference.set(model, true); // Save immediately
  };

  return (
    <div className="max-w-3xl mx-auto p-6">
      <div className="mb-6">
        <h1 id="settings-title" className="text-2xl font-semibold mb-2">Settings</h1>
        <p className="text-gray-400">Manage your application settings</p>
      </div>

      {/* Model Selection Section */}
      <section className="bg-zinc-900 rounded-lg border border-zinc-800 p-6 mb-6" aria-labelledby="model-selection-heading">
        <h2 id="model-selection-heading" className="text-lg font-medium mb-4">Model Selection</h2>
        <ModelGrid
          selectedModel={selectedModel}
          onModelChange={handleModelChange}
        />
        <p className="mt-4 text-sm text-gray-400" id="model-selection-description">
          The selected model will be used for all new conversations. You can change this anytime.
        </p>
      </section>

      {/* API Configuration Section */}
      <section className="bg-zinc-900 rounded-lg border border-zinc-800 p-6" aria-labelledby="api-config-heading">
        <h2 id="api-config-heading" className="text-lg font-medium mb-4">API Configuration</h2>

        {/* Saved key display */}
        {savedKeyInfo && (
          <div className="mb-6 p-4 bg-zinc-800 rounded-lg border border-zinc-700" role="status" aria-live="polite">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400 mb-1">API Key</p>
                <p className="font-mono text-sm" id="saved-key-preview">{savedKeyInfo.keyPreview}</p>
              </div>
              <button
                type="button"
                onClick={handleClear}
                className="px-3 py-1.5 text-sm bg-red-600 hover:bg-red-700 text-white rounded transition-colors"
                aria-describedby="saved-key-preview"
              >
                Clear
              </button>
            </div>
          </div>
        )}

        {/* API Key Input */}
        <div className="mb-4">
          <label htmlFor="apiKey" className="block text-sm font-medium mb-2">
            Anthropic API Key
          </label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                id="apiKey"
                type={isKeyVisible ? 'text' : 'password'}
                value={apiKey}
                onChange={handleApiKeyChange}
                placeholder="sk-ant-..."
                className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={saveStatus === 'saving'}
                aria-invalid={validationResult ? !validationResult.valid : undefined}
                aria-describedby={validationResult ? 'validation-result' : undefined}
              />
              <button
                type="button"
                onClick={() => setIsKeyVisible(!isKeyVisible)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
                aria-label={isKeyVisible ? 'Hide API key' : 'Show API key'}
                aria-pressed={isKeyVisible}
              >
                <span className="sr-only">{isKeyVisible ? 'Hide' : 'Show'} API key</span>
                {isKeyVisible ? (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
                    />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
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
              className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              aria-busy={isValidating}
            >
              {isValidating ? 'Validating...' : 'Validate'}
            </button>
          </div>

          {/* Validation Result */}
          {validationResult && (
            <div id="validation-result" className="mt-2" role={validationResult.valid ? "status" : "alert"} aria-live="polite">
              {validationResult.valid ? (
                <p className="text-sm text-green-400">API key is valid!</p>
              ) : (
                <p className="text-sm text-red-400">{validationResult.message}</p>
              )}
            </div>
          )}

          {/* Error Message */}
          {errorMessage && (
            <p className="mt-2 text-sm text-red-400" role="alert" aria-live="assertive">{errorMessage}</p>
          )}
        </div>

        {/* Helper text */}
        <p className="text-sm text-gray-400 mb-4">
          Get your API key from{' '}
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
            disabled={!apiKey.trim() || saveStatus === 'saving'}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            aria-busy={saveStatus === 'saving'}
          >
            {saveStatus === 'saving' && (
              <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24" aria-hidden="true">
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
            {saveStatus === 'saved' ? 'Saved!' : saveStatus === 'saving' ? 'Saving...' : 'Save API Key'}
          </button>

          {saveStatus === 'error' && (
            <span className="text-sm text-red-400" role="status" aria-live="polite">Failed to save. Please try again.</span>
          )}
        </div>
      </section>

      {/* Security notice */}
      <div className="mt-6 p-4 bg-blue-900/20 border border-blue-800 rounded-lg" role="note">
        <div className="flex gap-3">
          <svg className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <p className="text-sm font-medium text-blue-300">Security Notice</p>
            <p className="text-sm text-gray-400 mt-1">
              Your API key is encrypted using AES encryption before being stored locally. The encrypted key never leaves your device.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
