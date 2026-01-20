"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import type { Message, ContentBlock, FileAttachment } from "@/lib/types/chat";
import type { FileSystemEntry } from "@/types/files";
import { useChatContext } from "@/lib/context/ChatContext";
import { useFileTreeContextSafe } from "@/lib/context/FileTreeContext";
import { useModelPreference, useSystemPromptPreference } from "@/lib/storage/ui-state";
import { useProgress } from "@/lib/context/ProgressContext";
import { useResponseNotification } from "@/lib/context/NotificationContext";
import { MessageContent } from "./MessageContent";
import { SettingsButton } from "@/components/settings/SettingsButton";
import { ThinkingIndicator } from "@/components/ui/ThinkingIndicator";
import { AutoComplete } from "./AutoComplete";
import { VoiceInput } from "./VoiceInput";
import { SystemPromptSelector } from "./SystemPromptSelector";
import { SessionTokenStats, TokenUsageDisplay, formatTokenCount, formatCost } from "./TokenUsageDisplay";

interface ChatMessage extends Message {
  attachedFiles?: AttachedFile[];
}

interface AttachedFile {
  path: string;
  name: string;
  type?: 'file' | 'image';
  base64Data?: string;
  mediaType?: string;
}

interface ChatInterfaceProps {
  currentSessionId: string | null;
  onSessionChange: (sessionId: string) => void;
  createNewSession: boolean;
}

