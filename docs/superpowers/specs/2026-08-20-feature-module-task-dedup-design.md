# Feature Module Task Deduplication Design

## Goal

Treat multiple PRD files for one business feature as one allocation unit. The workbench must show one feature-module parent, generate one non-duplicated task set for that feature, and retain each source PRD for traceability.

## Problem

The current system assigns tasks and deduplicates them only within a single `prdId`. A folder such as `内测邀请码注册-v2/` can contain a developer guide, delivery note, metadata, and acceptance document for the same function. Each is analyzed independently, so the workbench renders separate PRD parents and overlapping tasks.

## Feature Identity

For file and ZIP imports with a relative source path, the first directory segment is the feature identity. The display name removes an optional version suffix such as `-v2`; the normalized original segment is retained as a stable `featureKey`.

Examples:

- `内测邀请码注册-v2/内测邀请码注册-开发阅读版-v2.md`
- `内测邀请码注册-v2/内测邀请码注册-负责人验收-v2.md`

Both resolve to the `内测邀请码注册-v2` key and display as `内测邀请码注册`. Files without a directory, pasted text, and URL imports use an identity unique to that PRD so unrelated requests are never merged implicitly.

## Data Model

Each PRD stores `featureKey` and `featureName` at import time, with a read-time fallback for legacy PRDs. New feature tasks store `featureKey` and `sourcePrdIds` in addition to the legacy primary `prdId`, which keeps existing task actions compatible while exposing all source documents for the module.

Existing data is not deleted during migration. Its feature identity is derived from the PRD source path. This immediately makes the four invitation-registration PRDs a single workbench parent; a module-level reallocation replaces its non-terminal task set with one combined result. Completed and cancelled tasks remain as historical records.

## Allocation Flow

The batch endpoint groups selected PRDs by `featureKey`. It sends the documents of each feature group to one model analysis request with source boundaries and instructs the model to produce one complete task set without per-document repetition. Progress remains sequential, but counters report feature modules rather than individual duplicate documents.

The task reconciler becomes feature-scoped. It replaces active tasks for the feature, preserves terminal tasks, and removes repeated candidate fingerprints before saving. A reallocation started from any PRD in a feature expands to all PRDs in the same feature, so the current invitation-registration group can be cleaned up with one action.

## Workbench

The list view groups tasks by feature module rather than PRD. The parent shows the feature display name, last update time, source-document count, and task count. Its child categories remain `共享实现`, `平台适配`, and `平台验收`. Existing filters continue to operate on the contained task set.

## Safety And Verification

Only a shared imported-directory identity causes automatic merging. The system never merges different folders solely because words in their titles are similar. Tests cover feature identity derivation, batch grouping, feature-scoped reconciliation, legacy fallback, and workbench rendering. Browser verification uses four `内测邀请码注册-v2` source files and confirms one parent and one regenerated task set.
