'use client';

/**
 * UpdateNotification - Displays auto-update notifications and download progress
 * Shows when updates are available, downloading, or ready to install
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/lib/context/ToastContext';
import { useProgress } from '@/lib/context/ProgressContext';
import type { UpdateState, UpdateEvent } from '@/types/electron';

interface UpdateNotificationProps {
  // Optional: If provided, will show update notification in a specific container
  // Otherwise, uses the toast system
  inline?: boolean;
}

export function UpdateNotification({ inline = false }: UpdateNotificationProps) {
  const [updateState, setUpdateState] = useState<UpdateState | null>(null);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const { show: showToast, success, error, warning, info } = useToast();
  const { startOperation, updateProgress, completeOperation, failOperation } = useProgress();

  // Handle update events from main process
  const handleUpdateEvent = useCallback((event: UpdateEvent, data?: any) => {
    switch (event) {
      case 'update:checking':
        info('Checking for updates...');
        break;

      case 'update:available':
        const updateInfo = data as { version: string; releaseNotes?: string };
        setUpdateState({
          available: true,
          downloaded: false,
          checking: false,
          downloading: false,
          error: null,
          updateInfo: updateInfo,
          downloadProgress: 0,
          bytesPerSecond: 0,
          percent: 0,
          transferred: 0,
          total: 0,
        });

        // Show notification with download action
        showToast({
          type: 'info',
          message: `Version ${updateInfo.version} is available!`,
          duration: 0, // Don't auto-dismiss
          actions: [
            {
              label: 'Update Now',
              onClick: () => {
                if (window.electronAPI) {
                  window.electronAPI.downloadUpdate();
                }
              },
            },
            {
              label: 'Later',
              onClick: () => {
                if (window.electronAPI) {
                  window.electronAPI.resetUpdateState();
                }
                setUpdateState(null);
              },
            },
          ],
        });
        break;

      case 'update:not-available':
        setUpdateState(null);
        success('You\'re using the latest version!');
        break;

      case 'update:download-progress':
        const progress = data as { percent: number; bytesPerSecond: number; transferred: number; total: number };
        setUpdateState((prev) =>
          prev
            ? {
                ...prev,
                downloading: true,
                downloadProgress: progress.percent,
                percent: progress.percent,
                bytesPerSecond: progress.bytesPerSecond,
                transferred: progress.transferred,
                total: progress.total,
              }
            : null
        );
        break;

      case 'update:downloaded':
        setUpdateState((prev) =>
          prev
            ? {
                ...prev,
                downloaded: true,
                downloading: false,
                downloadProgress: 100,
              }
            : null
        );
        setShowInstallPrompt(true);
        break;

      case 'update:error':
        setUpdateState((prev) =>
          prev
            ? {
                ...prev,
                checking: false,
                downloading: false,
                error: data as string,
              }
            : null
        );
        error(`Update error: ${data}`);
        break;

      case 'update:installing':
        info('Installing update and restarting...');
        break;
    }
  }, [showToast, success, error, info]);

  // Set up event listeners
  useEffect(() => {
    if (!window.electronAPI) return;

    window.electronAPI.onUpdateEvent(handleUpdateEvent);

    // Check initial state
    window.electronAPI.getUpdateState().then((state) => {
      if (state.available && !state.downloaded) {
        setUpdateState(state);
      }
    });

    return () => {
      // Clean up listeners would go here, but electronAPI doesn't expose a way to remove all listeners
    };
  }, [handleUpdateEvent]);

  // Handle manual check for updates
  const checkForUpdates = useCallback(async () => {
    if (!window.electronAPI) return;
    try {
      await window.electronAPI.checkForUpdates();
    } catch (err) {
      error(err instanceof Error ? err.message : 'Failed to check for updates');
    }
  }, [error]);

  // Handle install and restart
  const installAndRestart = useCallback(() => {
    if (!window.electronAPI) return;
    window.electronAPI.installUpdateAndRestart();
  }, []);

  // If not inline, we're using the toast system for notifications
  if (!inline) {
    return null;
  }

  // Inline render for settings panel or other specific locations
  return (
    <div className="update-notification">
      {updateState?.available && !updateState.downloaded && (
        <div className="p-4 bg-blue-900/20 border border-blue-800 rounded-lg">
          <p className="text-sm text-blue-300">
            Version {updateState.updateInfo?.version} is available!
          </p>
          <button
            onClick={() => window.electronAPI?.downloadUpdate()}
            className="mt-2 px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
          >
            Update Now
          </button>
        </div>
      )}

      {updateState?.downloading && (
        <div className="p-4 bg-neutral-750 border border-neutral-600 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-neutral-300">Downloading update...</p>
            <span className="text-xs text-neutral-400">
              {Math.round(updateState.percent)}%
            </span>
          </div>
          <div className="w-full bg-neutral-700 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${updateState.percent}%` }}
            />
          </div>
        </div>
      )}

      {showInstallPrompt && (
        <div className="p-4 bg-green-900/20 border border-green-800 rounded-lg">
          <p className="text-sm text-green-300 mb-3">
            Update downloaded! Restart to apply changes.
          </p>
          <div className="flex gap-2">
            <button
              onClick={installAndRestart}
              className="px-3 py-1.5 text-sm bg-green-600 hover:bg-green-700 text-white rounded transition-colors"
            >
              Restart & Install
            </button>
            <button
              onClick={() => {
                setShowInstallPrompt(false);
                setUpdateState(null);
              }}
              className="px-3 py-1.5 text-sm bg-neutral-700 hover:bg-neutral-600 text-white rounded transition-colors"
            >
              Later
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Export a hook for checking updates from components
export function useUpdateChecker() {
  const checkForUpdates = React.useCallback(async () => {
    if (!window.electronAPI) {
      throw new Error('Electron API not available');
    }
    return await window.electronAPI.checkForUpdates();
  }, []);

  const downloadUpdate = React.useCallback(async () => {
    if (!window.electronAPI) {
      throw new Error('Electron API not available');
    }
    return await window.electronAPI.downloadUpdate();
  }, []);

  const installUpdateAndRestart = React.useCallback(() => {
    if (!window.electronAPI) {
      throw new Error('Electron API not available');
    }
    window.electronAPI.installUpdateAndRestart();
  }, []);

  const getUpdateState = React.useCallback(async (): Promise<UpdateState> => {
    if (!window.electronAPI) {
      throw new Error('Electron API not available');
    }
    return await window.electronAPI.getUpdateState();
  }, []);

  const resetUpdateState = React.useCallback(async () => {
    if (!window.electronAPI) {
      throw new Error('Electron API not available');
    }
    await window.electronAPI.resetUpdateState();
  }, []);

  return {
    checkForUpdates,
    downloadUpdate,
    installUpdateAndRestart,
    getUpdateState,
    resetUpdateState,
  };
}
