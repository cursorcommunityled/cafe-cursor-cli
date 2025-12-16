import React, { useState, useMemo } from "react";
  import { Box, Text, useInput, useStdout } from "ink";
import type { Contact } from "../screens/ProfileConfirm.js";

const PAGE_SIZE = 10;

interface ContactTableProps {
  contacts: Contact[];
  onSelect?: (contact: Contact) => void;
  onBack?: () => void;
  isActive?: boolean;
}

const ContactTable = ({ contacts, onSelect, onBack, isActive = true }: ContactTableProps) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);
  const { stdout } = useStdout();

  const totalPages = Math.max(1, Math.ceil(contacts.length / PAGE_SIZE));

  // Calculate dynamic column widths based on terminal width
  const cols = useMemo(() => {
    const termWidth = stdout?.columns || 180;
    const padding = 4;
    const available = termWidth - padding;
    
    // Fixed columns
    const selector = 2;
    const sent = 5;
    
    // Proportional distribution for remaining space
    const remaining = available - sent - selector;
    const name = Math.floor(remaining * 0.18);
    const email = Math.floor(remaining * 0.30);
    const linkedin = Math.floor(remaining * 0.20);
    const twitter = Math.floor(remaining * 0.17);
    const drink = remaining - name - email - linkedin - twitter;
    
    return { selector, name, email, linkedin, twitter, drink, sent };
  }, [stdout?.columns]);

  // Get contacts for current page
  const pageContacts = useMemo(() => {
    const start = currentPage * PAGE_SIZE;
    return contacts.slice(start, start + PAGE_SIZE);
  }, [contacts, currentPage]);

  // Reset selection and page when contacts change (e.g., from filtering)
  React.useEffect(() => {
    setSelectedIndex(0);
    setCurrentPage(0);
  }, [contacts.length]);

  // Keyboard navigation - only when active
  useInput((input, key) => {
    if (!isActive) return;
    
    if (key.upArrow) {
      if (selectedIndex > 0) {
        setSelectedIndex((prev) => prev - 1);
      } else if (currentPage > 0) {
        setCurrentPage((prev) => prev - 1);
        setSelectedIndex(PAGE_SIZE - 1);
      }
    } else if (key.downArrow) {
      if (selectedIndex < pageContacts.length - 1) {
        setSelectedIndex((prev) => prev + 1);
      } else if (currentPage < totalPages - 1) {
        setCurrentPage((prev) => prev + 1);
        setSelectedIndex(0);
      }
    } else if (key.leftArrow && currentPage > 0) {
      setCurrentPage((prev) => prev - 1);
      setSelectedIndex(0);
    } else if (key.rightArrow && currentPage < totalPages - 1) {
      setCurrentPage((prev) => prev + 1);
      setSelectedIndex(0);
    } else if (key.return && pageContacts.length > 0) {
      onSelect?.(pageContacts[selectedIndex]!);
    } else if (input === "q" || key.escape) {
      onBack?.();
    }
  });

  const padRight = (str: string, len: number) => str.padEnd(len).slice(0, len);
  const totalWidth = cols.selector + cols.name + cols.email + cols.linkedin + cols.twitter + cols.drink + cols.sent;

  // Extract LinkedIn handle from URL or return as-is
  const getLinkedInHandle = (linkedin?: string): string => {
    if (!linkedin) return "-";
    // Extract handle from URL like linkedin.com/in/username
    const match = linkedin.match(/linkedin\.com\/in\/([^/?]+)/i);
    if (match && match[1]) return match[1];
    // If it's already just a handle, return it
    return linkedin;
  };

  // Extract Twitter handle from URL or return as-is
  const getTwitterHandle = (twitter?: string): string => {
    if (!twitter) return "-";
    // Extract handle from URL like twitter.com/username or x.com/username
    const match = twitter.match(/(?:twitter|x)\.com\/([^/?]+)/i);
    if (match && match[1]) return `@${match[1]}`;
    // If it starts with @, return as-is
    if (twitter.startsWith("@")) return twitter;
    // Otherwise add @
    return `@${twitter}`;
  };

  return (
    <Box flexDirection="column" width="100%">
      {/* Header */}
      <Box>
        <Text bold color="white">
          {"  "}
          {padRight("Name", cols.name)}
          {padRight("Email", cols.email)}
          {padRight("LinkedIn", cols.linkedin)}
          {padRight("Twitter", cols.twitter)}
          {padRight("Drink", cols.drink)}
          {padRight("Sent", cols.sent)}
        </Text>
      </Box>
      
      {/* Divider */}
      <Text dimColor>{"─".repeat(totalWidth)}</Text>
      
      {/* Rows */}
      {contacts.length === 0 ? (
        <Box paddingY={1}>
          <Text dimColor>No contacts found</Text>
        </Box>
      ) : (
        pageContacts.map((contact, index) => {
          const isSelected = index === selectedIndex;
          const fullName = `${contact.firstName} ${contact.lastName}`;
          const bg = isSelected && isActive ? "white" : undefined;
          const fg = isSelected && isActive ? "gray" : undefined;
          
          const linkedinHandle = getLinkedInHandle(contact.linkedin);
          const twitterHandle = getTwitterHandle(contact.twitter);
          
          return (
            <Box key={contact.id}>
              <Text backgroundColor={bg} color={fg}>
                {isSelected ? "> " : "  "}
                {padRight(fullName, cols.name)}
                {padRight(contact.email, cols.email)}
              </Text>
              <Text backgroundColor={bg} color={isSelected && isActive ? "gray" : linkedinHandle !== "-" ? "white" : "gray"}>
                {padRight(linkedinHandle, cols.linkedin)}
              </Text>
              <Text backgroundColor={bg} color={isSelected && isActive ? "gray" : twitterHandle !== "-" ? "gray" : "gray"}>
                {padRight(twitterHandle, cols.twitter)}
              </Text>
              <Text backgroundColor={bg} color={fg}>
                {padRight(contact.drink || "-", cols.drink)}
              </Text>
              <Text backgroundColor={bg} color={isSelected && isActive ? "gray" : contact.sent ? "green" : "gray"}>
                {contact.sent ? "\u2714" : "-".padEnd(cols.sent).slice(0, cols.sent)}
              </Text>
            </Box>
          );
        })
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <Box marginTop={1}>
          <Text dimColor>
            Page {currentPage + 1} of {totalPages} ({contacts.length} total)
          </Text>
          <Text dimColor> | </Text>
          <Text dimColor>
            <Text inverse> Left/Right </Text> Change page
          </Text>
        </Box>
      )}
    </Box>
  );
};

export default ContactTable;
