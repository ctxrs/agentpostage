import assert from 'node:assert/strict'
import { readFile, readdir, stat } from 'node:fs/promises'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const root = fileURLToPath(new URL('../', import.meta.url))
const json = async path => JSON.parse(await readFile(resolve(root, path), 'utf8'))
const skill = resolve(root, 'plugins/agentpostage/skills/postage/SKILL.md')

test('all plugins discover only the postage skill with matching folder and frontmatter', async () => {
  const pluginRoot = resolve(root, 'plugins/agentpostage')
  for (const client of ['codex', 'claude', 'cursor']) {
    const plugin = await json(resolve(pluginRoot, `.${client}-plugin/plugin.json`))
    assert.deepEqual(await readdir(resolve(pluginRoot, plugin.skills)), ['postage'])
  }
  assert.match(await readFile(skill, 'utf8'), /^---\nname: postage\n/)
})

test('Cursor marketplace discovers the canonical skill and its bundled CLI', async () => {
  const marketplace = await json('.cursor-plugin/marketplace.json')
  assert.equal(marketplace.plugins.length, 1)
  const entry = marketplace.plugins[0]
  const pluginRoot = resolve(root, entry.source)
  const plugin = await json(resolve(pluginRoot, '.cursor-plugin/plugin.json'))
  assert.equal(plugin.name, entry.name)
  assert.equal(resolve(pluginRoot, plugin.skills, 'postage', 'SKILL.md'), skill)
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

test('portable plugin discovers its skill, remote MCP and square bundled icon without embedded credentials', async () => {
  const pluginRoot = resolve(root, 'plugins/agentpostage')
  const plugin = await json(resolve(pluginRoot, 'plugin.json'))
  assert.equal(plugin.$schema, 'https://agent-plugins.org/schemas/1.0.0/plugin.schema.json')
  assert.equal(plugin.name, 'agentpostage')
  assert.deepEqual(await readdir(resolve(pluginRoot, 'skills')), ['postage'])
  const mcp = await json(resolve(pluginRoot, 'mcp.json'))
  assert.deepEqual(mcp.mcpServers, { agentpostage: { type: 'streamable-http', url: 'https://agentpostage.com/mcp' } })
  const ui = plugin.extensions['com.openai'].interface
  for (const field of ['websiteURL', 'supportURL', 'privacyPolicyURL', 'termsOfServiceURL']) {
    const url = new URL(ui[field])
    assert.equal(url.protocol, 'https:')
    assert.equal(url.username + url.password, '')
  }
  for (const field of ['logo', 'composerIcon']) {
    const icon = await readFile(resolve(pluginRoot, ui[field]), 'utf8')
    const dimensions = /viewBox="0 0 (\d+) (\d+)"/.exec(icon)
    assert.ok(dimensions)
    assert.equal(dimensions[1], dimensions[2])
    assert.ok(Number(dimensions[1]) >= 48)
  }
  assert.ok((await stat(resolve(pluginRoot, 'LICENSE'))).isFile())
})
