# Vue 3 & Flutter Code Factory Rules

You are operating inside the **Vue 3 (Web) & Flutter (Mobile) Code Factory** quality-enforcement framework. Apply these rules whenever working in a Vue/TypeScript or Flutter/Dart project.

---

## 1. Universal Code Factory Principles

1. **Repository Profile First**: At the start of a task, check `.agents/repo-profile.json` if it exists (or generate it via `code-factory-verify` skill) so you do not re-derive the stack, state manager, router, or test runner from scratch.
2. **Generated Files Are Read-Only & FVM Awareness**:
   - **Flutter / Dart (FVM First)**: Always check if the project uses **FVM** (`.fvmrc` or `.fvm/fvm_config.json` or `.agents/repo-profile.json` `flutter.usesFvm`). When FVM is present, ALWAYS prefix Flutter/Dart commands with `fvm` (`fvm flutter ...`, `fvm dart ...`, or use `.fvm/flutter_sdk/bin/flutter`) so the project's pinned SDK version is used instead of the global Flutter version.
   - **Flutter / Dart Codegen**: NEVER directly edit `*.g.dart`, `*.freezed.dart`, `*.gr.dart`, `*.config.dart`, or `*.mocks.dart`. Edit the source `.dart` file and run `fvm dart run build_runner build --delete-conflicting-outputs` (or `dart run build_runner...` if not using FVM).
   - **Vue / Web**: NEVER directly edit `auto-imports.d.ts`, `components.d.ts`, `.nuxt/**`, or `dist/**`.
3. **Verify Ladder (`V0` → `V4`) Before Finalizing**:
   - **`V0` (Static & Types)**: Run differential typechecking and linting (`vue-tsc --noEmit` + `eslint` for Vue; `flutter analyze` + `dart format` for Flutter). Only block on issues in touched files.
   - **`V1`/`V2` (Targeted Tests)**: Run unit/component/widget tests covering the modified files (`vitest run <spec>` or `flutter test <test_file>`).
   - **`V3` (Live Runtime & Visual Verification)**:
     - For **Vue Web UI changes**: Delegate to the `browser` subagent or `chrome-devtools` skill to verify the live route, check for `[Vue warn]` or uncaught Console errors, and test interactive flows.
     - For **Flutter Mobile UI changes**: Use `android-device-hub` (`android layout`, `android screen`, `adb logcat`) or `compose-preview` when an emulator/device is active to verify there are no `RenderFlex overflowed` or runtime `FlutterError` exceptions.
   - **`V4` (Evidence)**: Attach verification summaries and screenshots when completing UI tasks.

---

## 2. Vue 3 (Web) Engineering Standards (`*.vue`, `*.ts`)

- **Script Setup & TypeScript**: Always use `<script setup lang="ts">`. Use type-based declarations for `defineProps<Props>()`, `defineEmits<{ ... }>()`, and `defineModel<T>()`.
- **Reactivity Preservation**:
  - NEVER destructure a Pinia store directly (`const { count } = useCounterStore()` breaks reactivity). Always wrap state/getters with `storeToRefs(store)` and destructure actions directly from `store`.
  - Avoid mutating props directly; emit events or use `defineModel()`.
  - Prefer `computed()` over `watch()` for derived state. When using `watch` or event listeners / timers (`setInterval`, `window.addEventListener`), always clean up in `onUnmounted` or `onWatcherCleanup`.
- **UI States & Accessibility**: Every asynchronous view or form must handle **Loading**, **Empty**, **Error (with retry)**, and **Success** states, and follow semantic HTML / ARIA guidelines (`modern-web-guidance` & `a11y-debugging`).

---

## 3. Flutter (Mobile) Engineering Standards (`*.dart`)

- **Widget Tree & Rebuild Performance**:
  - Use `const` constructors everywhere possible.
  - Extract reusable or complex UI sections into separate `StatelessWidget` / `StatefulWidget` classes (`class _OrderCard extends StatelessWidget`) rather than helper methods (`Widget _buildOrderCard()`), preventing unnecessary full-tree rebuilds.
  - Always use `.builder` constructors (`ListView.builder`, `GridView.builder`, `SliverList.builder`) for dynamic or unbounded lists.
  - Never place an unbounded `ListView` inside a `Column` or `SingleChildScrollView` without `Expanded`, `Flexible`, or `shrinkWrap: true` + `NeverScrollableScrollPhysics()`.
- **Lifecycle & Async Safety**:
  - Every `TextEditingController`, `ScrollController`, `AnimationController`, `TabController`, `FocusNode`, `PageController`, and `StreamSubscription` created in a `State` or notifier MUST be disposed/canceled in `dispose()`.
  - After every `await` inside a widget method, guard any `BuildContext` usage (`Navigator.of(context)`, `ScaffoldMessenger.of(context)`, `showDialog`) with `if (!context.mounted) return;`.
- **Responsive Layout & Overflow Prevention**:
  - Wrap text inside rows with `Expanded` or `Flexible` and specify `overflow: TextOverflow.ellipsis` to prevent `RenderFlex overflowed` errors on narrow screens or large system font scales.
  - Respect safe areas (`SafeArea`) and keyboard insets (`MediaQuery.viewInsetsOf(context).bottom`).
