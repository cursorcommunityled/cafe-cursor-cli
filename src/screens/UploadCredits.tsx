import React, { useState, useEffect } from "react";
import { Box, Text, useInput } from "ink";
import TextInput from "ink-text-input";
import { parseCSVForUrls } from "../utils/csvParser.js";
import { initBrowser, closeBrowser } from "../utils/creditChecker.js";
import { ProgressBar } from "../components/ProgressBar.js";
import { useStorage } from "../context/StorageContext.js";
import { useAddCredit } from "../hooks/useStorageHooks.js";
import { useFileAutocomplete } from "../hooks/useFileAutocomplete.js";

interface UploadCreditsProps {
  onBack: () => void;
}

type Stage = "input" | "checking" | "results";

interface CheckResult {
  url: string;
  available: boolean;
  amount: number;
}

const UploadCredits = ({ onBack }: UploadCreditsProps) => {
  const { dataPath } = useStorage();
  const [stage, setStage] = useState<Stage>("input");
  const [filepath, setFilepath] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [availableUrls, setAvailableUrls] = useState<CheckResult[]>([]);
  const [totalCredits, setTotalCredits] = useState(0);
  const [savedCount, setSavedCount] = useState(0);
  const [skippedCount, setSkippedCount] = useState(0);

  const suggestions = useFileAutocomplete(filepath);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(0);
  const addCredit = useAddCredit();

  useEffect(() => {
    setSelectedSuggestionIndex(0);
  }, [suggestions]);

  useInput((input, key) => {
    if (stage === "input") {
      if (key.escape) {
        onBack();
      }
      
      if (suggestions.length > 0) {
        if (key.downArrow) {
          setSelectedSuggestionIndex((prev) => Math.min(prev + 1, suggestions.length - 1));
        }
        if (key.upArrow) {
          setSelectedSuggestionIndex((prev) => Math.max(prev - 1, 0));
        }
        if (key.tab) {
          const selected = suggestions[selectedSuggestionIndex];
          if (selected) {
            setFilepath(selected);
          }
        }
      }
    }
    if (stage === "results" && (input === "q" || key.escape)) {
      onBack();
    }
  });

  const handleSubmit = async () => {
    let targetPath = filepath.trim();

    // If using autocomplete and path is just the trigger, use the selected suggestion
    if (targetPath === "/" && suggestions.length > 0) {
      const selected = suggestions[selectedSuggestionIndex];
      if (selected) {
        targetPath = selected;
        setFilepath(selected);
      }
    }

    if (!targetPath || targetPath === "/") {
      setError("Please select a valid file");
      return;
    }

    setError(null);
    setStage("checking");

    try {
      const urls = await parseCSVForUrls(targetPath);

      if (urls.length === 0) {
        setError("No URLs found in CSV file");
        setStage("input");
        return;
      }

      setProgress({ current: 0, total: urls.length });
      await initBrowser(true);

      const results: CheckResult[] = [];
      let credits = 0;
      let saved = 0;
      let skipped = 0;

      for (let i = 0; i < urls.length; i++) {
        const url = urls[i];
        if (!url) continue;

        const result = await import("../utils/creditChecker.js").then(
          (m) => m.checkCreditsAvailable(url)
        );

        if (result.available) {
          const amount = result.amount ?? 20;
          const code = url.match(/code=([A-Z0-9]+)/i)?.[1] ?? "";

          const addResult = await addCredit({ url, code, amount });

          if (addResult.added) {
            saved++;
            results.push({ url, available: true, amount });
            credits += amount;
          } else {
            skipped++;
          }
        }

        setProgress({ current: i + 1, total: urls.length });
        setAvailableUrls([...results]);
        setTotalCredits(credits);
        setSavedCount(saved);
        setSkippedCount(skipped);

        if (i < urls.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }

      await closeBrowser();
      setStage("results");
    } catch (err: any) {
      await closeBrowser();
      const msg = err.code === 'EISDIR' 
        ? "Cannot read directory. Please select a file." 
        : (err.message || "Failed to process file");
      setError(msg);
      setStage("input");
    }
  };

  if (stage === "input") {
    return (
      <Box flexDirection="column" padding={1}>
        <Box marginBottom={1}>
          <Text bold color="white">Upload Cursor Credits</Text>
        </Box>
        {error && (
          <Box marginTop={1}>
            <Text color="red">{error}</Text>
          </Box>
        )}
        <Box marginTop={1} flexDirection="column">
          <Text bold dimColor>Expected CSV format:</Text>
          <Box marginLeft={2} flexDirection="column">
            <Text dimColor>url</Text>
            <Text dimColor>https://cursor.com/referral?code=12345678</Text>
          </Box>
        </Box>

        <Box marginTop={1}>
          <Text dimColor>Credits will be saved under: </Text>
          <Text color="green">{dataPath}</Text>
          <Text dimColor> as </Text>
          <Text color="green">cafe_credits.csv</Text>
        </Box>
        
        <Box borderStyle="round" borderColor="white" paddingX={1} flexDirection="column">
          <Box>
            <Text color="white">Enter CSV file path: </Text>
            <TextInput
              value={filepath}
              onChange={setFilepath}
              onSubmit={handleSubmit}
            />
          </Box>
          {suggestions.length > 0 && (
            <Box flexDirection="column" marginTop={1}>
              {suggestions.map((s, i) => (
                <Text key={s} color={i === selectedSuggestionIndex ? "white" : "gray"}>
                  {i === selectedSuggestionIndex ? "> " : "  "} - {s}
                </Text>
              ))}
            </Box>
          )}
        </Box>
        <Box marginTop={1} gap={2}>
          <Text><Text inverse> Enter </Text> Start</Text>
          <Text><Text inverse> Esc </Text> Back</Text>
        </Box>
      </Box>
    );
  }

  if (stage === "checking") {
    return (
      <Box flexDirection="column" padding={1}>
        <Box marginBottom={1}>
          <Text bold color="white">Checking Credits...</Text>
        </Box>
        <ProgressBar current={progress.current} total={progress.total} />
        <Box marginTop={1}>
          <Text color="green">Available: {availableUrls.length}</Text>
          <Text> | </Text>
          <Text color="yellow">Credits: ${totalCredits}</Text>
          <Text> | </Text>
          <Text color="white">Saved: {savedCount}</Text>
          <Text> | </Text>
          <Text color="gray">Skipped: {skippedCount}</Text>
        </Box>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" padding={1}>
      <Box marginBottom={1}>
        <Text bold color="white">Results</Text>
      </Box>
      <Box marginBottom={1} flexDirection="column">
        <Text bold color="green">Available Codes: {availableUrls.length}</Text>
        <Text bold color="yellow">Total New Credits: ${totalCredits}</Text>
        <Text bold color="white">Saved to CSV: {savedCount}</Text>
        <Text bold color="gray">Skipped (already exists): {skippedCount}</Text>
      </Box>
      {savedCount > 0 && (
        <Box marginBottom={1}>
          <Text dimColor>Credits saved under: </Text>
          <Text color="green">{dataPath}</Text>
        </Box>
      )}
      <Box marginTop={1}>
        <Text><Text inverse> Q </Text> Back to menu</Text>
      </Box>
    </Box>
  );
};

export default UploadCredits;
