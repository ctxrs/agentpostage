# Connect your agent

Create a verified account and API key at [Connect](https://agentpostage.com/connect/) and fund it at [Billing](https://agentpostage.com/billing/). Supply `AGENTPOSTAGE_API_KEY` through your runtime's environment or secret store. Restart an already-running app after changing its environment. Sandboxed tools need the key and runtime inside that sandbox.

First ask the agent to check your balance. That verifies authenticated access without sending a letter. There is no separate agent dashboard.

## Portable skill

The [skills CLI](https://skills.sh/docs) can discover and install the skill directly from this repository:

```sh
npx skills add ctxrs/agentpostage --skill agentpostage
```

Choose the intended agent and scope. Keep the whole skill folder, including `scripts/agentpostage.mjs`. The CLI requires Node.js 22+. For runtimes without a shell, use an authenticated HTTP or MCP tool instead.

## Codex

### Remote MCP

With the key available to the Codex process, run:

```sh
codex mcp add agentpostage \
  --url https://agentpostage.com/mcp \
  --bearer-token-env-var AGENTPOSTAGE_API_KEY
```

Alternatively merge this table into your Codex `config.toml`, or `.codex/config.toml` for a trusted project:

```toml
[mcp_servers.agentpostage]
url = "https://agentpostage.com/mcp"
bearer_token_env_var = "AGENTPOSTAGE_API_KEY"
```

Start a new session and check `/mcp`. This saves the variable name, not the secret. AgentPostage uses a Bearer API key, not OAuth. Do not use `codex mcp login` for this connection. See [official Codex MCP configuration](https://developers.openai.com/codex/mcp).

### Skill plugin from this checkout

The plugin bundles one skill and its CLI. It can use an existing AgentPostage MCP connection or the bundled CLI with Node.js 22+. It does not configure MCP authentication for you.

From the root of this checkout, with a Codex version that offers `codex plugin`:

```sh
codex plugin marketplace add .
codex plugin add agentpostage@personal
```

These commands install into your Codex profile when you run them. The repository's marketplace is named `personal`, as recorded in `.agents/plugins/marketplace.json`. If you already have a different marketplace with that name, use the skill-only path below instead of replacing it. Start a new task after installation. Ask the agent to check your balance, then give it a [mailing task](prompts.md) within your delegated authority.

For a project-local skill without a plugin installation, copy the whole skill folder to your target project's `.agents/skills/agentpostage` directory. Run this from the repository root and replace the target path:

```sh
target_project='/path/to/your/project'
mkdir -p "$target_project/.agents/skills"
cp -R plugins/agentpostage/skills/agentpostage "$target_project/.agents/skills/"
```

Choose a destination without an existing `agentpostage` skill. This folder contains its own CLI and needs no files outside it. Invoke `$agentpostage` in a new Codex task. The plugin is a local Codex package, not a published directory listing or a ChatGPT plugin. See [OpenAI's plugin scaffold documentation](https://developers.openai.com/plugins/build/plugins#plugin-creator-output).

## Claude Code

### Skill plugin

In Claude Code, add the AgentPostage marketplace and install its plugin:

```text
/plugin marketplace add ctxrs/agentpostage
/plugin install agentpostage@agentpostage
```

Follow Claude Code's reload or restart prompt, then invoke `/agentpostage:agentpostage`. The plugin bundles the same portable skill and standalone CLI. It needs `AGENTPOSTAGE_API_KEY` in the shell environment and Node.js 22+, or an existing authenticated MCP connection. It does not store a key, configure MCP or send mail during installation.

### Remote MCP

Merge this entry into the project's `.mcp.json`, preserving any existing servers:

```json
{
  "mcpServers": {
    "agentpostage": {
      "type": "http",
      "url": "https://agentpostage.com/mcp",
      "headers": {
        "Authorization": "Bearer ${AGENTPOSTAGE_API_KEY}"
      }
    }
  }
}
```

Claude Code expands the environment variable when it connects. For user-wide configuration, the equivalent command is:

```sh
claude mcp add --scope user --transport http agentpostage \
  https://agentpostage.com/mcp \
  --header 'Authorization: Bearer ${AGENTPOSTAGE_API_KEY}'
```

Keep the single quotes to save the variable reference. Start a new session, approve project MCP configuration if prompted and inspect `/mcp`. See [Claude Code's environment expansion reference](https://code.claude.com/docs/en/mcp#environment-variable-expansion-in-mcp-json).

## Cursor

Merge this into `.cursor/mcp.json` for one project or `~/.cursor/mcp.json` for all projects:

```json
{
  "mcpServers": {
    "agentpostage": {
      "url": "https://agentpostage.com/mcp",
      "headers": {
        "Authorization": "Bearer ${env:AGENTPOSTAGE_API_KEY}"
      }
    }
  }
}
```

Launch Cursor with the key in its process environment and enable the server. Remote HTTP servers do not load `envFile`. See [Cursor's MCP configuration](https://cursor.com/docs/context/mcp).

## OpenClaw and Hermes Agent

Copy the bundled skill folder into the active profile's skills directory. For the default profiles, run one of these from this repository:

```sh
# OpenClaw
mkdir -p "$HOME/.openclaw/skills"
cp -R plugins/agentpostage/skills/agentpostage "$HOME/.openclaw/skills/"
```

```sh
# Hermes Agent by Nous Research
mkdir -p "$HOME/.hermes/skills"
cp -R plugins/agentpostage/skills/agentpostage "$HOME/.hermes/skills/"
```

Choose a destination without an existing copy. Custom profiles can use different paths. Supply the key to the agent's shell, allow the required shell and network tools, and start a new session. The skill needs Node.js 22+ for its CLI, or an HTTP tool for the API.

For remote MCP instead, follow the current [AgentPostage OpenClaw and Hermes setup](https://agentpostage.com/docs/#agents). Tool discovery and availability depend on the installed client version and tool policy.

## Muse, Grok bots and other runtimes

Use the connection your particular runtime actually exposes:

- A shell with Node.js 22+ can run the [CLI](api.md#cli). Load the [skill instructions](../plugins/agentpostage/skills/agentpostage/SKILL.md) as a skill or task instructions using the runtime's documented mechanism.
- An HTTP tool can use the [public OpenAPI contract](https://agentpostage.com/openapi.json). It must support secret-backed Bearer headers and PDF uploads or base64 of actual PDF bytes.
- A remote MCP client can connect to `https://agentpostage.com/mcp` using Streamable HTTP and `Authorization: Bearer <API key>` from its secret store.

This repository does not supply a native Muse or Grok installer. A chat-only surface cannot mail a PDF through these instructions alone. If the host cannot keep a key out of prompts or cannot send authenticated requests, use another supported connection.

## ChatGPT

Use a private custom GPT with Actions. You need a plan and workspace that permit creating GPTs with Actions. This API-key integration does not use ChatGPT's native MCP connection flow.

1. In the GPT editor, add an Action and import the public [ChatGPT Actions OpenAPI schema](https://agentpostage.com/chatgpt-actions.json) linked by the [live setup guide](https://agentpostage.com/docs/#agents).
2. Set Action authentication to **API Key**, choose **Bearer**, and enter a dedicated AgentPostage key in the authentication field.
3. Copy the [published GPT instructions](https://agentpostage.com/chatgpt-instructions.txt) into the GPT's Instructions. If requested, use `https://agentpostage.com/privacy/` as the privacy policy URL.
4. Save with visibility **Only me**. Other people using a GPT with your key could spend your balance.
5. Check the balance first. Upload one PDF and provide both US addresses when ready. Enable Code Interpreter & Data Analysis if the GPT should create the PDF.

The Actions schema is an attachment-aware OpenAPI document. It sends `openaiFileIdRefs` to `POST /v1/chatgpt/letters`. Use it instead of constructing base64 text or inventing file URLs. The general [REST OpenAPI schema](https://agentpostage.com/openapi.json) remains the API reference.

Attachment links expire. Read a known letter ID before retrying. Refresh the same PDF attachment and preserve the original idempotency key and mailing inputs. ChatGPT's own confirmation rules still apply. See OpenAI's [Action authentication](https://developers.openai.com/api/docs/actions/authentication) and [file upload documentation](https://developers.openai.com/api/docs/actions/sending-files).

The GPT Actions can report receipt availability but cannot download the receipt PDF. Open the returned receipt path under `https://agentpostage.com` in a browser signed into the owner's account, or use another tool that can make an authenticated HTTP download. The same limitation applies to downloading the stored print PDF.

## Credential and billing boundaries

Keys can spend the available account balance. There are no per-key spending allowances. Keep them out of prompts, files you commit and shared logs. Revoke unneeded keys at [Connect](https://agentpostage.com/connect/).

Only the human owner can manage keys, add credit or authorize saved-card recharge. Agents should return the billing link when funding is needed. They should never obtain owner cookies or card details. An API key cannot directly charge a card, but mailing can trigger automatic recharge if the owner has enabled it. A payment-page return is not proof of funds. Read the confirmed balance.
