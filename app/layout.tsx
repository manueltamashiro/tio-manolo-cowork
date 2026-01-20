import type { Metadata } from "next";
import "./globals.css";
import { ChatProvider } from "@/lib/context/ChatContext";
import { FileTreeProvider } from "@/lib/context/FileTreeContext";
import { QueueProvider } from "@/lib/context/QueueContext";
import { ToastProvider, ToastHost } from "@/lib/context/ToastContext";
import { ProgressProvider } from "@/lib/context/ProgressContext";
import { NotificationProvider } from "@/lib/context/NotificationContext";
import { ThemeProvider } from "@/lib/context/ThemeContext";
import { LocaleProvider } from "@/lib/context/LocaleContext";
import { PerformanceProvider } from "@/lib/context/PerformanceContext";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";

export const metadata: Metadata = {
  title: "Tio Manolo Cowork",
  description: "AI-powered cowork workspace",
};

/**
 * Content Security Policy for the application.
 * Defines allowed sources for scripts, styles, images, fonts, and other resources.
 */
const CONTENT_SECURITY_POLICY = `
  default-src 'self';
  script-src 'self' 'unsafe-inline' 'unsafe-eval';
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: blob: https://*.anthropic.com;
  font-src 'self' data:;
  connect-src 'self' https://api.anthropic.com wss://api.anthropic.com;
  media-src 'self';
  object-src 'none';
  base-uri 'self';
  form-action 'self';
  frame-ancestors 'none';
  upgrade-insecure-requests;
`.replace(/\s{2,}/g, ' ').trim();

/**
 * Security headers middleware configuration.
 * These headers should be applied via Next.js middleware.
 * Note: CSP is managed via next.config.js for runtime application.
 */
// export function generateSecurityHeaders(): HeadersInit {
//   return {
//     'Content-Security-Policy': CONTENT_SECURITY_POLICY,
//     'X-Frame-Options': 'DENY',
//     'X-Content-Type-Options': 'nosniff',
//     'Referrer-Policy': 'strict-origin-when-cross-origin',
//     'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
//     'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
//     'Cross-Origin-Opener-Policy': 'same-origin',
//     'Cross-Origin-Resource-Policy': 'same-origin',
//   };
// }

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Theme script to prevent flash of unstyled content
  const themeScript = `
    (function() {
      function getPreference() {
        try {
          const stored = localStorage.getItem('tio_manolo_ui_state');
          if (stored) {
            const parsed = JSON.parse(stored);
            return parsed.theme || 'system';
          }
        } catch (e) {}
        return 'system';
      }

      function getSystemTheme() {
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      }

      function resolveTheme(theme) {
        return theme === 'system' ? getSystemTheme() : theme;
      }

      const theme = getPreference();
      const resolved = resolveTheme(theme);

      document.documentElement.classList.remove('light', 'dark');
      document.documentElement.classList.add(resolved);
    })();
  `;

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Script to prevent flash of unstyled content */}
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <meta name="theme-color" content="#0a0a0a" />
      </head>
      <body className="antialiased" suppressHydrationWarning>
        <ErrorBoundary>
          <LocaleProvider>
            <ThemeProvider>
              <ToastProvider>
                <QueueProvider maxConcurrent={3} maxHistory={50}>
                  <ProgressProvider>
                    <NotificationProvider>
                      <PerformanceProvider>
                        <ChatProvider>
                          <FileTreeProvider>{children}</FileTreeProvider>
                        </ChatProvider>
                      </PerformanceProvider>
                    </NotificationProvider>
                  </ProgressProvider>
                </QueueProvider>
                <ToastHost />
              </ToastProvider>
            </ThemeProvider>
          </LocaleProvider>
        </ErrorBoundary>

        {/* Skip links for keyboard users */}
        <a href="#main-content" className="skip-link">
          Skip to main content
        </a>
        <a href="#sidebar-content" className="skip-link" style={{ left: '180px' }}>
          Skip to sidebar
        </a>
      </body>
    </html>
  );
}
