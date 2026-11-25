---
name: code-factory-verify
description: >-
  Orchestrates the Vue 3 & Flutter Code Factory verification ladder (V0-V4),
  repository profiler, diff classifier, and reviewer fleet dispatch on Google
  Antigravity. Activate this skill when verifying code changes, running quality
  gates, profiling a Vue or Flutter repository, or dispatching the Reviewer Fleet
  before finishing a task or opening a PR.
---

# Code Factory Verification & Orchestration (`V0` → `V4`)

This skill implements the language-agnostic **Code Factory engine** adapted for **Google Antigravity**, specialized for **Vue 3 (Web)** and **Flutter (Mobile)** repositories.

---

## 1. Repository Memory Profile (`.agents/repo-profile.json`)

Before running expensive exploration or verification commands on a repository for the first time, generate or inspect `.agents/repo-profile.json` using the bundled script:

```bash
python3 ~/.gemini/config/plugins/vue-flutter-factory-antigravity/skills/code-factory-verify/scripts/factory.py profile --cwd "$(pwd)"
```

This creates/updates `.agents/repo-profile.json` with:
- Detected stack (`vue`, `flutter`, or `monorepo`)
- Package manager (`pnpm`, `npm`, `yarn`, `bun`, `flutter`/`dart`)
- State management (`pinia`, `vuex`, `riverpod`, `bloc`, `provider`, `getx`)
- Router (`vue-router`, `nuxt`, `go_router`, `auto_route`)
- Code generation tools (`build_runner`, `freezed`, `unplugin-auto-import`)
- Test runner (`vitest`, `jest`, `playwright`, `flutter test`)

---

## 2. Diff Classification & Reviewer Fleet Dispatch

Run the diff classifier to inspect all modified/untracked files and determine which Reviewer Subagents and Verify Ladder rungs must execute:

```bash
python3 ~/.gemini/config/plugins/vue-flutter-factory-antigravity/skills/code-factory-verify/scripts/factory.py classify --cwd "$(pwd)"
```

Based on the JSON output of `classify`, invoke the recommended **Reviewer Fleet** subagents in parallel via `invoke_subagent`:

| Changed Files Pattern | Subagent to Invoke (`TypeName`) | Focus Area |
| :--- | :--- | :--- |
| `*.vue`, `**/composables/*.ts`, `**/stores/*.ts` | `vue-reactivity-reviewer` | Pinia `storeToRefs`, prop mutation, watcher cleanup, computed vs watch, TypeScript props/emits contracts |
| `*.vue`, `*.css`, `*.scss` (UI/templates/forms) | `vue-ui-a11y-reviewer` | Loading/Empty/Error states, ARIA labels, keyboard navigation, responsive layout, Core Web Vitals (LCP/CLS) |
| `*.dart` (Widgets, States, Blocs, Notifiers, Services) | `flutter-lifecycle-memory-reviewer` | Controller/FocusNode/StreamSubscription `dispose()`, `if (!context.mounted) return;` after `await`, memory leaks |
| `*.dart` (Screens, Views, Widgets, Layouts) | `flutter-ui-performance-reviewer` | `RenderFlex overflow` hazards, unbounded `ListView` inside `Column`, missing `const`, helper methods vs Widget classes, `SafeArea` |

> **Bounded Fix Loop**: Run reviewers at most 2 rounds. Fix all `CRITICAL` and `HIGH` findings reported by the reviewer subagents before moving to `V3`/`V4`.

---

## 3. The Verify Ladder (`V0` → `V4`)

Execute the automated `V0`–`V2` verification script first:

```bash
python3 ~/.gemini/config/plugins/vue-flutter-factory-antigravity/skills/code-factory-verify/scripts/factory.py verify --cwd "$(pwd)"
```

### Rung Definitions

1. **`V0` — Differential Static Check & Codegen Readiness**:
   - **Flutter**: Verifies no `*.dart` file with `@freezed`, `@JsonSerializable`, or `@riverpod` is missing its generated counterpart (`*.g.dart`, `*.freezed.dart`). Runs `dart format --output=none --set-exit-if-changed` and `flutter analyze` filtered strictly to modified files.
   - **Vue**: Runs `vue-tsc --noEmit` (or `tsc --noEmit`) and `eslint` filtered strictly to modified `.vue` / `.ts` files.
2. **`V1` — Targeted Unit / Component / Widget Tests**:
   - Runs tests matching the modified source files (`vitest run <changed>` for Vue; `flutter test <changed_test.dart>` for Flutter).
3. **`V2` — Fail-Before / Pass-After Regression Check**:
   - When fixing a bug, write or update a targeted test that reproduces the issue and confirm it passes with the fix.
4. **`V3` — Live Runtime & Visual Verification (Antigravity Native)**:
   - **Vue (Web)**: If a dev server is running (or after starting it), invoke the `browser` subagent (or `chrome-devtools` skill) to open the affected route, exercise the interactive flow, and verify zero `[Vue warn]` or uncaught errors in the browser Console.
   - **Flutter (Mobile)**: If an Android Virtual Device (AVD) or physical device is connected, use the `android-device-hub` / `android-cli` skill (`android layout`, `android screen`, `adb logcat`) to inspect the rendered screen and verify zero `RenderFlex overflowed` or `FlutterError` logs.
5. **`V4` — Evidence Summary**:
   - Include a concise **Code Factory Verification Summary** block in your final response showing the status of `V0`, `V1`, `Reviewer Fleet`, and `V3`, plus any captured screenshots.
