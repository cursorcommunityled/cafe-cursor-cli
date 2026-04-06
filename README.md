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

A CLI tool for managing and sending Cursor credits to event attendees. Data lives in CSV files on disk. Optional [Resend](https://resend.com) sends the credit email; optional [Luma](https://docs.luma.com/reference/getting-started-with-your-api) webhooks automate sending when a guest checks in.

## Features

- Upload and manage attendee lists from CSV
- Upload and track Cursor credit codes
- Send personalized emails with credit codes using Resend (when configured)
- Track credit status (available, assigned, sent, redeemed)
- **Luma check-in automation**: webhook server verifies check-in via the Luma API and sends a credit email

## Prerequisites

- [Bun](https://bun.sh) (v1.0 or later)
- [Resend](https://resend.com) account with verified domain (optional, for email delivery)
- [Luma Plus](https://luma.com/pricing) and a Luma API key (optional, for webhook automation)

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

### 3. Run the CLI

```bash
bun run cli
```

By default, attendee and credit data is stored as `cafe_people.csv` and `cafe_credits.csv` in the current working directory. Set `CAFE_DATA_PATH` to use a fixed directory (recommended for the Luma webhook server).

### Environment variables

| Variable | Purpose |
|----------|---------|
| `CAFE_DATA_PATH` | Directory for `cafe_people.csv`, `cafe_credits.csv`, and `cafe_luma_sent_guests.txt` |
| `RESEND_API_KEY` | Send credit emails via Resend |
| `RESEND_FROM_EMAIL` | Verified sender address for Resend |

If Resend is not configured, the CLI and webhook still assign credits in CSV only (no outbound email).

## Luma check-in webhook (API-first for operators)

Integration is **server-to-server**: your deployment holds a [Luma API key](https://docs.luma.com/reference/getting-started-with-your-api) and optional Resend keys. End users do not configure Luma; they only receive the credit email after check-in.

Luma does **not** list a separate webhook type only for check-in. Per [Luma’s webhooks help](https://help.lu.ma/p/webhooks), **Guest Updated** fires when check-in status (and other guest fields) change, with payload type `guest.updated`. This server listens **only** for `guest.updated` and still **re-checks** check-in via the API before sending a code, so profile-only updates do not trigger a credit.

This repo includes a small HTTP server that:

1. Verifies the [Luma webhook signature](https://help.lu.ma/p/webhooks)
2. Confirms the guest is checked in using `GET /v1/event/get-guest` ([Luma API](https://docs.luma.com/reference/getting-started-with-your-api)) (per-ticket `checked_in_at`)
3. Sends one Cursor credit email per event + guest (deduped via `cafe_luma_sent_guests.txt`)

### Register the webhook via Luma API (recommended)

Operators run this once (uses [`POST /v1/webhooks/create`](https://docs.luma.com/reference/post_v1-webhooks-create) with `event_types: ["guest.updated"]`):

```bash
# Public URL must reach your running webhook server (tunnel or real host)
LUMA_API_KEY=your_key bun run luma:register-webhook https://your-host/luma/check-in
```

The command prints `LUMA_WEBHOOK_SECRET=whsec_...` — set that on the server that runs `luma:webhook`. List existing webhooks:

```bash
LUMA_API_KEY=your_key bun run luma:register-webhook list
```

Alternatively, you can create the same webhook manually in Luma: **Settings → Developer → Webhooks**, action **Guest Updated** only.

### Webhook server env

| Variable | Required | Description |
|----------|----------|-------------|
| `LUMA_API_KEY` | Yes | `x-luma-api-key` for API calls (webhook handler + optional registration) |
| `LUMA_WEBHOOK_SECRET` | Yes | `whsec_...` from `luma:register-webhook` output or Luma dashboard |
| `LUMA_DATA_PATH` | No | Same role as `CAFE_DATA_PATH` (defaults to cwd) |
| `LUMA_WEBHOOK_PORT` | No | Listen port (default `3847`) |
| `RESEND_API_KEY`, `RESEND_FROM_EMAIL` | For email | Same as CLI |

### Run the webhook server

```bash
bun run luma:webhook
```

Expose a URL publicly (for example via a tunnel). Recommended path: **`http://your-host:<port>/luma/check-in`**. The same server also accepts **`/luma/webhook`**, **`/luma/webhook/check-in`**, and **`/`** for backwards compatibility.

## Usage

### Main menu

1. **Send Cursor Credits** - Browse attendees and send or assign credits
2. **Upload Cursor Credits** - Import credit codes from a CSV file
3. **Upload Attendees** - Import attendees from a CSV file
4. **Check Credit Redemptions** - Check sent codes against Cursor

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
│   ├── cli.tsx                 # Main CLI entry point
│   ├── lumaWebhookServer.ts    # Luma guest.updated webhook HTTP server
│   ├── registerLumaCheckInWebhook.ts  # CLI: POST /v1/webhooks/create
│   ├── luma/                   # Luma API client, webhooks admin, signatures
│   ├── services/               # Shared send-credit logic (CLI + webhook)
│   ├── screens/                # CLI screens
│   ├── components/             # Reusable components
│   ├── context/                # Storage path context
│   ├── hooks/                  # CSV-backed data hooks
│   ├── emails/                 # Email templates
│   └── utils/                  # CSV storage and helpers
└── test/                       # Tests
```
