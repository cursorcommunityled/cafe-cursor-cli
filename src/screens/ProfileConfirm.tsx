import React, { useState } from "react";
import { Box, Text, useInput } from "ink";
import { exec } from "child_process";
import type { CreditDelivery } from "../services/sendCursorCreditEmail.js";

const openUrl = (url: string) => {
  let command;
  switch (process.platform) {
    case "darwin":
      command = `open "${url}"`;
      break;
    case "win32":
      command = `start "" "${url}"`;
      break;
    default:
      command = `xdg-open "${url}"`;
  }
  
  exec(command, (error) => {
    if (error) {
      // Silently fail if unable to open URL
    }
  });
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
  /** When Resend is configured, credits are emailed; otherwise only assigned in CSV. */
  sendsEmail?: boolean;
  delivery?: CreditDelivery | null;
}

const ProfileConfirm = ({
  contact,
  onConfirm,
  onCancel,
  isSending = false,
  sendError = null,
  sendSuccess = false,
  sendsEmail = true,
  delivery = null,
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
    const emailed = delivery === "email" || (delivery == null && sendsEmail);
    return (
      <Box flexDirection="column" padding={1}>
        <Box marginBottom={1}>
          <Text bold color="green">
            {emailed ? "Email Sent Successfully!" : "Credit Assigned Successfully!"}
          </Text>
        </Box>
        <Box flexDirection="column" borderStyle="round" borderColor="green" padding={1}>
          <Text>
            {emailed ? "Credits have been sent to:" : "Credit has been assigned to:"}
          </Text>
          <Text bold color="gray">{contact.email}</Text>
          {!emailed && (
            <Text dimColor>
              Set RESEND_API_KEY and RESEND_FROM_EMAIL to email codes automatically.
            </Text>
          )}
          <Text dimColor>(Saved to cafe_credits.csv and cafe_people.csv)</Text>
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
            {sendsEmail ? "Sending Credits..." : "Assigning Credit..."}
          </Text>
        </Box>
        <Box flexDirection="column" borderStyle="round" borderColor="yellow" padding={1}>
          <Text>
            {sendsEmail
              ? `Sending email to ${contact.email}`
              : `Assigning credit to ${contact.email}`}
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
          {sendsEmail
            ? `Send Cursor Credits to ${fullName}?`
            : `Assign Credit to ${fullName}?`}
        </Text>
        {!sendsEmail && <Text dimColor> (no email will be sent)</Text>}
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
