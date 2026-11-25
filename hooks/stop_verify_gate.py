#!/usr/bin/env python3
"""Antigravity Stop Hook (Verify Stop-Gate) for Vue 3 & Flutter Code Factory (Cross-Platform).

Runs when the agent is about to finish its turn (`NO_TOOL_CALL`).
Checks if the current workspace has uncommitted `.vue`, `.ts`, or `.dart` modifications
and runs a fast differential check (stale codegen check for Flutter + syntax/conflict markers).
If critical issues are found and `continuationActive` is False, it instructs the agent
to continue and resolve them before finishing.
"""

import json
import os
import re
import subprocess
import sys

if hasattr(sys.stdin, "reconfigure"):
    sys.stdin.reconfigure(encoding="utf-8", errors="replace")
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

CODEGEN_ANNOTATION_RE = re.compile(
    r"@(freezed|unfreezed|JsonSerializable|riverpod|Riverpod|RoutePage)\b"
)
CONFLICT_MARKER_RE = re.compile(r"^(<<<<<<<|=======|>>>>>>>)\s", re.MULTILINE)


def normalize_rel(path: str) -> str:
    return path.replace("\\", "/").strip()


def emit_stop(decision: str = "stop", reason: str = "") -> None:
    payload = {"decision": decision}
    if reason:
        payload["reason"] = reason
    sys.stdout.write(json.dumps(payload, ensure_ascii=False))
    sys.stdout.flush()


def get_modified_files(cwd: str) -> list[str]:
    try:
        res = subprocess.run(
            ["git", "status", "--porcelain"],
            cwd=cwd,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=5,
            check=False,
        )
        if res.returncode != 0:
            return []
        files = []
        for line in res.stdout.splitlines():
            if len(line) < 4:
                continue
            status = line[:2]
            if "D" in status:
                continue
            path = line[3:].strip()
            if " -> " in path:
                path = path.split(" -> ", 1)[1].strip()
            path = normalize_rel(path.strip('"'))
            files.append(path)
        return files
    except Exception:
        return []


def check_workspace(cwd: str) -> list[str]:
    issues: list[str] = []
    if not cwd or not os.path.isdir(cwd):
        return issues

    modified = get_modified_files(cwd)
    if not modified:
        return issues

    has_fvm = (
        os.path.isfile(os.path.join(cwd, ".fvmrc"))
        or os.path.isfile(os.path.join(cwd, ".fvm", "fvm_config.json"))
        or os.path.isdir(os.path.join(cwd, ".fvm", "flutter_sdk"))
    )
    build_runner_cmd = (
        "fvm dart run build_runner build --delete-conflicting-outputs"
        if has_fvm
        else "dart run build_runner build --delete-conflicting-outputs"
    )

    for rel_path in modified:
        full_path = os.path.join(cwd, *rel_path.split("/"))
        if not os.path.isfile(full_path):
            continue

        if not rel_path.endswith((".vue", ".ts", ".tsx", ".js", ".dart")):
            continue

        try:
            with open(full_path, "r", encoding="utf-8", errors="ignore") as f:
                content = f.read()
        except Exception:
            continue

        # 1. Check unresolved git merge conflict markers
        if CONFLICT_MARKER_RE.search(content):
            issues.append(
                f"Unresolved Git conflict markers found in `{rel_path}`."
            )

        # 2. Check Flutter codegen freshness (.g.dart / .freezed.dart)
        if rel_path.endswith(".dart") and not rel_path.endswith(
            (".g.dart", ".freezed.dart", ".gr.dart", ".mocks.dart")
        ):
            if CODEGEN_ANNOTATION_RE.search(content):
                base = full_path[:-5]  # strip .dart
                src_mtime = os.path.getmtime(full_path)

                if "part '" in content or 'part "' in content:
                    for ext in (".freezed.dart", ".g.dart"):
                        part_name = os.path.basename(base + ext)
                        if part_name in content:
                            gen_file = base + ext
                            rel_gen = normalize_rel(os.path.relpath(gen_file, cwd))
                            if not os.path.exists(gen_file):
                                issues.append(
                                    f"Missing generated file `{rel_gen}` for `{rel_path}`. "
                                    f"Run `{build_runner_cmd}`."
                                )
                            elif os.path.getmtime(gen_file) + 1.0 < src_mtime:
                                issues.append(
                                    f"Stale generated file `{rel_gen}` (older than `{rel_path}`). "
                                    f"Run `{build_runner_cmd}`."
                                )

    return issues


def main() -> int:
    try:
        raw = sys.stdin.read()
        data = json.loads(raw) if raw.strip() else {}
    except Exception:
        emit_stop("stop")
        return 0

    termination_reason = data.get("terminationReason", "")
    continuation_active = bool(data.get("continuationActive", False))
    if termination_reason != "NO_TOOL_CALL" or continuation_active:
        emit_stop("stop")
        return 0

    cwd = data.get("cwd") or ""
    workspace_paths = data.get("workspacePaths") or []
    target_dir = cwd if (cwd and os.path.isdir(cwd)) else (workspace_paths[0] if workspace_paths else "")

    issues = check_workspace(target_dir)
    if issues:
        bullet_list = "\n".join(f"- {item}" for item in issues[:5])
        emit_stop(
            "continue",
            f"[Code Factory Stop-Gate] Detected verification issues in modified files before turn completion:\n"
            f"{bullet_list}\n"
            "Please resolve these issues and run the Code Factory Verify Ladder (`V0`/`V1`) before concluding.",
        )
        return 0

    emit_stop("stop")
    return 0


if __name__ == "__main__":
    sys.exit(main())
