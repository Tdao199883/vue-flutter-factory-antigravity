# Vue 3 & Flutter Code Factory for Google Antigravity (`vue-flutter-factory-antigravity`)

An end-to-end **Code Factory quality-enforcement plugin** purpose-built for **Google Antigravity (AGY)** and optimized specifically for **Vue 3 / Nuxt (Web)** and **Flutter / Dart (Mobile)** engineering workflows.

Inspired by `code-factory`, this plugin adapts the **Verify Ladder (`V0` → `V4`)**, **Repository Memory Profile**, **Diff Classifier**, **Reviewer Fleet Subagents**, and **Fail-Safe Lifecycle Hooks** natively to Antigravity—supercharging `V3/V4` verification with Antigravity's **Browser Subagent**, **Chrome DevTools MCP**, and **Android Device Hub**.

---

## Architecture & What's Included

```text
vue-flutter-factory-antigravity/
├── plugin.json                                     # Antigravity Plugin Manifest
├── hooks.json                                      # PreToolUse & Stop Verify Gates
├── assets/
│   └── logo.svg                                    # Plugin icon
├── hooks/
│   ├── pre_tool_gate.py                            # Blocks editing *.g.dart/*.freezed.dart & dangerous git cmds
│   └── stop_verify_gate.py                         # Stop-gate checking stale codegen & conflict markers
├── rules/
│   └── AGENTS.md                                   # Always-on Vue 3 & Flutter quality rules
├── agents/                                         # Reviewer Fleet Subagents
│   ├── vue-reactivity-reviewer.md                  # Audits Pinia storeToRefs, watcher loops, reactivity loss
│   ├── vue-ui-a11y-reviewer.md                     # Audits 4-state UI, ARIA/a11y, CWV (LCP/CLS)
│   ├── flutter-lifecycle-memory-reviewer.md        # Audits controller dispose(), context.mounted after await
│   └── flutter-ui-performance-reviewer.md          # Audits RenderFlex overflow, unbounded ListView, const rebuilds
└── skills/                                         # Progressive Disclosure Skills
    ├── code-factory-verify/
    │   ├── SKILL.md                                # Orchestrates V0-V4 Verify Ladder & Reviewer Fleet dispatch
    │   └── scripts/
    │       └── factory.py                          # CLI engine: profile, classify, and differential verify
    ├── vue-factory/
    │   └── SKILL.md                                # 6-stage Vue 3 / Pinia / TypeScript workflow
    └── flutter-factory/
        └── SKILL.md                                # 6-stage Flutter / Dart / Freezed / Bloc / Riverpod workflow
```

---

## Key Features for Vue 3 (Web) & Flutter (Mobile)

### 1. Fail-Safe Lifecycle Hooks (`hooks.json`)
- **`PreToolUse` Gate (`hooks/pre_tool_gate.py`)**:
  - **Hard Deny** on direct edits to generated Flutter files (`*.g.dart`, `*.freezed.dart`, `*.gr.dart`, `*.config.dart`, `*.mocks.dart`) and generated Vue/Nuxt files (`auto-imports.d.ts`, `components.d.ts`, `typed-router.d.ts`).
  - **Confirmation Prompt (`ask`)** when modifying native mobile configurations (`AndroidManifest.xml`, `Info.plist`, `build.gradle`, `Podfile`) or running destructive git commands (`git reset --hard`, `git push --force`).
- **`Stop` Verify Gate (`hooks/stop_verify_gate.py`)**:
  - Automatically checks before the agent ends its turn whether any modified `@freezed` / `@JsonSerializable` / `@riverpod` `.dart` file has a missing or stale `.g.dart` / `.freezed.dart` counterpart, or unresolved merge conflict markers, forcing the agent to fix them before reporting completion.

### 2. The Verify Ladder (`V0` → `V4`)
| Rung | Vue 3 (Web) | Flutter (Mobile) |
| :--- | :--- | :--- |
| **`V0` (Differential Static)** | `vue-tsc --noEmit` + `eslint` (filtered strictly to modified `.vue`/`.ts` files) | Stale codegen check + `dart format` + `flutter analyze` (filtered to modified `.dart` files) |
| **`V1` / `V2` (Targeted Tests)** | `vitest run <changed_spec.ts>` | `flutter test <changed_test.dart>` |
| **`V3` (Live Runtime & UI)** | `browser` subagent / `chrome-devtools` checks live localhost route & zero `[Vue warn]` in Console | `android-device-hub` (`android layout`, `android screen`, `adb logcat`) checks zero `RenderFlex overflowed` |
| **`V4` (Evidence)** | Browser screenshot + verification table | Emulator screenshot + verification table |

### 3. Specialized Reviewer Fleet Subagents (`agents/`)
- **`vue-reactivity-reviewer`**: Catches direct Pinia destructuring without `storeToRefs()`, prop mutations, infinite route-query watcher loops, and uncleaned event listeners/timers.
- **`vue-ui-a11y-reviewer`**: Audits Loading/Empty/Error/Data states, double-submit protection, semantic HTML/ARIA, and `v-for` key stability.
- **`flutter-lifecycle-memory-reviewer`**: Catches undisposed `TextEditingController` / `ScrollController` / `AnimationController` / `FocusNode` / `StreamSubscription`, missing `if (!context.mounted) return;` after `await`, and `FutureBuilder` anti-patterns inside `build()`.
- **`flutter-ui-performance-reviewer`**: Catches `Vertical viewport was given unbounded height` (`ListView` inside `Column`), `RenderFlex overflowed` in `Row`, and helper methods (`Widget _build...()`) instead of `const` `StatelessWidget` classes.

---

## Installation

Clone this repository directly into your Antigravity global plugins directory:

```bash
git clone https://github.com/Tdao199883/vue-flutter-factory-antigravity.git \
  ~/.gemini/config/plugins/vue-flutter-factory-antigravity
```

Once placed in `~/.gemini/config/plugins/vue-flutter-factory-antigravity`, Antigravity automatically discovers and loads the plugin, its rules, skills, reviewer subagents, and lifecycle hooks.

---

## Usage Commands (via `factory.py`)

You or the agent can also invoke the core engine directly inside any Vue or Flutter workspace:

```bash
# 1. Generate or update .agents/repo-profile.json
python3 ~/.gemini/config/plugins/vue-flutter-factory-antigravity/skills/code-factory-verify/scripts/factory.py profile --cwd "$(pwd)"

# 2. Classify current git diff -> recommended Reviewer Subagents & Verify Rungs
python3 ~/.gemini/config/plugins/vue-flutter-factory-antigravity/skills/code-factory-verify/scripts/factory.py classify --cwd "$(pwd)"

# 3. Run V0 (differential typecheck/lint) & V1 (targeted unit/widget tests)
python3 ~/.gemini/config/plugins/vue-flutter-factory-antigravity/skills/code-factory-verify/scripts/factory.py verify --cwd "$(pwd)"
```
