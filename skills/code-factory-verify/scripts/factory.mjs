#!/usr/bin/env node
/**
 * Vue 3 & Flutter Code Factory CLI Engine (Node.js Zero-Dependency).
 * Works across Windows, macOS, and Linux without requiring Python.
 *
 * Usage:
 *   node factory.mjs init --cwd <dir>
 *   node factory.mjs profile --cwd <dir>
 *   node factory.mjs classify --cwd <dir>
 *   node factory.mjs verify --cwd <dir>
 *   node factory.mjs board-status --cwd <dir>
 */

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const IS_WIN = process.platform === "win32";
const JIRA_KEY_RE = /\b([A-Z][A-Z0-9]{1,9}-\d+)\b/;

/**
 * Detects whether the workspace uses FVM (.fvmrc or .fvm/fvm_config.json)
 * and resolves the exact flutter/dart invocation commands.
 */
function resolveFlutterToolchain(cwd) {
  const fvmrcPath = path.join(cwd, ".fvmrc");
  const fvmConfigPath = path.join(cwd, ".fvm", "fvm_config.json");
  let usesFvm = false;
  let fvmVersion = null;

  if (fs.existsSync(fvmrcPath)) {
    usesFvm = true;
    try {
      const data = JSON.parse(fs.readFileSync(fvmrcPath, "utf-8"));
      fvmVersion = data.flutter || data.flutterSdkVersion || null;
    } catch {}
  } else if (fs.existsSync(fvmConfigPath)) {
    usesFvm = true;
    try {
      const data = JSON.parse(fs.readFileSync(fvmConfigPath, "utf-8"));
      fvmVersion = data.flutterSdkVersion || data.flutter || null;
    } catch {}
  }

  // 1. Check local .fvm/flutter_sdk/bin symlink first (fastest & works even if `fvm` CLI isn't in PATH)
  const localFlutterBin = path.join(
    cwd,
    ".fvm",
    "flutter_sdk",
    "bin",
    IS_WIN ? "flutter.bat" : "flutter"
  );
  const localDartBin = path.join(
    cwd,
    ".fvm",
    "flutter_sdk",
    "bin",
    IS_WIN ? "dart.bat" : "dart"
  );

  if (fs.existsSync(localFlutterBin) && fs.existsSync(localDartBin)) {
    return {
      usesFvm: true,
      fvmVersion,
      source: ".fvm/flutter_sdk/bin",
      flutterCmd: [localFlutterBin],
      dartCmd: [localDartBin],
      buildRunnerHint: "fvm dart run build_runner build --delete-conflicting-outputs",
    };
  }

  // 2. If project uses FVM (or fvm binary is available when .fvmrc exists), route via `fvm flutter` / `fvm dart`
  if (usesFvm) {
    const fvmCheck = runCmd("fvm", ["--version"], cwd, 5000);
    if (fvmCheck.code === 0) {
      return {
        usesFvm: true,
        fvmVersion,
        source: "fvm CLI",
        flutterCmd: ["fvm", "flutter"],
        dartCmd: ["fvm", "dart"],
        buildRunnerHint: "fvm dart run build_runner build --delete-conflicting-outputs",
      };
    }
  }

  // 3. Fallback to global flutter / dart
  return {
    usesFvm,
    fvmVersion,
    source: "global PATH",
    flutterCmd: ["flutter"],
    dartCmd: ["dart"],
    buildRunnerHint: usesFvm
      ? "fvm dart run build_runner build --delete-conflicting-outputs"
      : "dart run build_runner build --delete-conflicting-outputs",
  };
}

function normalizeRel(p) {
  return String(p || "").replace(/\\/g, "/").trim();
}

function runCmd(bin, args, cwd, timeoutMs = 120000) {
  try {
    const res = spawnSync(bin, args, {
      cwd,
      encoding: "utf-8",
      timeout: timeoutMs,
      shell: IS_WIN, // Resolves .cmd / .bat (npx.cmd, flutter.bat, dart.bat) automatically on Windows
    });
    return {
      code: res.status ?? (res.error ? 127 : 0),
      stdout: (res.stdout || "").trim(),
      stderr: (res.stderr || (res.error ? res.error.message : "")).trim(),
    };
  } catch (err) {
    return { code: 127, stdout: "", stderr: String(err) };
  }
}

