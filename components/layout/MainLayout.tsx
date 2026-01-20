"use client";

import { useState, useCallback, useEffect, ReactNode, useRef, useImperativeHandle, forwardRef } from "react";
import { Sidebar, SidebarRef } from "../sidebar/Sidebar";
import { useSidebarState } from "@/lib/storage/ui-state";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { LanguageSelector } from "@/components/ui/LanguageSelector";
import { useTranslations } from "@/lib/context/LocaleContext";

export interface MainLayoutRef {
  focusSearch: () => void;
}

interface MainLayoutProps {
  children: ReactNode;
  currentSessionId: string | null;
  onSessionSelect: (sessionId: string, messageId?: string) => void;
  onNewSession: () => void;
  onSessionDelete: (sessionId: string) => void;
  onSessionRename: (sessionId: string, newTitle: string) => void;
  onSessionOpenInNewWindow?: (sessionId: string) => void;
  onSessionExport?: (sessionId: string, sessionTitle: string) => void;
  onFileSelect: (filePath: string) => void;
}

const MIN_SIDEBAR_WIDTH = 200;
const MAX_SIDEBAR_WIDTH = 500;
const MOBILE_BREAKPOINT = 768;

export const MainLayout = forwardRef<MainLayoutRef, MainLayoutProps>(function MainLayout({
  children,
  currentSessionId,
  onSessionSelect,
  onNewSession,
  onSessionDelete,
  onSessionRename,
  onSessionOpenInNewWindow,
  onSessionExport,
  onFileSelect,
}, ref) {
  const { t } = useTranslations();
  const sidebarRef = useRef<SidebarRef>(null);

  // Expose methods via ref
  useImperativeHandle(ref, () => ({
    focusSearch: () => {
      sidebarRef.current?.focusSearch();
    },
  }), []);

  // UI state persistence for sidebar
  const sidebarState = useSidebarState();
  const savedState = sidebarState.get();

  const [sidebarWidth, setSidebarWidth] = useState(savedState.width);
  const [isResizing, setIsResizing] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(savedState.isCollapsed);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Detect mobile viewport
  useEffect(() => {
    const checkMobile = () => {
      const newIsMobile = window.innerWidth < MOBILE_BREAKPOINT;
      setIsMobile(newIsMobile);
    };

    // Initial check
    checkMobile();

    // Listen for resize
    const handleResize = () => {
      const newIsMobile = window.innerWidth < MOBILE_BREAKPOINT;
      setIsMobile(newIsMobile);

      // Close mobile sidebar when resizing to desktop
      if (!newIsMobile && isMobileSidebarOpen) {
        setIsMobileSidebarOpen(false);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isMobileSidebarOpen]);

  // Close mobile sidebar when clicking outside (body scroll lock)
  useEffect(() => {
    if (isMobile && isMobileSidebarOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [isMobile, isMobileSidebarOpen]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isResizing) return;

      const newWidth = Math.min(
        MAX_SIDEBAR_WIDTH,
        Math.max(MIN_SIDEBAR_WIDTH, e.clientX)
      );
      setSidebarWidth(newWidth);
      // Persist the new width
      sidebarState.setWidth(newWidth);
    },
    [isResizing, sidebarState]
  );

  const handleMouseUp = useCallback(() => {
    setIsResizing(false);
  }, []);

  useEffect(() => {
    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      return () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };
    }
  }, [isResizing, handleMouseMove, handleMouseUp]);

  const toggleSidebar = useCallback(() => {
    if (isMobile) {
      // On mobile, toggle the drawer
      setIsMobileSidebarOpen(prev => !prev);
    } else {
      // On desktop, toggle collapse state
      setIsSidebarCollapsed((prev) => {
        const newState = !prev;
        // Persist the collapsed state
        sidebarState.toggleCollapsed();
        return newState;
      });
    }
  }, [sidebarState, isMobile]);

  const closeMobileSidebar = useCallback(() => {
    setIsMobileSidebarOpen(false);
  }, []);

  // Determine if sidebar should be rendered
  // Desktop: show when not collapsed
  // Mobile: show only when explicitly opened
  const showDesktopSidebar = !isMobile && !isSidebarCollapsed;
  const showMobileSidebar = isMobile && isMobileSidebarOpen;

  return (
    <div className="flex h-screen bg-white dark:bg-neutral-900 overflow-hidden relative">
      {/* Mobile Backdrop */}
      {isMobile && isMobileSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden animate-fade-in"
          onClick={closeMobileSidebar}
          aria-hidden="true"
        />
      )}

      {/* Sidebar - Desktop: Inline, Mobile: Overlay Drawer */}
      {(showDesktopSidebar || showMobileSidebar) && (
        <>
          <nav
            id="sidebar-content"
            className={`
              transition-all duration-200 ease-in-out flex-shrink-0
              ${isMobile
                ? 'fixed inset-y-0 left-0 z-50 w-[80%] max-w-[320px] shadow-2xl'
                : 'relative'
              }
              ${isMobile && isMobileSidebarOpen ? 'translate-x-0' : ''}
              ${isMobile && !isMobileSidebarOpen ? '-translate-x-full' : ''}
            `}
            style={isMobile ? {} : { width: `${sidebarWidth}px` }}
            aria-label="Sidebar navigation"
          >
            <Sidebar
              ref={sidebarRef}
              currentSessionId={currentSessionId}
              onSessionSelect={(sessionId, messageId) => {
                onSessionSelect(sessionId, messageId);
                if (isMobile) closeMobileSidebar();
              }}
              onNewSession={() => {
                onNewSession();
                if (isMobile) closeMobileSidebar();
              }}
              onSessionDelete={onSessionDelete}
              onSessionRename={onSessionRename}
              onSessionOpenInNewWindow={onSessionOpenInNewWindow}
              onSessionExport={(sessionId, sessionTitle) => {
                onSessionExport?.(sessionId, sessionTitle);
                if (isMobile) closeMobileSidebar();
              }}
              onFileSelect={(filePath) => {
                onFileSelect(filePath);
                if (isMobile) closeMobileSidebar();
              }}
              data-sidebar="true"
            />
          </nav>
          {/* Resize Handle - Desktop Only */}
          {!isMobile && (
            <div
              className={`
                w-1 bg-neutral-200 hover:bg-blue-500 dark:bg-neutral-800 dark:hover:bg-blue-500 cursor-col-resize transition-colors relative z-10
                ${isResizing ? "bg-blue-500 dark:bg-blue-500" : ""}
              `}
              onMouseDown={handleMouseDown}
              role="separator"
              aria-orientation="vertical"
              aria-label="Resize sidebar"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
                  e.preventDefault();
                  // Could implement keyboard resize here
                }
              }}
            >
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-0.5 h-4 bg-neutral-400 dark:bg-neutral-600 rounded" />
              </div>
            </div>
          )}
        </>
      )}

      {/* Main Content Area */}
      <main id="main-content" className="flex-1 flex flex-col overflow-hidden min-w-0" tabIndex={-1}>
        {/* Sidebar Toggle Button */}
        <header className="flex items-center justify-between px-3 md:px-4 py-2 md:py-2 border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900/50">
          <div className="flex items-center">
            <button
              onClick={toggleSidebar}
              className="p-2 text-neutral-500 hover:text-neutral-700 hover:bg-neutral-100 dark:text-neutral-500 dark:hover:text-neutral-300 dark:hover:bg-neutral-800 rounded transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
              aria-label={isSidebarCollapsed || (isMobile && !isMobileSidebarOpen) ? t('accessibility.skipToSidebar') : t('common.close')}
              aria-expanded={isMobile ? isMobileSidebarOpen : !isSidebarCollapsed}
              aria-controls="sidebar-content"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 16 16"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
              >
                {isSidebarCollapsed || (isMobile && !isMobileSidebarOpen) ? (
                  <path
                    d="M5 3h8a1 1 0 011 1v8a1 1 0 01-1 1H5M3 8h6"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                ) : (
                  <path
                    d="M3 3h8a1 1 0 011 1v8a1 1 0 01-1 1H3M5 8h6"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                )}
              </svg>
            </button>
          </div>
          <div className="flex items-center gap-1">
            <LanguageSelector variant="dropdown" />
            <ThemeToggle variant="dropdown" />
          </div>
        </header>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {children}
        </div>
      </main>
    </div>
  );
});
