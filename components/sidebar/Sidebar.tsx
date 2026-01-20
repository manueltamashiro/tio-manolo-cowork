"use client";

import { useState, useCallback, useRef, useImperativeHandle, forwardRef } from "react";
import { SidebarTab, SidebarTabType } from "./SidebarTab";
import { SessionList, SessionListRef } from "./SessionList";
import { FileExplorer } from "./FileExplorer";
import { ProgressPanel } from "@/components/progress/ProgressPanel";
import { SearchResults } from "./SearchResults";
import { useProgress } from "@/lib/context/ProgressContext";
import { useActiveTabState } from "@/lib/storage/ui-state";
import { useNotifications } from "@/lib/context/NotificationContext";

export interface SidebarRef {
  focusSearch: () => void;
  toggleSearch: () => void;
}

interface SidebarProps {
  currentSessionId: string | null;
  onSessionSelect: (sessionId: string, messageId?: string) => void;
  onNewSession: () => void;
  onSessionDelete: (sessionId: string) => void;
  onSessionRename: (sessionId: string, newTitle: string) => void;
  onSessionOpenInNewWindow?: (sessionId: string) => void;
  onSessionExport?: (sessionId: string, sessionTitle: string) => void;
  onFileSelect: (filePath: string) => void;
  className?: string;
  style?: React.CSSProperties;
  "data-sidebar"?: string;
}

export const Sidebar = forwardRef<SidebarRef, SidebarProps>(function Sidebar({
  currentSessionId,
  onSessionSelect,
  onNewSession,
  onSessionDelete,
  onSessionRename,
  onSessionOpenInNewWindow,
  onSessionExport,
  onFileSelect,
  className = "",
  style,
  "data-sidebar": dataSidebar,
}, ref) {
  const sessionListRef = useRef<SessionListRef>(null);
  const { activeCount } = useProgress();
  const { badgeCount: notificationBadgeCount, markAllRead } = useNotifications();

  // Search mode state
  const [isSearchMode, setIsSearchMode] = useState(false);

  // Expose methods via ref
  useImperativeHandle(ref, () => ({
    focusSearch: () => {
      setIsSearchMode(true);
      sessionListRef.current?.focusSearch();
    },
    toggleSearch: () => {
      setIsSearchMode(prev => !prev);
    },
  }), []);

  const { get: getSavedTab, set: saveTab } = useActiveTabState();
  const [activeTab, setActiveTab] = useState<SidebarTabType>(() => {
    const saved = getSavedTab();
    // If saved tab is not valid (e.g., old version), default to sessions
    return saved === "sessions" || saved === "files" || saved === "activity" ? saved : "sessions";
  });

  // Persist tab changes
  const handleTabChange = useCallback((tab: SidebarTabType) => {
    setActiveTab(tab);
    saveTab(tab);
    // Exit search mode when switching tabs
    setIsSearchMode(false);
    // Mark notifications as read when switching to sessions tab
    if (tab === "sessions") {
      markAllRead();
    }
  }, [saveTab, markAllRead]);

  const handleCloseSearch = useCallback(() => {
    setIsSearchMode(false);
  }, []);

  const handleSearchSessionSelect = useCallback((sessionId: string, messageId?: string) => {
    onSessionSelect(sessionId, messageId);
    setIsSearchMode(false);
  }, [onSessionSelect]);

  return (
    <aside className={`flex flex-col bg-neutral-950 dark:bg-neutral-950 light:bg-neutral-100 ${className}`} style={style} data-sidebar={dataSidebar}>
      {isSearchMode ? (
        // Full-screen search mode
        <SearchResults
          currentSessionId={currentSessionId}
          onSessionSelect={handleSearchSessionSelect}
          onClose={handleCloseSearch}
        />
      ) : (
        <>
          <div className="flex items-center border-b border-neutral-800 dark:border-neutral-800 light:border-neutral-200">
            <SidebarTab
              type="sessions"
              active={activeTab === "sessions"}
              activeCount={notificationBadgeCount}
              onClick={() => handleTabChange("sessions")}
            />
            <SidebarTab
              type="files"
              active={activeTab === "files"}
              onClick={() => handleTabChange("files")}
            />
            <SidebarTab
              type="activity"
              active={activeTab === "activity"}
              activeCount={activeCount}
              onClick={() => handleTabChange("activity")}
            />
          </div>

          <div className="flex-1 overflow-hidden">
            {activeTab === "sessions" ? (
              <SessionList
                ref={sessionListRef}
                currentSessionId={currentSessionId}
                onSessionSelect={onSessionSelect}
                onNewSession={onNewSession}
                onSessionDelete={onSessionDelete}
                onSessionRename={onSessionRename}
                onSessionOpenInNewWindow={onSessionOpenInNewWindow}
                onSessionExport={onSessionExport}
              />
            ) : activeTab === "files" ? (
              <FileExplorer onFileSelect={onFileSelect} />
            ) : (
              <ProgressPanel />
            )}
          </div>
        </>
      )}
    </aside>
  );
});
