import { crashReporter, app } from "electron";
import * as path from "path";
import * as os from "os";

/**
 * Crash Reporter Module
 *
 * Provides automatic crash reporting using Electron's crashReporter.
 * Collects error logs and provides options to submit reports.
 */

interface CrashReporterConfig {
  /** Company name for crash reports */
  companyName: string;
  /** Product name for crash reports */
  productName: string;
  /** URL to submit crash reports to (optional - will store locally if not provided) */
  submitURL?: string;
  /** Whether to upload crash reports to server */
  uploadToServer: boolean;
  /** Whether to compress crash reports */
  compress: boolean;
  /** Additional metadata to include with crash reports */
  extra?: Record<string, string>;
}

interface CrashReportInfo {
  /** Path to the crash dump file */
  crashPath: string | null;
  /** Whether crash reporter is initialized */
  isInitialized: boolean;
  /** Current configuration */
  config: Partial<CrashReporterConfig>;
}

const DEFAULT_CONFIG: CrashReporterConfig = {
  companyName: "Tio Manolo Cowork",
  productName: "Tio Manolo Cowork",
  uploadToServer: false,
  compress: true,
};

let isInitialized = false;
let currentConfig: CrashReporterConfig = { ...DEFAULT_CONFIG };

/**
 * Get platform-specific crash dumps directory
 */
function getCrashDumpsDir(): string {
  const userDataPath = app.getPath("userData");
  return path.join(userDataPath, "Crash Reports");
}

/**
 * Build extra metadata for crash reports
 */
function buildExtraMetadata(extra?: Record<string, string>): Record<string, string> {
  return {
    appVersion: app.getVersion(),
    electronVersion: process.versions.electron,
    chromeVersion: process.versions.chrome,
    nodeVersion: process.versions.node,
    platform: process.platform,
    arch: process.arch,
    osVersion: os.release(),
    osType: os.type(),
    ...extra,
  };
}

/**
 * Initialize the crash reporter
 *
 * @param config - Configuration options for crash reporter
 * @returns true if initialization was successful
 */
export function initializeCrashReporter(config: Partial<CrashReporterConfig> = {}): boolean {
  if (isInitialized) {
    console.warn("Crash reporter is already initialized");
    return true;
  }

  try {
    // Merge provided config with defaults
    currentConfig = { ...DEFAULT_CONFIG, ...config };

    // Build extra metadata
    const extra = buildExtraMetadata(currentConfig.extra);

    // Start crash reporter
    crashReporter.start({
      companyName: currentConfig.companyName,
      submitURL: currentConfig.submitURL || "http://0.0.0.0/placeholder", // Required by Electron but not used if uploadToServer is false
      productName: currentConfig.productName,
      uploadToServer: currentConfig.uploadToServer,
      compress: currentConfig.compress,
      extra,
    });

    isInitialized = true;
    console.log("Crash reporter initialized successfully");

    // Log crash dumps directory
    const crashDumpsDir = getCrashDumpsDir();
    console.log(`Crash reports will be saved to: ${crashDumpsDir}`);

    return true;
  } catch (error) {
    console.error("Failed to initialize crash reporter:", error);
    return false;
  }
}

/**
 * Get the last crash report
 *
 * @returns Path to the most recent crash dump file, or null if none exists
 */
export function getLastCrashReport(): string | null {
  try {
    const crashesDir = getCrashDumpsDir();
    const fs = require("fs");

    if (!fs.existsSync(crashesDir)) {
      return null;
    }

    const files = fs.readdirSync(crashesDir);
    const crashFiles = files.filter((file: string) => file.endsWith(".dmp"));

    if (crashFiles.length === 0) {
      return null;
    }

    // Get the most recent crash file
    crashFiles.sort((a: string, b: string) => {
      const statA = fs.statSync(path.join(crashesDir, a));
      const statB = fs.statSync(path.join(crashesDir, b));
      return statB.mtime.getTime() - statA.mtime.getTime();
    });

    return path.join(crashesDir, crashFiles[0]);
  } catch (error) {
    console.error("Failed to get last crash report:", error);
    return null;
  }
}

/**
 * Get all crash reports
 *
 * @returns Array of crash report file paths
 */
export function getAllCrashReports(): string[] {
  try {
    const crashesDir = getCrashDumpsDir();
    const fs = require("fs");

    if (!fs.existsSync(crashesDir)) {
      return [];
    }

    const files = fs.readdirSync(crashesDir);
    const crashFiles = files
      .filter((file: string) => file.endsWith(".dmp"))
      .map((file: string) => path.join(crashesDir, file))
      .sort((a: string, b: string) => {
        const statA = fs.statSync(a);
        const statB = fs.statSync(b);
        return statB.mtime.getTime() - statA.mtime.getTime();
      });

    return crashFiles;
  } catch (error) {
    console.error("Failed to get crash reports:", error);
    return [];
  }
}

/**
 * Get crash reporter info
 *
 * @returns Information about the crash reporter state
 */
export function getCrashReporterInfo(): CrashReportInfo {
  return {
    crashPath: getLastCrashReport(),
    isInitialized,
    config: {
      companyName: currentConfig.companyName,
      productName: currentConfig.productName,
      uploadToServer: currentConfig.uploadToServer,
      compress: currentConfig.compress,
    },
  };
}

/**
 * Clear all crash reports
 *
 * @returns true if successful
 */
export function clearCrashReports(): boolean {
  try {
    const crashesDir = getCrashDumpsDir();
    const fs = require("fs");

    if (!fs.existsSync(crashesDir)) {
      return true;
    }

    const files = fs.readdirSync(crashesDir);
    const crashFiles = files.filter((file: string) => file.endsWith(".dmp"));

    for (const file of crashFiles) {
      fs.unlinkSync(path.join(crashesDir, file));
    }

    console.log(`Cleared ${crashFiles.length} crash report(s)`);
    return true;
  } catch (error) {
    console.error("Failed to clear crash reports:", error);
    return false;
  }
}

/**
 * Manually submit a crash report
 *
 * @param crashPath - Path to the crash dump file
 * @param extra - Additional metadata to include
 * @returns true if submission was initiated
 */
export function submitCrashReport(crashPath: string, extra?: Record<string, string>): boolean {
  if (!currentConfig.submitURL) {
    console.warn("No submit URL configured, crash reports are stored locally only");
    return false;
  }

  try {
    // Electron's crashReporter handles submission automatically when uploadToServer is true
    // For manual submission, we would need to implement a custom upload handler
    console.log(`Manual crash report submission requested for: ${crashPath}`, extra ? `with extra data: ${JSON.stringify(extra)}` : "");
    // TODO: Implement custom upload handler for manual submission
    return true;
  } catch (error) {
    console.error("Failed to submit crash report:", error);
    return false;
  }
}

/**
 * Get crash upload status
 *
 * @returns true if crash uploads are enabled
 */
export function isCrashUploadEnabled(): boolean {
  return currentConfig.uploadToServer && !!currentConfig.submitURL;
}
