"use client";

import { useState, useEffect, useCallback } from "react";
import { useSystemPromptPreference } from "@/lib/storage/ui-state";

interface SystemPromptTemplate {
  id: string;
  name: string;
  content: string;
  category: string;
  isDefault: boolean;
}

interface SystemPromptSelectorProps {
  onPromptChange?: (promptId: string | null, promptContent: string | null) => void;
}

export function SystemPromptSelector({ onPromptChange }: SystemPromptSelectorProps) {
  const systemPromptPreference = useSystemPromptPreference();
  const [templates, setTemplates] = useState<SystemPromptTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(systemPromptPreference.get());

  // Load templates on mount
  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/system-prompts");
      const data = await response.json();
      setTemplates(data.templates || []);

      // If no selection, try to get the default
      if (!selectedId) {
        const defaultTemplate = data.templates?.find((t: SystemPromptTemplate) => t.isDefault);
        if (defaultTemplate) {
          setSelectedId(defaultTemplate.id);
          systemPromptPreference.set(defaultTemplate.id);
          onPromptChange?.(defaultTemplate.id, defaultTemplate.content);
        }
      }
    } catch (error) {
      console.error("Failed to load system prompt templates:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const selectedTemplate = templates.find((t) => t.id === selectedId);

  const handleSelect = (templateId: string | null) => {
    setSelectedId(templateId);
    systemPromptPreference.set(templateId);
    const template = templates.find((t) => t.id === templateId);
    onPromptChange?.(templateId, template?.content ?? null);
    setIsOpen(false);
  };

  const handleRefresh = () => {
    loadTemplates();
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 text-sm bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-lg transition-colors text-neutral-700 dark:text-neutral-300"
        title="Select system prompt"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <span className="hidden sm:inline max-w-[120px] truncate">
          {selectedTemplate?.name ?? "No Prompt"}
        </span>
        <svg className={`w-3 h-3 transition-transform ${isOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 top-full mt-2 w-72 bg-white dark:bg-neutral-800 rounded-lg shadow-lg border border-neutral-200 dark:border-neutral-700 z-20 max-h-96 flex flex-col">
            {/* Header */}
            <div className="p-3 border-b border-neutral-200 dark:border-neutral-700 flex items-center justify-between">
              <h3 className="text-sm font-medium text-neutral-900 dark:text-white">System Prompt</h3>
              <button
                onClick={handleRefresh}
                className="p-1 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 rounded transition-colors"
                title="Refresh templates"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
            </div>

            {/* Templates List */}
            <div className="flex-1 overflow-y-auto p-2">
              {isLoading ? (
                <div className="text-center py-4 text-sm text-neutral-500">Loading...</div>
              ) : templates.length === 0 ? (
                <div className="text-center py-4 text-sm text-neutral-500">No templates available</div>
              ) : (
                <div className="space-y-1">
                  <button
                    onClick={() => handleSelect(null)}
                    className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                      selectedId === null
                        ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                        : "text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium">None</span>
                      {selectedId === null && (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">Use Claude's default behavior</p>
                  </button>

                  {templates.map((template) => (
                    <button
                      key={template.id}
                      onClick={() => handleSelect(template.id)}
                      className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                        selectedId === template.id
                          ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                          : "text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium truncate">{template.name}</span>
                        {selectedId === template.id && (
                          <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs px-1.5 py-0.5 bg-neutral-200 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-400 rounded capitalize">
                          {template.category}
                        </span>
                        {template.isDefault && (
                          <span className="text-xs px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 rounded">
                            Default
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 line-clamp-2">
                        {template.content}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-2 border-t border-neutral-200 dark:border-neutral-700">
              <button
                onClick={() => {
                  setIsOpen(false);
                  // Open settings to system prompts tab
                  window.dispatchEvent(new CustomEvent('open-settings', { detail: { tab: 'system-prompts' } }));
                }}
                className="w-full px-3 py-2 text-sm text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Manage Templates
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/**
 * Hook to get the current system prompt content by ID
 */
export function useSystemPromptContent(promptId: string | null): string | null {
  const [content, setContent] = useState<string | null>(null);

  useEffect(() => {
    if (!promptId) {
      setContent(null);
      return;
    }

    fetch(`/api/system-prompts/${promptId}`)
      .then((res) => res.json())
      .then((data) => {
        setContent(data.template?.content ?? null);
      })
      .catch(() => {
        setContent(null);
      });
  }, [promptId]);

  return content;
}
