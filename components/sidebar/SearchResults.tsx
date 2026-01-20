"use client";

import { useCallback, useEffect, useState, useRef } from "react";
import { SearchIcon, XIcon, MessageSquareIcon, FileIcon, ClockIcon, ChevronRightIcon, UserIcon, BotIcon } from "lucide-react";
import { useTranslations } from "@/lib/context/LocaleContext";
import type { SearchResults as SearchResultsType, MessageSearchResult, FileSearchResult } from "@/lib/types/chat";

interface SearchResultsProps {
  currentSessionId: string | null;
  onSessionSelect: (sessionId: string, messageId?: string) => void;
  onClose: () => void;
}

interface HighlightedTextProps {
  text: string;
  query: string;
  maxLength?: number;
}

function HighlightedText({ text, query, maxLength = 150 }: HighlightedTextProps) {
  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();

  // Find the first match
  const matchIndex = lowerText.indexOf(lowerQuery);

  if (matchIndex === -1) {
    // No match found, return truncated text
    const displayText = text.length > maxLength ? text.substring(0, maxLength) + "..." : text;
    return <span>{displayText}</span>;
  }

  // Calculate the context window around the match
  const contextLength = Math.floor((maxLength - query.length) / 2);
  let startIndex = Math.max(0, matchIndex - contextLength);
  let endIndex = Math.min(text.length, matchIndex + query.length + contextLength);

  // Add ellipsis if truncated
  const prefix = startIndex > 0 ? "..." : "";
  const suffix = endIndex < text.length ? "..." : "";

  const beforeText = text.substring(startIndex, matchIndex);
  const matchedText = text.substring(matchIndex, matchIndex + query.length);
  const afterText = text.substring(matchIndex + query.length, endIndex);

  return (
    <span className="text-neutral-400">
      {prefix}
      {beforeText}
      <mark className="bg-yellow-500/30 text-yellow-200 rounded px-0.5">{matchedText}</mark>
      {afterText}
      {suffix}
    </span>
  );
}

