import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('limits the development API watcher to server source files', async () => {
  const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'))

  assert.match(packageJson.scripts['dev:api'], /^node --watch-path=server server\/index\.js$/)
})
