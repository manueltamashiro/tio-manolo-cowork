"use client";

import { useEffect, useRef } from "react";
import type { FileSystemEntry } from "@/types/files";

export interface ContextMenuItem {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  variant?: "normal" | "danger";
  disabled?: boolean;
}

export interface ContextMenuProps {
  x: number;
  y: number;
  entry: FileSystemEntry;
  onClose: () => void;
  items: ContextMenuItem[];
}

/**
 * ContextMenu - A right-click context menu component
 *
 * Displays a menu at the specified coordinates with the provided items.
 * Handles click-outside to close and keyboard navigation.
 */
export function ContextMenu({ x, y, entry, onClose, items }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const firstItemRef = useRef<HTMLButtonElement>(null);

  // Position menu within viewport bounds
  const getPosition = () => {
    const menuWidth = 200; // Approximate width
    const menuHeight = items.length * 40; // Approximate height
    const padding = 8;

    let adjustedX = x;
    let adjustedY = y;

    if (typeof window !== "undefined") {
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      // Adjust horizontal position if menu would overflow right edge
      if (x + menuWidth > viewportWidth - padding) {
        adjustedX = viewportWidth - menuWidth - padding;
      }

      // Adjust vertical position if menu would overflow bottom edge
      if (y + menuHeight > viewportHeight - padding) {
        adjustedY = viewportHeight - menuHeight - padding;
      }

      // Ensure menu doesn't go off the top or left edge
      adjustedX = Math.max(padding, adjustedX);
      adjustedY = Math.max(padding, adjustedY);
    }

    return { x: adjustedX, y: adjustedY };
  };

  const position = getPosition();

  // Handle click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleScroll = () => {
      onClose();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("scroll", handleScroll, true);
    window.addEventListener("keydown", handleKeyDown);

    // Focus first item when menu opens
    firstItemRef.current?.focus();

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("scroll", handleScroll, true);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  // Handle keyboard navigation within menu
  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    const itemsArray = Array.from(
      menuRef.current?.querySelectorAll('button:not([disabled])') || []
    );

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        const nextIndex = (index + 1) % itemsArray.length;
        (itemsArray[nextIndex] as HTMLElement)?.focus();
        break;
      case "ArrowUp":
        e.preventDefault();
        const prevIndex = (index - 1 + itemsArray.length) % itemsArray.length;
        (itemsArray[prevIndex] as HTMLElement)?.focus();
        break;
      case "Home":
        e.preventDefault();
        (itemsArray[0] as HTMLElement)?.focus();
        break;
      case "End":
        e.preventDefault();
        (itemsArray[itemsArray.length - 1] as HTMLElement)?.focus();
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        (e.currentTarget as HTMLButtonElement).click();
        break;
    }
  };

  return (
    <div
      className="fixed z-[100] min-w-[180px] max-w-[240px] bg-neutral-800 rounded-lg shadow-xl border border-neutral-700 py-1"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
      }}
      ref={menuRef}
      role="menu"
      aria-label={`Context menu for ${entry.name}`}
      tabIndex={-1}
    >
      {items.map((item, index) => (
        <button
          key={`${item.label}-${index}`}
          ref={index === 0 ? firstItemRef : null}
          type="button"
          onClick={() => {
            item.onClick();
            onClose();
          }}
          onKeyDown={(e) => handleKeyDown(e, index)}
          disabled={item.disabled}
          className={`
            w-full px-3 py-2 text-sm text-left flex items-center gap-2 transition-colors
            ${item.disabled
              ? 'text-neutral-600 cursor-not-allowed'
              : item.variant === 'danger'
                ? 'text-red-400 hover:bg-red-900/30'
                : 'text-neutral-300 hover:bg-neutral-700'
            }
            focus:outline-none focus:bg-neutral-700
            ${item.variant === 'danger' ? 'focus:bg-red-900/30' : ''}
          `}
          role="menuitem"
        >
          <span className="w-4 h-4 flex-shrink-0" aria-hidden="true">
            {item.icon}
          </span>
          <span className="truncate">{item.label}</span>
        </button>
      ))}
    </div>
  );
}
