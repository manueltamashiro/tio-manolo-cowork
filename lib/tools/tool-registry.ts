/**
 * Tool Registry - Manages all available tools and their execution
 */

import type {
  RegisteredTool,
  Tool,
  ToolExecutionContext,
  ToolExecutionResult,
} from "@/types/tools";
import {
  readFileSync,
  existsSync,
  rmSync,
  statSync,
} from "fs";
import { resolve } from "path";
import { execSync } from "child_process";
import { validatePath } from "@/lib/fs/directory";
import { listDirectory } from "@/lib/fs/directory";
import { writeFile } from "@/lib/fs/write";
import { createFile } from "@/lib/fs/file-operations";

/**
 * File operation tools
 */

/**
 * Read file tool - reads the content of a file
 */
async function executeReadFile(
  input: Record<string, unknown>,
  context: ToolExecutionContext
): Promise<ToolExecutionResult> {
  try {
    const { filePath } = input as { filePath: string };

    if (!filePath || typeof filePath !== "string") {
      return {
        success: false,
        error: "filePath is required and must be a string",
      };
    }

    // Resolve and validate path
    const resolvedPath = resolve(filePath);

    // Security check for path traversal if workspace is set
    if (context.workspacePath) {
      try {
        validatePath(context.workspacePath, resolvedPath);
      } catch {
        return {
          success: false,
          error: `Access denied: path traversal detected`,
        };
      }
    }

    // Check file exists
    if (!existsSync(resolvedPath)) {
      return {
        success: false,
        error: `File not found: ${filePath}`,
      };
    }

    // Check if it's a file (not a directory)
    const stats = statSync(resolvedPath);
    if (!stats.isFile()) {
      return {
        success: false,
        error: `Path is not a file: ${filePath}`,
      };
    }

    // Check file size (limit to 10MB)
    const MAX_FILE_SIZE = 10 * 1024 * 1024;
    if (stats.size > MAX_FILE_SIZE) {
      return {
        success: false,
        error: `File too large: ${stats.size} bytes (max ${MAX_FILE_SIZE} bytes)`,
      };
    }

    // Check if binary file
    const ext = resolvedPath.split(".").pop()?.toLowerCase();
    const BINARY_EXTENSIONS = [
      "exe",
      "dll",
      "so",
      "dylib",
      "bin",
      "dat",
      "zip",
      "tar",
      "gz",
      "7z",
      "rar",
      "pdf",
      "png",
      "jpg",
      "jpeg",
      "gif",
      "bmp",
      "ico",
      "mp3",
      "mp4",
      "wav",
      "avi",
      "mov",
      "woff",
      "woff2",
      "ttf",
      "eot",
    ];
    if (ext && BINARY_EXTENSIONS.includes(ext)) {
      return {
        success: false,
        error: `Cannot read binary file: ${filePath}`,
      };
    }

    // Read file content
    const content = readFileSync(resolvedPath, "utf-8");

    return {
      success: true,
      content: `File: ${filePath}\n\`\`\`\n${content}\n\`\`\``,
      metadata: {
        toolName: "read_file",
        duration: 0,
        fileSize: stats.size,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Write file tool - writes content to a file
 */
async function executeWriteFile(
  input: Record<string, unknown>,
  context: ToolExecutionContext
): Promise<ToolExecutionResult> {
  try {
    const { filePath, content } = input as {
      filePath: string;
      content: string;
    };

    if (!filePath || typeof filePath !== "string") {
      return {
        success: false,
        error: "filePath is required and must be a string",
      };
    }

    if (content === undefined || content === null) {
      return {
        success: false,
        error: "content is required",
      };
    }

    const contentStr = String(content);

    // Resolve and validate path
    const resolvedPath = resolve(filePath);

    // Security check for path traversal if workspace is set
    if (context.workspacePath) {
      try {
        validatePath(context.workspacePath, resolvedPath);
      } catch {
        return {
          success: false,
          error: `Access denied: path traversal detected`,
        };
      }
    }

    // Write file with backup
    const result = writeFile(resolvedPath, {
      content: contentStr,
      createBackup: true,
    });

    return {
      success: true,
      content: `File ${result.action}: ${result.fileName}\nPath: ${result.filePath}\nSize: ${result.size} bytes${
        result.backup ? `\nBackup created: ${result.backup.backupPath}` : ""
      }`,
      metadata: {
        toolName: "write_file",
        action: result.action,
        filePath: result.filePath,
        fileSize: result.size,
        backupPath: result.backup?.backupPath,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Create file tool - creates a new file in a directory
 */
async function executeCreateFile(
  input: Record<string, unknown>,
  context: ToolExecutionContext
): Promise<ToolExecutionResult> {
  try {
    const { directoryPath, fileName, content } = input as {
      directoryPath: string;
      fileName: string;
      content?: string;
    };

    if (!directoryPath || typeof directoryPath !== "string") {
      return {
        success: false,
        error: "directoryPath is required and must be a string",
      };
    }

    if (!fileName || typeof fileName !== "string") {
      return {
        success: false,
        error: "fileName is required and must be a string",
      };
    }

    const contentStr = content !== undefined ? String(content) : "";

    // Resolve and validate path
    const resolvedPath = resolve(directoryPath);

    // Security check for path traversal if workspace is set
    if (context.workspacePath) {
      try {
        validatePath(context.workspacePath, resolvedPath);
      } catch {
        return {
          success: false,
          error: `Access denied: path traversal detected`,
        };
      }
    }

    // Check directory exists
    if (!existsSync(resolvedPath)) {
      return {
        success: false,
        error: `Directory not found: ${directoryPath}`,
      };
    }

    // Create file
    const result = createFile(resolvedPath, fileName, {
      content: contentStr,
      onConflict: "error",
    });

    return {
      success: true,
      content: `File ${result.action}: ${result.fileName}\nPath: ${result.filePath}\nSize: ${result.size} bytes`,
      metadata: {
        toolName: "create_file",
        action: result.action,
        filePath: result.filePath,
        fileName: result.fileName,
        fileSize: result.size,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Delete file tool - deletes a file
 */
async function executeDeleteFile(
  input: Record<string, unknown>,
  context: ToolExecutionContext
): Promise<ToolExecutionResult> {
  try {
    const { filePath } = input as { filePath: string };

    if (!filePath || typeof filePath !== "string") {
      return {
        success: false,
        error: "filePath is required and must be a string",
      };
    }

    // Resolve and validate path
    const resolvedPath = resolve(filePath);

    // Security check for path traversal if workspace is set
    if (context.workspacePath) {
      try {
        validatePath(context.workspacePath, resolvedPath);
      } catch {
        return {
          success: false,
          error: `Access denied: path traversal detected`,
        };
      }
    }

    // Check file exists
    if (!existsSync(resolvedPath)) {
      return {
        success: false,
        error: `File not found: ${filePath}`,
      };
    }

    // Check if it's a file (not a directory)
    const stats = statSync(resolvedPath);
    if (!stats.isFile()) {
      return {
        success: false,
        error: `Path is not a file: ${filePath}`,
      };
    }

    // Delete file
    rmSync(resolvedPath);

    return {
      success: true,
      content: `File deleted: ${filePath}`,
      metadata: {
        toolName: "delete_file",
        filePath: resolvedPath,
        fileSize: stats.size,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * List directory tool - lists contents of a directory
 */
async function executeListDirectory(
  input: Record<string, unknown>,
  context: ToolExecutionContext
): Promise<ToolExecutionResult> {
  try {
    const {
      directoryPath,
      recursive = false,
      includeHidden = false,
    } = input as {
      directoryPath: string;
      recursive?: boolean;
      includeHidden?: boolean;
    };

    if (!directoryPath || typeof directoryPath !== "string") {
      return {
        success: false,
        error: "directoryPath is required and must be a string",
      };
    }

    // Resolve and validate path
    const resolvedPath = resolve(directoryPath);

    // Security check for path traversal if workspace is set
    if (context.workspacePath) {
      try {
        validatePath(context.workspacePath, resolvedPath);
      } catch {
        return {
          success: false,
          error: `Access denied: path traversal detected`,
        };
      }
    }

    // List directory
    const result = getDirectoryListing(resolvedPath, {
      recursive,
      includeHidden,
      fileTypes: ["file", "directory"],
    });

    // Format output
    const formatEntries = (
      entries: typeof result.entries,
      indent = 0
    ): string => {
      const lines: string[] = [];
      for (const entry of entries) {
        const prefix = "  ".repeat(indent);
        const icon = entry.type === "directory" ? "/" : "";
        const size = entry.size ? ` (${entry.size} bytes)` : "";
        lines.push(`${prefix}${entry.name}${icon}${size}`);
        if (entry.children) {
          lines.push(formatEntries(entry.children, indent + 1));
        }
      }
      return lines.join("\n");
    };

    return {
      success: true,
      content: `Directory: ${resolvedPath}\nTotal entries: ${result.totalCount}\n\n${formatEntries(result.entries)}`,
      metadata: {
        toolName: "list_directory",
        path: result.path,
        totalCount: result.totalCount,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// Commands that are never allowed regardless of context
const BLOCKED_COMMANDS = [
  /rm\s+-rf\s+\//,
  /mkfs/,
  /dd\s+if=/,
  /chmod\s+777\s+\//,
  /curl.*\|\s*(bash|sh)/,
  /wget.*\|\s*(bash|sh)/,
];

/**
 * Bash tool - runs a shell command and returns stdout/stderr
 */
async function executeBash(
  input: Record<string, unknown>,
  context: ToolExecutionContext
): Promise<ToolExecutionResult> {
  const { command, workingDirectory, timeout = 30000 } = input as {
    command: string;
    workingDirectory?: string;
    timeout?: number;
  };

  if (!command || typeof command !== "string") {
    return { success: false, error: "command is required and must be a string" };
  }

  // Block destructive patterns
  for (const pattern of BLOCKED_COMMANDS) {
    if (pattern.test(command)) {
      return { success: false, error: `Command blocked for safety: ${command}` };
    }
  }

  // Resolve and validate working directory
  let cwd: string | undefined;
  if (workingDirectory) {
    cwd = resolve(workingDirectory);
    if (context.workspacePath) {
      try {
        validatePath(context.workspacePath, cwd);
      } catch {
        return { success: false, error: "Access denied: working directory outside workspace" };
      }
    }
  } else if (context.workspacePath) {
    cwd = context.workspacePath;
  }

  const timeoutMs = Math.min(Number(timeout) || 30000, 120000);

  try {
    const output = execSync(command, {
      cwd,
      timeout: timeoutMs,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    });

    return {
      success: true,
      content: output || "(no output)",
      metadata: { toolName: "bash", command },
    };
  } catch (error: any) {
    const stderr = error.stderr ? String(error.stderr) : "";
    const stdout = error.stdout ? String(error.stdout) : "";
    const combined = [stdout, stderr].filter(Boolean).join("\n") || error.message;
    return { success: false, error: combined };
  }
}

/**
 * Tool definitions registry
 */
export const toolRegistry: RegisteredTool[] = [
  {
    name: "read_file",
    description:
      "Read the content of a file. Returns the file content with syntax information. Use this to examine existing files before making changes.",
    input_schema: {
      type: "object",
      properties: {
        filePath: {
          type: "string",
          description:
            "Path to the file to read. Can be absolute or relative to the workspace.",
        },
      },
      required: ["filePath"],
    },
    executor: executeReadFile,
  },
  {
    name: "write_file",
    description:
      "Write content to a file. Creates a backup before overwriting existing files. Use this to modify files after reading them.",
    input_schema: {
      type: "object",
      properties: {
        filePath: {
          type: "string",
          description:
            "Path to the file to write. Can be absolute or relative to the workspace.",
        },
        content: {
          type: "string",
          description: "Content to write to the file.",
        },
      },
      required: ["filePath", "content"],
    },
    executor: executeWriteFile,
  },
  {
    name: "create_file",
    description:
      "Create a new file in a directory. Fails if the file already exists. Use this to create new files.",
    input_schema: {
      type: "object",
      properties: {
        directoryPath: {
          type: "string",
          description:
            "Directory where the file should be created. Can be absolute or relative to the workspace.",
        },
        fileName: {
          type: "string",
          description: "Name of the file to create.",
        },
        content: {
          type: "string",
          description: "Content to write to the file. Defaults to empty string.",
        },
      },
      required: ["directoryPath", "fileName"],
    },
    executor: executeCreateFile,
  },
  {
    name: "delete_file",
    description:
      "Delete a file. Permanently removes the file from the filesystem. Use with caution.",
    input_schema: {
      type: "object",
      properties: {
        filePath: {
          type: "string",
          description:
            "Path to the file to delete. Can be absolute or relative to the workspace.",
        },
      },
      required: ["filePath"],
    },
    executor: executeDeleteFile,
  },
  {
    name: "list_directory",
    description:
      "List the contents of a directory. Shows files and subdirectories with their sizes.",
    input_schema: {
      type: "object",
      properties: {
        directoryPath: {
          type: "string",
          description:
            "Path to the directory to list. Can be absolute or relative to the workspace.",
        },
        recursive: {
          type: "boolean",
          description:
            "Whether to list recursively (include subdirectories). Defaults to false.",
        },
        includeHidden: {
          type: "boolean",
          description:
            "Whether to include hidden files (starting with .). Defaults to false.",
        },
      },
      required: ["directoryPath"],
    },
    executor: executeListDirectory,
  },
  {
    name: "bash",
    description:
      "Execute a shell command and return its output. Use for running tests, build scripts, git operations, or any shell task. Commands run inside the workspace directory by default.",
    input_schema: {
      type: "object",
      properties: {
        command: {
          type: "string",
          description: "The shell command to execute.",
        },
        workingDirectory: {
          type: "string",
          description:
            "Directory to run the command in. Defaults to the workspace root.",
        },
        timeout: {
          type: "number",
          description:
            "Timeout in milliseconds (max 120000). Defaults to 30000.",
        },
      },
      required: ["command"],
    },
    executor: executeBash,
  },
];

/**
 * Get tool definitions for Claude API (without executors)
 */
export function getToolDefinitions(): Tool[] {
  return toolRegistry.map((tool) => ({
    name: tool.name,
    description: tool.description,
    input_schema: tool.input_schema,
  }));
}

/**
 * Execute a tool by name
 */
export async function executeTool(
  toolName: string,
  input: Record<string, unknown>,
  context: ToolExecutionContext
): Promise<ToolExecutionResult> {
  const tool = toolRegistry.find((t) => t.name === toolName);

  if (!tool) {
    return {
      success: false,
      error: `Unknown tool: ${toolName}`,
    };
  }

  return tool.executor(input, context);
}

/**
 * Get directory listing with metadata
 */
function getDirectoryListing(
  dirPath: string,
  options: {
    recursive?: boolean;
    includeHidden?: boolean;
    fileTypes?: Array<"file" | "directory" | "symlink">;
  }
): {
  entries: ReturnType<typeof listDirectory>;
  path: string;
  totalCount: number;
} {
  const entries = listDirectory(dirPath, options);

  const countEntries = (entries: ReturnType<typeof listDirectory>): number => {
    let count = 0;
    for (const entry of entries) {
      count++;
      if (entry.children) {
        count += countEntries(entry.children);
      }
    }
    return count;
  };

  return {
    entries,
    path: dirPath,
    totalCount: countEntries(entries),
  };
}
