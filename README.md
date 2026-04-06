```text
   ██████╗ █████╗ ███████╗███████╗     ██████╗██╗   ██╗██████╗ ███████╗ ██████╗ ██████╗
  ██╔════╝██╔══██╗██╔════╝██╔════╝    ██╔════╝██║   ██║██╔══██╗██╔════╝██╔═══██╗██╔══██╗
  ██║     ███████║█████╗  █████╗      ██║     ██║   ██║██████╔╝███████╗██║   ██║██████╔╝
  ██║     ██╔══██║██╔══╝  ██╔══╝      ██║     ██║   ██║██╔══██╗╚════██║██║   ██║██╔══██╗
  ╚██████╗██║  ██║██║     ███████╗    ╚██████╗╚██████╔╝██║  ██║███████║╚██████╔╝██║  ██║
   ╚═════╝╚═╝  ╚═╝╚═╝     ╚══════╝     ╚═════╝ ╚═════╝ ╚═╝  ╚═╝╚══════╝ ╚═════╝ ╚═╝  ╚═╝
```

# Cafe Cursor CLI 
[![CI](https://github.com/Alhwyn/cafe-cursor-cli/actions/workflows/ci.yml/badge.svg)](https://github.com/Alhwyn/cafe-cursor-cli/actions/workflows/ci.yml)

**Storage is local only** – attendees, credits, and Luma dedupe state live in CSV/text files under `CAFE_DATA_PATH` (or the process working directory). There is no cloud database or sync layer in this app.

Two pieces work together:

1. **Interactive CLI** – manage attendees and Cursor credit codes in those local files; send credits manually (optional [Resend](https://resend.com) email).
2. **Luma API integration** – a small HTTP service that talks to [Luma’s public API](https://docs.luma.com/reference/getting-started-with-your-api) so **check-in on Luma** can trigger an automatic credit (again via Resend when configured). That service still reads and writes the same local files.

Event attendees never use the Luma API or this repo; operators hold the Luma API key and run the services.

## Luma API integration (overview)

| What | Luma API usage |
|------|----------------|
| **Auth** | Send header `x-luma-api-key: <your key>` on every request ([getting started](https://docs.luma.com/reference/getting-started-with-your-api)). Requires [Luma Plus](https://luma.com/pricing). |
| **Base URL** | `https://public-api.luma.com` |
| **Register webhook** | `POST /v1/webhooks/create` with `event_types: ["guest.updated"]` – scripted as `bun run luma:register-webhook` ([create webhook](https://docs.luma.com/reference/post_v1-webhooks-create)). |
| **List webhooks** | `GET /v1/webhooks/list` – `bun run luma:register-webhook list`. |
| **Verify check-in** | After Luma POSTs to your server, this app calls `GET /v1/event/get-guest` and requires per-ticket `checked_in_at` before sending a code ([get guest](https://docs.luma.com/reference/get_v1-event-get-guest)). |
| **Inbound webhooks** | Luma delivers `guest.updated` when guest data changes including check-in ([webhooks overview](https://help.lu.ma/p/webhooks)). There is no separate `guest.checked_in` event type; we filter on `type === "guest.updated"` and confirm check-in via the API. |

Flow:

1. Operator registers a public URL with Luma (API or dashboard).
2. Guest checks in on Luma.
3. Luma sends a signed `guest.updated` payload to your server.
4. Server verifies [HMAC signature](https://help.lu.ma/p/webhooks), calls `get-guest`, then assigns/sends one Cursor credit per event+guest (deduped in `cafe_luma_sent_guests.txt`).

OpenAPI spec (for exploring all endpoints): `https://public-api.luma.com/openapi.json`

## Features

- **Local-first data** – `cafe_people.csv`, `cafe_credits.csv`, `cafe_luma_sent_guests.txt` (no hosted backend)
- Upload and manage attendee lists from CSV
- Upload and track Cursor credit codes
- Send personalized emails with credit codes using Resend (when configured)
- Track credit status (available, assigned, sent, redeemed)
- **Luma + API**: register webhooks and verify check-in through the official Luma API

## Prerequisites

- [Bun](https://bun.sh) (v1.0 or later)
- [Resend](https://resend.com) with a verified domain (optional, for sending credit emails)
- [Luma Plus](https://luma.com/pricing) and a Luma API key (for the check-in automation service)

## Setup

### 1. Clone the repository

```bash
git clone <repository-url>
cd cafe-cursor-cli
```

### 2. Install dependencies

```bash
bun install
```

### 3. Run the CLI (local CSV + optional Resend)

```bash
bun run cli
```

By default, data files live in the current working directory: `cafe_people.csv`, `cafe_credits.csv`. For the Luma webhook process, set **`CAFE_DATA_PATH`** (or **`LUMA_DATA_PATH`** on the webhook server) so the CLI and the webhook automation use the **same** local folder.

### Environment variables (CLI)

| Variable | Purpose |
|----------|---------|
| `CAFE_DATA_PATH` | Directory for `cafe_people.csv`, `cafe_credits.csv`, and (if used) `cafe_luma_sent_guests.txt` |
| `RESEND_API_KEY` | Send credit emails via Resend |
| `RESEND_FROM_EMAIL` | Verified sender address for Resend |

Without Resend, credits are still assigned in CSV; no email is sent.

## Luma API: operator setup (check-in automation)

### 1. Start the webhook HTTP server

```bash
bun run luma:webhook
```

Expose it on the public internet (HTTPS in production). Recommended path: **`https://your-host/luma/check-in`** (also accepts `/luma/webhook`, `/luma/webhook/check-in`, `/`).

### 2. Register the webhook using the Luma API

```bash
LUMA_API_KEY=your_key bun run luma:register-webhook https://your-host/luma/check-in
```

This calls **`POST /v1/webhooks/create`** with `guest.updated` only. Copy the printed **`LUMA_WEBHOOK_SECRET=whsec_...`** into the environment of the machine running `luma:webhook`.

List webhooks already on your calendar:

```bash
LUMA_API_KEY=your_key bun run luma:register-webhook list
```

You can instead create the same webhook in Luma: **Settings → Developer → Webhooks** → **Guest Updated**.

### Webhook server environment

| Variable | Required | Description |
|----------|----------|-------------|
| `LUMA_API_KEY` | Yes | Same key as `x-luma-api-key` for outbound `get-guest` calls |
| `LUMA_WEBHOOK_SECRET` | Yes | `whsec_...` from registration response or Luma UI |
| `LUMA_DATA_PATH` | No | Data directory (defaults to cwd); align with `CAFE_DATA_PATH` for shared CSVs |
| `LUMA_WEBHOOK_PORT` | No | Listen port (default `3847`) |
| `RESEND_API_KEY`, `RESEND_FROM_EMAIL` | For email | Same as CLI |

## Usage (CLI menu)

1. **Send Cursor Credits** – Browse attendees and send or assign credits
2. **Upload Cursor Credits** – Import credit codes from a CSV file
3. **Upload Attendees** – Import attendees from a CSV file
4. **Check Credit Redemptions** – Check sent codes against Cursor

### CSV formats

#### Attendees CSV

```csv
first_name,last_name,email,What is your LinkedIn profile?,What is your X (Twitter) handle?,What would you like to drink?,What would you like for Snacks?,What are you working on?
John,Doe,john@example.com,https://linkedin.com/in/johndoe,@johndoe,Coffee,Croissant,Building an AI startup
```

Required columns: `first_name`, `last_name`, `email`

#### Credits CSV

```csv
url,code,amount
https://cursor.com/referral?code=ABC123,ABC123,20
```

## Development

### Run tests

```bash
bun test
```

### Build

```bash
bun run build
```

## Project structure

```
cafe-cursor-cli/
├── src/
│   ├── cli.tsx                        # Interactive CLI (local CSV + optional Resend)
│   ├── lumaWebhookServer.ts           # HTTP receiver + Luma signature verify + get-guest
│   ├── registerLumaCheckInWebhook.ts  # Operator CLI → POST /v1/webhooks/create
│   ├── luma/
│   │   ├── lumaClient.ts              # GET /v1/event/get-guest
│   │   ├── webhooksAdmin.ts           # POST create / GET list webhooks
│   │   └── verifyWebhookSignature.ts  # Inbound HMAC verification
│   ├── services/                      # Shared send-credit logic (CLI + webhook)
│   ├── screens/
│   ├── components/
│   ├── context/
│   ├── hooks/
│   ├── emails/
│   └── utils/
└── test/
```
