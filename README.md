# AgentPostage

Your agent can write the letter. Now it can mail it.

[AgentPostage](https://agentpostage.com/docs/) turns a PDF, a US return address and a US recipient address into physical mail. Send bank disputes, gym cancellations, credit bureau requests, notices and completed forms from your agent. Printing, an envelope, an address coversheet and US postage are included.

This repository contains a portable mailing skill, a Codex plugin and a standalone Node.js CLI. Connect through MCP or the HTTP API, or use a private GPT Action in ChatGPT.

## Start here

1. Create and verify your account at [Connect](https://agentpostage.com/connect/), accept the service policies and create a named API key.
2. Add prepaid funds at [Billing](https://agentpostage.com/billing/). The minimum payment is $10. There is no subscription.
3. Put the key in your agent's secret store as `AGENTPOSTAGE_API_KEY`, then follow your [agent setup](docs/integrations.md). Never paste it into a conversation.

For any agent with shell access and Node.js 22+, the CLI needs no package installation:

```sh
curl -fsS https://agentpostage.com/agentpostage.mjs -o agentpostage.mjs
node agentpostage.mjs --help
node agentpostage.mjs balance
node agentpostage.mjs price --pages 3 --service first_class
```

Review downloaded code before running it. Balance and price checks do not send mail. The [CLI source](plugins/agentpostage/skills/agentpostage/scripts/agentpostage.mjs) is also included in this repository.

> Mail my gym cancellation PDF to [recipient address] using AgentPostage First-Class, with [my return address]. Record the letter ID and cost, then check its mailing status.

Your agent acts within the authority and limits you have already delegated. AgentPostage does not add a per-letter approval workflow.

[More prompts](docs/prompts.md) cover bank disputes, credit bureau requests, tracking and return receipts.

## Choose your connection

| Agent or runtime | Connection |
| --- | --- |
| OpenClaw, Hermes Agent | Install the skill with shell access, or use their remote MCP configuration |
| Codex | Install the repo-local skill plugin, or configure HTTP MCP with a Bearer environment variable |
| Claude Code, Cursor | Remote HTTP MCP with an Authorization header |
| ChatGPT | Private custom GPT with Actions and API-key authentication |
| Muse, Grok bots, other tool-capable runtimes | CLI, HTTP or remote MCP where the runtime exposes those capabilities |

[Setup instructions](docs/integrations.md) explain prerequisites and limits. A model name alone does not provide tools or permission to send mail.

## What it costs

Retail prices in USD, tariff `2026-09-17-retail`:

| Service | First black-and-white PDF page |
| --- | ---: |
| First-Class | $4 |
| First-Class with Homeowner Statement Enclosed endorsement | $4 |
| First-Class flat | $6 |
| Certified with tracking | $12 |
| Certified with tracking and electronic return receipt | $15 |

Each additional PDF page is $0.30. Color adds $0.30 per PDF page, including the first. Non-white paper adds $0.10 per document sheet. An unstamped reply envelope adds $0.50, or $1.50 for a twelve-pack. Duplex keeps the per-page price and uses two document pages per sheet. The address coversheet is included, without an extra page or sheet charge.

You can check an exact price using the document's actual page count and print options. A price check does not hold a rate. Sending fixes the current price when the letter is queued. See the [current pricing reference](https://agentpostage.com/docs/#pricing).

## Send with care

Sending queues real, paid mail immediately. Use the document, addresses, service and print options covered by the user's existing delegation. Humans and agent hosts manage their own spending limits and permissions. Save one idempotency key per intended letter and reuse it with identical input after a timeout. A new key can create duplicate mail.

`queued` means saved for sending. It does not mean mailed. First-Class ends at confirmed mailing, without individual delivery confirmation. Certified can provide delivery evidence, and an electronic return receipt may arrive later.

The service accepts PDFs and US addresses. It does not draft documents, guarantee legal outcomes or promise a delivery date. Your agent can help prepare a PDF separately.

## Reference and development

- [API, CLI, file limits and retry handling](docs/api.md)
- [Agent setup and Codex plugin installation](docs/integrations.md)
- [Mailing skill](plugins/agentpostage/skills/agentpostage/SKILL.md)
- [Live API docs](https://agentpostage.com/docs/), [OpenAPI](https://agentpostage.com/openapi.json) and [agent reference](https://agentpostage.com/llms.txt)

Run the offline checks with Node.js 22+:

```sh
node --test tests/*.test.mjs
```

Tests use a local mock API and synthetic data. They do not send mail or charge an account. Integration files are [MIT licensed](LICENSE). Mailing is a paid service governed by the policies accepted during account setup.