function MessageResultItem({
  result,
  query,
  onSelect
}: {
  result: MessageSearchResult;
  query: string;
  onSelect: () => void;
}) {
  const { t, formatRelativeTime } = useTranslations();

  return (
    <div
      className="p-3 hover:bg-neutral-800/50 rounded-lg cursor-pointer group transition-colors"
      onClick={onSelect}
    >
      <div className="flex items-start gap-2">
        {result.role === 'user' ? (
          <UserIcon size={14} className="text-neutral-500 mt-1 shrink-0" />
        ) : result.role === 'assistant' ? (
          <BotIcon size={14} className="text-blue-400 mt-1 shrink-0" />
        ) : (
          <MessageSquareIcon size={14} className="text-neutral-500 mt-1 shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-medium text-neutral-300 truncate">
              {result.sessionTitle}
            </span>
          </div>
          <div className="text-xs text-neutral-500 flex items-center gap-2 mb-1.5">
            <ClockIcon size={10} />
            <span>{formatRelativeTime(result.createdAt)}</span>
          </div>
          <div className="text-xs leading-relaxed">
            <HighlightedText text={result.textContent} query={query} />
          </div>
        </div>
        <ChevronRightIcon size={14} className="text-neutral-600 shrink-0 mt-4 opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    </div>
  );
}

function FileResultItem({
  result,
  query,
  onSelect
}: {
  result: FileSearchResult;
  query: string;
  onSelect: () => void;
}) {
  const { t } = useTranslations();

  return (
    <div
      className="p-3 hover:bg-neutral-800/50 rounded-lg cursor-pointer group transition-colors"
      onClick={onSelect}
    >
      <div className="flex items-start gap-2">
        <FileIcon size={14} className="text-neutral-500 mt-1 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-medium text-neutral-300 truncate">
              <HighlightedText text={result.fileName} query={query} maxLength={100} />
            </span>
          </div>
          <div className="text-xs text-neutral-500 truncate">
            {result.sessionTitle}
          </div>
          <div className="text-xs text-neutral-600 truncate mt-0.5">
            {result.filePath}
          </div>
        </div>
        <ChevronRightIcon size={14} className="text-neutral-600 shrink-0 mt-4 opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    </div>
  );
}

export function SearchResults({ currentSessionId, onSessionSelect, onClose }: SearchResultsProps) {
  const { t } = useTranslations();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResultsType | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [activeTab, setActiveTab] = useState<'all' | 'messages' | 'files'>('all');

  // Focus the input on mount
  useEffect(() => {
    searchInputRef.current?.focus();
  }, []);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  // Perform search when debounced query changes
  useEffect(() => {
    const performSearch = async () => {
      if (!debouncedQuery.trim()) {
        setResults(null);
        return;
      }

      setIsLoading(true);
      try {
        const params = new URLSearchParams({
          q: debouncedQuery,
          limit: '20',
          includeMessages: 'true',
          includeFiles: 'true',
        });
        const response = await fetch(`/api/chat-history/search?${params}`);
        if (response.ok) {
          const data = await response.json();
          setResults(data);
        }
      } catch {
        setResults(null);
      } finally {
        setIsLoading(false);
      }
    };

    performSearch();
  }, [debouncedQuery]);

  const handleResultSelect = useCallback((sessionId: string, messageId?: string) => {
    onSessionSelect(sessionId, messageId);
  }, [onSessionSelect]);

  const handleClearSearch = useCallback(() => {
    setQuery("");
    setResults(null);
    searchInputRef.current?.focus();
  }, []);

  // Filter results based on active tab
  const filteredResults = results ? {
    ...results,
    messages: activeTab === 'all' || activeTab === 'messages' ? results.messages : [],
    files: activeTab === 'all' || activeTab === 'files' ? results.files : [],
  } : null;

  const totalResults = filteredResults
    ? filteredResults.sessions.length + filteredResults.messages.length + filteredResults.files.length
    : 0;

  return (
    <div className="flex flex-col h-full bg-neutral-900">
      {/* Search Header */}
      <div className="flex items-center gap-2 p-3 border-b border-neutral-800">
        <SearchIcon size={16} className="text-neutral-500 shrink-0" />
        <input
          ref={searchInputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('sidebar.searchPlaceholder')}
          className="flex-1 bg-transparent text-sm text-white placeholder:text-neutral-600 outline-none"
        />
        {query && (
          <button
            onClick={handleClearSearch}
            className="shrink-0 p-1 hover:bg-neutral-800 rounded"
            aria-label={t('common.clear')}
          >
            <XIcon size={14} className="text-neutral-500" />
          </button>
        )}
        <button
          onClick={onClose}
          className="shrink-0 p-1 hover:bg-neutral-800 rounded text-neutral-500 hover:text-white"
          aria-label={t('common.close')}
        >
          <XIcon size={16} />
        </button>
      </div>

      {/* Tab Navigation */}
      {results && results.totalResults > 0 && (
        <div className="flex items-center gap-1 px-3 py-2 border-b border-neutral-800">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-3 py-1 text-xs rounded-full transition-colors ${
              activeTab === 'all'
                ? 'bg-blue-500/20 text-blue-400'
                : 'text-neutral-500 hover:text-neutral-300'
            }`}
          >
            {t('search.allTab')} ({results.totalResults})
          </button>
          <button
            onClick={() => setActiveTab('messages')}
            className={`px-3 py-1 text-xs rounded-full transition-colors ${
              activeTab === 'messages'
                ? 'bg-blue-500/20 text-blue-400'
                : 'text-neutral-500 hover:text-neutral-300'
            }`}
          >
            {t('search.messagesTab')} ({results.messages.length})
          </button>
          <button
            onClick={() => setActiveTab('files')}
            className={`px-3 py-1 text-xs rounded-full transition-colors ${
              activeTab === 'files'
                ? 'bg-blue-500/20 text-blue-400'
                : 'text-neutral-500 hover:text-neutral-300'
            }`}
          >
            {t('search.filesTab')} ({results.files.length})
          </button>
        </div>
      )}

      {/* Results List */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="p-8 text-center text-neutral-500 text-sm" role="status">
            {t('common.loading')}
          </div>
        ) : query && !filteredResults ? (
          <div className="p-8 text-center text-neutral-500 text-sm" role="status">
            {t('search.enterQuery')}
          </div>
        ) : filteredResults && filteredResults.totalResults === 0 ? (
          <div className="p-8 text-center text-neutral-500 text-sm" role="status">
            {t('search.noResults')}
          </div>
        ) : filteredResults ? (
          <div className="p-2 space-y-2">
            {/* Session Results */}
            {filteredResults.sessions.length > 0 && activeTab !== 'files' && (
              <div>
                <div className="px-2 py-1 text-xs font-medium text-neutral-500 uppercase tracking-wide">
                  {t('search.conversations')}
                </div>
                {filteredResults.sessions.slice(0, 5).map(({ session, rank }) => (
                  <div
                    key={session.id}
                    className={`px-3 py-2 rounded-lg cursor-pointer transition-colors flex items-center gap-2 ${
                      currentSessionId === session.id
                        ? "bg-neutral-800 text-white"
                        : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50"
                    }`}
                    onClick={() => handleResultSelect(session.id)}
                  >
                    <MessageSquareIcon size={14} className="shrink-0" />
                    <span className="flex-1 text-sm truncate">{session.title}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Message Results */}
            {filteredResults.messages.length > 0 && (activeTab === 'all' || activeTab === 'messages') && (
              <div>
                <div className="px-2 py-1 text-xs font-medium text-neutral-500 uppercase tracking-wide">
                  {t('search.messages')}
                </div>
                {filteredResults.messages.map((result) => (
                  <MessageResultItem
                    key={result.messageId}
                    result={result}
                    query={query}
                    onSelect={() => handleResultSelect(result.sessionId, result.messageId)}
                  />
                ))}
              </div>
            )}

            {/* File Results */}
            {filteredResults.files.length > 0 && (activeTab === 'all' || activeTab === 'files') && (
              <div>
                <div className="px-2 py-1 text-xs font-medium text-neutral-500 uppercase tracking-wide">
                  {t('search.files')}
                </div>
                {filteredResults.files.map((result) => (
                  <FileResultItem
                    key={result.fileId}
                    result={result}
                    query={query}
                    onSelect={() => handleResultSelect(result.sessionId)}
                  />
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="p-8 text-center text-neutral-600 text-sm">
            <SearchIcon size={24} className="mx-auto mb-3 opacity-50" />
            <p>{t('search.startTyping')}</p>
          </div>
        )}
      </div>
    </div>
  );
}
