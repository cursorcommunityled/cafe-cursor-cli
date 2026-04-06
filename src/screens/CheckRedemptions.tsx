import React, { useState, useEffect } from "react";
import { Box, Text, useInput } from "ink";
import { writeFileSync } from "fs";
import { ProgressBar } from "../components/ProgressBar.js";
import { useStorage } from "../context/StorageContext.js";
import { useSentCredits, useMarkRedeemed, type SentCreditWithPerson } from "../hooks/useStorageHooks.js";
import { checkCreditsAvailable, initBrowser, closeBrowser } from "../utils/creditChecker.js";

interface CheckRedemptionsProps {
  onBack: () => void;
}

interface CheckResult {
  credit: SentCreditWithPerson;
  status: "redeemed" | "active" | "unknown" | "pending";
}

const CheckRedemptions = ({ onBack }: CheckRedemptionsProps) => {
  const { dataPath } = useStorage();
  const { data: sentCredits, refresh } = useSentCredits();
  const markRedeemed = useMarkRedeemed();

  const [checking, setChecking] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [currentCode, setCurrentCode] = useState<string | null>(null);
  const [results, setResults] = useState<CheckResult[]>([]);
  const [checkComplete, setCheckComplete] = useState(false);
  const [exportMessage, setExportMessage] = useState<string | null>(null);

  // Initialize results when data loads
  useEffect(() => {
    if (sentCredits && results.length === 0 && !checking) {
      setResults(sentCredits.map(credit => ({ credit, status: "pending" as const })));
      setProgress({ current: 0, total: sentCredits.length });
    }
  }, [sentCredits]);

  // Handle keyboard input
  useInput((input, key) => {
    if (checking) return; // Disable input while checking

    if ((input === "q" || key.escape) && !checking) {
      onBack();
    } else if (input === "s" && !checking && !checkComplete && sentCredits && sentCredits.length > 0) {
      startCheck();
    } else if (input === "e" && checkComplete) {
      exportUnusedCredits();
    }
  });

  const startCheck = async () => {
    if (!sentCredits || sentCredits.length === 0) return;

    setChecking(true);
    setCheckComplete(false);
    setProgress({ current: 0, total: sentCredits.length });

    try {
      // Initialize browser
      await initBrowser(false);

      for (let i = 0; i < sentCredits.length; i++) {
        const credit = sentCredits[i];
        if (!credit) continue;

        setCurrentCode(credit.code);
        setProgress({ current: i + 1, total: sentCredits.length });

        // Check the credit
        const result = await checkCreditsAvailable(credit.url);

        let status: "redeemed" | "active" | "unknown";
        if (result.redeemed) {
          status = "redeemed";
          // Update database
          await markRedeemed(credit.id);
        } else if (result.available) {
          status = "active";
        } else {
          status = "unknown";
        }

        // Update results
        setResults(prev => prev.map((r, idx) => 
          idx === i ? { ...r, status } : r
        ));
      }
    } catch (error) {
      // Handle error silently
    } finally {
      await closeBrowser();
      setChecking(false);
      setCheckComplete(true);
      setCurrentCode(null);
      refresh();
    }
  };

  const exportUnusedCredits = () => {
    const activeCredits = results.filter(r => r.status === "active");
    
    if (activeCredits.length === 0) {
      setExportMessage("No unused credits to export.");
      return;
    }

    const dateStr = new Date().toISOString().split("T")[0];
    const filename = `unused_credits_${dateStr}.csv`;

    const csvLines = [
      "url,code,amount,assigned_to_email,assigned_to_name",
      ...activeCredits.map(r => {
        const personName = r.credit.person 
          ? `${r.credit.person.firstName} ${r.credit.person.lastName}`
          : "";
        const personEmail = r.credit.person?.email || "";
        return `${r.credit.url},${r.credit.code},${r.credit.amount},${personEmail},"${personName}"`;
      })
    ];

    writeFileSync(filename, csvLines.join("\n"), "utf-8");
    setExportMessage(`Exported ${activeCredits.length} unused credits to ${filename}`);
  };

  // Calculate summary
  const summary = {
    redeemed: results.filter(r => r.status === "redeemed").length,
    active: results.filter(r => r.status === "active").length,
    unknown: results.filter(r => r.status === "unknown").length,
    pending: results.filter(r => r.status === "pending").length,
  };

  // Show loading state
  if (sentCredits === undefined) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text color="white">Loading sent credits...</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" padding={1}>
      {/* Mode indicator */}
      <Box marginBottom={1}>
        <Text dimColor>Data: </Text>
        <Text color="green">{dataPath}</Text>
      </Box>

      {/* Header */}
      <Box marginBottom={1}>
        <Text bold color="white">Check Credit Redemptions</Text>
        <Text dimColor> ({sentCredits.length} sent credits)</Text>
      </Box>

      {/* Progress Bar */}
      {(checking || checkComplete) && (
        <Box marginBottom={1} flexDirection="column">
          <Box>
            <Text bold color="white">Progress: </Text>
            <Text color="white">{progress.current}</Text>
            <Text dimColor> / {progress.total} credits checked</Text>
          </Box>
          <ProgressBar current={progress.current} total={progress.total} />
        </Box>
      )}

      {/* Current check status */}
      {checking && currentCode && (
        <Box marginBottom={1}>
          <Text color="yellow">Checking: </Text>
          <Text color="white">{currentCode}...</Text>
        </Box>
      )}

      {/* Results list */}
      {results.length > 0 && (
        <Box flexDirection="column" marginBottom={1}>
          <Text bold color="white" underline>Results:</Text>
          <Box flexDirection="column" marginTop={1}>
            {results.slice(0, 15).map((result, idx) => (
              <Box key={idx}>
                <Text color="gray">{result.credit.person 
                  ? `${result.credit.person.firstName} ${result.credit.person.lastName}`
                  : result.credit.code
                }</Text>
                <Text> - </Text>
                {result.status === "redeemed" && <Text color="green">REDEEMED</Text>}
                {result.status === "active" && <Text color="yellow">STILL ACTIVE</Text>}
                {result.status === "unknown" && <Text color="red">UNKNOWN</Text>}
                {result.status === "pending" && <Text dimColor>PENDING</Text>}
              </Box>
            ))}
            {results.length > 15 && (
              <Text dimColor>... and {results.length - 15} more</Text>
            )}
          </Box>
        </Box>
      )}

      {/* Summary */}
      {checkComplete && (
        <Box marginBottom={1} borderStyle="single" borderColor="white" paddingX={2} paddingY={1}>
          <Text bold color="white">Summary: </Text>
          <Text color="green">{summary.redeemed} redeemed</Text>
          <Text> | </Text>
          <Text color="yellow">{summary.active} still active</Text>
          <Text> | </Text>
          <Text color="red">{summary.unknown} unknown</Text>
        </Box>
      )}

      {/* Export message */}
      {exportMessage && (
        <Box marginBottom={1}>
          <Text color="cyan">{exportMessage}</Text>
        </Box>
      )}

      {/* No credits message */}
      {sentCredits.length === 0 && (
        <Box marginBottom={1}>
          <Text color="yellow">No sent credits to check. Send some credits first!</Text>
        </Box>
      )}

      {/* Instructions */}
      <Box marginTop={1} gap={2}>
        {!checking && !checkComplete && sentCredits.length > 0 && (
          <Text><Text inverse> S </Text> Start Check</Text>
        )}
        {checking && (
          <Text dimColor>Checking in progress...</Text>
        )}
        {checkComplete && summary.active > 0 && (
          <Text><Text inverse> E </Text> Export Unused</Text>
        )}
        {!checking && (
          <Text><Text inverse> Q </Text> Back</Text>
        )}
      </Box>
    </Box>
  );
};

export default CheckRedemptions;
