"use client";

import { useState, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import type { ContentBlock, ImageSource } from "@/lib/types/chat";
import { DiffViewer } from "@/components/diff/DiffViewer";
import { ImagePreviewModal, type ImagePreviewData } from "@/components/ui/ImagePreviewModal";

interface MessageContentProps {
  content: ContentBlock[] | string;
  showCopyButton?: boolean;
  onCopyMessage?: (content: string) => void;
}

interface DiffState {
  originalContent: string;
  newContent: string;
  fileName: string;
}

export function MessageContent({ content, showCopyButton, onCopyMessage }: MessageContentProps) {
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [copiedMessage, setCopiedMessage] = useState(false);
  const [diffState, setDiffState] = useState<DiffState | null>(null);
  const [previewImage, setPreviewImage] = useState<ImagePreviewData | null>(null);

  const copyMessageToClipboard = useCallback(async () => {
    try {
      // Convert content blocks to plain text/markdown format
      const contentBlocks: ContentBlock[] = Array.isArray(content)
        ? content
        : [{ type: "text", text: content }];

      const messageText = contentBlocks
        .map((block) => {
          if (block.type === "text") {
            return block.text;
          } else if (block.type === "image") {
            return block.source.type === "url"
              ? `![Image](${block.source.url})`
              : `[Image: data:${block.source.mediaType};base64,${block.source.data.slice(0, 20)}...]`;
          } else if (block.type === "tool_use") {
            return `\`\`\`tool_use\n${block.name}\n${JSON.stringify(block.input, null, 2)}\n\`\`\``;
          } else if (block.type === "tool_result") {
            return `\`\`\`tool_result\n${block.content || ""}\n\`\`\``;
          }
          return "";
        })
        .join("\n\n");

      await navigator.clipboard.writeText(messageText);
      setCopiedMessage(true);
      setTimeout(() => setCopiedMessage(false), 2000);
      onCopyMessage?.(messageText);
    } catch (err) {
      console.error("Failed to copy message:", err);
    }
  }, [content, onCopyMessage]);

  const copyToClipboard = useCallback(async (code: string, language: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(language);
      setTimeout(() => setCopiedCode(null), 2000);
    } catch (err) {
      console.error("Failed to copy code:", err);
    }
  }, []);

  const showDiff = useCallback(async (block: ContentBlock) => {
    if (block.type !== "tool_result" || !block.diffMetadata) {
      return;
    }

    const { backupPath, filePath, fileName } = block.diffMetadata;
    if (!backupPath || !filePath) {
      return;
    }

    try {
      const response = await fetch("/api/files/diff", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ backupPath, currentPath: filePath }),
      });

      if (!response.ok) {
        console.error("Failed to fetch diff:", await response.text());
        return;
      }

      const data = await response.json();
      setDiffState({
        originalContent: data.originalContent,
        newContent: data.newContent,
        fileName: fileName || data.fileName,
      });
    } catch (error) {
      console.error("Failed to load diff:", error);
    }
  }, []);

  const closeDiff = useCallback(() => {
    setDiffState(null);
  }, []);

  // Helper to get image source from ImageSource
  const getImageSrc = useCallback((source: ImageSource): string => {
    if (source.type === "base64") {
      return `data:${source.mediaType};base64,${source.data}`;
    }
    return source.url;
  }, []);

  // Handle image click to open preview
  const handleImageClick = useCallback((source: ImageSource) => {
    const src = getImageSrc(source);
    setPreviewImage({
      src,
      mediaType: source.type === "base64" ? source.mediaType : undefined,
    });
  }, [getImageSrc]);

  // Close image preview
  const closeImagePreview = useCallback(() => {
    setPreviewImage(null);
  }, []);

  // Normalize content to ContentBlock array
  const contentBlocks: ContentBlock[] = Array.isArray(content)
    ? content
    : [{ type: "text", text: content }];

  // Render a single content block
  const renderContentBlock = (block: ContentBlock, index: number) => {
    switch (block.type) {
      case "text":
        return (
          <div key={`text-${index}`} className="prose prose-invert max-w-none">
            <MarkdownContent
              content={block.text}
              copiedCode={copiedCode}
              onCopyCode={copyToClipboard}
            />
          </div>
        );

      case "tool_use":
        return (
          <div
            key={`tool-${index}`}
            className="my-3 p-3 bg-neutral-700/50 rounded-lg border border-neutral-600"
          >
            <div className="flex items-center gap-2 mb-2">
              <svg
                className="w-4 h-4 text-amber-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
              <span className="text-sm font-medium text-amber-300">
                {block.name}
              </span>
            </div>
            <pre className="text-xs text-neutral-400 overflow-x-auto">
              {JSON.stringify(block.input, null, 2)}
            </pre>
          </div>
        );

      case "tool_result":
        return (
          <div
            key={`result-${index}`}
            className={`my-3 p-3 rounded-lg border ${
              block.is_error
                ? "bg-red-900/20 border-red-700/50"
                : "bg-green-900/20 border-green-700/50"
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                {block.is_error ? (
                  <svg
                    className="w-4 h-4 text-red-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                ) : (
                  <svg
                    className="w-4 h-4 text-green-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                )}
                <span
                  className={`text-sm font-medium ${
                    block.is_error ? "text-red-300" : "text-green-300"
                  }`}
                >
                  {block.is_error ? "Tool Error" : "Tool Result"}
                </span>
              </div>
              {/* Show diff button for write_file operations with backup */}
              {!block.is_error && block.diffMetadata?.backupPath && block.diffMetadata.action === "overwritten" && (
                <button
                  onClick={() => showDiff(block)}
                  className="flex items-center gap-1.5 px-2 py-1 text-xs bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 rounded transition-colors"
                  type="button"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  View Diff
                </button>
              )}
            </div>
            {block.content && (
              <pre className="text-xs text-neutral-300 whitespace-pre-wrap overflow-x-auto">
                {block.content}
              </pre>
            )}
          </div>
        );

      case "image":
        const imageSrc = getImageSrc(block.source);
        return (
          <button
            key={`image-${index}`}
            type="button"
            onClick={() => handleImageClick(block.source)}
            className="relative group inline-block max-w-full"
            aria-label="Preview image"
          >
            <img
              src={imageSrc}
              alt="Attached image"
              className="max-w-full h-auto rounded-lg my-2 cursor-pointer hover:opacity-90 transition-opacity"
            />
            <span className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
              <span className="bg-black/50 text-white px-2 py-1 rounded text-xs">Click to preview</span>
            </span>
          </button>
        );

      default:
        return null;
    }
  };

  return (
    <div className="message-content relative group">
      {showCopyButton && (
        <button
          onClick={copyMessageToClipboard}
          className="absolute -top-3 -right-3 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 bg-neutral-700 hover:bg-neutral-600 rounded-md shadow-lg z-10"
          aria-label="Copy message"
          type="button"
        >
          {copiedMessage ? (
            <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <svg className="w-4 h-4 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          )}
        </button>
      )}
      {contentBlocks.map((block, index) => renderContentBlock(block, index))}
      {diffState && (
        <DiffViewer
          originalContent={diffState.originalContent}
          newContent={diffState.newContent}
          fileName={diffState.fileName}
          onClose={closeDiff}
        />
      )}
      {previewImage && (
        <ImagePreviewModal
          isOpen={!!previewImage}
          imageData={previewImage}
          onClose={closeImagePreview}
        />
      )}
    </div>
  );
}

interface MarkdownContentProps {
  content: string;
  copiedCode: string | null;
  onCopyCode: (code: string, language: string) => void;
}

function MarkdownContent({ content, copiedCode, onCopyCode }: MarkdownContentProps) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        code(props: any) {
          const { node, className, children, ...restProps } = props;
          const match = /language-(\w+)/.exec(className || "");
          const language = match ? match[1] : "";
          const codeString = String(children).replace(/\n$/, "");
          const inline = !className && !codeString.includes("\n");

          if (!inline) {
            return (
              <div className="relative group my-4">
                <div className="flex items-center justify-between px-4 py-2 bg-neutral-800/80 rounded-t-lg border-b border-neutral-700">
                  <span className="text-xs text-neutral-400 font-medium">
                    {language || "code"}
                  </span>
                  <button
                    onClick={() => onCopyCode(codeString, language || "code")}
                    className="flex items-center gap-1.5 px-2 py-1 text-xs text-neutral-400 hover:text-white transition-colors rounded hover:bg-neutral-700"
                    aria-label="Copy code to clipboard"
                    type="button"
                  >
                    {copiedCode === (language || "code") ? (
                      <>
                        <svg
                          className="w-3.5 h-3.5 text-green-400"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                        Copied!
                      </>
                    ) : (
                      <>
                        <svg
                          className="w-3.5 h-3.5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                          />
                        </svg>
                        Copy
                      </>
                    )}
                  </button>
                </div>
                <SyntaxHighlighter
                  language={language}
                  style={vscDarkPlus}
                  customStyle={{
                    margin: 0,
                    borderTopLeftRadius: 0,
                    borderTopRightRadius: 0,
                    borderBottomLeftRadius: "0.5rem",
                    borderBottomRightRadius: "0.5rem",
                    fontSize: "0.875rem",
                    lineHeight: "1.5",
                  }}
                  {...restProps}
                >
                  {codeString}
                </SyntaxHighlighter>
              </div>
            );
          }

          return (
            <code
              className="px-1.5 py-0.5 rounded bg-neutral-700/50 text-amber-300 font-mono text-sm"
              {...restProps}
            >
              {children}
            </code>
          );
        },
        p({ children }) {
          return <p className="mb-4 last:mb-0">{children}</p>;
        },
        ul({ children }) {
          return <ul className="list-disc list-inside mb-4 space-y-1">{children}</ul>;
        },
        ol({ children }) {
          return <ol className="list-decimal list-inside mb-4 space-y-1">{children}</ol>;
        },
        li({ children }) {
          return <li className="text-neutral-200">{children}</li>;
        },
        h1({ children }) {
          return <h1 className="text-xl font-bold mb-4 text-white">{children}</h1>;
        },
        h2({ children }) {
          return <h2 className="text-lg font-bold mb-3 text-white">{children}</h2>;
        },
        h3({ children }) {
          return <h3 className="text-base font-bold mb-2 text-white">{children}</h3>;
        },
        a({ href, children }) {
          return (
            <a
              href={href}
              className="text-blue-400 hover:text-blue-300 underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              {children}
            </a>
          );
        },
        blockquote({ children }) {
          return (
            <blockquote className="border-l-4 border-neutral-600 pl-4 italic text-neutral-400 mb-4">
              {children}
            </blockquote>
          );
        },
        table({ children }) {
          return (
            <div className="overflow-x-auto mb-4">
              <table className="min-w-full border border-neutral-700 rounded-lg overflow-hidden">
                {children}
              </table>
            </div>
          );
        },
        thead({ children }) {
          return <thead className="bg-neutral-800">{children}</thead>;
        },
        tbody({ children }) {
          return <tbody className="divide-y divide-neutral-700">{children}</tbody>;
        },
        tr({ children }) {
          return <tr>{children}</tr>;
        },
        th({ children }) {
          return <th className="px-4 py-2 text-left text-sm font-semibold text-white">{children}</th>;
        },
        td({ children }) {
          return <td className="px-4 py-2 text-sm text-neutral-300">{children}</td>;
        },
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
