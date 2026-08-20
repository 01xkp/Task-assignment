import assert from 'node:assert/strict'
import test from 'node:test'
import { addSelectedFiles, folderMarkdownFiles, relativeFilePath } from '../src/import-file-selection.js'

const file = (name, webkitRelativePath = name, size = 1, lastModified = 1) => ({ name, webkitRelativePath, size, lastModified })

test('keeps nested Markdown files from a selected folder', () => {
  const selected = folderMarkdownFiles([
    file('登录.md', '产品/账户/登录.md'),
    file('readme.MD', '产品/readme.MD'),
    file('notes.txt', '产品/notes.txt'),
  ])

  assert.deepEqual(selected.map(relativeFilePath), ['产品/账户/登录.md', '产品/readme.MD'])
})

test('deduplicates the same relative file while retaining distinct folders', () => {
  const first = file('需求.md', 'A/需求.md', 10, 20)
  const duplicate = file('需求.md', 'A/需求.md', 10, 20)
  const distinct = file('需求.md', 'B/需求.md', 10, 20)

  assert.deepEqual(addSelectedFiles([first], [duplicate, distinct]).map(relativeFilePath), ['A/需求.md', 'B/需求.md'])
})