export function ChatInterface({
  currentSessionId,
  onSessionChange,
  createNewSession,
}: ChatInterfaceProps) {
  const { currentSession, createSession, addMessage, tokenStats } = useChatContext();
  const modelPreference = useModelPreference();
  const systemPromptPreference = useSystemPromptPreference();
  const { startOperation, updateProgress, completeOperation, failOperation } = useProgress();
  const { notifyResponseComplete } = useResponseNotification();

  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [apiKeyError, setApiKeyError] = useState("");
  const [showApiKeyInput, setShowApiKeyInput] = useState(true);
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const [showFilePicker, setShowFilePicker] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [folderFiles, setFolderFiles] = useState<FileSystemEntry[]>([]);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [selectedSystemPromptContent, setSelectedSystemPromptContent] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const dropZoneRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const fileTreeContext = useFileTreeContextSafe();
  const rootPath = fileTreeContext?.rootPath ?? null;
  const selectedModel = modelPreference.get();
  const selectedSystemPromptId = systemPromptPreference.get();

  // Convert currentSession messages to ChatMessage format
  const messages: ChatMessage[] = currentSession?.messages.map((msg) => ({
    ...msg,
    attachedFiles: msg.fileAttachments?.map((f) => ({
      path: f.filePath,
      name: f.fileName,
    })),
  })) ?? [];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Handle creating a new session when requested
  useEffect(() => {
    if (createNewSession && !currentSessionId) {
      handleCreateNewSession();
    }
  }, [createNewSession]);

  const handleCreateNewSession = useCallback(async () => {
    const metadata: Record<string, unknown> = {};
    if (selectedSystemPromptContent) {
      metadata.systemPrompt = selectedSystemPromptContent;
    }
    const newSession = await createSession("New Chat", metadata);
    if (newSession) {
      onSessionChange(newSession.id);
    }
  }, [createSession, onSessionChange, selectedSystemPromptContent]);

  const handleSetApiKey = async (e: React.FormEvent) => {
    e.preventDefault();
    setApiKeyError("");

    if (!apiKey.trim()) {
      setApiKeyError("API key is required");
      return;
    }

    try {
      const response = await fetch("/api/api-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to set API key");
      }

      setShowApiKeyInput(false);
    } catch (error) {
      setApiKeyError(
        error instanceof Error ? error.message : "Failed to set API key"
      );
    }
  };

  // Toggle file picker and load files from the selected folder
  const toggleFilePicker = async () => {
    if (!rootPath) {
      setApiKeyError("Please select a folder first");
      return;
    }

    if (showFilePicker) {
      setShowFilePicker(false);
    } else {
      // Load files from the selected folder
      try {
        const response = await fetch("/api/files/list", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            path: rootPath,
            options: {
              includeHidden: false,
              recursive: true,
              maxDepth: 3,
            },
          }),
        });

        if (response.ok) {
          const data = await response.json();
          setFolderFiles(flattenFileTree(data.entries));
        }
      } catch (error) {
        console.error("Failed to load files:", error);
      }
      setShowFilePicker(true);
    }
  };

  // Flatten file tree to get all files
  const flattenFileTree = (entries: FileSystemEntry[]): FileSystemEntry[] => {
    const files: FileSystemEntry[] = [];
    for (const entry of entries) {
      if (entry.type === "file") {
        files.push(entry);
      } else if (entry.children) {
        files.push(...flattenFileTree(entry.children));
      }
    }
    return files;
  };

  // Attach a file to the message
  const attachFile = (file: FileSystemEntry) => {
    if (!attachedFiles.find((f) => f.path === file.path)) {
      setAttachedFiles([...attachedFiles, { path: file.path, name: file.name }]);
    }
  };

  // Attach an image from clipboard (base64 data)
  const attachImageFromClipboard = (base64Data: string, mediaType: string, fileName: string) => {
    const imageId = `clipboard-image-${Date.now()}`;
    setAttachedFiles([...attachedFiles, {
      path: imageId,
      name: fileName,
      type: 'image',
      base64Data,
      mediaType
    }]);
  };

  // Handle paste events
  const handlePaste = async (e: React.ClipboardEvent) => {
    const clipboardData = e.clipboardData;
    if (!clipboardData) return;

    const items = Array.from(clipboardData.items);

    // Check for images in clipboard
    const imageItem = items.find(item => item.type.startsWith('image/'));
    if (imageItem) {
      e.preventDefault();
      const file = imageItem.getAsFile();
      if (file) {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          // Extract base64 data (remove data URL prefix)
          const matches = result.match(/^data:([^;]+);base64,(.+)$/);
          if (matches) {
            const mediaType = matches[1];
            const base64Data = matches[2];
            attachImageFromClipboard(base64Data, mediaType, `pasted-image-${Date.now()}.${mediaType.split('/')[1]}`);
          }
        };
        reader.readAsDataURL(file);
      }
      return;
    }

    // Check for file data in clipboard
    const fileItem = items.find(item => item.kind === 'file' && item.type.startsWith('text/'));
    if (fileItem) {
      e.preventDefault();
      const file = fileItem.getAsFile();
      if (file) {
        const reader = new FileReader();
        reader.onload = () => {
          const content = reader.result as string;
          // Insert file content as text in the input
          setInput(prev => prev + (prev ? '\n\n' : '') + `// File: ${file.name}\n${content}`);
        };
        reader.readAsText(file);
      }
      return;
    }
  };

  // Remove a file from attachments
  const removeAttachment = (filePath: string) => {
    setAttachedFiles(attachedFiles.filter((f) => f.path !== filePath));
  };

  // Handle drag over
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    setIsDraggingOver(true);
  };

  // Handle drag leave
  const handleDragLeave = (e: React.DragEvent) => {
    // Only set dragging to false if we're actually leaving the form
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = e.clientX;
    const y = e.clientY;

    // Check if the mouse left the element bounds
    if (x < rect.left || x >= rect.right || y < rect.top || y >= rect.bottom) {
      setIsDraggingOver(false);
    }
  };

  // Handle drop
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);

    try {
      const data = e.dataTransfer.getData('application/json');
      if (data) {
        const droppedFile = JSON.parse(data);
        if (droppedFile.type === 'file') {
          // Attach the dropped file
          if (!attachedFiles.find((f) => f.path === droppedFile.path)) {
            setAttachedFiles([...attachedFiles, {
              path: droppedFile.path,
              name: droppedFile.name
            }]);
          }
        }
      }
    } catch (error) {
      console.error('Failed to handle drop:', error);
    }
  };

  // Handle auto-complete selection
  const handleAutoCompleteSelect = (value: string, replaceFrom: number, replaceTo: number) => {
    const before = input.slice(0, replaceFrom);
    const after = input.slice(replaceTo);
    setInput(before + value + after);

    // Move cursor to end of inserted value
    setTimeout(() => {
      const newPosition = replaceFrom + value.length;
      inputRef.current?.setSelectionRange(newPosition, newPosition);
      inputRef.current?.focus();
    }, 0);
  };

  // Handle voice transcript
  const handleVoiceTranscript = (transcript: string) => {
    setInput(prev => prev + transcript);
  };

  // Toggle recording state
  const toggleRecording = () => {
    setIsRecording(prev => !prev);
  };

  // Fetch file content for attached files
  const fetchFileContents = async (
    files: AttachedFile[]
  ): Promise<Array<{ path: string; name: string; content: string }>> => {
    const fileContents = await Promise.all(
      files.filter(f => f.type !== 'image').map(async (file) => {
        const opId = startOperation("file-read", `Reading ${file.name}`, { filePath: file.path, fileName: file.name });
        try {
          updateProgress(opId, 20, "Opening file...");

          const response = await fetch("/api/files/read", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ path: file.path }),
          });

          if (response.ok) {
            updateProgress(opId, 80, "Reading content...");
            const data = await response.json();
            updateProgress(opId, 100, "File read complete");
            completeOperation(opId, `Read ${file.name}`);
            return { path: file.path, name: file.name, content: data.content };
          }
          throw new Error(`Failed to read file: ${response.statusText}`);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : "Unknown error";
          failOperation(opId, errorMessage);
          console.error(`Failed to read file ${file.path}:`, error);
        }
        return null;
      })
    );

    return fileContents.filter(
      (f): f is { path: string; name: string; content: string } =>
        f !== null
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!input.trim() && attachedFiles.length === 0) || isLoading || !currentSessionId) return;

    // Fetch file contents if there are attachments (excluding images)
    let fileContexts: Array<{ path: string; name: string; content: string }> =
      [];
    const nonImageFiles = attachedFiles.filter(f => f.type !== 'image');
    if (nonImageFiles.length > 0) {
      fileContexts = await fetchFileContents(nonImageFiles);
    }

    // Create content blocks for the message
    const contentBlocks: ContentBlock[] = [];

    // Add text input
    if (input.trim()) {
      contentBlocks.push({ type: 'text', text: input.trim() });
    }

    // Add attached images as content blocks
    const imageAttachments = attachedFiles.filter(f => f.type === 'image');
    for (const image of imageAttachments) {
      if (image.base64Data && image.mediaType) {
        contentBlocks.push({
          type: 'image',
          source: {
            type: 'base64',
            mediaType: image.mediaType,
            data: image.base64Data
          }
        });
      }
    }

    // If no content blocks and no file contexts, return
    if (contentBlocks.length === 0 && fileContexts.length === 0) return;

    // Create file attachments for storage (only for non-image files)
    const fileAttachments: FileAttachment[] = nonImageFiles.map((f, i) => ({
      id: `file-${Date.now()}-${i}`,
      filePath: f.path,
      fileName: f.name,
    }));

    // Save user message to database
    const userMessage = await addMessage(
      currentSessionId,
      'user',
      contentBlocks,
      { timestamp: Date.now() },
      fileAttachments
    );

    if (!userMessage) {
      setApiKeyError("Failed to save message. Please try again.");
      return;
    }

    setInput("");
    setAttachedFiles([]);
    setIsLoading(true);

    // Prepare messages for API (include all previous messages for context)
    const apiMessages = messages.map((m) => ({
      role: m.role,
      content: m.content.map((b) => b.type === 'text' ? b.text : '').join(''),
    }));

    // Add the new user message
    apiMessages.push({
      role: 'user',
      content: input.trim(),
    });

    // Start tracking the API call
    const opId = startOperation("chat-stream", "AI Response", { endpoint: "/api/chat", method: "POST" });
    updateProgress(opId, 10, "Sending request...");

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
        },
        body: JSON.stringify({
          messages: apiMessages,
          model: selectedModel,
          stream: true,
          fileContexts: fileContexts.map((f) => ({
            path: f.path,
            name: f.name,
            content: f.content,
          })),
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to get response");
      }

      updateProgress(opId, 20, "Streaming response...");

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error("No response body");
      }

      let buffer = "";
      let assistantContent = "";
      let chunkCount = 0;
      let usageData: { inputTokens?: number; outputTokens?: number; cacheReadTokens?: number; cacheCreationTokens?: number } | undefined;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = JSON.parse(line.slice(6));
            if (data.type === "content") {
              assistantContent += data.content;
              chunkCount++;
              // Update progress based on chunks (assume ~50 chunks is a full response)
              const progress = Math.min(90, 20 + (chunkCount * 2));
              updateProgress(opId, progress, `Receiving response (${chunkCount} chunks)...`);
            } else if (data.type === "error") {
              throw new Error(data.error);
            } else if (data.type === "done") {
              // Capture usage data if provided
              if (data.usage) {
                usageData = data.usage;
              }
              updateProgress(opId, 95, "Saving response...");
              // Save assistant message to database when complete with usage metadata
              await addMessage(
                currentSessionId,
                'assistant',
                [{ type: 'text', text: assistantContent }],
                {
                  timestamp: Date.now(),
                  inputTokens: usageData?.inputTokens,
                  outputTokens: usageData?.outputTokens,
                  cacheReadTokens: usageData?.cacheReadTokens,
                  cacheCreationTokens: usageData?.cacheCreationTokens,
                  model: selectedModel,
                }
              );
              updateProgress(opId, 100, "Response complete");
              completeOperation(opId, "AI Response complete");
              // Notify if app was in background
              if (currentSessionId) {
                notifyResponseComplete(currentSessionId);
              }
              setIsLoading(false);
              return;
            }
          }
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to send message";
      failOperation(opId, errorMessage);
      setApiKeyError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  if (showApiKeyInput) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-white dark:bg-neutral-900 p-4">
        <div className="w-full max-w-md p-4 md:p-6 bg-white dark:bg-neutral-800 rounded-lg shadow-xl">
          <h1 className="text-xl md:text-2xl font-semibold text-neutral-900 dark:text-white mb-4">
            Tio Manolo Cowork
          </h1>
          <p className="text-neutral-600 dark:text-neutral-400 mb-6 text-sm md:text-base">
            Enter your Anthropic API key to get started.
          </p>
          <form onSubmit={handleSetApiKey} className="space-y-4">
            <div>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-ant-api03-..."
                className="w-full px-4 py-3 bg-neutral-100 dark:bg-neutral-700 text-neutral-900 dark:text-white rounded-md border border-neutral-300 dark:border-neutral-600 focus:outline-none focus:border-blue-500 placeholder:text-neutral-500 dark:placeholder:text-neutral-400 min-h-[48px]"
                autoFocus
              />
              {apiKeyError && (
                <p className="mt-2 text-sm text-red-400">{apiKeyError}</p>
              )}
            </div>
            <button
              type="submit"
              className="w-full px-4 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors min-h-[48px] font-medium"
            >
              Continue
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Show loading state when switching sessions
  if (currentSessionId && messages.length === 0 && !currentSession) {
    return (
      <div className="flex items-center justify-center h-screen bg-white dark:bg-neutral-900">
        <ThinkingIndicator size="lg" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-white dark:bg-neutral-900 relative">
      <header className="px-4 md:px-6 py-3 md:py-4 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <h1 id="chat-title" className="text-base md:text-lg lg:text-xl font-semibold text-neutral-900 dark:text-white truncate pr-4">
            {currentSession?.title ?? "Tio Manolo Cowork"}
          </h1>
          {isRecording && (
            <div className="flex items-center gap-2 px-3 py-1 bg-red-100 dark:bg-red-900/30 rounded-full" role="status" aria-live="polite">
              <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" aria-hidden="true"></span>
              <span className="text-xs md:text-sm font-medium text-red-600 dark:text-red-400">Recording...</span>
            </div>
          )}
          {/* Session token stats */}
          {tokenStats.totalTokens > 0 && (
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 bg-neutral-100 dark:bg-neutral-800 rounded-md text-xs text-neutral-600 dark:text-neutral-400">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <span className="font-medium">{formatTokenCount(tokenStats.totalTokens)}</span>
              <span className="text-neutral-500 dark:text-neutral-500">tokens</span>
              {tokenStats.totalCost > 0 && (
                <span className="text-blue-600 dark:text-blue-400 ml-1">{formatCost(tokenStats.totalCost)}</span>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <SystemPromptSelector
            onPromptChange={(id, content) => setSelectedSystemPromptContent(content)}
          />
          <SettingsButton />
        </div>
      </header>

      <div
        className="flex-1 overflow-y-auto p-3 md:p-4 lg:p-6 space-y-4 md:space-y-6"
        role="log"
        aria-live="polite"
        aria-atomic="false"
        aria-label="Chat messages"
      >
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full" role="status">
            <p className="text-neutral-500 text-sm md:text-base text-center px-4">
              Start a conversation by typing a message below.
            </p>
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${
                message.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              <div
                className={`relative max-w-[85%] md:max-w-[80%] lg:max-w-[75%] rounded-lg px-3 py-2 md:px-4 md:py-3 ${
                  message.role === "user"
                    ? "bg-blue-600 text-white"
                    : "bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100"
                }`}
                role="article"
                aria-label={`${message.role === "user" ? "You" : "Assistant"} message`}
              >
                {/* Display attached files for user messages */}
                {message.attachedFiles && message.attachedFiles.length > 0 && (
                  <div className="mb-2 flex flex-wrap gap-1" role="list" aria-label={`${message.attachedFiles.length} attached file${message.attachedFiles.length > 1 ? 's' : ''}`}>
                    {message.attachedFiles.map((file) => (
                      <span
                        key={file.path}
                        className="inline-flex items-center px-2 py-1 bg-blue-700/50 rounded text-xs"
                        role="listitem"
                      >
                        <svg
                          className="w-3 h-3 mr-1"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                          aria-hidden="true"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                          />
                        </svg>
                        {file.name}
                      </span>
                    ))}
                  </div>
                )}
                <MessageContent
                  content={message.content}
                  showCopyButton={message.role === "assistant"}
                />
                {/* Token usage display for assistant messages */}
                {message.role === "assistant" && (
                  <TokenUsageDisplay message={message} detailed={false} />
                )}
              </div>
            </div>
          ))
        )}
        {isLoading && (
          <div className="flex justify-start" role="status" aria-live="polite" aria-label="Assistant is typing">
            <div className="bg-neutral-100 dark:bg-neutral-800 rounded-lg px-4 py-3">
              <ThinkingIndicator size="md" />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* File attachments display */}
      {attachedFiles.length > 0 && (
        <div className="px-3 md:px-4 lg:px-6 py-2 md:py-3 bg-neutral-100 dark:bg-neutral-800/50 border-t border-neutral-200 dark:border-neutral-800" role="region" aria-label="Attached files">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
              Attached Files ({attachedFiles.length})
            </span>
            <button
              type="button"
              onClick={() => setAttachedFiles([])}
              className="text-xs text-neutral-500 hover:text-red-400 transition-colors min-h-[36px] px-2 flex items-center"
              aria-label="Clear all attached files"
            >
              Clear All
            </button>
          </div>
          <div className="flex flex-wrap gap-2" role="list">
            {attachedFiles.map((file) => (
              <span
                key={file.path}
                className={`group inline-flex items-center ${file.type === 'image' ? 'p-1' : 'px-2 md:px-3 py-2'} bg-neutral-200 dark:bg-neutral-700 rounded-lg text-sm text-neutral-700 dark:text-neutral-200 hover:bg-neutral-300 dark:hover:bg-neutral-600 transition-colors`}
                role="listitem"
              >
                {file.type === 'image' && file.base64Data && file.mediaType ? (
                  <div className="relative">
                    <img
                      src={`data:${file.mediaType};base64,${file.base64Data}`}
                      alt={file.name}
                      className="h-16 w-auto rounded object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => removeAttachment(file.path)}
                      className="absolute -top-2 -right-2 bg-red-500 hover:bg-red-600 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                      aria-label={`Remove ${file.name}`}
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ) : (
                  <>
                    <svg
                      className="w-4 h-4 mr-2 text-blue-400 flex-shrink-0"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                    <span className="max-w-[150px] md:max-w-[200px] truncate">{file.name}</span>
                    <button
                      type="button"
                      onClick={() => removeAttachment(file.path)}
                      className="ml-1 md:ml-2 opacity-100 md:opacity-0 group-hover:opacity-100 text-neutral-400 hover:text-red-400 transition-all min-h-[32px] min-w-[32px] flex items-center justify-center"
                      aria-label={`Remove ${file.name}`}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </>
                )}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* File picker modal */}
      {showFilePicker && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true" aria-labelledby="file-picker-title">
          <div className="bg-white dark:bg-neutral-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] md:max-h-[80vh] flex flex-col">
            <div className="px-4 md:px-6 py-3 md:py-4 border-b border-neutral-200 dark:border-neutral-700 flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <h2 id="file-picker-title" className="text-base md:text-lg font-semibold text-neutral-900 dark:text-white truncate">
                  Select Files to Attach
                </h2>
                <p className="text-xs md:text-sm text-neutral-600 dark:text-neutral-400 mt-1">
                  {attachedFiles.length} file{attachedFiles.length !== 1 ? 's' : ''} selected
                </p>
              </div>
              <div className="flex items-center gap-2">
                {attachedFiles.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setAttachedFiles([])}
                    className="px-3 py-1.5 text-sm bg-neutral-200 dark:bg-neutral-700 hover:bg-neutral-300 dark:hover:bg-neutral-600 text-neutral-900 dark:text-white rounded transition-colors min-h-[40px]"
                  >
                    Clear All
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowFilePicker(false)}
                  className="text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white p-2 min-h-[44px] min-w-[44px] flex items-center justify-center"
                  aria-label="Close file picker"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-3 md:p-4" role="listbox" aria-label="Available files">
              {folderFiles.length === 0 ? (
                <p className="text-neutral-500 text-center py-8 text-sm md:text-base">
                  No files found in the selected folder.
                </p>
              ) : (
                <div className="grid grid-cols-1 gap-2">
                  {folderFiles.map((file) => {
                    const isAttached = !!attachedFiles.find((f) => f.path === file.path);
                    return (
                      <button
                        key={file.path}
                        type="button"
                        onClick={() => isAttached ? removeAttachment(file.path) : attachFile(file)}
                        className={`flex items-center px-3 md:px-4 py-3 rounded-lg text-left transition-colors min-h-[52px] md:min-h-[48px] ${
                          isAttached
                            ? "bg-blue-600/30 text-blue-300 hover:bg-blue-600/40"
                            : "bg-neutral-100 dark:bg-neutral-700 hover:bg-neutral-200 dark:hover:bg-neutral-600 text-neutral-700 dark:text-neutral-200"
                        }`}
                        aria-pressed={isAttached}
                        aria-label={`${isAttached ? 'Remove' : 'Attach'} ${file.name}`}
                      >
                        <div className={`w-5 h-5 mr-3 flex-shrink-0 rounded border ${
                          isAttached
                            ? "bg-blue-500 border-blue-500 flex items-center justify-center"
                            : "border-neutral-500"
                        }`} aria-hidden="true">
                          {isAttached && (
                            <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </div>
                        <svg
                          className="w-5 h-5 mr-3 flex-shrink-0 text-neutral-400"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                          aria-hidden="true"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                          />
                        </svg>
                        <span className="truncate flex-1 text-left text-sm md:text-base">{file.name}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="px-4 md:px-6 py-3 md:py-4 border-t border-neutral-200 dark:border-neutral-700 flex flex-col-reverse md:flex-row justify-between items-stretch md:items-center gap-3">
              <span className="text-xs md:text-sm text-neutral-600 dark:text-neutral-400 flex items-center">
                Drag files from the file tree to attach
              </span>
              <button
                type="button"
                onClick={() => setShowFilePicker(false)}
                className="px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors min-h-[48px] font-medium"
              >
                Done ({attachedFiles.length} selected)
              </button>
            </div>
          </div>
        </div>
      )}

      <form
        ref={dropZoneRef}
        onSubmit={handleSubmit}
        className={`p-3 md:p-4 lg:p-6 border-t border-neutral-200 dark:border-neutral-800 transition-colors ${
          isDraggingOver ? 'bg-blue-900/20 border-blue-500/50' : ''
        }`}
        data-chat-input="true"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        role="form"
        aria-label="Chat input form"
      >
        {/* Drop zone overlay when dragging */}
        {isDraggingOver && (
          <div className="absolute inset-0 bg-blue-500/10 border-2 border-dashed border-blue-400 rounded-lg flex items-center justify-center pointer-events-none z-10 m-3 md:m-4 lg:m-6" role="status" aria-live="assertive">
            <div className="text-center">
              <svg
                className="w-12 h-12 mx-auto text-blue-400 mb-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                />
              </svg>
              <p className="text-blue-300 font-medium text-sm md:text-base">Drop files to attach</p>
            </div>
          </div>
        )}
        <div className="flex space-x-2 md:space-x-4">
          <button
            type="button"
            onClick={toggleFilePicker}
            disabled={!rootPath}
            className="px-3 md:px-4 py-3 bg-neutral-200 dark:bg-neutral-700 text-neutral-700 dark:text-white rounded-lg hover:bg-neutral-300 dark:hover:bg-neutral-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center min-h-[48px] min-w-[48px]"
            title={rootPath ? "Attach files from selected folder" : "Select a folder first"}
            aria-label={rootPath ? "Attach files" : "Select a folder first"}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
            </svg>
          </button>
          <VoiceInput
            onTranscript={handleVoiceTranscript}
            disabled={isLoading || !currentSessionId}
            isRecording={isRecording}
            onToggleRecording={toggleRecording}
          />
          <div className="relative flex-1">
            <input
              ref={inputRef}
              id="chat-message-input"
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onPaste={handlePaste}
              placeholder="Type your message... (Type / for commands, @ for files)"
              disabled={isLoading || !currentSessionId}
              className="w-full px-3 md:px-4 py-3 bg-neutral-50 dark:bg-neutral-800 text-neutral-900 dark:text-white rounded-lg border border-neutral-300 dark:border-neutral-700 focus:outline-none focus:border-blue-500 disabled:opacity-50 text-sm md:text-base min-h-[48px] placeholder:text-neutral-500 dark:placeholder:text-neutral-400"
              aria-label="Type your message"
              aria-describedby={currentSessionId ? undefined : "chat-input-hint"}
              aria-autocomplete="list"
              aria-controls="autocomplete-list"
            />
            <AutoComplete
              input={input}
              inputRef={inputRef}
              disabled={isLoading || !currentSessionId}
              fileEntries={fileTreeContext?.entries ?? []}
              onSelect={handleAutoCompleteSelect}
            />
          </div>
          <button
            type="submit"
            disabled={isLoading || (!input.trim() && attachedFiles.length === 0) || !currentSessionId}
            className="px-4 md:px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-h-[48px] min-w-[64px] md:min-w-[80px] font-medium"
            aria-label="Send message"
          >
            <span className="hidden md:inline">Send</span>
            <span className="md:hidden">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </span>
          </button>
        </div>
        {apiKeyError && (
          <p className="mt-2 text-sm text-red-400" role="alert">{apiKeyError}</p>
        )}
        {!currentSessionId && (
          <p id="chat-input-hint" className="mt-2 text-xs md:text-sm text-neutral-500">Create or select a session to start chatting</p>
        )}
      </form>
    </div>
  );
}
