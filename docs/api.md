# Mail through the API or CLI

Base URL: `https://agentpostage.com`. Send `Authorization: Bearer $AGENTPOSTAGE_API_KEY` on authenticated requests. Use the [live OpenAPI contract](https://agentpostage.com/openapi.json) for complete fields and responses, and [llms.txt](https://agentpostage.com/llms.txt) for the current agent reference.

## CLI

Requires Node.js 22+, with no npm dependencies. Download the [published CLI](https://agentpostage.com/agentpostage.mjs), or run the copy in this checkout:

```sh
node plugins/agentpostage/skills/agentpostage/scripts/agentpostage.mjs --help
```

The commands below assume you downloaded it as `agentpostage.mjs` in your working directory. Inject the key into the process environment through your normal secret store.

```sh
node agentpostage.mjs balance
node agentpostage.mjs price --pages 3 --service first_class --color color --duplex true
```

This price example is $5.50 under the `2026-09-17-retail` tariff. It checks a price without sending a PDF, reserving money or mailing. Count PDF pages, not physical sheets. Use the same service and print options for the price check and send.

Save the actual sender and recipient as separate JSON files. Both use this shape. The example is synthetic and must not be used to send mail:

```json
{
  "name": "Example Person",
  "address_line1": "123 Example Street",
  "address_line2": "Suite 4",
  "city": "Boston",
  "state": "MA",
  "postal_code": "02110",
  "country": "US"
}
```

Omit `address_line2` when unused. Addresses require single-line printable ASCII, a two-letter US state and ZIP or ZIP+4. Names allow 80 characters, address lines 100 and cities 60. The PDF itself can contain Unicode.

When the user's existing delegation covers the document, addresses, service and options, submit directly under your host's permission policy. AgentPostage requires no new confirmation for each letter. Choose a unique idempotency key and save it before submitting. This example performs a paid mailing when run with valid inputs:

```sh
node agentpostage.mjs send \
  --pdf letter.pdf \
  --sender sender.json \
  --recipient recipient.json \
  --service first_class \
  --idempotency-key UNIQUE_LETTER_KEY
```

Replace `UNIQUE_LETTER_KEY` with a saved key for this intended mailing. If omitted, the CLI generates one and prints it to stderr before sending. Preserve it for recovery. JSON results go to stdout. Failures exit nonzero.

Use the returned ID for follow-up commands:

```sh
node agentpostage.mjs get LETTER_ID
node agentpostage.mjs list --limit 20
node agentpostage.mjs transactions --limit 20
node agentpostage.mjs billing
```

`cancel LETTER_ID` requests cancellation before mailing authorization starts. Only a successful response confirms it. `list` and `transactions` accept `--cursor` from the previous `next_cursor`. A null cursor ends pagination. Limits are 1–50.

`AGENTPOSTAGE_BASE_URL` overrides the API origin. Leave it unset for normal use. It receives your key and document, so only override it for a destination you trust. The CLI refuses HTTP except on loopback and does not follow redirects.

## HTTP and MCP

`POST /v1/letters` accepts either:

- JSON containing `pdf_base64` of actual PDF bytes, `sender` and `recipient` objects, and optional print fields.
- Multipart form data containing a `pdf` file, `sender` and `recipient` as JSON strings, and optional print fields.

The required `Idempotency-Key` header identifies this intended mailing. The ordinary endpoint does not fetch a PDF URL or accept plain text in place of a PDF. JSON `duplex` is a boolean. Multipart `duplex` is the string `true` or `false`.

| Operation | HTTP | MCP tool |
| --- | --- | --- |
| Exact price without mailing | `POST /v1/price` | `price_letter` |
| Submit PDF | `POST /v1/letters` | `send_letter` |
| Read a letter | `GET /v1/letters/{id}` | `get_letter` |
| List letters | `GET /v1/letters` | `list_letters` |
| Cancel before authorization | `POST /v1/letters/{id}/cancel` | `cancel_letter` |
| Read balance | `GET /v1/balance` | `get_balance` |
| Read transactions | `GET /v1/transactions` | `list_transactions` |
| Get owner's billing link | `GET /v1/billing/link` | `get_billing_link` |

Price takes `page_count` and optional print fields, without a PDF, addresses or idempotency key. MCP send takes the JSON send fields plus `idempotency_key`. Read and cancel tools take `{id}`. List tools take optional `limit` and `cursor`. Balance and billing-link tools take `{}`. MCP returns the same structured resources and errors as REST.

Download the print PDF through `GET /v1/letters/{id}/pdf` and a return receipt through `GET /v1/letters/{id}/receipt`, with Bearer authentication. Treat downloaded documents and their URLs as private account data.

## Services and print options

| Field | Values |
| --- | --- |
| `service` | `first_class` (default), `certified`, `certified_return_receipt`, `first_class_flat`, `first_class_hse` |
| `color` | `black` (default), `color` |
| `duplex` | `false` (default), `true` |
| `paper` | `white` (default), `yellow`, `blue`, `green`, `orange`, `red`, `ivory`, `perforated`, `statement`, `check_blue`, `check_red`, `check_green`, `coupon` |
| `return_envelope` | `none` (default), `right_window`, `left_window`, `small`, `coupon_pack` |

CLI flags use `--service`, `--color`, `--duplex true|false`, `--paper` and `--return-envelope`. Certified adds tracking. Only `certified_return_receipt` includes an electronic return receipt. Flat selects unfolded mailing. HSE adds a Homeowner Statement Enclosed endorsement.

Reply envelopes are unstamped. Specialty stock requires a PDF laid out for that stock. Check stock prints supplied artwork and does not issue a payment or add bank details. See [pricing](../README.md#what-it-costs) and [the detailed print reference](https://agentpostage.com/docs/).

## Files

The source PDF limit is 10 MiB. The normalized print PDF limit is 20 MiB. First-Class and HSE accept up to 500 document pages. Either Certified service accepts up to 150. Explicit flats accept up to 75 single-sided or 150 duplex pages. Page-limit errors are rejected before storage or charging.

The included address coversheet does not count as a customer page. Non-US-letter pages fit onto US letter paper. Scans, embedded fonts and Unicode retain their visual content. Encrypted, corrupt and empty PDFs are rejected.

Forms and printable annotations need saved appearances. `unsupported_print_annotation` means the PDF must be exported or printed to a new PDF. Confirm the original request was rejected before submitting corrected bytes. Do not silently remove pages or annotations.

## Retries, money and status

A send requests physical mailing directly. A new send returns `202` with a saved letter resource. Save its `id`, the original idempotency key and the exact inputs. New letters return `cost.total_cents` and `currency: "USD"` immediately, with a price fixed when queued. Legacy letters may have `cost: null`, which does not mean free.

Idempotency keys contain 8–128 ASCII letters, digits, dots, colons, underscores or hyphens. Reuse the same key and identical PDF bytes, addresses, service and print options after an uncertain response. Reusing a key with changed input returns `409`. A fresh key can send a second physical letter.

| Status | What to report or do |
| --- | --- |
| `queued`, `preauthorizing` | Saved or preparing for mailing authorization. Not proof of mailing |
| `awaiting_funds` | Give the human the billing link and read the balance after funding |
| `authorizing` | Mailing authorization is underway. Cancellation is no longer available |
| `accepted` | Submission accepted. Not proof of mailing or delivery |
| `mailed` | Confirmed mailing evidence. First-Class normally ends here |
| `delivered` | Delivery evidence for Certified mail. A return receipt may still be pending |
| `cancelled`, `rejected` | Report the actual result and any `next_action` |
| `submission_unknown` | An unresolved submission. Inspect this letter and do not create a replacement |

Use `evidence` and the current resource to describe tracking. `receipt_url` stays null until `evidence.return_receipt_available` is true. A receipt can arrive after delivery. A service name is not proof of receipt or legal adequacy.

PDFs, addresses and stored receipts expire 30 days after confirmed First-Class mailing, Certified delivery, cancellation or rejection. Pending mail stays stored until resolved, including mailed Certified letters and `submission_unknown`. Document endpoints return `410` after retention deletion. Keep needed records before expiry.

Errors use `{"error":{"code":"…","message":"…","next_action":"…"}}`, with optional `next_action`. Fix input errors on `400`, credentials or permissions on `401/403`, and size on `413`. `404` means unavailable to this account. Inspect `409` conflicts. Network failures and `5xx` may follow a successful submission, so read known resources and preserve the original key.
