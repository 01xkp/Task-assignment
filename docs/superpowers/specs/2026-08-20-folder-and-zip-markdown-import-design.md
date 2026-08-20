# Folder And ZIP Markdown Import Design

## Scope

The PRD import modal supports recursive Markdown import from either a local
folder or a ZIP archive. Both sources use the existing batch upload, Markdown
parsing, content-based deduplication, newest-first ordering, and optional batch
analysis flows.

Only `.md` files are collected. Existing PDF, DOCX, TXT, JSON, URL, and pasted
text import behaviors remain unchanged.

## User Flow

- The local-file import tab keeps the current multi-file picker.
- A **Select folder** action opens a native directory picker. The browser
  returns files from nested directories; the client keeps only Markdown files.
- An **Import ZIP** action accepts one ZIP file. Its Markdown entries are
  discovered and parsed on the server.
- The selected-file list shows relative paths for folder files and ZIP entries,
  so equally named documents from different directories are distinguishable.
- The existing result screen reports imported, duplicate, and failed documents.
  A document with duplicate body text is not stored again regardless of whether
  it originated from a file, folder, or archive.

Folder selection relies on the browser directory-picker attribute. Browsers
without this capability continue to offer the ordinary multi-file picker and
ZIP import.

## Data Flow

Folder selection produces browser `File` values with relative paths. The client
filters paths ending in `.md` case-insensitively, removes duplicate selections
by relative path, size, and modification time, and submits the selected files
through the existing multipart batch endpoint.

ZIP import uploads the archive to that endpoint as a dedicated archive field.
The server reads archive entries in memory, rejects unsafe or unsupported
entries, and converts valid Markdown entries into the same parsed-document
shape used by uploaded files. Archive paths are treated as labels only; they are
never written to the server filesystem or used as filesystem paths.

The storage layer receives one combined list of parsed documents. Its existing
content fingerprint is therefore the single deduplication rule across ordinary
files, folders, and ZIP archives.

## Limits And Errors

- A request may contain at most 100 Markdown documents after folder and archive
  expansion.
- Each Markdown document remains limited to 10 MB.
- The ZIP upload itself remains limited to 10 MB before extraction.
- ZIP extraction is limited to 50 MB of total uncompressed Markdown content.
- Encrypted, corrupt, empty, or over-limit archives fail with a clear,
  user-visible error. Non-Markdown archive entries are skipped.
- A selected folder or archive that contains no Markdown documents reports that
  condition without creating PRDs.
- Per-document parser failures remain isolated: valid documents in the same
  request are imported and failed documents are listed in the existing results
  UI.

## Components

- `src/components/ImportPrdModal.vue` owns the two new selection controls,
  relative-path presentation, and client-side folder filtering.
- `src/api.js` submits folder files and an optional ZIP field to the existing
  PRD upload endpoint.
- `server/index.js` accepts the archive field and combines its parsed entries
  with normal uploaded files before storage.
- A focused archive parser module owns ZIP entry validation, resource limits,
  Markdown extraction, and parser-facing file metadata.

## Verification

- Unit-test recursive folder-file selection and case-insensitive Markdown
  filtering.
- Unit-test ZIP extraction for nested Markdown entries, non-Markdown skips,
  corrupt archives, empty archives, document-count limits, and uncompressed-size
  limits.
- Verify ordinary files, folder files, and archive entries share content
  deduplication and preserve relative-path labels.
- Run the full test suite and production build. Manually verify folder and ZIP
  import in a Chromium browser, including result messages for duplicates and
  failures.
