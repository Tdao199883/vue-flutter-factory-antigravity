#!/usr/bin/env python3
"""Vue 3 & Flutter Code Factory CLI Engine for Google Antigravity (Cross-Platform: macOS, Windows, Linux).

Commands:
  profile  -- Inspects the workspace and writes `.agents/repo-profile.json`
  classify -- Classifies the current git diff and outputs required Verify Rungs & Reviewer Subagents
  verify   -- Executes V0 (differential typecheck/lint/codegen check) and V1 (targeted tests)
"""

import argparse
import json
import os
import re
import shutil
import subprocess
import sys
from datetime import datetime, timezone

JIRA_KEY_RE = re.compile(r"\b([A-Z][A-Z0-9]{1,9}-\d+)\b")
IS_WIN = sys.platform.startswith("win")


def resolve_flutter_toolchain(cwd: str) -> dict:
    fvmrc_path = os.path.join(cwd, ".fvmrc")
    fvm_cfg_path = os.path.join(cwd, ".fvm", "fvm_config.json")
    uses_fvm = False
    fvm_version = None

    if os.path.isfile(fvmrc_path):
        uses_fvm = True
        try:
            with open(fvmrc_path, "r", encoding="utf-8") as f:
                data = json.load(f)
                fvm_version = data.get("flutter") or data.get("flutterSdkVersion")
        except Exception:
            pass
    elif os.path.isfile(fvm_cfg_path):
        uses_fvm = True
        try:
            with open(fvm_cfg_path, "r", encoding="utf-8") as f:
                data = json.load(f)
                fvm_version = data.get("flutterSdkVersion") or data.get("flutter")
        except Exception:
            pass

    local_flutter = os.path.join(
        cwd, ".fvm", "flutter_sdk", "bin", "flutter.bat" if IS_WIN else "flutter"
    )
    local_dart = os.path.join(
        cwd, ".fvm", "flutter_sdk", "bin", "dart.bat" if IS_WIN else "dart"
    )
    if os.path.isfile(local_flutter) and os.path.isfile(local_dart):
        return {
            "usesFvm": True,
            "fvmVersion": fvm_version,
            "source": ".fvm/flutter_sdk/bin",
            "flutterCmd": [local_flutter],
            "dartCmd": [local_dart],
            "buildRunnerHint": "fvm dart run build_runner build --delete-conflicting-outputs",
        }

    fvm_bin = shutil.which("fvm")
    if uses_fvm and fvm_bin:
        return {
            "usesFvm": True,
            "fvmVersion": fvm_version,
            "source": "fvm CLI",
            "flutterCmd": [fvm_bin, "flutter"],
            "dartCmd": [fvm_bin, "dart"],
            "buildRunnerHint": "fvm dart run build_runner build --delete-conflicting-outputs",
        }

    flutter_bin = shutil.which("flutter") or "flutter"
    dart_bin = shutil.which("dart") or "dart"
    return {
        "usesFvm": uses_fvm,
        "fvmVersion": fvm_version,
        "source": "global PATH",
        "flutterCmd": [flutter_bin],
        "dartCmd": [dart_bin],
        "buildRunnerHint": "fvm dart run build_runner build --delete-conflicting-outputs"
        if uses_fvm
        else "dart run build_runner build --delete-conflicting-outputs",
    }

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")


def normalize_rel(path: str) -> str:
    return path.replace("\\", "/").strip()


def run_cmd(cmd: list[str], cwd: str, timeout: int = 120) -> tuple[int, str, str]:
    try:
        proc = subprocess.run(
            cmd,
            cwd=cwd,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=timeout,
            check=False,
        )
        return proc.returncode, proc.stdout.strip(), proc.stderr.strip()
    except FileNotFoundError:
        return 127, "", f"Executable not found: {cmd[0]}"
    except subprocess.TimeoutExpired:
        return 124, "", f"Command timed out after {timeout}s: {' '.join(cmd)}"


