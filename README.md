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

A CLI tool for managing and sending Cursor credits to event attendees via email.

## Features

- Upload and manage attendee lists from CSV
- Upload and track Cursor credit codes
- Send personalized emails with credit codes using Resend
- Track credit status (available, assigned, sent, redeemed)
- **Local Mode**: Run without a database using CSV files for storage

## Prerequisites

- [Bun](https://bun.sh) (v1.0 or later)
- [Convex](https://convex.dev) account (optional, only for Cloud Mode)
- [Resend](https://resend.com) account with verified domain (optional, only for Cloud Mode)

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

That's it for **Local Mode**! The CLI will use CSV files for storage and no external services are required.

---

### Optional: Set up Convex (Cloud Mode)

If you want to use Cloud Mode with database sync and email sending, follow these additional steps:

#### 3a. Set up Convex

```bash
# Login to Convex
bunx convex login

# Initialize Convex (creates a new project)
bunx convex dev
```

This will create a new Convex project and start syncing your schema.

#### 3b. Configure environment variables

Create a `.env` file in the root directory:

```env
CONVEX_URL=https://your-deployment.convex.cloud
RESEND_API_KEY=re_xxxxxxxxxxxxx
RESEND_FROM_EMAIL=credits@yourdomain.com
```

You can find your `CONVEX_URL` in the Convex dashboard after running `bunx convex dev`.

#### 3c. Set up Convex environment variables

Go to your [Convex Dashboard](https://dashboard.convex.dev):
1. Select your project
2. Go to **Settings** > **Environment Variables**
3. Add:
   - `RESEND_API_KEY` - Your Resend API key
   - `RESEND_FROM_EMAIL` - Your verified sender email

## Usage

### Storage Modes

When you start the CLI, you'll be prompted to select a storage mode:

1. **Cloud Mode (Convex Database)**
   - Uses Convex database for storage
   - Requires environment variables (CONVEX_URL, RESEND_API_KEY, RESEND_FROM_EMAIL)
   - Data synced across devices
   - Sends actual emails via Resend

2. **Local Mode (CSV Files)**
   - Uses CSV files in the current directory for storage
   - No database setup required
   - Files created: `cafe_people.csv`, `cafe_credits.csv`
   - Credits are assigned but no emails are sent

### Main Menu Options

1. **Send Cursor Credits** - Browse attendees and send credits via email
2. **Upload Cursor Credits** - Import credit codes from a CSV file
3. **Upload Attendees** - Import attendees from a CSV file

### CSV Formats

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

### Start Convex dev server (optional, for Cloud Mode)

```bash
bunx convex dev
```

## Project Structure

```
cafe-cursor-cli/
├── convex/              # Convex backend (optional, for Cloud Mode)
│   ├── schema.ts        # Database schema
│   ├── credits.ts       # Credit mutations/queries
│   ├── people.ts        # People mutations/queries
│   ├── email.ts         # Email sending action
│   └── emailHelpers.ts  # Email helper mutations
├── src/
│   ├── cli.tsx          # Main CLI entry point
│   ├── screens/         # CLI screens
│   ├── components/      # Reusable components (includes ModeSelector)
│   ├── context/         # React contexts (StorageContext for mode)
│   ├── hooks/           # Custom hooks (storage abstraction)
│   ├── emails/          # Email templates
│   └── utils/           # Utility functions (includes localStorage)
└── test/                # Test files
```
