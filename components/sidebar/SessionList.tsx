"use client";

import { useCallback, useEffect, useState, useRef, useImperativeHandle, forwardRef } from "react";
import type { Session } from "@/lib/types/chat";
import { MessageSquareIcon, PlusIcon, Trash2Icon, Edit2Icon, SearchIcon, XIcon, ClockIcon, ExternalLinkIcon, DownloadIcon } from "lucide-react";
import { useTranslations } from "@/lib/context/LocaleContext";

export interface SessionListRef {
  focusSearch: () => void;
}

interface SessionListProps {
  currentSessionId: string | null;
  onSessionSelect: (sessionId: string) => void;
  onNewSession: () => void;
  onSessionDelete: (sessionId: string) => void;
  onSessionRename: (sessionId: string, newTitle: string) => void;
  onSessionOpenInNewWindow?: (sessionId: string) => void;
  onSessionExport?: (sessionId: string, sessionTitle: string) => void;
}

export const SessionList = forwardRef<SessionListRef, SessionListProps>(function SessionList({
  currentSessionId,
  onSessionSelect,
  onNewSession,
  onSessionDelete,
  onSessionRename: _onSessionRename,
  onSessionOpenInNewWindow,
  onSessionExport,
}, ref) {
  const { t, formatRelativeTime } = useTranslations();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [filteredSessions, setFilteredSessions] = useState<Session[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  // Expose methods via ref
  useImperativeHandle(ref, () => ({
    focusSearch: () => {
      searchInputRef.current?.focus();
    },
  }), []);

  const loadSessions = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/chat-history/sessions?limit=50&sortBy=updatedAt&sortOrder=desc");
      if (response.ok) {
        const data = await response.json();
        setSessions(data.sessions || []);
      }
    } catch {
      setSessions([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  // Filter sessions based on search query
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredSessions(sessions);
    } else {
      const query = searchQuery.toLowerCase();
      const filtered = sessions.filter((session) => {
        const titleMatch = session.title.toLowerCase().includes(query);
        const previewMatch = session.lastMessagePreview?.toLowerCase().includes(query);
        return titleMatch || previewMatch;
      });
      setFilteredSessions(filtered);
    }
  }, [sessions, searchQuery]);

  const handleDelete = useCallback(
    async (sessionId: string, e: React.MouseEvent) => {
      e.stopPropagation();
      if (!confirm(t('sidebar.deleteConversation'))) return;

      try {
        const response = await fetch(`/api/chat-history/sessions/${sessionId}`, {
          method: "DELETE",
        });
        if (response.ok) {
          setSessions((prev) => prev.filter((s) => s.id !== sessionId));
          // Notify parent if the deleted session was the current one
          if (currentSessionId === sessionId) {
            onSessionDelete(sessionId);
          }
        }
      } catch {
        // Error handling
      }
    },
    [currentSessionId, onSessionDelete, t]
  );

  const handleStartEdit = useCallback((sessionId: string, currentTitle: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(sessionId);
    setEditingTitle(currentTitle);
  }, []);

  const handleSaveEdit = useCallback(
    async (sessionId: string) => {
      if (!editingTitle.trim()) return;

      try {
        const response = await fetch(`/api/chat-history/sessions/${sessionId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: editingTitle.trim() }),
        });
        if (response.ok) {
          setSessions((prev) =>
            prev.map((s) => (s.id === sessionId ? { ...s, title: editingTitle.trim() } : s))
          );
        }
      } finally {
        setEditingId(null);
        setEditingTitle("");
      }
    },
    [editingTitle]
  );

  const handleCancelEdit = useCallback(() => {
    setEditingId(null);
    setEditingTitle("");
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, sessionId: string) => {
      if (e.key === "Enter") {
        handleSaveEdit(sessionId);
      } else if (e.key === "Escape") {
        handleCancelEdit();
      }
    },
    [handleSaveEdit, handleCancelEdit]
  );

  const clearSearch = useCallback(() => {
    setSearchQuery("");
  }, []);

  const handleOpenInNewWindow = useCallback(
    async (sessionId: string, e: React.MouseEvent) => {
      e.stopPropagation();

      // Check if running in Electron
      if (typeof window !== 'undefined' && (window as any).electronAPI?.openSessionInNewWindow) {
        try {
          await (window as any).electronAPI.openSessionInNewWindow(sessionId);
        } catch (error) {
          console.error('Failed to open session in new window:', error);
        }
      } else if (onSessionOpenInNewWindow) {
        // Web mode: use the provided callback
        onSessionOpenInNewWindow(sessionId);
      } else {
        // Default web behavior: open in new tab
        const url = new URL(window.location.href);
        url.searchParams.set('sessionId', sessionId);
        window.open(url.toString(), '_blank');
      }
    },
    [onSessionOpenInNewWindow]
  );

  const handleExport = useCallback(
    async (sessionId: string, sessionTitle: string, e: React.MouseEvent) => {
      e.stopPropagation();
      onSessionExport?.(sessionId, sessionTitle);
    },
    [onSessionExport]
  );

  return (
    <div className="flex flex-col h-full">
      <button
        onClick={onNewSession}
        className="flex items-center gap-2 px-4 py-3 m-2 text-sm font-medium text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-lg transition-colors"
        data-new-session-button="true"
      >
        <PlusIcon size={16} aria-hidden="true" />
        <span>{t('sidebar.newChat')}</span>
      </button>

      {/* Search Bar */}
      <div className="px-2 pb-2">
        <label htmlFor="session-search" className="sr-only">{t('sidebar.searchConversations')}</label>
        <div className={`relative flex items-center gap-2 px-3 py-2 rounded-lg transition-all ${isSearchFocused ? "bg-neutral-800 ring-1 ring-blue-500" : "bg-neutral-800/50"}`}>
          <SearchIcon size={14} className="text-neutral-500 shrink-0" aria-hidden="true" />
          <input
            ref={searchInputRef}
            id="session-search"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setIsSearchFocused(true)}
            onBlur={() => setIsSearchFocused(false)}
            placeholder={t('sidebar.searchPlaceholder')}
            className="flex-1 bg-transparent text-sm text-neutral-300 placeholder:text-neutral-600 outline-none"
          />
          {searchQuery && (
            <button
              onClick={clearSearch}
              className="shrink-0 p-0.5 hover:bg-neutral-700 rounded"
              aria-label={t('common.clear')}
            >
              <XIcon size={12} className="text-neutral-500" />
            </button>
          )}
        </div>
      </div>

      {/* Results count when filtering */}
      {searchQuery && (
        <div className="px-4 pb-2 text-xs text-neutral-500" role="status" aria-live="polite">
          {t('sidebar.results', { count: filteredSessions.length })}
        </div>
      )}

      <ul
        className="flex-1 overflow-y-auto px-2 space-y-1"
        role="listbox"
        aria-label="Chat sessions"
        aria-busy={isLoading}
      >
        {isLoading ? (
          <li className="px-4 py-8 text-center text-neutral-500 text-sm" role="status">{t('common.loading')}</li>
        ) : filteredSessions.length === 0 ? (
          <li className="px-4 py-8 text-center text-neutral-500 text-sm" role="status">
            {searchQuery ? t('sidebar.noMatchingConversations') : t('sidebar.noConversations')}
          </li>
        ) : (
          filteredSessions.map((session, index) => (
            <li
              key={session.id}
              role="option"
              aria-selected={currentSessionId === session.id}
              aria-setsize={filteredSessions.length}
              aria-posinset={index + 1}
            >
              <div
                className={`
                  group flex flex-col gap-1 px-3 py-2.5 rounded-lg cursor-pointer transition-colors relative
                  ${currentSessionId === session.id ? "bg-neutral-800 text-white" : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50"}
                `}
                onClick={() => onSessionSelect(session.id)}
                tabIndex={currentSessionId === session.id ? 0 : -1}
              >
                <div className="flex items-center gap-2">
                  <MessageSquareIcon size={14} className="shrink-0 mt-0.5" aria-hidden="true" />
                  {editingId === session.id ? (
                    <input
                      type="text"
                      value={editingTitle}
                      onChange={(e) => setEditingTitle(e.target.value)}
                      onKeyDown={(e) => handleKeyDown(e, session.id)}
                      onBlur={() => handleSaveEdit(session.id)}
                      className="flex-1 bg-neutral-700 text-white text-sm px-2 py-1 rounded outline-none"
                      autoFocus
                      onClick={(e) => e.stopPropagation()}
                      aria-label="Edit session title"
                    />
                  ) : (
                    <span className="flex-1 text-sm font-medium truncate">{session.title}</span>
                  )}
                  {editingId !== session.id && (
                    <div className="hidden group-hover:flex items-center gap-1 shrink-0">
                      <button
                        onClick={(e) => handleStartEdit(session.id, session.title, e)}
                        className="p-1 hover:bg-neutral-700 rounded"
                        aria-label={`Rename "${session.title}"`}
                        title={t('sidebar.rename')}
                      >
                        <Edit2Icon size={12} />
                      </button>
                      <button
                        onClick={(e) => handleExport(session.id, session.title, e)}
                        className="p-1 hover:bg-neutral-700 rounded text-neutral-500 hover:text-green-400"
                        aria-label={`Export "${session.title}"`}
                        title={t('sidebar.exportConversation')}
                      >
                        <DownloadIcon size={12} />
                      </button>
                      <button
                        onClick={(e) => handleOpenInNewWindow(session.id, e)}
                        className="p-1 hover:bg-neutral-700 rounded text-neutral-500 hover:text-blue-400"
                        aria-label={`Open "${session.title}" in new window`}
                        title={t('sidebar.openInNewWindow')}
                      >
                        <ExternalLinkIcon size={12} />
                      </button>
                      <button
                        onClick={(e) => handleDelete(session.id, e)}
                        className="p-1 hover:bg-neutral-700 rounded text-neutral-500 hover:text-red-400"
                        aria-label={`Delete "${session.title}"`}
                        title={t('common.delete')}
                      >
                        <Trash2Icon size={12} />
                      </button>
                    </div>
                  )}
                </div>

                {/* Timestamp and preview */}
                {editingId !== session.id && (
                  <div className="flex items-start gap-2 pl-5">
                    <ClockIcon size={10} className="text-neutral-600 shrink-0 mt-0.5" aria-hidden="true" />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-neutral-600 mb-0.5">
                        {formatRelativeTime(session.updatedAt)}
                      </div>
                      {session.lastMessagePreview && (
                        <div className="text-xs text-neutral-500 truncate">
                          {session.lastMessagePreview}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </li>
          ))
        )}
      </ul>
    </div>
  );
});