def detect_profile(cwd: str) -> dict:
    profile: dict = {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "platform": sys.platform,
        "root": cwd,
        "stacks": [],
        "vue": None,
        "flutter": None,
    }

    pkg_json_path = os.path.join(cwd, "package.json")
    pubspec_path = os.path.join(cwd, "pubspec.yaml")

    # 1. Detect Vue / Web stack
    if os.path.isfile(pkg_json_path):
        try:
            with open(pkg_json_path, "r", encoding="utf-8") as f:
                pkg = json.load(f)
        except Exception:
            pkg = {}

        deps = {
            **(pkg.get("dependencies") or {}),
            **(pkg.get("devDependencies") or {}),
        }
        scripts = pkg.get("scripts") or {}

        if "vue" in deps or "nuxt" in deps:
            profile["stacks"].append("vue")
            pkg_manager = "npm"
            if os.path.isfile(os.path.join(cwd, "pnpm-lock.yaml")):
                pkg_manager = "pnpm"
            elif os.path.isfile(os.path.join(cwd, "yarn.lock")):
                pkg_manager = "yarn"
            elif os.path.isfile(os.path.join(cwd, "bun.lockb")) or os.path.isfile(
                os.path.join(cwd, "bun.lock")
            ):
                pkg_manager = "bun"

            ui_libs = [
                lib
                for lib in (
                    "element-plus",
                    "vuetify",
                    "naive-ui",
                    "radix-vue",
                    "primevue",
                    "ant-design-vue",
                    "tailwindcss",
                )
                if lib in deps
            ]

            profile["vue"] = {
                "framework": "nuxt" if "nuxt" in deps else "vue3",
                "packageManager": pkg_manager,
                "stateManagement": "pinia"
                if "pinia" in deps
                else ("vuex" if "vuex" in deps else "composables"),
                "router": "vue-router"
                if ("vue-router" in deps or "nuxt" in deps)
                else None,
                "typecheck": "vue-tsc"
                if ("vue-tsc" in deps or "typecheck" in scripts or "type-check" in scripts)
                else "tsc",
                "linter": "eslint" if "eslint" in deps else None,
                "testRunner": "vitest"
                if "vitest" in deps
                else ("jest" if "jest" in deps else None),
                "uiLibraries": ui_libs,
                "autoImports": "unplugin-auto-import" in deps
                or "unplugin-vue-components" in deps
                or "nuxt" in deps,
                "scripts": list(scripts.keys()),
            }

    # 2. Detect Flutter / Dart stack
    if os.path.isfile(pubspec_path):
        try:
            with open(pubspec_path, "r", encoding="utf-8") as f:
                pubspec_text = f.read()
        except Exception:
            pubspec_text = ""

        profile["stacks"].append("flutter")
        state_mgmt = []
        for lib in (
            "flutter_bloc",
            "bloc",
            "flutter_riverpod",
            "hooks_riverpod",
            "riverpod",
            "provider",
            "get",
            "mobx",
        ):
            if f"{lib}:" in pubspec_text:
                state_mgmt.append(lib)

        codegen = []
        for lib in (
            "build_runner",
            "freezed",
            "json_serializable",
            "riverpod_generator",
            "auto_route_generator",
            "injectable_generator",
        ):
            if f"{lib}:" in pubspec_text:
                codegen.append(lib)

        router = None
        if "go_router:" in pubspec_text:
            router = "go_router"
        elif "auto_route:" in pubspec_text:
            router = "auto_route"

        toolchain = resolve_flutter_toolchain(cwd)

        profile["flutter"] = {
            "usesFvm": toolchain["usesFvm"],
            "fvmVersion": toolchain["fvmVersion"],
            "sdkSource": toolchain["source"],
            "flutterCommand": " ".join(toolchain["flutterCmd"]),
            "dartCommand": " ".join(toolchain["dartCmd"]),
            "buildRunnerCommand": toolchain["buildRunnerHint"],
            "stateManagement": state_mgmt or ["StatefulWidget / ValueNotifier"],
            "router": router or "Navigator",
            "codegen": codegen,
            "usesBuildRunner": "build_runner" in codegen,
        }

    return profile


def get_changed_files(cwd: str) -> list[str]:
    code, out, _ = run_cmd(["git", "status", "--porcelain"], cwd=cwd, timeout=10)
    if code != 0 or not out:
        return []
    files: list[str] = []
    for line in out.splitlines():
        if len(line) < 4:
            continue
        status = line[:2]
        if "D" in status:
            continue
        path = line[3:].strip()
        if " -> " in path:
            path = path.split(" -> ", 1)[1].strip()
        files.append(normalize_rel(path.strip('"')))
    return files


