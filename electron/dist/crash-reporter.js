"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.initializeCrashReporter = initializeCrashReporter;
exports.getLastCrashReport = getLastCrashReport;
exports.getAllCrashReports = getAllCrashReports;
exports.getCrashReporterInfo = getCrashReporterInfo;
exports.clearCrashReports = clearCrashReports;
exports.submitCrashReport = submitCrashReport;
exports.isCrashUploadEnabled = isCrashUploadEnabled;
const electron_1 = require("electron");
const path = __importStar(require("path"));
const os = __importStar(require("os"));
const DEFAULT_CONFIG = {
    companyName: "Tio Manolo Cowork",
    productName: "Tio Manolo Cowork",
    uploadToServer: false,
    compress: true,
};
let isInitialized = false;
let currentConfig = { ...DEFAULT_CONFIG };
/**
 * Get platform-specific crash dumps directory
 */
function getCrashDumpsDir() {
    const userDataPath = electron_1.app.getPath("userData");
    return path.join(userDataPath, "Crash Reports");
}
/**
 * Build extra metadata for crash reports
 */
function buildExtraMetadata(extra) {
    return {
        appVersion: electron_1.app.getVersion(),
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
function initializeCrashReporter(config = {}) {
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
        electron_1.crashReporter.start({
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
    }
    catch (error) {
        console.error("Failed to initialize crash reporter:", error);
        return false;
    }
}
/**
 * Get the last crash report
 *
 * @returns Path to the most recent crash dump file, or null if none exists
 */
function getLastCrashReport() {
    try {
        const crashesDir = getCrashDumpsDir();
        const fs = require("fs");
        if (!fs.existsSync(crashesDir)) {
            return null;
        }
        const files = fs.readdirSync(crashesDir);
        const crashFiles = files.filter((file) => file.endsWith(".dmp"));
        if (crashFiles.length === 0) {
            return null;
        }
        // Get the most recent crash file
        crashFiles.sort((a, b) => {
            const statA = fs.statSync(path.join(crashesDir, a));
            const statB = fs.statSync(path.join(crashesDir, b));
            return statB.mtime.getTime() - statA.mtime.getTime();
        });
        return path.join(crashesDir, crashFiles[0]);
    }
    catch (error) {
        console.error("Failed to get last crash report:", error);
        return null;
    }
}
/**
 * Get all crash reports
 *
 * @returns Array of crash report file paths
 */
function getAllCrashReports() {
    try {
        const crashesDir = getCrashDumpsDir();
        const fs = require("fs");
        if (!fs.existsSync(crashesDir)) {
            return [];
        }
        const files = fs.readdirSync(crashesDir);
        const crashFiles = files
            .filter((file) => file.endsWith(".dmp"))
            .map((file) => path.join(crashesDir, file))
            .sort((a, b) => {
            const statA = fs.statSync(a);
            const statB = fs.statSync(b);
            return statB.mtime.getTime() - statA.mtime.getTime();
        });
        return crashFiles;
    }
    catch (error) {
        console.error("Failed to get crash reports:", error);
        return [];
    }
}
/**
 * Get crash reporter info
 *
 * @returns Information about the crash reporter state
 */
function getCrashReporterInfo() {
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
function clearCrashReports() {
    try {
        const crashesDir = getCrashDumpsDir();
        const fs = require("fs");
        if (!fs.existsSync(crashesDir)) {
            return true;
        }
        const files = fs.readdirSync(crashesDir);
        const crashFiles = files.filter((file) => file.endsWith(".dmp"));
        for (const file of crashFiles) {
            fs.unlinkSync(path.join(crashesDir, file));
        }
        console.log(`Cleared ${crashFiles.length} crash report(s)`);
        return true;
    }
    catch (error) {
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
function submitCrashReport(crashPath, extra) {
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
    }
    catch (error) {
        console.error("Failed to submit crash report:", error);
        return false;
    }
}
/**
 * Get crash upload status
 *
 * @returns true if crash uploads are enabled
 */
function isCrashUploadEnabled() {
    return currentConfig.uploadToServer && !!currentConfig.submitURL;
}
