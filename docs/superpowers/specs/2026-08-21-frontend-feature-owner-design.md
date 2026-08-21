# Frontend Feature Owner Design

## Goal

Change frontend task allocation from platform-based distribution to feature-module ownership. A feature module has exactly one frontend owner for each analysis run. All frontend tasks generated for that module are assigned to that owner.

## User Workflow

1. In the PRD analysis dialog, each feature module retains the existing multi-select frontend control. The selected people form the module's frontend candidate pool.
2. The user may optionally enable backend work and selects one backend owner as today.
3. When analysis starts, the model chooses one frontend owner from the candidate pool using the supplied active workload and relevant skills.
4. The server validates that choice and gives every generated frontend task in the feature module to the chosen owner. The selected backend owner remains the sole owner of generated backend tasks.
5. When a user changes a frontend owner from the workbench, the application changes every non-terminal frontend task in that feature module together. Backend tasks and terminal frontend tasks are not changed.

## Data Model

- `frontendDeveloperIds` remains a non-empty array of valid frontend developer IDs. It is the editable candidate pool, so existing multi-select profiles stay valid.
- Add optional `frontendOwnerId` to the normalized and persisted allocation profile. It records the resolved owner of the latest analysis or a module-level frontend reassignment.
- `includeBackend` and `backendOwnerId` retain their current behavior.
- Existing profiles without `frontendOwnerId` remain readable. Existing tasks are not modified during migration; a new analysis or explicit module-level reassignment establishes the current owner.

## Model Contract

- The analysis response includes a required `frontendOwner` whose value is one of the selected frontend candidates.
- The prompt directs the model to choose that person once for the entire feature based on workload and skills, then to plan all frontend tasks for that one owner.
- The server rejects a missing or non-candidate owner instead of silently substituting one.
- After response validation, the server overwrites every frontend task assignee with the resolved frontend owner. This makes the one-owner rule independent of individual task output variation.
- The backend schema branch remains optional and, when enabled, only permits the selected backend owner.

## UI Changes

- Rename the frontend section from "可用前端人员" to "前端候选人员".
- Add concise supporting text that the model selects one owner from the selected candidates and assigns the complete feature module to that person.
- Keep checkbox multi-select controls. Do not expose a platform-specific frontend allocation control.
- In the workbench, frontend reassignment is a module-level action for active frontend tasks rather than an isolated task change. The UI clearly identifies the selected module and affected active task count before confirmation.

## Failure Handling

- Analysis cannot begin unless a feature has at least one valid frontend candidate and, when backend work is enabled, one valid backend owner.
- Invalid model ownership data fails the analysis before tasks or allocation profiles are saved. The existing failed-analysis status and retry path communicate the error.
- Module-level reassignment validates that the destination developer has frontend discipline. Cross-discipline reassignment remains rejected.

## Compatibility

- Historical completed and cancelled tasks preserve their current assignee.
- Historical active frontend tasks are unchanged until the user deliberately performs a module-level reassignment or reanalyzes the feature.
- The backend feature-owner workflow, duplicate prevention, PRD grouping, and model selection configuration remain unchanged.

## Verification

- Unit-test profile normalization with multiple frontend candidates and one resolved owner, including invalid owner rejection.
- Unit-test model schema, prompt, and result normalization so every frontend task receives the resolved owner.
- Unit-test feature-level frontend reassignment to update all active frontend tasks while preserving backend and terminal tasks.
- Exercise the PRD dialog with multiple frontend candidates and backend enabled, then verify that generated tasks have one frontend owner per feature module.
- Run the full test suite and production build before commit and deployment.