def extract_jira_context(cwd: str) -> dict:
    code, branch, _ = run_cmd(["git", "rev-parse", "--abbrev-ref", "HEAD"], cwd=cwd, timeout=5)
    branch = branch if code == 0 else ""
    branch_match = JIRA_KEY_RE.search(branch)
    folder_match = JIRA_KEY_RE.search(os.path.basename(cwd))
    jira_key = branch_match.group(1) if branch_match else (folder_match.group(1) if folder_match else None)
    return {
        "branch": branch or None,
        "jiraKey": jira_key,
        "suggestedCommitPrefix": f"feat({jira_key}): " if jira_key else "feat: ",
    }


def cmd_init(cwd: str) -> int:
    profile = detect_profile(cwd)
    jira = extract_jira_context(cwd)
    agents_dir = os.path.join(cwd, ".agents")
    os.makedirs(agents_dir, exist_ok=True)
    profile_path = os.path.join(agents_dir, "repo-profile.json")
    with open(profile_path, "w", encoding="utf-8") as f:
        json.dump({**profile, "jira": jira}, f, indent=2, ensure_ascii=False)

    config_path = os.path.join(agents_dir, "factory.config.json")
    if not os.path.isfile(config_path):
        with open(config_path, "w", encoding="utf-8") as f:
            json.dump(
                {
                    "tier": "auto",
                    "reviewerFleetThresholdLines": 40,
                    "verifyLadder": {"V0": True, "V1": True, "V3": True, "V4": True},
                    "jiraIntegration": True,
                },
                f,
                indent=2,
                ensure_ascii=False,
            )

    git_exclude = os.path.join(cwd, ".git", "info", "exclude")
    if os.path.isfile(git_exclude):
        with open(git_exclude, "r", encoding="utf-8", errors="ignore") as f:
            exc = f.read()
        if ".agents/repo-profile.json" not in exc:
            with open(git_exclude, "a", encoding="utf-8") as f:
                f.write("\n.agents/repo-profile.json\n")

    print(
        json.dumps(
            {
                "status": "initialized",
                "profilePath": profile_path,
                "configPath": config_path,
                "jira": jira,
                "stacks": profile["stacks"],
            },
            indent=2,
            ensure_ascii=False,
        )
    )
    return 0


def cmd_board_status(cwd: str) -> int:
    jira = extract_jira_context(cwd)
    changed = get_changed_files(cwd)
    profile = detect_profile(cwd)
    print(
        json.dumps(
            {
                "cwd": cwd,
                "stacks": profile["stacks"],
                "branch": jira["branch"],
                "detectedJiraKey": jira["jiraKey"],
                "suggestedCommitPrefix": jira["suggestedCommitPrefix"],
                "uncommittedFilesCount": len(changed),
                "uncommittedFiles": changed,
            },
            indent=2,
            ensure_ascii=False,
        )
    )
    return 0


