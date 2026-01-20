"use client";

import { useState, useCallback, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { MainLayout, MainLayoutRef } from "@/components/layout/MainLayout";
import { ChatInterface } from "@/components/chat/ChatInterface";
import { QueueStatus } from "@/components/queue/QueueStatus";
import { FirstRunOnboarding, FeatureTour, defaultTourSteps } from "@/components/onboarding";
import { KeyboardShortcutsModal } from "@/components/ui/KeyboardShortcutsModal";
import { UpdateNotification } from "@/components/ui/UpdateNotification";
import { ExportDialog, ExportFormat } from "@/components/ui/ExportDialog";
import { useChatContext } from "@/lib/context/ChatContext";
import { useQueueContext } from "@/lib/context/QueueContext";
import { useOnboardingState } from "@/lib/storage/ui-state";
import { setWindowId } from "@/lib/storage/ui-state";
import { ErrorBoundaryClass as ErrorBoundary } from "@/components/ui/ErrorBoundary";
import { useKeyboardShortcuts } from "@/lib/hooks/useKeyboardShortcuts";
import { useToast } from "@/lib/context/ToastContext";
import { PerformanceDebugPanel } from "@/components/ui/PerformanceDebugPanel";

function HomeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const mainLayoutRef = useRef<MainLayoutRef>(null);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [shouldCreateSession, setShouldCreateSession] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showTour, setShowTour] = useState(false);
  const [showShortcutsModal, setShowShortcutsModal] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [exportSessionId, setExportSessionId] = useState<string | undefined>();
  const [exportSessionTitle, setExportSessionTitle] = useState<string | undefined>();
  const [isExporting, setIsExporting] = useState(false);
  const { loadSession, clearCurrentSession, currentSession } = useChatContext();
  const queue = useQueueContext();
  const { get: hasCompletedOnboarding } = useOnboardingState();
  const { info, success, error: showError } = useToast();

  // Initialize window ID and session from URL params
  useEffect(() => {
    const windowIdParam = searchParams.get('windowId');
    const sessionIdParam = searchParams.get('sessionId');

    // Set the window ID for multi-window support
    if (windowIdParam) {
      setWindowId(windowIdParam);
    }

    // If a session ID is in URL, load that session
    if (sessionIdParam) {
      setCurrentSessionId(sessionIdParam);
      loadSession(sessionIdParam);
    }
  }, [searchParams, loadSession]);

  // Check if onboarding is needed on mount
  useEffect(() => {
    const needsOnboarding = !hasCompletedOnboarding();
    setShowOnboarding(needsOnboarding);
  }, [hasCompletedOnboarding]);

  const handleSessionSelect = useCallback((sessionId: string, messageId?: string) => {
    setCurrentSessionId(sessionId);
    loadSession(sessionId, messageId);
  }, [loadSession]);

  const handleNewSession = useCallback(() => {
    // Clear current session to trigger creation in ChatInterface
    setCurrentSessionId(null);
    clearCurrentSession();
    setShouldCreateSession(true);
  }, [clearCurrentSession]);

  const handleSessionDelete = useCallback(() => {
    // Clear current session if it was deleted
    setCurrentSessionId(null);
    clearCurrentSession();
  }, [clearCurrentSession]);

  const handleSessionRename = useCallback(() => {
    // Session rename is handled by SessionList component directly
  }, []);

  const handleSessionOpenInNewWindow = useCallback((sessionId: string) => {
    // For web mode, open in new tab via URL
    const url = new URL(window.location.href);
    url.searchParams.set('sessionId', sessionId);
    url.searchParams.set('windowId', `session_${sessionId}`);
    window.open(url.toString(), '_blank');
  }, []);

  const handleFileSelect = useCallback((filePath: string) => {
    // Handle file selection - could be used to attach files to chat
    console.log("Selected file:", filePath);
  }, []);

  // Reset the create session flag after it's handled
  useEffect(() => {
    if (shouldCreateSession) {
      setShouldCreateSession(false);
    }
  }, [shouldCreateSession]);

  // Show tour after onboarding completes
  const handleOnboardingComplete = useCallback(() => {
    setShowOnboarding(false);
    // Show tour after a short delay to let UI settle
    setTimeout(() => setShowTour(true), 500);
  }, []);

  const handleTourComplete = useCallback(() => {
    setShowTour(false);
  }, []);

  // Show tour button for users who completed onboarding (available in settings)
  const handleStartTour = useCallback(() => {
    setShowTour(true);
  }, []);

  const handleExportCurrentSession = useCallback(() => {
    if (currentSession) {
      setExportSessionId(currentSession.id);
      setExportSessionTitle(currentSession.title);
    } else {
      setExportSessionId(undefined);
      setExportSessionTitle(undefined);
    }
    setShowExportDialog(true);
  }, [currentSession]);

  const handleExportAllSessions = useCallback(() => {
    setExportSessionId(undefined);
    setExportSessionTitle(undefined);
    setShowExportDialog(true);
  }, []);

  const handleExportSession = useCallback((sessionId: string, sessionTitle: string) => {
    setExportSessionId(sessionId);
    setExportSessionTitle(sessionTitle);
    setShowExportDialog(true);
  }, []);

  const handleExport = useCallback(async (format: ExportFormat, includeAttachments: boolean) => {
    setIsExporting(true);
    try {
      const params = new URLSearchParams({
        format,
        includeAttachments: includeAttachments.toString(),
      });

      if (exportSessionId) {
        params.set('sessionId', exportSessionId);
      }

      const response = await fetch(`/api/chat-history/export?${params.toString()}`);

      if (!response.ok) {
        throw new Error('Failed to export conversation');
      }

      // Get filename from Content-Disposition header or generate one
      let filename = `export_${Date.now()}.${format === 'markdown' ? 'md' : format === 'text' ? 'txt' : 'json'}`;
      const disposition = response.headers.get('Content-Disposition');
      if (disposition) {
        const match = disposition.match(/filename="([^"]+)"/);
        if (match?.[1]) {
          filename = match[1];
        }
      }

      // Download the file
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      success(`Exported conversation as ${format.toUpperCase()}`);
      setShowExportDialog(false);
    } catch (err) {
      console.error('Export error:', err);
      showError('Failed to export conversation');
    } finally {
      setIsExporting(false);
    }
  }, [exportSessionId, success, showError]);

  // Register keyboard shortcuts
  useKeyboardShortcuts(
    [
      {
        key: "Cmd+N",
        callback: handleNewSession,
        description: "New chat",
      },
      {
        key: "Cmd+K",
        callback: () => {
          mainLayoutRef.current?.focusSearch();
        },
        description: "Search conversations",
      },
      {
        key: "Cmd+,",
        callback: () => {
          router.push("/settings");
        },
        description: "Open settings",
      },
      {
        key: "Cmd+/",
        callback: () => {
          setShowShortcutsModal(true);
        },
        description: "Show keyboard shortcuts",
      },
    ],
    !showOnboarding && !showTour, // Disable shortcuts during onboarding/tour
    [handleNewSession]
  );

  // Set up menu action handlers (Electron only)
  useEffect(() => {
    if (typeof window === "undefined" || !window.electronAPI) return;

    const handleMenuAction = (event: string, ...args: any[]) => {
      switch (event) {
        case "menu:new-chat":
          handleNewSession();
          break;
        case "menu:open-workspace":
          if (args[0]) {
            handleFileSelect(args[0]);
          }
          break;
        case "menu:save-chat":
          handleExportCurrentSession();
          break;
        case "menu:export-chat":
          handleExportCurrentSession();
          break;
        case "menu:settings":
          router.push("/settings");
          break;
        case "menu:find":
          mainLayoutRef.current?.focusSearch();
          break;
        case "menu:find-next":
        case "menu:find-previous":
          // Find navigation - handled by search component
          break;
        case "menu:clear-chat":
          handleNewSession();
          break;
        case "menu:toggle-sidebar":
          // Sidebar toggle - could be implemented
          break;
        case "menu:check-updates":
          // Trigger update check
          if (window.electronAPI) {
            window.electronAPI.checkForUpdates().catch((err) => {
              console.error("Failed to check for updates:", err);
            });
          }
          break;
      }
    };

    window.electronAPI.onMenuAction(handleMenuAction);

    return () => {
      // Note: electronAPI doesn't provide a cleanup method for menu listeners
    };
  }, [handleNewSession, router, info, handleExportCurrentSession]);

  return (
    <ErrorBoundary
      onError={(error, errorInfo) => {
        console.error("Page Error Boundary caught an error:", error, errorInfo);
      }}
    >
      {/* First-run onboarding */}
      {showOnboarding && (
        <FirstRunOnboarding onComplete={handleOnboardingComplete} />
      )}

      {/* Feature tour (shown after onboarding or triggered manually) */}
      <FeatureTour
        steps={defaultTourSteps}
        isOpen={showTour}
        onClose={() => setShowTour(false)}
        onComplete={handleTourComplete}
      />

      <MainLayout
        ref={mainLayoutRef}
        currentSessionId={currentSessionId}
        onSessionSelect={handleSessionSelect}
        onNewSession={handleNewSession}
        onSessionDelete={handleSessionDelete}
        onSessionRename={handleSessionRename}
        onSessionOpenInNewWindow={handleSessionOpenInNewWindow}
        onSessionExport={handleExportSession}
        onFileSelect={handleFileSelect}
      >
        <ChatInterface
          currentSessionId={currentSessionId}
          onSessionChange={setCurrentSessionId}
          createNewSession={shouldCreateSession}
        />
      </MainLayout>

      {/* Keyboard shortcuts modal */}
      <KeyboardShortcutsModal
        isOpen={showShortcutsModal}
        onClose={() => setShowShortcutsModal(false)}
      />

      {/* Export dialog */}
      <ExportDialog
        isOpen={showExportDialog}
        sessionId={exportSessionId}
        sessionTitle={exportSessionTitle}
        onExport={handleExport}
        onCancel={() => setShowExportDialog(false)}
        isExporting={isExporting}
      />

      {/* Queue status panel */}
      <QueueStatus
        stats={queue.stats}
        operations={queue.operations}
        isProcessing={queue.isProcessing}
        onCancelOperation={queue.cancelOperation}
        onCancelAll={queue.cancelAllOperations}
        onRetryOperation={queue.retryOperation}
        onRemoveOperation={queue.removeOperation}
        onClearHistory={queue.clearHistory}
        onPauseQueue={queue.pauseQueue}
        onResumeQueue={queue.resumeQueue}
      />

      {/* Update notifications (Electron only) */}
      <UpdateNotification />

      {/* Performance debug panel */}
      <PerformanceDebugPanel position="bottom-right" defaultOpen={false} />

      {/* Tour restart button (hidden by default, can be shown via settings) */}
      {!showOnboarding && !showTour && (
        <button
          onClick={handleStartTour}
          className="fixed bottom-4 right-4 z-40 p-2 bg-neutral-800 text-neutral-400 hover:text-white rounded-lg shadow-lg border border-neutral-700 transition-colors"
          title="Show feature tour"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </button>
      )}
    </ErrorBoundary>
  );
}

// Wrapper component with Suspense boundary for useSearchParams
export default function Home() {
  return (
    <Suspense fallback={
      <div className="flex h-screen items-center justify-center bg-white dark:bg-neutral-900">
        <div className="text-neutral-500">Loading...</div>
      </div>
    }>
      <HomeContent />
    </Suspense>
  );
}
