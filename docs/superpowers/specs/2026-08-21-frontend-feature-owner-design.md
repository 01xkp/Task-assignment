# Frontend Feature Allocation Design

## Goal

Allocate frontend work by functional module rather than by platform ownership. A feature keeps a multi-select frontend candidate pool, and the model may assign individual frontend tasks only among those candidates according to the function, skills, and total current workload. No unique frontend owner is required or persisted.

## User Workflow

1. The PRD analysis dialog provides frontend candidate checkboxes for each selected feature. At least one frontend candidate is required.
2. Backend work is optional. When enabled, the user selects exactly one backend owner, and every generated backend task belongs to that owner.
3. A document's `重新分配` action opens the same PRD analysis dialog in the uploaded-PRD view, with only that document selected and its saved candidate choices prefilled.
4. The user can change frontend candidates and the optional backend setting before starting the analysis. It then uses the normal batch-analysis path, even when only one PRD is selected.

## Data And Model Contract

- `frontendDeveloperIds` is the complete and non-empty frontend candidate pool. It remains multi-select.
- The allocation profile has no `frontendOwnerId`. Historical profiles containing that property are tolerated as unknown legacy data but it is not emitted, read, or used for assignment.
- The model response has `summary` and `tasks`; it has no top-level `frontendOwner` field.
- Frontend task `suggestedAssignee` is constrained to selected frontend candidate names. The server preserves a valid task-level choice and falls back only when the returned name is invalid.
- A model prompt must state that platform responsibility is context for estimating impact, never a rule for splitting or selecting a frontend assignee. It must balance functional cohesion, skills, existing all-platform workload, and workload accumulated inside the current allocation.
- Backend task `suggestedAssignee` remains constrained and normalized to the selected backend owner.

## Failure Handling

- Analysis is disabled until every selected feature has a valid non-empty frontend candidate pool and any enabled backend work has one backend owner.
- A reanalysis does not call the model before the allocation dialog has been completed and its normal validation passes.
- If a model response uses a frontend name outside the selected pool, normalization falls back to the first selected frontend candidate instead of accepting an unselected person.

## Scope Boundaries

- This change does not alter manual task reassignment. It continues to operate on the individual selected task.
- This change does not alter the backend feature-owner workflow, feature deduplication, PRD grouping, or `OPENAI_MODEL` configuration.

## Verification

- Unit-test schema, instructions, and output normalization with two frontend candidates to prove no unique owner is required and valid task-level assignments are retained.
- Unit-test the reanalysis selection state to prove it preselects one clicked PRD while retaining its saved candidate profile.
- Run the full Node test suite, production build, whitespace check, and local browser workflow before commit.
