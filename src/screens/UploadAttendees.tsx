import React, { useState, useEffect } from "react";
import { Box, Text, useInput } from "ink";
import TextInput from "ink-text-input";
import { parseAttendeeCSV } from "../utils/attendeeParser.js";
import type { Attendee } from "../utils/attendeeParser.js";
import { ProgressBar } from "../components/ProgressBar.js";
import { useStorage } from "../context/StorageContext.js";
import { useAddPerson } from "../hooks/useStorageHooks.js";
import { useFileAutocomplete } from "../hooks/useFileAutocomplete.js";

interface UploadAttendeesProps {
  onBack: () => void;
}

type Stage = "input" | "importing" | "results";

interface ImportResult {
  total: number;
  imported: number;
  skipped: number;
}

const UploadAttendees = ({ onBack }: UploadAttendeesProps) => {
  const { isLocal } = useStorage();
  const [stage, setStage] = useState<Stage>("input");
  const [filepath, setFilepath] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [result, setResult] = useState<ImportResult>({ total: 0, imported: 0, skipped: 0 });
  const [attendees, setAttendees] = useState<Attendee[]>([]);

  const suggestions = useFileAutocomplete(filepath);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(0);
  const addPerson = useAddPerson();

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
      setError("Please select a file");
      return;
    }

    setError(null);
    setStage("importing");

    try {
      const parsed = await parseAttendeeCSV(targetPath);
      setAttendees(parsed);
      setProgress({ current: 0, total: parsed.length });

      let imported = 0;
      let skipped = 0;

      for (let i = 0; i < parsed.length; i++) {
        const attendee = parsed[i];

        if (!attendee) {
          skipped++;
          continue;
        }

        const res = await addPerson({
          firstName: attendee.firstName,
          lastName: attendee.lastName,
          email: attendee.email,
          linkedin: attendee.linkedin,
          twitter: attendee.twitter,
          drink: attendee.drink,
          food: attendee.food,
          workingOn: attendee.workingOn,
        });

        if (res.skipped) {
          skipped++;
        } else {
          imported++;
        }

        setProgress({ current: i + 1, total: parsed.length });
      }

      setResult({ total: parsed.length, imported, skipped });
      setStage("results");
    } catch (err: any) {
      const msg = err.code === 'EISDIR' 
        ? "Cannot read directory. Please select a file." 
        : (err.message || "Failed to parse CSV");
      setError(msg);
      setStage("input");
    }
  };

  if (stage === "input") {
    return (
      <Box flexDirection="column" padding={1}>
        <Box borderStyle="round" borderColor="white" paddingX={2} marginBottom={1}>
          <Text color="white" bold>
            Upload Attendees
          </Text>
          {isLocal && (
            <Text color="green"> [LOCAL MODE]</Text>
          )}
        </Box>

        <Box flexDirection="column" marginBottom={1}>
          <Text color="white">Expected CSV columns:</Text>
          <Text dimColor>  - first_name (required)</Text>
          <Text dimColor>  - last_name (required)</Text>
          <Text dimColor>  - email (required)</Text>
          <Text dimColor>  - What is your LinkedIn profile?</Text>
          <Text dimColor>  - What is your X (Twitter) handle?</Text>
          <Text dimColor>  - What would you like to drink?</Text>
          <Text dimColor>  - What would you like for Snacks?</Text>
          <Text dimColor>  - What are you working on?</Text>
        </Box>

        {isLocal && (
          <Box marginBottom={1}>
            <Text dimColor>Attendees will be saved to: </Text>
            <Text color="green">cafe_people.csv</Text>
          </Box>
        )}

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

        {error && (
          <Box marginBottom={1} marginTop={1}>
            <Text color="red">{error}</Text>
          </Box>
        )}

        <Box marginTop={1}>
          <Text dimColor>
            <Text inverse> ESC </Text> Back
          </Text>
        </Box>
      </Box>
    );
  }

  if (stage === "importing") {
    return (
      <Box flexDirection="column" padding={1}>
        <Box borderStyle="round" borderColor="white" paddingX={2} marginBottom={1}>
          <Text color="white" bold>
            Importing Attendees
          </Text>
          {isLocal && <Text color="green"> [LOCAL]</Text>}
        </Box>

        <Box marginBottom={1}>
          <Text>Processing: </Text>
          <Text color="white">{filepath}</Text>
        </Box>

        <ProgressBar current={progress.current} total={progress.total} />

        <Box marginTop={1}>
          <Text dimColor>
            {isLocal ? "Saving to CSV file..." : "Importing attendees to database..."}
          </Text>
        </Box>
      </Box>
    );
  }

  // Results stage
  return (
    <Box flexDirection="column" padding={1}>
      <Box borderStyle="round" borderColor="green" paddingX={2} marginBottom={1}>
        <Text color="green" bold>
          Import Complete
        </Text>
        {isLocal && <Text color="green"> [LOCAL]</Text>}
      </Box>

      <Box flexDirection="column" marginBottom={1}>
        <Text>
          <Text color="white">Total processed: </Text>
          <Text bold>{result.total}</Text>
        </Text>
        <Text>
          <Text color="green">Imported: </Text>
          <Text bold color="green">{result.imported}</Text>
        </Text>
        <Text>
          <Text color="white">Skipped (duplicates): </Text>
          <Text bold color="white">{result.skipped}</Text>
        </Text>
      </Box>

      {isLocal && result.imported > 0 && (
        <Box marginBottom={1}>
          <Text dimColor>Saved to: </Text>
          <Text color="green">cafe_people.csv</Text>
        </Box>
      )}

      {result.imported > 0 && (
        <Box flexDirection="column" marginBottom={1}>
          <Text color="white" bold>Sample imported:</Text>
          {attendees.slice(0, 3).map((a, i) => (
            <Text key={i} dimColor>
              {a.firstName} {a.lastName} ({a.email})
            </Text>
          ))}
          {attendees.length > 3 && <Text dimColor>...and {attendees.length - 3} more</Text>}
        </Box>
      )}

      <Box marginTop={1}>
        <Text dimColor>
          <Text inverse> Q </Text> or <Text inverse> ESC </Text> Back to menu
        </Text>
      </Box>
    </Box>
  );
};

export default UploadAttendees;