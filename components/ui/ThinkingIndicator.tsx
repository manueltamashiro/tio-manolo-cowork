'use client';

/**
 * ThinkingIndicator - A subtle animated indicator showing when Claude is processing
 * Features a pulsing dot with a glow effect, similar to Claude Desktop
 */

interface ThinkingIndicatorProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeStyles = {
  sm: {
    dot: 'w-1.5 h-1.5',
    glow: 'w-3 h-3',
  },
  md: {
    dot: 'w-2 h-2',
    glow: 'w-4 h-4',
  },
  lg: {
    dot: 'w-2.5 h-2.5',
    glow: 'w-5 h-5',
  },
};

export function ThinkingIndicator({ size = 'md', className = '' }: ThinkingIndicatorProps) {
  const { dot, glow } = sizeStyles[size];

  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      {/* Main pulsing dot */}
      <div className="relative flex items-center justify-center">
        {/* Outer glow ring */}
        <div className={`${glow} rounded-full bg-blue-500/20 absolute animate-thinking-pulse`} />
        {/* Inner solid dot */}
        <div className={`${dot} rounded-full bg-blue-500 animate-thinking-pulse relative z-10`} />
      </div>
      {/* Optional text label for accessibility */}
      <span className="sr-only">Claude is thinking</span>
    </div>
  );
}

/**
 * InlineThinkingIndicator - A compact version for use in message bubbles
 * Shows a smaller indicator without additional spacing
 */
interface InlineThinkingIndicatorProps {
  className?: string;
}

export function InlineThinkingIndicator({ className = '' }: InlineThinkingIndicatorProps) {
  return (
    <div className={`flex items-center gap-1 ${className}`}>
      <div className="relative flex items-center justify-center">
        <div className="w-2 h-2 rounded-full bg-blue-500/20 absolute animate-thinking-pulse" />
        <div className="w-1 h-1 rounded-full bg-blue-500 animate-thinking-pulse relative z-10" />
      </div>
      <span className="text-xs text-neutral-400">Thinking</span>
    </div>
  );
}
