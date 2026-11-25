---
name: flutter-factory
description: >-
  Specialized Code Factory workflow for Flutter and Dart mobile applications.
  Activate this skill whenever creating, refactoring, debugging, or reviewing
  Flutter widgets, screens, state management (Bloc, Cubit, Riverpod, Provider),
  Freezed/JsonSerializable models, or native Android/iOS configurations.
---

# Flutter (Mobile) Code Factory Workflow

Follow this structured 6-stage factory workflow whenever building or modifying a **Flutter / Dart** application.

---

## Stage 1: Profile & Architecture Discovery

1. Check `.agents/repo-profile.json` (or run `node ~/.gemini/config/plugins/vue-flutter-factory-antigravity/skills/code-factory-verify/scripts/factory.mjs profile --cwd "$(pwd)"`).
2. Respect the repository's existing architecture:
   - **FVM (Flutter Version Management)**: Check `flutter.usesFvm` and `flutter.fvmVersion` in `.agents/repo-profile.json` (or check `.fvmrc` / `.fvm/fvm_config.json`). If FVM is used, ALWAYS run commands via `fvm flutter` and `fvm dart` (or `.fvm/flutter_sdk/bin/flutter`) to avoid SDK version mismatches across machines.
   - **State Management**: `flutter_bloc` (Bloc/Cubit), `flutter_riverpod` (Notifier/AsyncNotifier), `provider`, or `get`.
   - **Code Generation**: Check `pubspec.yaml` for `freezed`, `json_serializable`, `riverpod_generator`, `auto_route_generator`, `injectable_generator`.
   - **Navigation**: `go_router`, `auto_route`, or `Navigator` 1.0/2.0.

---

## Stage 2: Implementation Standards & Hard Guardrails

### A. Generated Files Rule (Enforced by `PreToolUse` Hook)
- **NEVER manually edit** `*.g.dart`, `*.freezed.dart`, `*.gr.dart`, `*.config.dart`, or `*.mocks.dart`.
- Always modify the source `.dart` class and run:
  ```bash
  dart run build_runner build --delete-conflicting-outputs
  ```
- **Do not run `build_runner` after every single file edit**; batch all model/provider edits first, then run `build_runner` once before `V0` verification.

### B. Lifecycle & Memory Safety
- **Dispose Every Controller**: Every `TextEditingController`, `ScrollController`, `PageController`, `TabController`, `AnimationController`, `FocusNode`, and `StreamSubscription` MUST be disposed in `dispose()`:
  ```dart
  @override
  void dispose() {
    _searchController.dispose();
    _scrollController.dispose();
    _subscription?.cancel();
    super.dispose();
  }
  ```
- **Async `BuildContext` Guard**: After any `await` in a Widget or State method, always check `mounted` before touching `context`:
  ```dart
  await ref.read(orderProvider.notifier).cancelOrder(orderId);
  if (!context.mounted) return;
  ScaffoldMessenger.of(context).showSnackBar(
    const SnackBar(content: Text('Order cancelled')),
  );
  Navigator.of(context).pop();
  ```

### C. Layout, Overflow & Rebuild Performance
- **No Helper Widget Methods**: Never write `Widget _buildHeader() { ... }`. Extract a `class _OrderHeader extends StatelessWidget` with a `const` constructor so Flutter can short-circuit rebuilds.
- **Prevent `RenderFlex overflowed`**:
  - Inside a `Row`, wrap dynamic `Text` widgets in `Expanded` or `Flexible` with `overflow: TextOverflow.ellipsis`.
  - Never put an unbounded `ListView` inside a `Column` without wrapping it in `Expanded` / `Flexible`.
  - Wrap forms in `SingleChildScrollView` (or `CustomScrollView`) and respect keyboard insets (`MediaQuery.viewInsetsOf(context).bottom`).
- **4-State Screen Coverage**: Every async screen must cleanly render **Loading** (shimmer/indicator), **Error** (message + Retry button), **Empty** (illustration/message), and **Data** states.

---

## Stage 3: Differential `V0` & `V1` Verification

Run the factory verification script after completing your edits:
```bash
node ~/.gemini/config/plugins/vue-flutter-factory-antigravity/skills/code-factory-verify/scripts/factory.mjs verify --cwd "$(pwd)"
```
- Checks for stale codegen (`*.g.dart` / `*.freezed.dart` older than source `.dart`).
- Runs `dart format` and `flutter analyze` filtered to touched `.dart` files.
- Runs targeted `flutter test <test_file.dart>` for modified features.

---

## Stage 4: Reviewer Fleet Dispatch

For non-trivial Flutter changes, invoke the specialized Reviewer Subagents in parallel:
- `flutter-lifecycle-memory-reviewer` (audits `dispose()`, `context.mounted`, stream/timer leaks, state mutation safety)
- `flutter-ui-performance-reviewer` (audits `RenderFlex overflow` risks, unbounded scrollables, missing `const`, helper widget anti-patterns, `SafeArea`/keyboard handling)

---

## Stage 5: Live Emulator / Device Verification (`V3` & `V4`)

When an Android Virtual Device (AVD) or physical device is active (via `android-device-hub` / `android-cli`):
1. Trigger a Hot Reload / launch the updated screen.
2. Run `android layout` and `android screen` (or check `adb logcat`) to verify:
   - Zero `A RenderFlex overflowed by ... pixels` warnings.
   - Zero `Vertical viewport was given unbounded height` or `FlutterError` exceptions.
3. Capture a device screenshot via `android screen` as `V4` verification evidence.
