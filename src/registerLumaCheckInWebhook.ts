#!/usr/bin/env bun
/**
 * Operator tool: register the Cursor Cafe check-in webhook via Luma API
 * (no Luma dashboard clicks). Requires LUMA_API_KEY only.
 *
 * Usage:
 *   LUMA_API_KEY=... bun src/registerLumaCheckInWebhook.ts https://your-host/luma/check-in
 *   LUMA_API_KEY=... bun src/registerLumaCheckInWebhook.ts list
 *
 * After create, set LUMA_WEBHOOK_SECRET on the webhook server to the printed secret (whsec_...).
 */

import { createCheckInWebhook, listLumaWebhooks } from "./luma/webhooksAdmin.js";

const apiKey = process.env.LUMA_API_KEY ?? "";

async function main() {
  const arg = process.argv[2];

  if (!apiKey) {
    console.error("Set LUMA_API_KEY (from Luma dashboard, server-side only).");
    process.exit(1);
  }

  if (arg === "list" || arg === "ls") {
    const { entries } = await listLumaWebhooks(apiKey);
    if (entries.length === 0) {
      console.log("No webhooks.");
      return;
    }
    for (const w of entries) {
      console.log(
        `${w.id}\t${w.status}\t${w.event_types.join(",")}\t${w.url}`
      );
    }
    return;
  }

  const url = arg || process.env.LUMA_WEBHOOK_PUBLIC_URL || "";
  if (!url || !/^https?:\/\//i.test(url)) {
    console.error(
      "Provide a public HTTPS (or http) URL as the first argument, or set LUMA_WEBHOOK_PUBLIC_URL.\n" +
        "Example: LUMA_API_KEY=... bun src/registerLumaCheckInWebhook.ts https://example.com/luma/check-in\n" +
        "List existing: LUMA_API_KEY=... bun src/registerLumaCheckInWebhook.ts list"
    );
    process.exit(1);
  }

  const webhook = await createCheckInWebhook(apiKey, url);

  console.log("Registered check-in webhook via Luma API:\n");
  console.log(`  id:     ${webhook.id}`);
  console.log(`  url:    ${webhook.url}`);
  console.log(`  events: ${webhook.event_types.join(", ")}`);
  console.log(`  status: ${webhook.status}`);
  console.log(`\nSet on your webhook server (keep secret private):\n`);
  console.log(`  LUMA_WEBHOOK_SECRET=${webhook.secret}\n`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
