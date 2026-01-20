"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  ZoomIn,
  ZoomOut,
  RotateCw,
  Download,
  X,
  Maximize2,
} from "lucide-react";

export interface ImagePreviewData {
  /** Image source - can be base64 data URL or regular URL */
  src: string;
  /** File name of the image */
  fileName?: string;
  /** Optional file path for the image */
  filePath?: string;
  /** Media type (e.g., "image/png") */
  mediaType?: string;
  /** Original dimensions of the image (if available) */
  width?: number;
  height?: number;
}

export interface ImagePreviewModalProps {
  /** Whether the modal is open */
  isOpen: boolean;
  /** Image data to preview */
  imageData: ImagePreviewData | null;
  /** Called when user closes the modal */
  onClose: () => void;
}

const ZOOM_STEP = 0.25;
const MIN_ZOOM = 0.25;
const MAX_ZOOM = 5;

export function ImagePreviewModal({
  isOpen,
  imageData,
  onClose,
}: ImagePreviewModalProps) {
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [imageDimensions, setImageDimensions] = useState<{
    width: number;
    height: number;
  } | null>(null);

  const imageRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragStartPos = useRef({ x: 0, y: 0 });

  const handleZoomIn = useCallback(() => {
    setZoom((prev) => Math.min(prev + ZOOM_STEP, MAX_ZOOM));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoom((prev) => Math.max(prev - ZOOM_STEP, MIN_ZOOM));
  }, []);

  const handleReset = useCallback(() => {
    setZoom(1);
    setRotation(0);
    setPosition({ x: 0, y: 0 });
  }, []);

  const handleRotate = useCallback(() => {
    setRotation((prev) => (prev + 90) % 360);
  }, []);

  // Reset state when image changes or modal opens
  useEffect(() => {
    if (isOpen && imageData) {
      setZoom(1);
      setRotation(0);
      setPosition({ x: 0, y: 0 });
      setIsLoading(true);
      setImageDimensions(null);
    }
  }, [isOpen, imageData]);

  // Handle keyboard shortcuts
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case "Escape":
          e.preventDefault();
          onClose();
          break;
        case "+":
        case "=":
          e.preventDefault();
          handleZoomIn();
          break;
        case "-":
        case "_":
          e.preventDefault();
          handleZoomOut();
          break;
        case "0":
          e.preventDefault();
          handleReset();
          break;
        case "r":
        case "R":
          e.preventDefault();
          handleRotate();
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose, handleZoomIn, handleZoomOut, handleReset, handleRotate]);

  const handleDownload = useCallback(() => {
    if (!imageData?.src) return;

    const link = document.createElement("a");
    link.href = imageData.src;
    link.download = imageData.fileName || "image.png";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [imageData]);

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) return;
      e.preventDefault();

      const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
      setZoom((prev) =>
        Math.min(Math.max(prev + delta, MIN_ZOOM), MAX_ZOOM)
      );
    },
    []
  );

  // Mouse drag handlers for panning
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return; // Only left mouse button
    setIsDragging(true);
    dragStartPos.current = { x: e.clientX - position.x, y: e.clientY - position.y };
    setDragStart({ x: e.clientX, y: e.clientY });
  }, [position]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging) return;
    const newX = e.clientX - dragStartPos.current.x;
    const newY = e.clientY - dragStartPos.current.y;
    setPosition({ x: newX, y: newY });
  }, [isDragging]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleImageLoad = useCallback(() => {
    setIsLoading(false);
    if (imageRef.current) {
      setImageDimensions({
        width: imageRef.current.naturalWidth,
        height: imageRef.current.naturalHeight,
      });
    }
  }, []);

  const handleImageError = useCallback(() => {
    setIsLoading(false);
  }, []);

  if (!isOpen || !imageData) return null;

  const imageSrc = imageData.src;
  const fileName = imageData.fileName || "image";

  // Calculate transform style
  const transformStyle = `translate(${position.x}px, ${position.y}px) scale(${zoom}) rotate(${rotation}deg)`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90"
      role="dialog"
      aria-modal="true"
      aria-labelledby="image-preview-title"
      onClick={onClose}
    >
      {/* Modal content - stop propagation to prevent closing when clicking on content */}
      <div
        className="relative w-full h-full flex flex-col"
        onClick={(e) => e.stopPropagation()}
        onWheel={handleWheel}
      >
        {/* Header / Toolbar */}
        <div className="flex items-center justify-between px-4 py-3 bg-neutral-900/90 border-b border-neutral-700">
          <div className="flex items-center gap-3">
            <h2
              id="image-preview-title"
              className="text-sm font-medium text-white truncate max-w-[200px] sm:max-w-md"
            >
              {fileName}
            </h2>
            {imageDimensions && (
              <span className="text-xs text-neutral-400 hidden sm:inline">
                {imageDimensions.width} × {imageDimensions.height}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1 sm:gap-2">
            {/* Zoom controls */}
            <button
              type="button"
              onClick={handleZoomOut}
              disabled={zoom <= MIN_ZOOM}
              className="p-2 text-neutral-300 hover:text-white hover:bg-neutral-700 rounded disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              aria-label="Zoom out"
              title="Zoom out (-)"
            >
              <ZoomOut size={18} />
            </button>

            <span className="text-sm text-neutral-300 min-w-[3rem] text-center">
              {Math.round(zoom * 100)}%
            </span>

            <button
              type="button"
              onClick={handleZoomIn}
              disabled={zoom >= MAX_ZOOM}
              className="p-2 text-neutral-300 hover:text-white hover:bg-neutral-700 rounded disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              aria-label="Zoom in"
              title="Zoom in (+)"
            >
              <ZoomIn size={18} />
            </button>

            {/* Rotate button */}
            <button
              type="button"
              onClick={handleRotate}
              className="p-2 text-neutral-300 hover:text-white hover:bg-neutral-700 rounded transition-colors hidden sm:block"
              aria-label="Rotate image"
              title="Rotate (R)"
            >
              <RotateCw size={18} />
            </button>

            {/* Download button */}
            <button
              type="button"
              onClick={handleDownload}
              className="p-2 text-neutral-300 hover:text-white hover:bg-neutral-700 rounded transition-colors"
              aria-label="Download image"
              title="Download"
            >
              <Download size={18} />
            </button>

            {/* Reset button */}
            <button
              type="button"
              onClick={handleReset}
              className="p-2 text-neutral-300 hover:text-white hover:bg-neutral-700 rounded transition-colors"
              aria-label="Reset zoom and rotation"
              title="Reset (0)"
            >
              <Maximize2 size={18} />
            </button>

            {/* Close button */}
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-neutral-300 hover:text-white hover:bg-neutral-700 rounded transition-colors"
              aria-label="Close"
              title="Close (Esc)"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Image display area */}
        <div
          ref={containerRef}
          className="flex-1 flex items-center justify-center overflow-hidden cursor-grab active:cursor-grabbing"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          style={{ cursor: isDragging ? "grabbing" : "grab" }}
        >
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="flex flex-col items-center gap-3">
                <svg
                  className="animate-spin h-8 w-8 text-neutral-400"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                <span className="text-sm text-neutral-400">Loading image...</span>
              </div>
            </div>
          )}

          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={imageRef}
            src={imageSrc}
            alt={fileName}
            className="max-w-[90%] max-h-[90%] object-contain transition-transform duration-100 ease-out"
            style={{
              transform: transformStyle,
              cursor: isDragging ? "grabbing" : "grab",
            }}
            onLoad={handleImageLoad}
            onError={handleImageError}
            draggable={false}
          />

          {/* Zoom hint */}
          {zoom === 1 && rotation === 0 && !isLoading && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 bg-neutral-800/80 rounded-full text-xs text-neutral-300 pointer-events-none">
              Scroll to zoom • Drag to pan • R to rotate
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
