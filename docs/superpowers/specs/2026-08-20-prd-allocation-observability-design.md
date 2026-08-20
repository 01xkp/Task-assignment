# PRD Allocation Status and Progress Design

## Goal

Replace ambiguous PRD analysis labels with allocation-oriented labels and make a model allocation request observable from start through completion, failure, or cancellation. Batch allocation must retain its current sequential behavior: a failed PRD is reported and the next selected PRD continues.

## Status Model

The persisted `analysisStatus` values remain machine-oriented. A shared presentation helper maps them consistently across the PRD library, workbench, and batch-selection list.

| Stored value | User-facing label | Meaning |
| --- | --- | --- |
| `ready` | `待分配` | No successful task allocation exists yet. |
| `analyzing` | `分配中` | The server accepted an allocation request and is waiting for model progress or completion. |
| `completed` | `重新分配` | A prior allocation exists; triggering the action replaces only non-terminal matching tasks according to existing reconciliation rules. |
| `failed` | `分配失败` | The last allocation attempt ended in an error, timeout, cancellation, or server interruption. The recorded error is visible in the PRD library. |

`analysisStartedAt`, `analysisFinishedAt`, and a bounded `analysisError` are stored with status changes. Existing `ready` and `completed` records require no migration.

## Server Flow

1. `runPrdAnalysis` marks the PRD `analyzing` in storage before it requests the model.
2. The Responses stream reports every lifecycle event to the analysis caller. `response.created` changes the displayed state from connection setup to “模型已接受请求，正在推理”; text deltas retain the existing draft/review progress ranges.
3. The SSE route emits a heartbeat with the current stage and elapsed wait time whenever no model text has arrived. It never fabricates a higher completion percentage.
4. Successful reconciliation stores `completed`, task count, model trace, and finish time.
5. Any error stores `failed`, finish time, and a concise error message before it reaches the single-PRD or batch SSE error event. A client disconnect still aborts the active model request; the final stored state records that attempt as failed.

The existing per-stage 6-minute model timeout remains unchanged. With review enabled, a PRD retains its current overall maximum of two stages plus the existing grace period.

## Client Behavior

- All PRD status chips use the shared label helper rather than local `completed ? ... : ...` expressions.
- A PRD with `analyzing` disables its action and displays `分配中`; a completed or failed PRD offers `重新分配`.
- The single-PRD floating progress panel shows accepted-request and heartbeat wording, together with elapsed time and the current model/stage.
- The batch modal shows the selected item number, title, model progress, and completed/failed outcomes. It continues to receive later items after an earlier failure.
- After any allocation finishes, the client reloads workspace state so the persisted status is authoritative.

## Validation

Automated coverage will verify the status-label mapping, lifecycle event mapping, failure persistence, and sequential batch continuation. Local verification will run the complete test suite and production build, then use the configured model for a non-persistent allocation-path probe that exercises the same request shape without writing tasks to `data/workspace.json`.
