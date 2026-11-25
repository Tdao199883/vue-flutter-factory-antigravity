#!/usr/bin/env node
/**
 * Antigravity Stop Hook (Verify Stop-Gate) for Vue 3 & Flutter Code Factory (Node.js Zero-Dependency).
 * Works on Windows, macOS, and Linux without requiring Python.
 */

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const CODEGEN_ANNOTATION_RE =
  /@(freezed|unfreezed|JsonSerializable|riverpod|Riverpod|RoutePage)\b/;
const CONFLICT_MARKER_RE = /^(<<<<<<<|=======|>>>>>>>)\s/m;

function normalizeRel(p) {
  return String(p || "").replace(/\\/g, "/").trim();
}

function emitStop(decision = "stop", reason = "") {
  const payload = { decision };
  if (reason) payload.reason = reason;
  process.stdout.write(JSON.stringify(payload));
}

function getModifiedFiles(cwd) {
  try {
    const out = execFileSync("git", ["status", "--porcelain"], {
      cwd,
      encoding: "utf-8",
      timeout: 5000,
      stdio: ["ignore", "pipe", "ignore"],
    });
    const files = [];
    for (const line of out.split(/\r?\n/)) {
      if (line.length < 4) continue;
      const status = line.slice(0, 2);
      if (status.includes("D")) continue;
      let filePath = line.slice(3).trim();
      if (filePath.includes(" -> ")) {
        filePath = filePath.split(" -> ")[1].trim();
      }
      filePath = normalizeRel(filePath.replace(/^"+|"+$/g, ""));
      if (filePath) files.push(filePath);
    }
    return files;
  } catch {
    return [];
  }
}

function checkWorkspace(cwd) {
  const issues = [];
  if (!cwd || !fs.existsSync(cwd)) return issues;

  const hasFvm =
    fs.existsSync(path.join(cwd, ".fvmrc")) ||
    fs.existsSync(path.join(cwd, ".fvm", "fvm_config.json")) ||
    fs.existsSync(path.join(cwd, ".fvm", "flutter_sdk"));
  const buildRunnerCmd = hasFvm
    ? "fvm dart run build_runner build --delete-conflicting-outputs"
    : "dart run build_runner build --delete-conflicting-outputs";

  const modified = getModifiedFiles(cwd);
  for (const relPath of modified) {
    const fullPath = path.join(cwd, ...relPath.split("/"));
    if (!fs.existsSync(fullPath) || !fs.statSync(fullPath).isFile()) continue;
    if (
      ![".vue", ".ts", ".tsx", ".js", ".dart"].some((ext) =>
        relPath.endsWith(ext)
      )
    ) {
      continue;
    }

    let content = "";
    try {
      content = fs.readFileSync(fullPath, "utf-8");
    } catch {
      continue;
    }

    if (CONFLICT_MARKER_RE.test(content)) {
      issues.push(`Unresolved Git conflict markers found in \`${relPath}\`.`);
    }

    if (
      relPath.endsWith(".dart") &&
      ![".g.dart", ".freezed.dart", ".gr.dart", ".mocks.dart"].some((ext) =>
        relPath.endsWith(ext)
      )
    ) {
      if (CODEGEN_ANNOTATION_RE.test(content)) {
        const base = fullPath.slice(0, -5);
        const srcMtime = fs.statSync(fullPath).mtimeMs;

        if (content.includes("part '") || content.includes('part "')) {
          for (const ext of [".freezed.dart", ".g.dart"]) {
            const partName = path.basename(base + ext);
            if (content.includes(partName)) {
              const genFile = base + ext;
              const relGen = normalizeRel(path.relative(cwd, genFile));
              if (!fs.existsSync(genFile)) {
                issues.push(
                  `Missing generated file \`${relGen}\` for \`${relPath}\`. Run \`${buildRunnerCmd}\`.`
                );
              } else if (fs.statSync(genFile).mtimeMs + 1000 < srcMtime) {
                issues.push(
                  `Stale generated file \`${relGen}\` (older than \`${relPath}\`). Run \`${buildRunnerCmd}\`.`
                );
              }
            }
          }
        }
      }
    }
  }
  return issues;
}

function main() {
  let data = {};
  try {
    const raw = fs.readFileSync(0, "utf-8");
    if (raw && raw.trim()) {
      data = JSON.parse(raw);
    }
  } catch {
    emitStop("stop");
    return;
  }

  const terminationReason = data.terminationReason || "";
  const continuationActive = Boolean(data.continuationActive);
  if (terminationReason !== "NO_TOOL_CALL" || continuationActive) {
    emitStop("stop");
    return;
  }

  const cwd = data.cwd || "";
  const workspacePaths = data.workspacePaths || [];
  const targetDir =
    cwd && fs.existsSync(cwd) ? cwd : workspacePaths[0] || "";

  const issues = checkWorkspace(targetDir);
  if (issues.length > 0) {
    const bullets = issues
      .slice(0, 5)
      .map((i) => `- ${i}`)
      .join("\n");
    emitStop(
      "continue",
      `[Code Factory Stop-Gate] Detected verification issues in modified files before turn completion:\n${bullets}\nPlease resolve these issues and run the Code Factory Verify Ladder (\`V0\`/\`V1\`) before concluding.`
    );
    return;
  }

  emitStop("stop");
}

main();
