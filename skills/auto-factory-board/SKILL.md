---
name: auto-factory-board
description: >-
  Autonomous Jira / Issue Board orchestrator ("auto-factory board") for Vue 3 and
  Flutter projects on Google Antigravity. Fetches tickets from a Jira board, sprint,
  or issue list (via twg-jira), builds a file-overlap conflict matrix, dispatches
  isolated parallel subagents (Workspace: "share" worktrees) through the full
  Vue/Flutter Code Factory Verify Ladder (V0-V4), and prepares verified commits/PRs.
  Activate whenever the user mentions "auto-factory", "auto-factory board", running
  the factory across a Jira board/sprint, or batch-executing multiple Jira tickets.
---

# Auto-Factory Board Orchestrator (Jira & Parallel Worktrees)

This skill brings the **`auto-factory board`** workflow to **Google Antigravity**, combining your installed **`twg` / `twg-jira`** Atlassian integration, Antigravity's native isolated workspaces (`Workspace: "share"`), and the **Vue 3 & Flutter Code Factory Verify Ladder (`V0` → `V4`)**.

---

## Phase 1: Board Intake & Ticket Discovery

1. **Ensure Repository Profile Exists**:
   ```bash
   node ~/.gemini/config/plugins/vue-flutter-factory-antigravity/skills/code-factory-verify/scripts/factory.mjs profile --cwd "$(pwd)"
   ```
2. **Fetch Candidate Tickets from Jira**:
   - Activate the `twg` and `twg-jira` skills.
   - Determine the target scope from the user's prompt:
     - **Specific ticket keys** (e.g., `C2P3-111, C2P3-112`) → fetch each issue's summary, description, and Acceptance Criteria (AC).
     - **Current branch ticket** → run `node .../factory.mjs board-status --cwd "$(pwd)"` to auto-extract the Jira key (e.g., `C2P3-111`) from the current branch or folder name, then fetch that ticket via `twg-jira`.
     - **Active Jira Board / Sprint** → query the user's assigned or "To Do" / "Ready for Dev" workitems in the current sprint/board via `twg-jira`.

---

## Phase 2: Triage, Conflict Matrix & User Confirmation

Before spawning autonomous worker subagents, analyze the candidate tickets and present a **Factory Board Plan** table to the user:

| Jira Key | Summary | Target Stack (`Vue` / `Flutter`) | Estimated Touched Modules | Execution Mode |
| :--- | :--- | :--- | :--- | :--- |
| `PROJ-101` | Add status filter to OrderList | Vue 3 (`src/views/orders/`) | `OrderList.vue`, `useOrderStore.ts` | **Parallel Drive #1** (`Workspace: "share"`) |
| `PROJ-102` | Fix crash on Profile avatar upload | Flutter (`lib/features/profile/`) | `profile_screen.dart`, `profile_cubit.dart` | **Parallel Drive #2** (`Workspace: "share"`) |
| `PROJ-103` | Export orders to CSV | Vue 3 (`src/views/orders/`) | `OrderList.vue` (overlaps `PROJ-101`) | **Sequential** (runs after `PROJ-101`) |

- **Collision Rule**: Tickets that touch overlapping files or shared state stores MUST be scheduled **sequentially**. Tickets touching disjoint modules/stacks can run **in parallel** using isolated workspaces (`Workspace: "share"`).
- **Ask for Confirmation**: If running 2+ tickets or mutating branches/Jira status, ask the user to confirm which tickets from the table to dispatch. (If the user explicitly asked to run a single known ticket immediately, proceed directly.)

---

## Phase 3: Autonomous Execution Pipeline (Per Ticket)

Use `update_steps` to display a live checklist of the board tickets being processed.

For **single-ticket mode**, execute directly in the current workspace (or a dedicated feature branch `feat/<JIRA-KEY>`).
For **multi-ticket parallel board mode**, spawn one `self` subagent per independent ticket using `invoke_subagent` with `Workspace: "share"` (or orchestrate them via `run_workflow`):

Each ticket drive MUST follow this strict 6-step contract:

1. **Branch & Context Setup**:
   - Checkout or create branch `feat/<JIRA-KEY>` (or `fix/<JIRA-KEY>` for bugs).
   - Parse every bullet of the Jira ticket's **Acceptance Criteria (AC)** into a verification checklist.
2. **Implementation (`vue-factory` / `flutter-factory`)**:
   - Implement the required changes adhering to `rules/AGENTS.md`.
   - Never touch generated files (`*.g.dart`, `*.freezed.dart`, `auto-imports.d.ts`). Run `dart run build_runner build --delete-conflicting-outputs` once after Dart model edits.
3. **Verify Ladder `V0` & `V1` (Differential Static & Targeted Tests)**:
   ```bash
   node ~/.gemini/config/plugins/vue-flutter-factory-antigravity/skills/code-factory-verify/scripts/factory.mjs verify --cwd "$(pwd)"
   ```
   - Loop and self-fix until `V0` (`vue-tsc`/`eslint` or `flutter analyze`/`dart format`) and `V1` (`vitest` or `flutter test`) report `PASS`.
4. **Smart-Tiered Reviewer Fleet Dispatch**:
   - Run `factory.mjs classify --cwd "$(pwd)"`.
   - If the diff is **non-trivial** (2+ files or >40 changed lines), invoke the recommended Reviewer Subagents (`vue-reactivity-reviewer`, `vue-ui-a11y-reviewer`, `flutter-lifecycle-memory-reviewer`, `flutter-ui-performance-reviewer`) and fix any `[CRITICAL]` or `[HIGH]` findings (bounded to max 2 rounds).
   - If the diff is **trivial** (<40 lines, single file, no state/async lifecycle changes), skip the Reviewer Fleet to save tokens.
5. **Live Runtime & Visual Check (`V3`) + AC Sign-off (`V4`)**:
   - Verify live UI via `browser` subagent / `chrome-devtools` (for Vue) or `android-device-hub` (for Flutter) when a server/emulator is active.
   - Check off every Jira **Acceptance Criterion** against the actual diff.
6. **Conventional Commit**:
   - Stage changes and commit using the Jira key:
     `feat(<JIRA-KEY>): <concise summary>` or `fix(<JIRA-KEY>): <concise summary>`.

---

## Phase 4: Board Summary & Optional Jira Sync

When all dispatched ticket drives complete, present the **Auto-Factory Board Report**:

```markdown
### 🏭 Auto-Factory Board Execution Report

| Jira Key | Branch / Commit | V0 (Static) | V1 (Tests) | Reviewer Fleet | V3 (Live UI) | AC Coverage | Status |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **C2P3-111** | `feat/C2P3-111` (`a1b2c3d`) | ✅ PASS | ✅ PASS | ✅ PASS | ✅ PASS | 4/4 ACs | **READY FOR PR** |
```

- **Safe Jira Mutation Rule**: Never transition a Jira ticket status or post a comment to Jira without asking the user first:
  *"Bạn có muốn mình đẩy nhánh lên remote, cập nhật báo cáo Verify này vào comment của ticket `<JIRA-KEY>` và chuyển trạng thái Jira sang In Review không?"*
