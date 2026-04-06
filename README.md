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

## Luma check-in webhook

When a guest checks in on Luma, Luma can call your server with a `guest.updated` webhook. This repo includes a small HTTP server that:

1. Verifies the [Luma webhook signature](https://help.lu.ma/p/webhooks)
2. Confirms the guest is checked in using `GET /v1/event/get-guest` ([Luma API](https://docs.luma.com/reference/getting-started-with-your-api))
3. Sends one Cursor credit email per event + guest (deduped via `cafe_luma_sent_guests.txt`)

### Webhook server env

| Variable | Required | Description |
|----------|----------|-------------|
| `LUMA_API_KEY` | Yes | `x-luma-api-key` for API calls |
| `LUMA_WEBHOOK_SECRET` | Yes | `whsec_...` secret from Luma webhook settings |
| `LUMA_DATA_PATH` | No | Same role as `CAFE_DATA_PATH` (defaults to cwd) |
| `LUMA_WEBHOOK_PORT` | No | Listen port (default `3847`) |
| `RESEND_API_KEY`, `RESEND_FROM_EMAIL` | For email | Same as CLI |

### Run the webhook server

```bash
bun run luma:webhook
```

Expose `http://your-host:<port>/luma/webhook` publicly (for example via a tunnel), then in Luma: **Settings → Developer → Webhooks**, create a webhook with event type **Guest Updated** pointing at that URL.

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
│   ├── luma/                   # Luma API client and signature verification
│   ├── services/               # Shared send-credit logic (CLI + webhook)
│   ├── screens/                # CLI screens
│   ├── components/             # Reusable components
│   ├── context/                # Storage path context
│   ├── hooks/                  # CSV-backed data hooks
│   ├── emails/                 # Email templates
│   └── utils/                  # CSV storage and helpers
└── test/                       # Tests
```
