import React, { useState } from "react";
import { Box, Text, useInput } from "ink";
import { execFile } from "child_process";

const ALLOWED_OPEN_HOSTS = new Set([
  "linkedin.com",
  "www.linkedin.com",
  "x.com",
  "www.x.com",
  "twitter.com",
  "www.twitter.com",
]);

function isAllowedHttpUrl(raw: string): boolean {
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== "https:") return false;
    return ALLOWED_OPEN_HOSTS.has(parsed.hostname.toLowerCase());
  } catch {
    return false;
  }
}

const openUrl = (url: string) => {
  if (!isAllowedHttpUrl(url)) {
    return;
  }

  if (process.platform === "darwin") {
    execFile("/usr/bin/open", [url], () => {});
    return;
  }
  if (process.platform === "win32") {
    execFile("C:\\Windows\\System32\\cmd.exe", ["/c", "start", "", url], () => {});
    return;
  }
  execFile("/usr/bin/xdg-open", [url], () => {});
};

export interface Contact {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  linkedin?: string;
  twitter?: string;
  drink?: string;
  food?: string;
  workingOn?: string;
  sent: boolean;
}

interface ProfileConfirmProps {
  contact: Contact;
  onConfirm: () => void;
  onCancel: () => void;
  isSending?: boolean;
  sendError?: string | null;
  sendSuccess?: boolean;
  isLocal?: boolean;
}

const ProfileConfirm = ({
  contact,
  onConfirm,
  onCancel,
  isSending = false,
  sendError = null,
  sendSuccess = false,
  isLocal = false,
}: ProfileConfirmProps) => {
  const [selected, setSelected] = useState<"yes" | "no">("yes");

  useInput((input, key) => {
    // Disable input while sending or after success/error
    if (isSending) return;

    // After success or error, any key returns to list
    if (sendSuccess || sendError) {
      onCancel();
      return;
    }

    if (key.leftArrow || key.rightArrow) {
      setSelected((prev) => (prev === "yes" ? "no" : "yes"));
    } else if (key.return) {
      if (selected === "yes") {
        onConfirm();
      } else {
        onCancel();
      }
    } else if (input === "l" && contact.linkedin) {
      openUrl(contact.linkedin);
    } else if (input === "t" && contact.twitter) {
      let twitterUrl = contact.twitter;
      if (twitterUrl.startsWith("@")) {
        twitterUrl = `https://x.com/${twitterUrl.substring(1)}`;
      } else if (!twitterUrl.startsWith("http")) {
        twitterUrl = `https://x.com/${twitterUrl}`;
      }
      openUrl(twitterUrl);
    } else if (key.escape || input === "q") {
      onCancel();
    }
  });

  const fullName = `${contact.firstName} ${contact.lastName}`;

  // Show success screen
  if (sendSuccess) {
    return (
      <Box flexDirection="column" padding={1}>
        <Box marginBottom={1}>
          <Text bold color="green">
            {isLocal ? "Credit Assigned Successfully!" : "Email Sent Successfully!"}
          </Text>
        </Box>
        <Box flexDirection="column" borderStyle="round" borderColor="green" padding={1}>
          <Text>{isLocal ? "Credit has been assigned to:" : "Credits have been sent to:"}</Text>
          <Text bold color="gray">{contact.email}</Text>
          {isLocal && (
            <Text dimColor>(Saved to cafe_credits.csv and cafe_people.csv)</Text>
          )}
        </Box>
        <Box marginTop={1}>
          <Text dimColor>Press any key to continue...</Text>
        </Box>
      </Box>
    );
  }

  // Show error screen
  if (sendError) {
    return (
      <Box flexDirection="column" padding={1}>
        <Box marginBottom={1}>
          <Text bold color="red">Failed to Send Email</Text>
        </Box>
        <Box flexDirection="column" borderStyle="round" borderColor="red" padding={1}>
          <Text>Error: {sendError}</Text>
        </Box>
        <Box marginTop={1}>
          <Text dimColor>Press any key to continue...</Text>
        </Box>
      </Box>
    );
  }

  // Show sending state
  if (isSending) {
    return (
      <Box flexDirection="column" padding={1}>
        <Box marginBottom={1}>
          <Text bold color="yellow">
            {isLocal ? "Assigning Credit..." : "Sending Credits..."}
          </Text>
        </Box>
        <Box flexDirection="column" borderStyle="round" borderColor="yellow" padding={1}>
          <Text>
            {isLocal 
              ? `Assigning credit to ${contact.email}` 
              : `Sending email to ${contact.email}`
            }
          </Text>
          <Text dimColor>Please wait...</Text>
        </Box>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" padding={1}>
      <Box marginBottom={1}>
        <Text bold color="gray">Contact Profile</Text>
      </Box>

      <Box flexDirection="column" borderStyle="round" borderColor="gray" padding={1}>
        <Box>
          <Text bold>Name:       </Text>
          <Text>{fullName}</Text>
        </Box>
        <Box>
          <Text bold>Email:      </Text>
          <Text color="gray">{contact.email}</Text>
        </Box>
        {contact.linkedin && (
          <Box>
            <Text bold>LinkedIn:   </Text>
            <Text color="white">{contact.linkedin}</Text>
          </Box>
        )}
        {contact.twitter && (
          <Box>
            <Text bold>Twitter:    </Text>
            <Text color="gray">{contact.twitter}</Text>
          </Box>
        )}
        {contact.workingOn && (
          <Box>
            <Text bold>Working On: </Text>
            <Text>{contact.workingOn}</Text>
          </Box>
        )}
        {contact.drink && (
          <Box>
            <Text bold>Drink:      </Text>
            <Text>{contact.drink}</Text>
          </Box>
        )}
        {contact.food && (
          <Box>
            <Text bold>Food:       </Text>
            <Text>{contact.food}</Text>
          </Box>
        )}
        <Box>
          <Text bold>Sent:       </Text>
          <Text color={contact.sent ? "green" : "yellow"}>{contact.sent ? "Yes" : "No"}</Text>
        </Box>
      </Box>

      <Box marginTop={1}>
        <Text bold>
          {isLocal 
            ? `Assign Credit to ${fullName}?` 
            : `Send Cursor Credits to ${fullName}?`
          }
        </Text>
        {isLocal && (
          <Text dimColor> (no email will be sent)</Text>
        )}
      </Box>

      <Box marginTop={1} gap={2}>
        <Text
          backgroundColor={selected === "yes" ? "green" : undefined}
          color={selected === "yes" ? "gray" : "gray"}
        >
          {selected === "yes" ? "> " : "  "}Yes
        </Text>
        <Text
          backgroundColor={selected === "no" ? "red" : undefined}
          color={selected === "no" ? "gray" : "gray"}
        >
          {selected === "no" ? "> " : "  "}No
        </Text>
      </Box>

      <Box marginTop={1} gap={2}>
        <Text><Text inverse> Left/Right </Text> Select</Text>
        <Text><Text inverse> Enter </Text> Confirm</Text>
        {contact.linkedin && <Text><Text inverse> L </Text> LinkedIn</Text>}
        {contact.twitter && <Text><Text inverse> T </Text> Twitter</Text>}
        <Text><Text inverse> Q </Text> Cancel</Text>
      </Box>
    </Box>
  );
};

export default ProfileConfirm;
