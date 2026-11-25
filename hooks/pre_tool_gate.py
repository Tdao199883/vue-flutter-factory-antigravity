#!/usr/bin/env python3
"""Antigravity PreToolUse Gate for Vue 3 & Flutter Code Factory.

Enforces hard safety guardrails before tool execution:
1. Blocks direct manual edits to generated Flutter files (*.g.dart, *.freezed.dart, etc.)
   and generated Vue/Nuxt files (auto-imports.d.ts, components.d.ts).
2. Prompts for confirmation ("ask") when editing sensitive native mobile config files
   (AndroidManifest.xml, Info.plist, build.gradle, Podfile).
3. Blocks destructive git commands (git reset --hard, git push --force, git clean -fd).
"""

import json
import os
import re
import sys

BLOCKED_GENERATED_SUFFIXES = (
    ".g.dart",
    ".freezed.dart",
    ".gr.dart",
    ".config.dart",
    ".mocks.dart",
)

BLOCKED_GENERATED_BASENAMES = {
    "auto-imports.d.ts",
    "components.d.ts",
    "typed-router.d.ts",
}

SENSITIVE_NATIVE_PATTERNS = (
    "AndroidManifest.xml",
    "Info.plist",
    "Podfile",
    "build.gradle",
    "build.gradle.kts",
)

DANGEROUS_CMD_REGEX = re.compile(
    r"\b("
    r"git\s+reset\s+--hard|"
    r"git\s+push\s+.*(-f|--force\b)|"
    r"git\s+clean\s+-[a-zA-Z]*f|"
    r"git\s+checkout\s+--\s+\.|"
    r"rm\s+-rf\s+(/|~|\.\.|\.[/\s]|node_modules\s+/)"
    r")",
    re.IGNORECASE,
)


def emit(decision: str, reason: str = "") -> None:
    payload = {"decision": decision}
    if reason:
        payload["reason"] = reason
    sys.stdout.write(json.dumps(payload))
    sys.stdout.flush()


def main() -> int:
    try:
        raw = sys.stdin.read()
        data = json.loads(raw) if raw.strip() else {}
    except Exception:
        emit("allow")
        return 0

    tool_call = data.get("toolCall") or {}
    tool_name = tool_call.get("name", "")
    args = tool_call.get("args") or {}

    if tool_name in ("edit_file", "write_file"):
        path = args.get("Path") or args.get("path") or ""
        basename = os.path.basename(path)

        if any(path.endswith(suffix) for suffix in BLOCKED_GENERATED_SUFFIXES):
            emit(
                "deny",
                f"[Code Factory Gate] Direct editing of generated Dart file '{basename}' is forbidden. "
                "Modify the source .dart file and run: dart run build_runner build --delete-conflicting-outputs",
            )
            return 0

        if basename in BLOCKED_GENERATED_BASENAMES:
            emit(
                "deny",
                f"[Code Factory Gate] Direct editing of auto-generated Vue/Nuxt declaration '{basename}' is forbidden. "
                "It is managed automatically by unplugin-auto-import / unplugin-vue-components / unplugin-vue-router.",
            )
            return 0

        if any(basename == pat or path.endswith("/" + pat) for pat in SENSITIVE_NATIVE_PATTERNS):
            emit(
                "ask",
                f"[Code Factory Gate] Modifying native platform configuration '{basename}'. Confirm before proceeding.",
            )
            return 0

    elif tool_name == "run_command":
        cmd = args.get("CommandLine") or args.get("command") or ""
        match = DANGEROUS_CMD_REGEX.search(cmd)
        if match:
            emit(
                "ask",
                f"[Code Factory Gate] Potentially destructive command detected ('{match.group(0)}'). Requires explicit user confirmation.",
            )
            return 0

    emit("allow")
    return 0


if __name__ == "__main__":
    sys.exit(main())
