import { FullConfig } from "@playwright/test";

/**
 * Global setup for Playwright tests
 *
 * This runs once before all tests.
 * Use this for:
 * - Starting required services
 * - Setting up test databases
 * - Generating test data
 */
async function globalSetup(config: FullConfig) {
  console.log("🔧 Setting up test environment...");

  // Log test configuration
  const projectNames = config.projects.map((p) => p.name).join(", ");
  console.log(`📋 Test projects: ${projectNames}`);
  console.log(`🌐 Base URL: ${config.use?.baseURL || "N/A"}`);
  console.log(`⏱️  Timeout: ${config.timeout}ms`);

  // Ensure test-results directories exist
  const fs = await import("fs/promises");
  const path = await import("path");

  const dirs = [
    "test-results",
    "test-results/artifacts",
    "test-results/screenshots",
    "test-results/html-report",
  ];

  for (const dir of dirs) {
    try {
      await fs.mkdir(dir, { recursive: true });
    } catch {
      // Directory might already exist, ignore error
    }
  }

  console.log("✅ Test environment ready");
}

export default globalSetup;
