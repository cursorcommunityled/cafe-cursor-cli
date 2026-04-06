#!/usr/bin/env bun
import React, { useState, useEffect } from "react";
import { render, Text, Box, useInput, useApp } from "ink";
import figlet from "figlet";
import SelectInput from "ink-select-input";
import SendCredits from "./screens/SendCredits.js";
import UploadCredits from "./screens/UploadCredits.js";
import UploadAttendees from "./screens/UploadAttendees.js";
import CheckRedemptions from "./screens/CheckRedemptions.js";
import { StorageProvider, useStorage } from "./context/StorageContext.js";

type Screen = "menu" | "send" | "upload" | "attendees" | "check";

const clearScreen = () => {
  process.stdout.write("\x1B[2J\x1B[0f");
};

const exitApp = () => {
  clearScreen();
  process.exit(0);
};

process.on("SIGINT", exitApp);
process.on("SIGTERM", exitApp);

const MainMenu = () => {
  const { exit } = useApp();
  const { dataPath } = useStorage();
  const [banner, setBanner] = useState<string>("");
  const [screen, setScreen] = useState<Screen>("menu");
  const [highlighted, setHighlighted] = useState<string>("send");

  useEffect(() => {
    clearScreen();
    figlet.text("CAFE CURSOR", { font: "ANSI Shadow" }, (err, data) => {
      if (data) setBanner(data);
    });
  }, []);

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
    } else if (input === "4") {
      clearScreen();
      setScreen("check");
    }
  });

  const menuItems = [
    { label: "Send Cursor Credits", value: "send" },
    { label: "Upload Cursor Credits", value: "upload" },
    { label: "Upload Attendees", value: "attendees" },
    { label: "Check Credit Redemptions", value: "check" },
  ];

  const handleSelect = (item: { label: string; value: string }) => {
    clearScreen();
    setScreen(item.value as Screen);
  };

  const handleBack = () => {
    clearScreen();
    setScreen("menu");
  };

  if (screen === "send") {
    return <SendCredits onBack={handleBack} />;
  }

  if (screen === "upload") {
    return <UploadCredits onBack={handleBack} />;
  }

  if (screen === "attendees") {
    return <UploadAttendees onBack={handleBack} />;
  }

  if (screen === "check") {
    return <CheckRedemptions onBack={handleBack} />;
  }

  return (
    <Box flexDirection="column" padding={1}>
      <Box borderStyle="round" borderColor="white" paddingX={2} flexDirection="column">
        <Text color="white">{banner}</Text>

        <Box marginTop={1} paddingX={1} borderStyle="single" borderColor="white">
          <Text color="white">[LOCAL DATA]</Text>
          <Text dimColor> {dataPath}</Text>
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
          <Text color={highlighted === "send" ? "white" : "gray"}>
            <Text inverse> 1 </Text> Send
          </Text>
          <Text color={highlighted === "upload" ? "white" : "gray"}>
            <Text inverse> 2 </Text> Credits
          </Text>
          <Text color={highlighted === "attendees" ? "white" : "gray"}>
            <Text inverse> 3 </Text> Attendees
          </Text>
          <Text color={highlighted === "check" ? "white" : "gray"}>
            <Text inverse> 4 </Text> Check
          </Text>
          <Text color="gray">
            <Text inverse> Q </Text> Quit
          </Text>
        </Box>
      </Box>
    </Box>
  );
};

render(
  <StorageProvider>
    <MainMenu />
  </StorageProvider>
);
