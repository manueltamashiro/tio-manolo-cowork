'use client';

import { useState } from 'react';
import type { ModelId } from '@/types/claude';
import { MODELS, getTierBadgeColor, getTierLabel, type ModelInfo } from '@/types/models';

interface ModelSelectorProps {
  selectedModel: ModelId;
  onModelChange: (model: ModelId) => void;
  disabled?: boolean;
}

export function ModelSelector({ selectedModel, onModelChange, disabled = false }: ModelSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const selectedInfo = MODELS[selectedModel];

  return (
    <div className="relative">
      <label className="block text-sm font-medium mb-2 text-neutral-300">
        Claude Model
      </label>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled}
        className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-left flex items-center justify-between disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="font-medium text-white">{selectedInfo.name}</span>
          <span className={`text-xs px-2 py-0.5 rounded-full border ${getTierBadgeColor(selectedInfo.tier)}`}>
            {getTierLabel(selectedInfo.tier)}
          </span>
        </div>
        <svg
          className={`w-5 h-5 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute z-20 w-full mt-2 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl max-h-96 overflow-y-auto">
            {Object.values(MODELS).map((model) => (
              <button
                key={model.id}
                type="button"
                onClick={() => {
                  onModelChange(model.id);
                  setIsOpen(false);
                }}
                className={`w-full px-4 py-3 text-left hover:bg-zinc-700 transition-colors border-b border-zinc-700 last:border-b-0 ${
                  model.id === selectedModel ? 'bg-zinc-700' : ''
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-white">{model.name}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full border ${getTierBadgeColor(model.tier)}`}>
                    {getTierLabel(model.tier)}
                  </span>
                </div>
                <p className="text-sm text-gray-400 mb-2">{model.description}</p>
                <div className="flex flex-wrap gap-1 mb-2">
                  {model.capabilities.map((capability) => (
                    <span
                      key={capability}
                      className="text-xs px-2 py-0.5 bg-zinc-900 text-gray-400 rounded"
                    >
                      {capability}
                    </span>
                  ))}
                </div>
                <div className="flex items-center gap-4 text-xs text-gray-500">
                  <span>Input: ${model.inputPrice}/M tokens</span>
                  <span>Output: ${model.outputPrice}/M tokens</span>
                  <span>Max: {model.maxTokens} tokens</span>
                </div>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

interface ModelCardProps {
  model: ModelInfo;
  isSelected: boolean;
  onSelect: () => void;
}

export function ModelCard({ model, isSelected, onSelect }: ModelCardProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full p-4 rounded-lg border text-left transition-all ${
        isSelected
          ? 'bg-blue-900/30 border-blue-700'
          : 'bg-zinc-800 border-zinc-700 hover:bg-zinc-750'
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-semibold text-white">{model.name}</h3>
        <span className={`text-xs px-2 py-0.5 rounded-full border ${getTierBadgeColor(model.tier)}`}>
          {getTierLabel(model.tier)}
        </span>
      </div>
      <p className="text-sm text-gray-400 mb-3">{model.description}</p>

      <div className="flex flex-wrap gap-1.5 mb-3">
        {model.capabilities.map((capability) => (
          <span
            key={capability}
            className="text-xs px-2 py-1 bg-zinc-900 text-gray-400 rounded-md"
          >
            {capability}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="flex justify-between">
          <span className="text-gray-500">Input:</span>
          <span className="text-gray-300">${model.inputPrice}/M</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Output:</span>
          <span className="text-gray-300">${model.outputPrice}/M</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Context:</span>
          <span className="text-gray-300">{model.contextWindow.toLocaleString()}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Max tokens:</span>
          <span className="text-gray-300">{model.maxTokens.toLocaleString()}</span>
        </div>
      </div>

      {isSelected && (
        <div className="mt-3 pt-3 border-t border-zinc-700 flex items-center text-blue-400 text-sm">
          <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
              clipRule="evenodd"
            />
          </svg>
          Selected
        </div>
      )}
    </button>
  );
}

interface ModelGridProps {
  selectedModel: ModelId;
  onModelChange: (model: ModelId) => void;
  disabled?: boolean;
}

export function ModelGrid({ selectedModel, onModelChange, disabled = false }: ModelGridProps) {
  return (
    <div className="space-y-4">
      <label className="block text-sm font-medium text-neutral-300">
        Select Claude Model
      </label>
      <div className="grid gap-4">
        {Object.values(MODELS).map((model) => (
          <ModelCard
            key={model.id}
            model={model}
            isSelected={model.id === selectedModel}
            onSelect={() => !disabled && onModelChange(model.id)}
          />
        ))}
      </div>
    </div>
  );
}
