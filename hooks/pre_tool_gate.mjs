#!/usr/bin/env node
/**
 * Antigravity PreToolUse Gate for Vue 3 & Flutter Code Factory (Node.js Zero-Dependency).
 * Works out-of-the-box on Windows, macOS, and Linux without requiring Python.
 */

import fs from "node:fs";
import path from "node:path";

const BLOCKED_GENERATED_SUFFIXES = [
  ".g.dart",
  ".freezed.dart",
  ".gr.dart",
  ".config.dart",
  ".mocks.dart",
];

const BLOCKED_GENERATED_BASENAMES = new Set([
  "auto-imports.d.ts",
  "components.d.ts",
  "typed-router.d.ts",
]);

const SENSITIVE_NATIVE_PATTERNS = [
  "AndroidManifest.xml",
  "Info.plist",
  "Podfile",
  "build.gradle",
  "build.gradle.kts",
];

const DANGEROUS_CMD_REGEX =
  /\b(git\s+reset\s+--hard|git\s+push\s+.*(-f|--force\b)|git\s+clean\s+-[a-zA-Z]*f|git\s+checkout\s+--\s+\.|rm\s+-rf\s+(\/|~|\.\.|\.[/\s]|node_modules\s+\/)|rmdir\s+\/s\s+\/q\s+(\\|[a-zA-Z]:\\|\.\.))/i;

function normalizePath(p) {
  return String(p || "").replace(/\\/g, "/").trim();
}

function emit(decision, reason = "") {
  const payload = { decision };
  if (reason) payload.reason = reason;
  process.stdout.write(JSON.stringify(payload));
}

function main() {
  let data = {};
  try {
    const raw = fs.readFileSync(0, "utf-8");
    if (raw && raw.trim()) {
      data = JSON.parse(raw);
    }
  } catch {
    emit("allow");
    return;
  }

  const toolCall = data.toolCall || {};
  const toolName = toolCall.name || "";
  const args = toolCall.args || {};

  if (toolName === "edit_file" || toolName === "write_file") {
    const rawPath = args.Path || args.path || "";
    const normPath = normalizePath(rawPath);
    const basename = path.posix.basename(normPath);

    if (BLOCKED_GENERATED_SUFFIXES.some((suffix) => normPath.endsWith(suffix))) {
      emit(
        "deny",
        `[Code Factory Gate] Direct editing of generated Dart file '${basename}' is forbidden. Modify the source .dart file and run: dart run build_runner build --delete-conflicting-outputs`
      );
      return;
    }

    if (BLOCKED_GENERATED_BASENAMES.has(basename)) {
      emit(
        "deny",
        `[Code Factory Gate] Direct editing of auto-generated Vue/Nuxt declaration '${basename}' is forbidden. It is managed automatically by unplugin-auto-import / unplugin-vue-components / unplugin-vue-router.`
      );
      return;
    }

    const lowerPath = normPath.toLowerCase();
    const lowerBase = basename.toLowerCase();
    if (
      SENSITIVE_NATIVE_PATTERNS.some(
        (pat) =>
          lowerBase === pat.toLowerCase() ||
          lowerPath.endsWith("/" + pat.toLowerCase())
      )
    ) {
      emit(
        "ask",
        `[Code Factory Gate] Modifying native platform configuration '${basename}'. Confirm before proceeding.`
      );
      return;
    }
  } else if (toolName === "run_command") {
    const cmd = args.CommandLine || args.command || "";
    const match = cmd.match(DANGEROUS_CMD_REGEX);
    if (match) {
      emit(
        "ask",
        `[Code Factory Gate] Potentially destructive command detected ('${match[0]}'). Requires explicit user confirmation.`
      );
      return;
    }
  }

  emit("allow");
}

main();
