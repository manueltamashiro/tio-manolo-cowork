'use client';

/**
 * Notification Context - Manages notification badges for the app icon and sidebar
 * Tracks responses that complete while the app is in the background
 */

import React, { createContext, useContext, useCallback, useState, useEffect, useRef } from 'react';

// ==================== Types ====================

export interface NotificationBadge {
  id: string;
  sessionId: string;
  timestamp: number;
  read: boolean;
}

export interface NotificationContextValue {
  badgeCount: number;
  notifications: NotificationBadge[];
  // Add a notification (response completed while app was in background)
  addNotification: (sessionId: string) => void;
  // Mark all notifications as read
  markAllRead: () => void;
  // Clear all notifications
  clearAll: () => void;
  // Check if app is focused/visible
  isAppFocused: boolean;
}

const NotificationContext = createContext<NotificationContextValue | undefined>(undefined);

// ==================== Provider ====================

interface NotificationProviderProps {
  children: React.ReactNode;
}

export function NotificationProvider({ children }: NotificationProviderProps) {
  const [notifications, setNotifications] = useState<NotificationBadge[]>([]);
  const [isAppFocused, setIsAppFocused] = useState(true); // Default to focused
  const [isDocumentHidden, setIsDocumentHidden] = useState(false);
  const isElectronRef = useRef(false);

  // Initialize on client side only
  useEffect(() => {
    setIsAppFocused(!document.hidden);
    setIsDocumentHidden(document.hidden);
    isElectronRef.current = typeof window !== 'undefined' && 'electronAPI' in window;
  }, []);

  // Track document visibility
  useEffect(() => {
    const handleVisibilityChange = () => {
      const hidden = document.hidden;
      setIsDocumentHidden(hidden);
      setIsAppFocused(!hidden);

      // When app gains focus, clear badges and mark notifications as read
      if (!hidden) {
        clearAppBadge();
        setNotifications((prev) =>
          prev.map((n) => ({ ...n, read: true }))
        );
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Also handle window focus for desktop environments
    window.addEventListener('focus', handleVisibilityChange);
    window.addEventListener('blur', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleVisibilityChange);
      window.removeEventListener('blur', handleVisibilityChange);
    };
  }, []);

  // Calculate unread count for badge
  const badgeCount = notifications.filter((n) => !n.read).length;

  // Update the app badge when count changes
  useEffect(() => {
    if (isElectronRef.current && typeof window !== 'undefined' && 'electronAPI' in window) {
      const updateBadge = async () => {
        try {
          await (window as any).electronAPI.setBadgeCount(badgeCount);
        } catch (error) {
          console.error('Failed to update badge:', error);
        }
      };
      updateBadge();
    }
  }, [badgeCount]);

  // Add a notification
  const addNotification = useCallback((sessionId: string) => {
    // Only add notification if app is in background
    if (!isDocumentHidden) {
      return;
    }

    const id = `notification-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    setNotifications((prev) => [
      {
        id,
        sessionId,
        timestamp: Date.now(),
        read: false,
      },
      ...prev,
    ]);
  }, [isDocumentHidden]);

  // Mark all notifications as read
  const markAllRead = useCallback(() => {
    setNotifications((prev) =>
      prev.map((n) => ({ ...n, read: true }))
    );
    clearAppBadge();
  }, []);

  // Clear all notifications
  const clearAll = useCallback(() => {
    setNotifications([]);
    clearAppBadge();
  }, []);

  const value: NotificationContextValue = {
    badgeCount,
    notifications,
    addNotification,
    markAllRead,
    clearAll,
    isAppFocused,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

// ==================== Helper Functions ====================

/**
 * Clear the app badge (for desktop apps)
 */
async function clearAppBadge() {
  if (typeof window !== 'undefined' && 'electronAPI' in window) {
    try {
      await (window as any).electronAPI.setBadgeCount(0);
    } catch (error) {
      console.error('Failed to clear badge:', error);
    }
  }
}

// ==================== Hook ====================

/**
 * Hook to access the notification context
 */
export function useNotifications(): NotificationContextValue {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
}

/**
 * Hook specifically for adding response completion notifications
 */
export function useResponseNotification() {
  const { addNotification } = useNotifications();
  const [isAppHidden, setIsAppHidden] = useState(false);

  // Track if app is hidden
  useEffect(() => {
    setIsAppHidden(document.hidden);

    const handleVisibilityChange = () => {
      setIsAppHidden(document.hidden);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleVisibilityChange);
    window.addEventListener('blur', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleVisibilityChange);
      window.removeEventListener('blur', handleVisibilityChange);
    };
  }, []);

  const notifyResponseComplete = useCallback(
    (sessionId: string) => {
      // Only notify if app is in background
      if (isAppHidden) {
        addNotification(sessionId);
      }
    },
    [addNotification, isAppHidden]
  );

  return { notifyResponseComplete };
}
