import { chromium } from "playwright";
import type { Browser, Page } from "playwright";

interface CreditStatus {
  available: boolean;
  redeemed?: boolean;
  unknown?: boolean;
  amount?: number;
  lastChecked: string;
  error?: string;
}

const REFERRAL_REGEX = /https?:\/\/cursor\.com\/referral\?code=([A-Z0-9]+)/i;
const TIMEOUT_MS = 15000;

// Extract referral code from URL
function extractCode(url: string): string | null {
  const match = url.match(REFERRAL_REGEX);
  return match?.[1] ?? null;
}

const REDEEMED_INDICATORS = [
  /already been used/i,
  /already used/i,
  /referral has been redeemed/i,
  /this referral has already/i,
];

// Check referral by scraping the DOM for credit modal
async function checkReferralInBrowser(
  page: Page,
  url: string
): Promise<{ available: boolean; redeemed?: boolean; unknown?: boolean; amount?: number }> {
  try {
    await page.goto(url, { waitUntil: "networkidle", timeout: TIMEOUT_MS });
  } catch {
    return { available: false, unknown: true };
  }

  const waitTimeout = 10000;

  try {
    // Wait for either credit modal or redeemed indicator to appear
    const creditH1 = page.locator("h1").filter({ hasText: /You've received a \$[\d.]+ credit!/ });
    const getStartedButton = page.getByRole("button", { name: "Get Started" });

    // Check for redeemed state first (page may show "already used" etc.)
    const pageContent = await page.content();
    const isRedeemed = REDEEMED_INDICATORS.some((re) => re.test(pageContent));
    if (isRedeemed) {
      return { available: false, redeemed: true };
    }

    // Wait for credit h1 to appear
    await creditH1.waitFor({ state: "visible", timeout: waitTimeout });

    const h1Text = await creditH1.first().textContent();
    const amountMatch = h1Text?.match(/\$([\d.]+)/);
    const amount = amountMatch?.[1] != null ? parseFloat(amountMatch[1]) : 20;

    // Confirm Get Started button exists (credit-available state)
    const buttonVisible = await getStartedButton.isVisible();
    if (buttonVisible) {
      return { available: true, amount };
    }

    // H1 found but no button - treat as available with parsed amount
    return { available: true, amount };
  } catch {
    // Timeout or element not found - check if we got a redeemed page that loaded differently
    const pageContent = await page.content();
    const isRedeemed = REDEEMED_INDICATORS.some((re) => re.test(pageContent));
    if (isRedeemed) {
      return { available: false, redeemed: true };
    }
    return { available: false, unknown: true };
  }
}

// Shared browser instance for batch checking
let sharedBrowser: Browser | null = null;
let sharedPage: Page | null = null;

export async function initBrowser(headless = false): Promise<void> {
  if (!sharedBrowser) {
    sharedBrowser = await chromium.launch({
      headless,
      channel: "chrome",
    });
    const context = await sharedBrowser.newContext();
    sharedPage = await context.newPage();
  }
}

export async function closeBrowser(): Promise<void> {
  if (sharedBrowser) {
    await sharedBrowser.close();
    sharedBrowser = null;
    sharedPage = null;
  }
}

export async function checkCreditsAvailable(url: string): Promise<CreditStatus> {
  const lastChecked = new Date().toISOString();

  try {
    const code = extractCode(url);

    if (!code) {
      return {
        available: false,
        unknown: true,
        lastChecked,
        error: "Could not extract referral code from URL",
      };
    }

    // Use shared browser if available, otherwise create temporary one
    let browser: Browser | null = null;
    let page: Page;

    if (sharedPage) {
      page = sharedPage;
    } else {
      browser = await chromium.launch({ headless: false, channel: "chrome" });
      const context = await browser.newContext();
      page = await context.newPage();
    }

    const result = await checkReferralInBrowser(page, url);

    // Close temporary browser if we created one
    if (browser) {
      await browser.close();
    }

    return {
      available: result.available,
      redeemed: result.redeemed,
      unknown: result.unknown,
      amount: result.amount,
      lastChecked,
    };
  } catch (error) {
    return {
      available: false,
      unknown: true,
      lastChecked,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// Batch check multiple URLs efficiently
export async function checkMultipleCredits(
  urls: string[],
  onProgress?: (index: number, total: number, result: CreditStatus) => void
): Promise<Map<string, CreditStatus>> {
  const results = new Map<string, CreditStatus>();

  await initBrowser(false);

  try {
    for (let i = 0; i < urls.length; i++) {
      const url = urls[i];

      if (!url) throw new Error(`URL is undefined at index ${i}`);

      const result = await checkCreditsAvailable(url);
      results.set(url, result);

      if (onProgress) {
        onProgress(i + 1, urls.length, result);
      }

      // 1 second delay between checks to avoid rate limiting
      if (i < urls.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
  } finally {
    await closeBrowser();
  }

  return results;
}

// Debug function
export async function debugPage(url: string): Promise<void> {
  console.log(`\n--- Debug: ${url} ---`);

  const code = extractCode(url);
  if (!code) {
    console.log("Could not extract code from URL");
    return;
  }

  console.log(`Extracted code: ${code}`);
  console.log("Launching browser...");

  const result = await checkCreditsAvailable(url);
  console.log("Result:", JSON.stringify(result, null, 2));
}
