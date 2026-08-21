# Frontend Feature Allocation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let reanalysis collect personnel choices first and allocate frontend tasks among the selected multi-select candidate pool without a unique owner requirement.

**Architecture:** The existing `ImportPrdModal` remains the single allocation editor. `App.vue` opens it in library mode with a selected PRD ID for reanalysis. The server's existing task-level assignee schema is retained for frontend candidates, while backend continues to be normalized to its selected owner.

**Tech Stack:** Vue 3, Express 5, Node.js built-in test runner, JSON Schema Responses API integration.

---

### Task 1: Restore The Frontend Candidate-Pool Contract

**Files:**
- Modify: `shared/allocation-profile.js`
- Modify: `src/feature-allocation-state.js`
- Modify: `server/model.js`
- Modify: `server/index.js`
- Test: `tests/allocation-profile.test.js`
- Test: `tests/feature-allocation-state.test.js`
- Test: `tests/model-allocation.test.js`

- [ ] **Step 1: Write failing tests**

Add a normalization test that an input profile containing `frontendOwnerId` returns only the normal candidate and backend fields. In `tests/model-allocation.test.js`, assert `schema.required` equals `['summary', 'tasks']`, that no `frontendOwner` property exists, and that two valid frontend task assignees are preserved:

```js
const result = normalizeAllocationForProfile({
  summary: '邀请码注册',
  tasks: [frontendTask({ suggestedAssignee: '向坤朋' }), frontendTask({ suggestedAssignee: '曾雨秋' })],
}, frontendCandidatesProfile, developers)

assert.deepEqual(result.tasks.map((task) => task.suggestedAssignee), ['向坤朋', '曾雨秋'])
```

- [ ] **Step 2: Verify failing tests**

Run: `node --test tests/allocation-profile.test.js tests/feature-allocation-state.test.js tests/model-allocation.test.js`

Expected: failures that show the old unique-owner schema or normalization is still active.

- [ ] **Step 3: Implement the minimal contract**

Remove `frontendOwnerId` from normalized profile output and client editing state. In `server/model.js`, remove the top-level owner schema, owner resolution, and assignee overwrite. Return the normalized candidate-only profile from `normalizeAllocationForProfile`. Restore instructions that frontend tasks must stay inside the selected candidate pool and must be assigned by functional cohesion, skills, and all-platform workload rather than platform ownership. Keep `server/index.js` storing the normalized result profile.

- [ ] **Step 4: Verify green**

Run: `node --test tests/allocation-profile.test.js tests/feature-allocation-state.test.js tests/model-allocation.test.js`

Expected: all specified tests pass, including selected-backend-only behavior.

### Task 2: Open Personnel Selection For Reanalysis

**Files:**
- Modify: `src/components/ImportPrdModal.vue`
- Modify: `src/App.vue`
- Test: `tests/import-modal-state.test.js`

- [ ] **Step 1: Write failing modal-state test**

Export a pure helper that produces unique, existing initial library selections. Test that `['prd-a']` selects only `prd-a`, while missing and duplicate IDs are ignored.

- [ ] **Step 2: Verify failing test**

Run: `node --test tests/import-modal-state.test.js`

Expected: failure because the helper and modal preselection input do not exist.

- [ ] **Step 3: Implement reanalysis preselection**

Add an optional `initialPrdIds` prop to `ImportPrdModal`. In library mode, initialize `selectedPrdIds` with valid IDs from that prop, then let the current profile watcher preload persisted personnel settings. In `App.vue`, replace the direct `api.analyzePrd` call with `openImport('library', [prd.id])`; retain the existing batch-analysis events and progress rendering.

- [ ] **Step 4: Verify green and build**

Run: `node --test tests/import-modal-state.test.js && npm run build`

Expected: test passes and Vite exits 0.

### Task 3: End-To-End Verification And Commit

**Files:**
- Verify: `src/App.vue`
- Verify: `src/components/ImportPrdModal.vue`
- Verify: `server/model.js`
- Verify: `server/index.js`

- [ ] **Step 1: Run automated verification**

Run: `npm test && npm run build && git diff --check`

Expected: all tests pass, the production bundle builds, and Git reports no whitespace errors.

- [ ] **Step 2: Verify the browser workflow**

Run the local application and click `重新分配` on a PRD. Confirm the uploaded-PRD dialog opens with that PRD selected, frontend checkboxes can select several people, the backend toggle still requires exactly one backend owner when enabled, and starting analysis uses the standard progress view.

- [ ] **Step 3: Commit**

```powershell
git add shared/allocation-profile.js src/feature-allocation-state.js server/model.js server/index.js src/App.vue src/components/ImportPrdModal.vue tests/allocation-profile.test.js tests/feature-allocation-state.test.js tests/model-allocation.test.js tests/feature-allocation-state.test.js docs/superpowers/specs/2026-08-21-frontend-feature-owner-design.md docs/superpowers/plans/2026-08-21-frontend-feature-owner.md
git commit -m "fix: select personnel before reanalyzing PRDs"
```