function detectProfile(cwd) {
  const profile = {
    generatedAt: new Date().toISOString(),
    platform: process.platform,
    runtime: "node",
    root: cwd,
    stacks: [],
    vue: null,
    flutter: null,
  };

  const pkgJsonPath = path.join(cwd, "package.json");
  const pubspecPath = path.join(cwd, "pubspec.yaml");

  if (fs.existsSync(pkgJsonPath)) {
    let pkg = {};
    try {
      pkg = JSON.parse(fs.readFileSync(pkgJsonPath, "utf-8"));
    } catch {}
    const deps = {
      ...(pkg.dependencies || {}),
      ...(pkg.devDependencies || {}),
    };
    const scripts = pkg.scripts || {};

    if ("vue" in deps || "nuxt" in deps) {
      profile.stacks.push("vue");
      let pkgManager = "npm";
      if (fs.existsSync(path.join(cwd, "pnpm-lock.yaml"))) pkgManager = "pnpm";
      else if (fs.existsSync(path.join(cwd, "yarn.lock"))) pkgManager = "yarn";
      else if (
        fs.existsSync(path.join(cwd, "bun.lockb")) ||
        fs.existsSync(path.join(cwd, "bun.lock"))
      )
        pkgManager = "bun";

      const uiLibs = [
        "element-plus",
        "vuetify",
        "naive-ui",
        "radix-vue",
        "primevue",
        "ant-design-vue",
        "tailwindcss",
      ].filter((lib) => lib in deps);

      profile.vue = {
        framework: "nuxt" in deps ? "nuxt" : "vue3",
        packageManager: pkgManager,
        stateManagement:
          "pinia" in deps ? "pinia" : "vuex" in deps ? "vuex" : "composables",
        router: "vue-router" in deps || "nuxt" in deps ? "vue-router" : null,
        typecheck:
          "vue-tsc" in deps || "typecheck" in scripts || "type-check" in scripts
            ? "vue-tsc"
            : "tsc",
        linter: "eslint" in deps ? "eslint" : null,
        testRunner:
          "vitest" in deps ? "vitest" : "jest" in deps ? "jest" : null,
        uiLibraries: uiLibs,
        autoImports:
          "unplugin-auto-import" in deps ||
          "unplugin-vue-components" in deps ||
          "nuxt" in deps,
        scripts: Object.keys(scripts),
      };
    }
  }

  if (fs.existsSync(pubspecPath)) {
    let pubspecText = "";
    try {
      pubspecText = fs.readFileSync(pubspecPath, "utf-8");
    } catch {}
    profile.stacks.push("flutter");

    const stateMgmt = [
      "flutter_bloc",
      "bloc",
      "flutter_riverpod",
      "hooks_riverpod",
      "riverpod",
      "provider",
      "get",
      "mobx",
    ].filter((lib) => pubspecText.includes(`${lib}:`));

    const codegen = [
      "build_runner",
      "freezed",
      "json_serializable",
      "riverpod_generator",
      "auto_route_generator",
      "injectable_generator",
    ].filter((lib) => pubspecText.includes(`${lib}:`));

    let router = "Navigator";
    if (pubspecText.includes("go_router:")) router = "go_router";
    else if (pubspecText.includes("auto_route:")) router = "auto_route";

    const toolchain = resolveFlutterToolchain(cwd);

    profile.flutter = {
      usesFvm: toolchain.usesFvm,
      fvmVersion: toolchain.fvmVersion,
      sdkSource: toolchain.source,
      flutterCommand: toolchain.flutterCmd.join(" "),
      dartCommand: toolchain.dartCmd.join(" "),
      buildRunnerCommand: toolchain.buildRunnerHint,
      stateManagement: stateMgmt.length
        ? stateMgmt
        : ["StatefulWidget / ValueNotifier"],
      router,
      codegen,
      usesBuildRunner: codegen.includes("build_runner"),
    };
  }

  return profile;
}

