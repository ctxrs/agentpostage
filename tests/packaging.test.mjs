import assert from 'node:assert/strict'
import { readFile, stat } from 'node:fs/promises'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const root = fileURLToPath(new URL('../', import.meta.url))
const json = async path => JSON.parse(await readFile(resolve(root, path), 'utf8'))
const skill = resolve(root, 'plugins/agentpostage/skills/agentpostage/SKILL.md')

test('Cursor marketplace discovers the canonical skill and its bundled CLI', async () => {
  const marketplace = await json('.cursor-plugin/marketplace.json')
  assert.equal(marketplace.plugins.length, 1)
  const entry = marketplace.plugins[0]
  const pluginRoot = resolve(root, entry.source)
  const plugin = await json(resolve(pluginRoot, '.cursor-plugin/plugin.json'))
  assert.equal(plugin.name, entry.name)
  assert.equal(resolve(pluginRoot, plugin.skills, plugin.name, 'SKILL.md'), skill)
  assert.ok((await stat(skill)).isFile())
  assert.ok((await stat(resolve(dirname(skill), 'scripts/agentpostage.mjs'))).isFile())
})

test('Gemini loads the same instructions and uses a secret-backed HTTPS MCP connection', async () => {
  const extension = await json('gemini-extension.json')
  assert.equal(resolve(root, extension.contextFileName), skill)
  assert.ok((await stat(skill)).isFile())
  const server = extension.mcpServers.agentpostage
  assert.equal(server.httpUrl, 'https://agentpostage.com/mcp')
  assert.equal(server.headers.Authorization, 'Bearer ${AGENTPOSTAGE_API_KEY}')
  const setting = extension.settings.find(item => item.envVar === 'AGENTPOSTAGE_API_KEY')
  assert.equal(setting.sensitive, true)
  assert.equal(server.command, undefined)
  assert.equal(server.trust, undefined)
})