def cmd_profile(cwd: str) -> int:
    profile = detect_profile(cwd)
    agents_dir = os.path.join(cwd, ".agents")
    os.makedirs(agents_dir, exist_ok=True)
    out_path = os.path.join(agents_dir, "repo-profile.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(profile, f, indent=2, ensure_ascii=False)
    print(json.dumps({"status": "ok", "profilePath": out_path, "profile": profile}, indent=2, ensure_ascii=False))
    return 0


def cmd_classify(cwd: str) -> int:
    changed = get_changed_files(cwd)
    vue_files = [f for f in changed if f.endswith(".vue")]
    ts_files = [f for f in changed if f.endswith((".ts", ".tsx", ".js"))]
    style_files = [f for f in changed if f.endswith((".css", ".scss", ".sass"))]
    dart_files = [
        f
        for f in changed
        if f.endswith(".dart")
        and not f.endswith((".g.dart", ".freezed.dart", ".gr.dart", ".mocks.dart"))
    ]
    native_mobile_files = [
        f
        for f in changed
        if any(
            p in f
            for p in (
                "android/",
                "ios/",
                "pubspec.yaml",
                "AndroidManifest.xml",
                "Info.plist",
                "build.gradle",
                "Podfile",
            )
        )
    ]

    reviewers: list[str] = []
    verify_rungs: list[str] = ["V0"]

    if vue_files or ts_files:
        reviewers.append("vue-reactivity-reviewer")
        verify_rungs.append("V1")
    if vue_files or style_files:
        reviewers.append("vue-ui-a11y-reviewer")
        if "V3_BROWSER" not in verify_rungs:
            verify_rungs.append("V3_BROWSER")

    if dart_files:
        reviewers.append("flutter-lifecycle-memory-reviewer")
        reviewers.append("flutter-ui-performance-reviewer")
        if "V1" not in verify_rungs:
            verify_rungs.append("V1")
        if "V3_DEVICE_HUB" not in verify_rungs:
            verify_rungs.append("V3_DEVICE_HUB")

    jira = extract_jira_context(cwd)
    result = {
        "jira": jira,
        "recommendedTier": "full (run Reviewer Fleet)" if len(changed) >= 2 else "quick (V0/V1 only - save tokens)",
        "changedFilesCount": len(changed),
        "changedFiles": changed,
        "categories": {
            "vueComponents": vue_files,
            "tsModules": ts_files,
            "styles": style_files,
            "dartSources": dart_files,
            "nativeMobileConfigs": native_mobile_files,
        },
        "recommendedReviewers": reviewers,
        "requiredVerifyRungs": verify_rungs,
    }
    print(json.dumps(result, indent=2, ensure_ascii=False))
    return 0


def cmd_verify(cwd: str) -> int:
    profile = detect_profile(cwd)
    changed = get_changed_files(cwd)
    report: dict = {
        "cwd": cwd,
        "changedFiles": changed,
        "V0": {"status": "SKIPPED", "checks": []},
        "V1": {"status": "SKIPPED", "checks": []},
    }

    v0_failed = False
    v1_failed = False

    # --- Vue V0 & V1 ---
    vue_changed = [f for f in changed if f.endswith((".vue", ".ts", ".tsx"))]
    if "vue" in profile["stacks"] and vue_changed:
        report["V0"]["status"] = "PASS"
        npx_bin = shutil.which("npx")
        if npx_bin:
            code, out, err = run_cmd([npx_bin, "--no-install", "vue-tsc", "--noEmit"], cwd=cwd)
            combined = f"{out}\n{err}".strip()
            relevant_lines = [
                line
                for line in combined.splitlines()
                if any(f in normalize_rel(line) for f in vue_changed)
            ]
            if code != 0 and relevant_lines:
                v0_failed = True
                report["V0"]["checks"].append(
                    {
                        "name": "vue-tsc (differential)",
                        "status": "FAIL",
                        "errors": relevant_lines[:25],
                    }
                )
            else:
                report["V0"]["checks"].append(
                    {"name": "vue-tsc (differential)", "status": "PASS"}
                )

            existing_vue = [
                f for f in vue_changed if os.path.isfile(os.path.join(cwd, *f.split("/")))
            ]
            if existing_vue and (profile.get("vue") or {}).get("linter") == "eslint":
                e_code, e_out, e_err = run_cmd(
                    [npx_bin, "--no-install", "eslint", *existing_vue], cwd=cwd
                )
                if e_code != 0:
                    v0_failed = True
                    report["V0"]["checks"].append(
                        {
                            "name": "eslint (changed files)",
                            "status": "FAIL",
                            "output": (e_out or e_err).splitlines()[:25],
                        }
                    )
                else:
                    report["V0"]["checks"].append(
                        {"name": "eslint (changed files)", "status": "PASS"}
                    )

        spec_files = [
            f for f in vue_changed if f.endswith((".spec.ts", ".test.ts", ".spec.tsx", ".test.tsx"))
        ]
        for f in vue_changed:
            base, _ = os.path.splitext(f)
            for candidate in (f"{base}.spec.ts", f"{base}.test.ts"):
                if (
                    os.path.isfile(os.path.join(cwd, *candidate.split("/")))
                    and candidate not in spec_files
                ):
                    spec_files.append(candidate)

        if spec_files and npx_bin and (profile.get("vue") or {}).get("testRunner") == "vitest":
            report["V1"]["status"] = "PASS"
            t_code, t_out, t_err = run_cmd(
                [npx_bin, "--no-install", "vitest", "run", *spec_files], cwd=cwd
            )
            if t_code != 0:
                v1_failed = True
                report["V1"]["checks"].append(
                    {
                        "name": "vitest (targeted)",
                        "status": "FAIL",
                        "files": spec_files,
                        "output": f"{t_out}\n{t_err}".splitlines()[-30:],
                    }
                )
            else:
                report["V1"]["checks"].append(
                    {"name": "vitest (targeted)", "status": "PASS", "files": spec_files}
                )

    # --- Flutter V0 & V1 ---
    dart_changed = [
        f
        for f in changed
        if f.endswith(".dart")
        and not f.endswith((".g.dart", ".freezed.dart", ".gr.dart", ".mocks.dart"))
        and os.path.isfile(os.path.join(cwd, *f.split("/")))
    ]
    if "flutter" in profile["stacks"] and dart_changed:
        if report["V0"]["status"] == "SKIPPED":
            report["V0"]["status"] = "PASS"

        toolchain = resolve_flutter_toolchain(cwd)
        dart_cmd = toolchain["dartCmd"]
        flutter_cmd = toolchain["flutterCmd"]

        f_code, f_out, f_err = run_cmd(
            [*dart_cmd, "format", "--output=none", "--set-exit-if-changed", *dart_changed],
            cwd=cwd,
        )
        if f_code not in (0, 127):
            v0_failed = True
            report["V0"]["checks"].append(
                {
                    "name": f"dart format ({toolchain['source']})",
                    "status": "FAIL",
                    "output": (f_out or f_err).splitlines()[:20],
                }
            )
        elif f_code == 0:
            report["V0"]["checks"].append(
                {"name": f"dart format ({toolchain['source']})", "status": "PASS"}
            )

        a_code, a_out, a_err = run_cmd([*flutter_cmd, "analyze", *dart_changed], cwd=cwd)
        if a_code not in (0, 127):
            v0_failed = True
            report["V0"]["checks"].append(
                {
                    "name": f"flutter analyze ({toolchain['source']})",
                    "status": "FAIL",
                    "output": f"{a_out}\n{a_err}".splitlines()[:30],
                }
            )
        elif a_code == 0:
            report["V0"]["checks"].append(
                {"name": f"flutter analyze ({toolchain['source']})", "status": "PASS"}
            )

        dart_tests = [f for f in dart_changed if f.endswith("_test.dart")]
        for f in dart_changed:
            if f.startswith("lib/"):
                rel = f[len("lib/") : -len(".dart")]
                candidate = f"test/{rel}_test.dart"
                if (
                    os.path.isfile(os.path.join(cwd, *candidate.split("/")))
                    and candidate not in dart_tests
                ):
                    dart_tests.append(candidate)

        if dart_tests:
            if report["V1"]["status"] == "SKIPPED":
                report["V1"]["status"] = "PASS"
            t_code, t_out, t_err = run_cmd([*flutter_cmd, "test", *dart_tests], cwd=cwd)
            if t_code != 0:
                v1_failed = True
                report["V1"]["checks"].append(
                    {
                        "name": f"flutter test ({toolchain['source']})",
                        "status": "FAIL",
                        "files": dart_tests,
                        "output": f"{t_out}\n{t_err}".splitlines()[-30:],
                    }
                )
            else:
                report["V1"]["checks"].append(
                    {
                        "name": f"flutter test ({toolchain['source']})",
                        "status": "PASS",
                        "files": dart_tests,
                    }
                )

    if v0_failed:
        report["V0"]["status"] = "FAIL"
    if v1_failed:
        report["V1"]["status"] = "FAIL"

    print(json.dumps(report, indent=2, ensure_ascii=False))
    return 1 if (v0_failed or v1_failed) else 0


def main() -> int:
    parser = argparse.ArgumentParser(description="Vue & Flutter Code Factory Engine")
    parser.add_argument("action", choices=["init", "profile", "classify", "verify", "board-status"])
    parser.add_argument("--cwd", default=os.getcwd(), help="Target workspace directory")
    args = parser.parse_args()

    cwd = os.path.abspath(args.cwd)
    if args.action == "init":
        return cmd_init(cwd)
    if args.action == "profile":
        return cmd_profile(cwd)
    if args.action == "classify":
        return cmd_classify(cwd)
    if args.action == "verify":
        return cmd_verify(cwd)
    if args.action == "board-status":
        return cmd_board_status(cwd)
    return 0


if __name__ == "__main__":
    sys.exit(main())