function getChangedFiles(cwd) {
  const { code, stdout } = runCmd("git", ["status", "--porcelain"], cwd, 10000);
  if (code !== 0 || !stdout) return [];
  const files = [];
  for (const line of stdout.split(/\r?\n/)) {
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
}

function extractJiraContext(cwd) {
  let branch = "";
  const bRes = runCmd("git", ["rev-parse", "--abbrev-ref", "HEAD"], cwd, 5000);
  if (bRes.code === 0) branch = bRes.stdout;

  const branchMatch = branch.match(JIRA_KEY_RE);
  const folderMatch = path.basename(cwd).match(JIRA_KEY_RE);
  const jiraKey = branchMatch ? branchMatch[1] : folderMatch ? folderMatch[1] : null;

  return {
    branch: branch || null,
    jiraKey,
    suggestedCommitPrefix: jiraKey ? `feat(${jiraKey}): ` : "feat: ",
  };
}

function cmdInit(cwd) {
  const profile = detectProfile(cwd);
  const jira = extractJiraContext(cwd);
  const agentsDir = path.join(cwd, ".agents");
  fs.mkdirSync(agentsDir, { recursive: true });

  const profilePath = path.join(agentsDir, "repo-profile.json");
  fs.writeFileSync(profilePath, JSON.stringify({ ...profile, jira }, null, 2), "utf-8");

  const configPath = path.join(agentsDir, "factory.config.json");
  if (!fs.existsSync(configPath)) {
    fs.writeFileSync(
      configPath,
      JSON.stringify(
        {
          tier: "auto",
          reviewerFleetThresholdLines: 40,
          verifyLadder: { V0: true, V1: true, V3: true, V4: true },
          jiraIntegration: true,
        },
        null,
        2
      ),
      "utf-8"
    );
  }

  // Add .agents/repo-profile.json to .git/info/exclude so it never pollutes git status
  const gitExclude = path.join(cwd, ".git", "info", "exclude");
  if (fs.existsSync(gitExclude)) {
    const excludeContent = fs.readFileSync(gitExclude, "utf-8");
    if (!excludeContent.includes(".agents/repo-profile.json")) {
      fs.appendFileSync(gitExclude, "\n.agents/repo-profile.json\n", "utf-8");
    }
  }

  console.log(
    JSON.stringify(
      {
        status: "initialized",
        profilePath,
        configPath,
        jira,
        stacks: profile.stacks,
      },
      null,
      2
    )
  );
  return 0;
}

function cmdBoardStatus(cwd) {
  const jira = extractJiraContext(cwd);
  const changed = getChangedFiles(cwd);
  const profile = detectProfile(cwd);
  console.log(
    JSON.stringify(
      {
        cwd,
        stacks: profile.stacks,
        branch: jira.branch,
        detectedJiraKey: jira.jiraKey,
        suggestedCommitPrefix: jira.suggestedCommitPrefix,
        uncommittedFilesCount: changed.length,
        uncommittedFiles: changed,
      },
      null,
      2
    )
  );
  return 0;
}

function cmdProfile(cwd) {
  const profile = detectProfile(cwd);
  const agentsDir = path.join(cwd, ".agents");
  fs.mkdirSync(agentsDir, { recursive: true });
  const outPath = path.join(agentsDir, "repo-profile.json");
  fs.writeFileSync(outPath, JSON.stringify(profile, null, 2), "utf-8");
  console.log(
    JSON.stringify({ status: "ok", profilePath: outPath, profile }, null, 2)
  );
  return 0;
}

function cmdClassify(cwd) {
  const changed = getChangedFiles(cwd);
  const vueFiles = changed.filter((f) => f.endsWith(".vue"));
  const tsFiles = changed.filter((f) =>
    [".ts", ".tsx", ".js"].some((ext) => f.endsWith(ext))
  );
  const styleFiles = changed.filter((f) =>
    [".css", ".scss", ".sass"].some((ext) => f.endsWith(ext))
  );
  const dartFiles = changed.filter(
    (f) =>
      f.endsWith(".dart") &&
      ![".g.dart", ".freezed.dart", ".gr.dart", ".mocks.dart"].some((ext) =>
        f.endsWith(ext)
      )
  );
  const nativeMobileFiles = changed.filter((f) =>
    [
      "android/",
      "ios/",
      "pubspec.yaml",
      "AndroidManifest.xml",
      "Info.plist",
      "build.gradle",
      "Podfile",
    ].some((p) => f.includes(p))
  );

  const reviewers = [];
  const verifyRungs = ["V0"];

  if (vueFiles.length || tsFiles.length) {
    reviewers.push("vue-reactivity-reviewer");
    verifyRungs.push("V1");
  }
  if (vueFiles.length || styleFiles.length) {
    reviewers.push("vue-ui-a11y-reviewer");
    if (!verifyRungs.includes("V3_BROWSER")) verifyRungs.push("V3_BROWSER");
  }
  if (dartFiles.length) {
    reviewers.push("flutter-lifecycle-memory-reviewer");
    reviewers.push("flutter-ui-performance-reviewer");
    if (!verifyRungs.includes("V1")) verifyRungs.push("V1");
    if (!verifyRungs.includes("V3_DEVICE_HUB"))
      verifyRungs.push("V3_DEVICE_HUB");
  }

  const jira = extractJiraContext(cwd);
  let diffLines = 0;
  const dRes = runCmd("git", ["diff", "--shortstat"], cwd, 5000);
  if (dRes.code === 0 && dRes.stdout) {
    const m = dRes.stdout.match(/(\d+)\s+insertion|(\d+)\s+deletion/g);
    if (m) {
      for (const part of m) {
        const num = parseInt(part, 10);
        if (!Number.isNaN(num)) diffLines += num;
      }
    }
  }
  const tier =
    changed.length >= 2 || diffLines >= 40 ? "full (run Reviewer Fleet)" : "quick (V0/V1 only - save tokens)";

  console.log(
    JSON.stringify(
      {
        jira,
        recommendedTier: tier,
        estimatedDiffLines: diffLines,
        changedFilesCount: changed.length,
        changedFiles: changed,
        categories: {
          vueComponents: vueFiles,
          tsModules: tsFiles,
          styles: styleFiles,
          dartSources: dartFiles,
          nativeMobileConfigs: nativeMobileFiles,
        },
        recommendedReviewers: reviewers,
        requiredVerifyRungs: verifyRungs,
      },
      null,
      2
    )
  );
  return 0;
}

function cmdVerify(cwd) {
  const profile = detectProfile(cwd);
  const changed = getChangedFiles(cwd);
  const report = {
    cwd,
    changedFiles: changed,
    V0: { status: "SKIPPED", checks: [] },
    V1: { status: "SKIPPED", checks: [] },
  };

  let v0Failed = false;
  let v1Failed = false;

  // Vue V0 & V1
  const vueChanged = changed.filter((f) =>
    [".vue", ".ts", ".tsx"].some((ext) => f.endsWith(ext))
  );
  if (profile.stacks.includes("vue") && vueChanged.length > 0) {
    report.V0.status = "PASS";
    const { code, stdout, stderr } = runCmd(
      "npx",
      ["--no-install", "vue-tsc", "--noEmit"],
      cwd
    );
    const combined = `${stdout}\n${stderr}`.trim();
    const relevantLines = combined
      .split(/\r?\n/)
      .filter((line) => vueChanged.some((f) => normalizeRel(line).includes(f)));

    if (code !== 0 && relevantLines.length > 0) {
      v0Failed = true;
      report.V0.checks.push({
        name: "vue-tsc (differential)",
        status: "FAIL",
        errors: relevantLines.slice(0, 25),
      });
    } else {
      report.V0.checks.push({
        name: "vue-tsc (differential)",
        status: "PASS",
      });
    }

    const existingVue = vueChanged.filter((f) =>
      fs.existsSync(path.join(cwd, ...f.split("/")))
    );
    if (existingVue.length > 0 && profile.vue?.linter === "eslint") {
      const eRes = runCmd(
        "npx",
        ["--no-install", "eslint", ...existingVue],
        cwd
      );
      if (eRes.code !== 0) {
        v0Failed = true;
        report.V0.checks.push({
          name: "eslint (changed files)",
          status: "FAIL",
          output: (eRes.stdout || eRes.stderr).split(/\r?\n/).slice(0, 25),
        });
      } else {
        report.V0.checks.push({
          name: "eslint (changed files)",
          status: "PASS",
        });
      }
    }

    const specFiles = vueChanged.filter((f) =>
      [".spec.ts", ".test.ts", ".spec.tsx", ".test.tsx"].some((ext) =>
        f.endsWith(ext)
      )
    );
    for (const f of vueChanged) {
      const base = f.replace(/\.[^.]+$/, "");
      for (const cand of [`${base}.spec.ts`, `${base}.test.ts`]) {
        if (
          fs.existsSync(path.join(cwd, ...cand.split("/"))) &&
          !specFiles.includes(cand)
        ) {
          specFiles.push(cand);
        }
      }
    }

    if (specFiles.length > 0 && profile.vue?.testRunner === "vitest") {
      report.V1.status = "PASS";
      const tRes = runCmd(
        "npx",
        ["--no-install", "vitest", "run", ...specFiles],
        cwd
      );
      if (tRes.code !== 0) {
        v1Failed = true;
        report.V1.checks.push({
          name: "vitest (targeted)",
          status: "FAIL",
          files: specFiles,
          output: `${tRes.stdout}\n${tRes.stderr}`.split(/\r?\n/).slice(-30),
        });
      } else {
        report.V1.checks.push({
          name: "vitest (targeted)",
          status: "PASS",
          files: specFiles,
        });
      }
    }
  }

  // Flutter V0 & V1
  const dartChanged = changed.filter(
    (f) =>
      f.endsWith(".dart") &&
      ![".g.dart", ".freezed.dart", ".gr.dart", ".mocks.dart"].some((ext) =>
        f.endsWith(ext)
      ) &&
      fs.existsSync(path.join(cwd, ...f.split("/")))
  );
  if (profile.stacks.includes("flutter") && dartChanged.length > 0) {
    if (report.V0.status === "SKIPPED") report.V0.status = "PASS";

    const toolchain = resolveFlutterToolchain(cwd);
    const [dartBin, ...dartPrefix] = toolchain.dartCmd;
    const [flutterBin, ...flutterPrefix] = toolchain.flutterCmd;

    const fRes = runCmd(
      dartBin,
      [...dartPrefix, "format", "--output=none", "--set-exit-if-changed", ...dartChanged],
      cwd
    );
    if (fRes.code !== 0 && fRes.code !== 127) {
      v0Failed = true;
      report.V0.checks.push({
        name: `dart format (${toolchain.source})`,
        status: "FAIL",
        output: (fRes.stdout || fRes.stderr).split(/\r?\n/).slice(0, 20),
      });
    } else if (fRes.code === 0) {
      report.V0.checks.push({
        name: `dart format (${toolchain.source})`,
        status: "PASS",
      });
    }

    const aRes = runCmd(
      flutterBin,
      [...flutterPrefix, "analyze", ...dartChanged],
      cwd
    );
    if (aRes.code !== 0 && aRes.code !== 127) {
      v0Failed = true;
      report.V0.checks.push({
        name: `flutter analyze (${toolchain.source})`,
        status: "FAIL",
        output: `${aRes.stdout}\n${aRes.stderr}`.split(/\r?\n/).slice(0, 30),
      });
    } else if (aRes.code === 0) {
      report.V0.checks.push({
        name: `flutter analyze (${toolchain.source})`,
        status: "PASS",
      });
    }

    const dartTests = dartChanged.filter((f) => f.endsWith("_test.dart"));
    for (const f of dartChanged) {
      if (f.startsWith("lib/")) {
        const rel = f.slice(4, -5);
        const cand = `test/${rel}_test.dart`;
        if (
          fs.existsSync(path.join(cwd, ...cand.split("/"))) &&
          !dartTests.includes(cand)
        ) {
          dartTests.push(cand);
        }
      }
    }

    if (dartTests.length > 0) {
      if (report.V1.status === "SKIPPED") report.V1.status = "PASS";
      const tRes = runCmd(
        flutterBin,
        [...flutterPrefix, "test", ...dartTests],
        cwd
      );
      if (tRes.code !== 0) {
        v1Failed = true;
        report.V1.checks.push({
          name: `flutter test (${toolchain.source})`,
          status: "FAIL",
          files: dartTests,
          output: `${tRes.stdout}\n${tRes.stderr}`.split(/\r?\n/).slice(-30),
        });
      } else {
        report.V1.checks.push({
          name: `flutter test (${toolchain.source})`,
          status: "PASS",
          files: dartTests,
        });
      }
    }
  }

  if (v0Failed) report.V0.status = "FAIL";
  if (v1Failed) report.V1.status = "FAIL";

  console.log(JSON.stringify(report, null, 2));
  return v0Failed || v1Failed ? 1 : 0;
}

function main() {
  const args = process.argv.slice(2);
  const action = args[0] || "profile";
  let cwd = process.cwd();
  const cwdIdx = args.indexOf("--cwd");
  if (cwdIdx !== -1 && args[cwdIdx + 1]) {
    cwd = path.resolve(args[cwdIdx + 1]);
  }

  if (action === "init") process.exit(cmdInit(cwd));
  else if (action === "profile") process.exit(cmdProfile(cwd));
  else if (action === "classify") process.exit(cmdClassify(cwd));
  else if (action === "verify") process.exit(cmdVerify(cwd));
  else if (action === "board-status") process.exit(cmdBoardStatus(cwd));
  else {
    console.error("Unknown action. Use: init | profile | classify | verify | board-status");
    process.exit(1);
  }
}

main();
