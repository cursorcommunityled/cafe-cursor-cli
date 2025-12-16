#!/usr/bin/env bun
import React, { useState, useEffect } from "react";
import { render, Text, Box, useInput, useApp } from "ink";
import figlet from "figlet";
import SelectInput from "ink-select-input";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import SendCredits from "./screens/SendCredits.js";
import UploadCredits from "./screens/UploadCredits.js";
import UploadAttendees from "./screens/UploadAttendees.js";
import ModeSelector from "./components/ModeSelector.js";
import { StorageProvider, useStorage, type StorageMode } from "./context/StorageContext.js";

// Check if cloud mode can be used (has required env vars)
const hasCloudConfig = Boolean(
  process.env.CONVEX_URL &&
  process.env.RESEND_API_KEY &&
  process.env.RESEND_FROM_EMAIL
);

// Only create Convex client if we have the URL
const convex = new ConvexReactClient(process.env.CONVEX_URL!);

type Screen = "menu" | "send" | "upload" | "attendees";

const clearScreen = () => {
  process.stdout.write("\x1B[2J\x1B[0f");
};

const exitApp = () => {
  clearScreen();
  process.exit(0);
};

// Handle process exit signals
process.on("SIGINT", exitApp);
process.on("SIGTERM", exitApp);

// Main menu component (used after mode is selected)
const MainMenu = () => {
  const { exit } = useApp();
  const { isLocal, setMode } = useStorage();
  const [banner, setBanner] = useState<string>("");
  const [screen, setScreen] = useState<Screen>("menu");
  const [highlighted, setHighlighted] = useState<string>("send");

  useEffect(() => {
    clearScreen();
    figlet.text("CAFE CURSOR", { font: "ANSI Shadow" }, (err, data) => {
      if (data) setBanner(data);
    });
  }, []);

  // Handle keyboard shortcuts from main menu
  useInput((input, key) => {
    if (screen !== "menu") return;
    
    if (input === "q" || key.escape) {
      clearScreen();
      exit();
    } else if (input === "1") {
      clearScreen();
      setScreen("send");
    } else if (input === "2") {
      clearScreen();
      setScreen("upload");
    } else if (input === "3") {
      clearScreen();
      setScreen("attendees");
    }
  });

  const menuItems = [
    { label: "Send Cursor Credits", value: "send" },
    { label: "Upload Cursor Credits", value: "upload" },
    { label: "Upload Attendees", value: "attendees" },
  ];

  const handleSelect = (item: { label: string; value: string }) => {
    clearScreen();
    setScreen(item.value as Screen);
  };

  const handleBack = () => {
    clearScreen();
    setScreen("menu");
  };

  // Render Send Credits screen
  if (screen === "send") {
    return <SendCredits onBack={handleBack} />;
  }

  // Render Upload screen
  if (screen === "upload") {
    return <UploadCredits onBack={handleBack} />;
  }

  // Render Upload Attendees screen
  if (screen === "attendees") {
    return <UploadAttendees onBack={handleBack} />;
  }

  // Render main menu
  return (
    <Box flexDirection="column" padding={1}>
      <Box borderStyle="round" borderColor="white" paddingX={2} flexDirection="column">
        <Text color="white">{banner}</Text>
        
        {/* Mode indicator banner */}
        <Box 
          marginTop={1} 
          paddingX={1} 
          borderStyle="single" 
          borderColor="white"
        >
          <Text color="white">
            {isLocal ? "[LOCAL MODE]" : "[CLOUD MODE]"} 
          </Text>
          <Text dimColor>
            {isLocal 
              ? " - Using CSV files in current directory" 
              : " - Using Convex database"
            }
          </Text>
        </Box>

        <Box marginTop={1} flexDirection="column">
          <Text bold>Select an option:</Text>
          <SelectInput 
            items={menuItems} 
            onSelect={handleSelect} 
            onHighlight={(item) => setHighlighted(item.value)}
          />
        </Box>
        <Box marginTop={1} gap={2}>
          <Text color={highlighted === "send" ? "white" : "gray"}><Text inverse> 1 </Text> Send</Text>
          <Text color={highlighted === "upload" ? "white" : "gray"}><Text inverse> 2 </Text> Credits</Text>
          <Text color={highlighted === "attendees" ? "white" : "gray"}><Text inverse> 3 </Text> Attendees</Text>
          <Text color="gray"><Text inverse> Q </Text> Quit</Text>
        </Box>
      </Box>
    </Box>
  );
};

// Root app component that handles mode selection
const App = () => {
  const { mode, setMode } = useStorage();
  const [modeSelected, setModeSelected] = useState(false);

  const handleModeSelect = (selectedMode: StorageMode) => {
    // Validate cloud mode has required env vars
    if (selectedMode === "cloud" && !hasCloudConfig) {
      // Can't use cloud mode without config - show error
      console.error("\x1b[31mError: Cloud mode requires environment variables:\x1b[0m");
      console.error("  CONVEX_URL, RESEND_API_KEY, RESEND_FROM_EMAIL");
      console.error("\nUsing local mode instead...\n");
      selectedMode = "local";
    }
    
    setMode(selectedMode);
    clearScreen();
    setModeSelected(true);
  };

  // Show mode selector first
  if (!modeSelected) {
    return <ModeSelector onSelect={handleModeSelect} />;
  }

  // Always provide Convex client (even if dummy) so hooks don't crash in local mode
  return (
    <ConvexProvider client={convex}>
      <MainMenu />
    </ConvexProvider>
  );
};

render(
  <StorageProvider>
    <App />
  </StorageProvider>
);
