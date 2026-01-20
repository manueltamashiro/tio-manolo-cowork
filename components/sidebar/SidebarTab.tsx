"use client";

import { useTranslations } from "@/lib/context/LocaleContext";

export type SidebarTabType = "sessions" | "files" | "activity";

interface SidebarTabProps {
  type: SidebarTabType;
  active: boolean;
  onClick: () => void;
  activeCount?: number;
}

export function SidebarTab({ type, active, onClick, activeCount }: SidebarTabProps) {
  const { t } = useTranslations();

  const getLabel = () => {
    if (type === "sessions") return t('sidebar.tabs.chats');
    if (type === "files") return t('sidebar.tabs.files');
    return t('sidebar.tabs.activity');
  };

  return (
    <button
      onClick={onClick}
      className={`
        flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors relative
        ${active ? "text-white" : "text-neutral-500 hover:text-neutral-300"}
      `}
    >
      {type === "sessions" ? (
        // Chat/Message icon
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
          />
        </svg>
      ) : type === "files" ? (
        // Files icon
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
          />
        </svg>
      ) : (
        // Activity icon
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M13 10V3L4 14h7v7l9-11h-7z"
          />
        </svg>
      )}
      <span>{getLabel()}</span>
      {activeCount !== undefined && activeCount > 0 && (type === "activity" || type === "sessions") && (
        <span className="flex items-center justify-center w-4 h-4 text-xs font-semibold text-white bg-blue-500 rounded-full">
          {activeCount > 9 ? "9+" : activeCount}
        </span>
      )}
      {active && (
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500" />
      )}
    </button>
  );
}
