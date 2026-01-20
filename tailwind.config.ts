import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // Claude-inspired color palette
        claude: {
          // Primary brand colors
          primary: {
            50: "#e6f0ff",
            100: "#b3d1ff",
            200: "#80b1ff",
            300: "#4d91ff",
            400: "#1a71ff",
            500: "#0066ff", // Primary blue
            600: "#0052cc",
            700: "#003d99",
            800: "#002966",
            900: "#001433",
          },
          // Accent colors for different states
          accent: {
            purple: "#a78bfa",
            teal: "#5eead4",
            amber: "#fbbf24",
            rose: "#fb7185",
            emerald: "#34d399",
          },
          // Semantic colors
          success: {
            50: "#f0fdf4",
            100: "#dcfce7",
            200: "#bbf7d0",
            300: "#86efac",
            400: "#4ade80",
            500: "#22c55e",
            600: "#16a34a",
            700: "#15803d",
            800: "#166534",
            900: "#14532d",
          },
          warning: {
            50: "#fffbeb",
            100: "#fef3c7",
            200: "#fde68a",
            300: "#fcd34d",
            400: "#fbbf24",
            500: "#f59e0b",
            600: "#d97706",
            700: "#b45309",
            800: "#92400e",
            900: "#78350f",
          },
          error: {
            50: "#fef2f2",
            100: "#fee2e2",
            200: "#fecaca",
            300: "#fca5a5",
            400: "#f87171",
            500: "#ef4444",
            600: "#dc2626",
            700: "#b91c1c",
            800: "#991b1b",
            900: "#7f1d1d",
          },
          info: {
            50: "#eff6ff",
            100: "#dbeafe",
            200: "#bfdbfe",
            300: "#93c5fd",
            400: "#60a5fa",
            500: "#3b82f6",
            600: "#2563eb",
            700: "#1d4ed8",
            800: "#1e40af",
            900: "#1e3a8a",
          },
        },
        // Neutral palette for backgrounds and text
        neutral: {
          50: "#fafafa",
          100: "#f5f5f5",
          150: "#e5e5e5",
          200: "#e5e5e5",
          300: "#d4d4d4",
          400: "#a3a3a3",
          500: "#737373",
          600: "#525252",
          650: "#404040",
          700: "#404040",
          750: "#262626",
          800: "#262626",
          850: "#171717",
          900: "#171717",
          950: "#0a0a0a",
        },
        // Legacy CSS variable support
        background: "var(--background)",
        foreground: "var(--foreground)",
      },
      typography: ({ theme }: any) => ({
        DEFAULT: {
          css: {
            color: theme("colors.neutral.200"),
            maxWidth: "none",
            a: {
              color: theme("colors.claude.primary.400"),
              "&:hover": {
                color: theme("colors.claude.primary.300"),
              },
            },
            h1: {
              color: theme("colors.white"),
              fontWeight: "600",
              fontSize: "2rem",
              lineHeight: "1.2",
            },
            h2: {
              color: theme("colors.white"),
              fontWeight: "600",
              fontSize: "1.5rem",
              lineHeight: "1.3",
            },
            h3: {
              color: theme("colors.white"),
              fontWeight: "600",
              fontSize: "1.25rem",
              lineHeight: "1.4",
            },
            h4: {
              color: theme("colors.neutral.100"),
              fontWeight: "500",
            },
            "h5,h6": {
              color: theme("colors.neutral.200"),
              fontWeight: "500",
            },
            strong: {
              color: theme("colors.white"),
              fontWeight: "600",
            },
            code: {
              color: theme("colors.claude.accent.teal"),
              backgroundColor: theme("colors.neutral.800"),
              padding: "0.2em 0.4em",
              borderRadius: "0.25rem",
              fontSize: "0.875em",
            },
            "code::before": {
              content: '""',
            },
            "code::after": {
              content: '""',
            },
            pre: {
              backgroundColor: theme("colors.neutral.900"),
              color: theme("colors.neutral.100"),
              borderRadius: "0.5rem",
              padding: "1rem",
              overflow: "auto",
            },
            "pre code": {
              backgroundColor: "transparent",
              padding: "0",
              color: "inherit",
            },
            blockquote: {
              borderLeftColor: theme("colors.claude.primary.500"),
              fontStyle: "italic",
              color: theme("colors.neutral.400"),
            },
            hr: {
              borderColor: theme("colors.neutral.800"),
            },
            ul: {
              listStyleType: "disc",
              paddingLeft: "1.5rem",
            },
            ol: {
              listStyleType: "decimal",
              paddingLeft: "1.5rem",
            },
            li: {
              color: theme("colors.neutral.300"),
            },
            table: {
              width: "100%",
              borderCollapse: "collapse",
            },
            thead: {
              borderBottomColor: theme("colors.neutral.700"),
            },
            "th, td": {
              padding: "0.75rem",
              textAlign: "left",
            },
            th: {
              color: theme("colors.neutral.100"),
              fontWeight: "600",
            },
            td: {
              borderBottomColor: theme("colors.neutral.800"),
            },
          },
        },
      }),
      fontFamily: {
        sans: [
          "Inter",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "Oxygen",
          "Ubuntu",
          "Cantarell",
          "Open Sans",
          "Helvetica Neue",
          "sans-serif",
        ],
        mono: [
          "JetBrains Mono",
          "Menlo",
          "Monaco",
          "Lucide Console",
          "Liberation Mono",
          "Courier New",
          "monospace",
        ],
      },
      fontSize: {
        xs: ["0.75rem", { lineHeight: "1rem" }],
        sm: ["0.875rem", { lineHeight: "1.25rem" }],
        base: ["1rem", { lineHeight: "1.5rem" }],
        lg: ["1.125rem", { lineHeight: "1.75rem" }],
        xl: ["1.25rem", { lineHeight: "1.75rem" }],
        "2xl": ["1.5rem", { lineHeight: "2rem" }],
        "3xl": ["1.875rem", { lineHeight: "2.25rem" }],
        "4xl": ["2.25rem", { lineHeight: "2.5rem" }],
      },
      boxShadow: {
        "claude-sm": "0 1px 2px 0 rgba(0, 0, 0, 0.3)",
        "claude": "0 4px 6px -1px rgba(0, 0, 0, 0.3), 0 2px 4px -1px rgba(0, 0, 0, 0.15)",
        "claude-md": "0 10px 15px -3px rgba(0, 0, 0, 0.3), 0 4px 6px -2px rgba(0, 0, 0, 0.15)",
        "claude-lg": "0 20px 25px -5px rgba(0, 0, 0, 0.3), 0 10px 10px -5px rgba(0, 0, 0, 0.15)",
        "claude-xl": "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
        "claude-glow": "0 0 20px rgba(0, 102, 255, 0.3)",
        "claude-glow-lg": "0 0 40px rgba(0, 102, 255, 0.4)",
      },
      borderRadius: {
        "claude-sm": "0.375rem",
        "claude": "0.5rem",
        "claude-md": "0.625rem",
        "claude-lg": "0.75rem",
        "claude-xl": "1rem",
      },
      animation: {
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "shimmer": "shimmer 2s linear infinite",
        "fade-in": "fadeIn 0.2s ease-in-out",
        "slide-in": "slideIn 0.2s ease-out",
        "slide-out": "slideOut 0.2s ease-in",
        "toast-progress": "toastProgress linear forwards",
        "thinking-pulse": "thinkingPulse 1.5s ease-in-out infinite",
      },
      keyframes: {
        shimmer: {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(100%)" },
        },
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideIn: {
          "0%": { transform: "translateY(-10px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        slideOut: {
          "0%": { transform: "translateY(0)", opacity: "1" },
          "100%": { transform: "translateY(-10px)", opacity: "0" },
        },
        toastProgress: {
          "0%": { width: "100%" },
          "100%": { width: "0%" },
        },
        thinkingPulse: {
          "0%, 100%": { opacity: "0.4", transform: "scale(1)" },
          "50%": { opacity: "1", transform: "scale(1.2)" },
        },
      },
      backdropBlur: {
        claude: "12px",
      },
      zIndex: {
        claude: "1000",
        "claude-modal": "1100",
        "claude-toast": "1200",
      },
    },
  },
  plugins: [
    require("@tailwindcss/typography"),
  ],
};

export default config;
