import { defineConfig, devices } from "@playwright/test";
import path from "path";

/**
 * Playwright configuration for Tio Manolo Cowork
 *
 * This configuration supports both:
 * - Web E2E tests (Chromium)
 * - Electron app tests
 *
 * Environment variables:
 * - ELECTRON_PATH: Path to Electron executable (for Electron tests)
 * - TEST_PROJECT: Run specific project (e.g., 'chromium' or 'electron')
 */
export default defineConfig({
  // Global test timeout
  timeout: 30 * 1000,
  // Expect timeout for assertions
  expect: {
    timeout: 10 * 1000,
  },

  // Test directory configuration
  testDir: "./tests",
  // Test match patterns
  testMatch: [
    "**/*.spec.ts",
    "**/*.test.ts",
  ],
  // Ignore test files
  testIgnore: [
    "**/node_modules/**",
    "**/dist/**",
    "**/.next/**",
  ],

  // Fully parallel is disabled due to potential resource conflicts
  fullyParallel: false,
  // Fail the build on CI if you accidentally left test.only in the source code
  forbidOnly: !!process.env.CI,
  // Retry on CI only
  retries: process.env.CI ? 2 : 0,
  // Limit workers to 1 for stability
  workers: 1,

  // Reporter configuration
  reporter: [
    ["html", { outputFolder: "test-results/html-report" }],
    ["list"],
    ["json", { outputFile: "test-results/results.json" }],
  ],

  // Output directory for test artifacts
  outputDir: "test-results/artifacts",

  // Global setup and teardown
  globalSetup: path.join(__dirname, "tests/global-setup.ts"),
  globalTeardown: path.join(__dirname, "tests/global-teardown.ts"),

  use: {
    // Base URL for web tests
    baseURL: "http://localhost:3000",
    // Trace on retry for debugging
    trace: "on-first-retry",
    // Screenshot on failure
    screenshot: "only-on-failure",
    // Video on failure
    video: "retain-on-failure",
    // Action timeout
    actionTimeout: 15 * 1000,
    // Navigation timeout
    navigationTimeout: 30 * 1000,
  },

  // Projects configuration
  projects: [
    // Web E2E Tests - Chromium
    {
      name: "chromium",
      testDir: "./tests/e2e",
      testMatch: ["**/*.spec.ts"],
      use: {
        ...devices["Desktop Chrome"],
        contextOptions: {
          // Accept downloads
          acceptDownloads: true,
        },
      },
    },

    // Integration Tests - API and File Operations
    {
      name: "integration",
      testDir: "./tests/integration",
      testMatch: ["**/*.spec.ts"],
      use: {
        ...devices["Desktop Chrome"],
        // Integration tests use the API directly, don't need full browser context
      },
    },

    // Electron App Tests
    {
      name: "electron",
      testDir: "./tests/electron",
      testMatch: ["**/*.spec.ts"],
      use: {
        // Electron-specific test options
        launchOptions: {
          // Path to Electron executable (defaults to installed electron package)
          executablePath: process.env.ELECTRON_PATH,
        },
      },
      // Don't use webServer for Electron tests
      dependencies: [],
    },
  ],

  // Web server configuration (only for web tests)
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
    // Only start for web tests
    stdout: "pipe",
    stderr: "pipe",
  },
});
