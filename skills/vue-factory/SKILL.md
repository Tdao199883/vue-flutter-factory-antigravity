---
name: vue-factory
description: >-
  Specialized Code Factory workflow for Vue 3, Nuxt, Vite, Pinia, and TypeScript
  web applications. Activate this skill whenever creating, refactoring, debugging,
  or reviewing Vue 3 components (.vue), composables, Pinia stores, or Vue Router
  views.
---

# Vue 3 (Web) Code Factory Workflow

Follow this structured 6-stage factory workflow whenever building or modifying a **Vue 3 / Nuxt** web application.

---

## Stage 1: Profile & Context Discovery

1. Check `.agents/repo-profile.json` (or run `python3 ~/.gemini/config/plugins/vue-flutter-factory-antigravity/skills/code-factory-verify/scripts/factory.py profile --cwd "$(pwd)"`).
2. Identify:
   - UI library (`Element Plus`, `Vuetify`, `Naive UI`, `Radix Vue / shadcn-vue`, `Tailwind CSS`)
   - State layer (`Pinia` vs composable state)
   - Auto-import configuration (`unplugin-auto-import` / `unplugin-vue-components` — never edit `auto-imports.d.ts` or `components.d.ts` by hand)
3. Consult `modern-web-guidance` when building dialogs, popovers, forms, tables, or CSS layouts.

---

## Stage 2: Implementation Standards (Guardrails)

When authoring or editing `.vue` and `.ts` files:

### A. `<script setup lang="ts">` Contracts
```vue
<script setup lang="ts">
interface Props {
  orderId: string
  initialStatus?: 'pending' | 'delivered' | 'cancelled'
}

const props = withDefaults(defineProps<Props>(), {
  initialStatus: 'pending',
})

const emit = defineEmits<{
  updated: [orderId: string, status: string]
  cancel: [orderId: string]
}>()
</script>
```

### B. Pinia & Reactivity Safety
- **Always use `storeToRefs`** when extracting state or getters from a Pinia store:
  ```ts
  const orderStore = useOrderStore()
  const { items, isLoading, error } = storeToRefs(orderStore) // Reactive!
  const { fetchOrders, updateOrder } = orderStore // Actions destructured directly
  ```
- **Never mutate props**: Either emit an update event or use `const modelValue = defineModel<string>()`.
- **Derived State**: Use `computed(() => ...)` instead of syncing two `ref`s with `watch()`.
- **Side-effect Cleanup**: Every `setInterval`, `setTimeout`, `AbortController`, or `window.addEventListener` inside a component or composable must be cleaned up inside `onUnmounted` or `onWatcherCleanup`.
- **URL Query & Filter Sync**: Debounce user text inputs (300ms) before triggering API calls or `router.replace({ query: ... })`, and guard watchers against infinite feedback loops between route query and store state.

### C. Complete UI State Matrix
Every data-driven component or view must explicitly handle:
1. **Loading**: Skeleton or spinner (`aria-busy="true"`), disable submit buttons during inflight mutations.
2. **Error**: Clear error message with a **Retry** action button.
3. **Empty**: Friendly empty state when filters return zero items (with a "Clear filters" action if filtered).
4. **Data**: Accessible semantic markup with proper keyboard navigation.

---

## Stage 3: Differential `V0` & `V1` Verification

Run the factory verification script before concluding your edits:
```bash
python3 ~/.gemini/config/plugins/vue-flutter-factory-antigravity/skills/code-factory-verify/scripts/factory.py verify --cwd "$(pwd)"
```
- Fixes any `vue-tsc --noEmit` template type errors or `eslint` violations introduced in your diff.
- Runs targeted `vitest` unit/component tests for affected files.

---

## Stage 4: Reviewer Fleet Dispatch

For non-trivial changes (2+ files or >40 lines changed in `.vue`/`.ts`), dispatch:
- `vue-reactivity-reviewer` (checks reactivity loss, memory leaks, infinite watcher loops, TypeScript contract gaps)
- `vue-ui-a11y-reviewer` (checks UI state completeness, accessibility, responsive layout, LCP/CLS pitfalls)

---

## Stage 5: Live Browser Verification (`V3` & `V4`)

When a local dev server is running (or can be started):
1. Invoke the `browser` subagent (or use `chrome-devtools` skill) on the target localhost URL.
2. Exercise the new UI controls (e.g., filtering, submitting a form, opening a modal).
3. Inspect the browser Console to confirm **zero `[Vue warn]`** and zero uncaught runtime/network errors.
4. Capture a screenshot as `V4` verification evidence.
