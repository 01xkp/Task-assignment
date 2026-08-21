# Backend Feature Owner and Frontend Availability Design

## Goal

Extend PRD analysis so each feature module can be allocated to a selected set of
available frontend developers and, optionally, to one backend owner. Backend work
is owned by feature module rather than split by platform or source PRD.

The feature keeps existing PRD import, feature-module deduplication, model review,
task workbench, and manual reassignment behavior intact.

## Team Model

The developer definitions gain a `discipline` field with values `frontend` and
`backend`.

- Existing three Flutter developers remain frontend developers.
- `舒杰` and `陈远志` are Go backend developers with a 40-hour weekly capacity.
- All active task hours, independent of discipline, contribute to each person's
  workload shown to the allocator and workbench.

## Per-Feature Allocation Profile

Each feature module has an allocation profile persisted to every source PRD in
that module:

```json
{
  "frontendDeveloperIds": ["frontend-a", "frontend-b"],
  "includeBackend": true,
  "backendOwnerId": "backend-a"
}
```

Rules:

1. `frontendDeveloperIds` contains unique IDs for one or more valid frontend
   developers.
2. `includeBackend` defaults to `false`.
3. When `includeBackend` is `true`, `backendOwnerId` is required and must name a
   valid backend developer.
4. When `includeBackend` is `false`, no backend task may be generated; an empty
   backend owner value is persisted.
5. PRDs saved before this feature have no profile. They behave as if all existing
   frontend developers were selected and backend work was disabled.

The profile is keyed by the existing stable `featureKey`, so two imported PRDs
grouped into the same feature always use the same decisions. Batch analysis sends
a profile per feature rather than one profile for the entire batch.

## Analysis Interface

`ImportPrdModal.vue` shows controls for each detected feature module.

- A frontend multi-select starts with all frontend developers selected and
  requires at least one selection.
- The `包含后端任务` switch starts disabled.
- Enabling it reveals a required single-select containing only `舒杰` and
  `陈远志`.
- Selection is made per feature module, including modules inferred from a folder
  or ZIP upload; unrelated PRDs in the same batch can select different backend
  owners.

Existing analysis data retains its profile. `重新分配` uses the persisted profile
instead of asking the model to invent a new team. Changing the profile is done by
selecting the feature again in `分析新需求` and saving a new analysis result.

## Server and Model Flow

The client includes `allocationProfiles` keyed by `featureKey` in batch analysis
requests. Single-feature analysis carries its equivalent profile. The server
normalizes legacy input, validates every profile against the developer roster,
and passes the validated profile to feature analysis.

The model schema and prompts are constructed from that profile:

- Frontend task assignees are limited to the selected frontend developers.
- When backend is enabled, backend tasks are limited to the single selected
  backend owner.
- When backend is disabled, backend tasks are prohibited.
- Tasks gain `deliveryType: "frontend" | "backend"`.
- Backend tasks use the `后端实现` work type and a `服务端` platform marker.

The review pass uses the same limits and removes duplicate work across the source
PRDs belonging to one feature. General Go service context may be supplied as
domain guidance: handler/service/repository layering, `internal/modules/*`,
migrations under `internal/db/migrations`, and APIs under `cmd/api`. The reference
backend repository is illustrative only; its paths are not requirements for a
generated PRD task.

## Allocation and Reassignment

The allocation and reassignment logic is discipline-safe.

- Backend tasks may select only backend candidates. Tasks from one feature module
  remain with its chosen backend owner during initial generation.
- Frontend tasks may select only the profile's available frontend candidates.
- If a platform's normal frontend owner is unavailable, its work is allocated
  among the selected frontend developers, preferring matching skills or platform
  ownership and then the lowest current active workload.
- Manual reassignment preserves discipline boundaries: a backend task cannot be
  reassigned to a frontend developer, and a frontend task cannot be reassigned to
  a backend developer.

The task workbench loads all five developers and groups backend tasks under
`后端实现`, while preserving current feature-module parent and child category
rendering.

## Errors and Compatibility

Invalid analysis requests receive an actionable validation error rather than
starting a model call. This includes an empty frontend selection, duplicate or
unknown IDs, a frontend ID supplied as a backend owner, or enabled backend work
without an owner.

No migration of stored data is required. Read paths normalize missing allocation
profiles and missing `deliveryType` values to the existing frontend behavior.

## Verification

Tests are added before implementation for:

1. Allocation-profile defaults, normalization, and validation.
2. Stable per-feature profile mapping in batch analysis.
3. Model schema and prompt limits for allowed assignees and backend opt-in.
4. One-backend-owner binding per feature module.
5. Frontend redistribution when a platform owner is unavailable.
6. Discipline-safe reassignment and active-workload accounting.
7. Backend task grouping and legacy PRD compatibility.

Completion requires the focused test suite, full `npm test`, `npm run build`,
`git diff --check`, and a local browser verification of the analysis form and the
resulting workbench tasks.
