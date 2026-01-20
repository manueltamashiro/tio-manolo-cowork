import { FullConfig } from "@playwright/test";

/**
 * Global teardown for Playwright tests
 *
 * This runs once after all tests complete.
 * Use this for:
 * - Stopping services
 * - Cleaning up test data
 * - Generating final reports
 */
async function globalTeardown(config: FullConfig) {
  console.log("🧹 Cleaning up test environment...");

  // Clean up any temporary files
  const fs = await import("fs/promises");
  const path = await import("path");

  const tempDir = path.join(process.cwd(), "test-results", "temp");
  try {
    await fs.rm(tempDir, { recursive: true, force: true });
  } catch {
    // Directory might not exist, ignore error
  }

  console.log("✅ Cleanup complete");
}

export default globalTeardown;
