import React, { useState, useMemo, useEffect } from "react";
import { Box, Text, useInput } from "ink";
import TextInput from "ink-text-input";
import ContactTable from "../components/ContactTable.js";
import ProfileConfirm, { type Contact } from "../screens/ProfileConfirm.js";
import { ProgressBar } from "../components/ProgressBar.js";
import { useStorage } from "../context/StorageContext.js";
import { usePeopleList, useCreditTally, useSendCredits } from "../hooks/useStorageHooks.js";

interface SendCreditsProps {
  onBack: () => void;
}

const SendCredits = ({ onBack }: SendCreditsProps) => {
  const { isLocal } = useStorage();
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [showNotSentOnly, setShowNotSentOnly] = useState(false);
  const [showSentOnly, setShowSentOnly] = useState(false);

  // Email sending state
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sendSuccess, setSendSuccess] = useState(false);

  // Use custom hooks for data
  const { data: people, refresh: refreshPeople } = usePeopleList();
  const { data: creditTally, refresh: refreshCredits } = useCreditTally();
  const sendCredits = useSendCredits();

  // Refresh data when entering the page
  useEffect(() => {
    refreshPeople();
    refreshCredits();
  }, []);

  // Handle going back - refresh data before leaving
  const handleBack = () => {
    refreshPeople();
    refreshCredits();
    onBack();
  };

  // Transform database people to Contact format
  const contacts: Contact[] = useMemo(() => {
    if (!people) return [];
    return people.map((person) => ({
      id: person.id,
      firstName: person.firstName,
      lastName: person.lastName,
      email: person.email,
      linkedin: person.linkedin,
      twitter: person.twitter,
      drink: person.drink,
      food: person.food,
      workingOn: person.workingOn,
      sent: person.sentCredits,
    }));
  }, [people]);

  // Filter contacts based on search query and sent status
  const filteredContacts = useMemo(() => {
    let filtered = contacts;
    
    // Filter by sent status
    if (showNotSentOnly) {
      filtered = filtered.filter((contact) => !contact.sent);
    } else if (showSentOnly) {
      filtered = filtered.filter((contact) => contact.sent);
    }
    
    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (contact) =>
          contact.firstName.toLowerCase().includes(query) ||
          contact.lastName.toLowerCase().includes(query) ||
          contact.email.toLowerCase().includes(query) ||
          (contact.workingOn?.toLowerCase().includes(query) ?? false)
      );
    }
    
    return filtered;
  }, [contacts, searchQuery, showNotSentOnly, showSentOnly]);

  // Toggle focus between search and table
  useInput((input, key) => {
    if (selectedContact) return; // Disable when profile is open
    
    if (key.tab) {
      setIsSearchFocused((prev) => !prev);
    } else if (key.escape && isSearchFocused) {
      setIsSearchFocused(false);
    } else if (input === "/" && !isSearchFocused) {
      setIsSearchFocused(true);
    } else if (input === "f" && !isSearchFocused) {
      setShowNotSentOnly((prev) => !prev);
      setShowSentOnly(false);
    } else if (input === "s" && !isSearchFocused) {
      setShowSentOnly((prev) => !prev);
      setShowNotSentOnly(false);
    }
  });

  const handleSelect = (contact: Contact) => {
    setSelectedContact(contact);
    // Reset send states when selecting a new contact
    setIsSending(false);
    setSendError(null);
    setSendSuccess(false);
  };

  const handleConfirmSend = async () => {
    if (!selectedContact) return;

    setIsSending(true);
    setSendError(null);
    setSendSuccess(false);

    const result = await sendCredits(selectedContact.id);

    setIsSending(false);

    if (result.success) {
      setSendSuccess(true);
      // Refresh data after successful send
      refreshPeople();
      refreshCredits();
    } else {
      setSendError(result.error || "Unknown error occurred");
    }
  };

  const handleCancelSend = () => {
    setSelectedContact(null);
    setIsSending(false);
    setSendError(null);
    setSendSuccess(false);
    // Refresh data when closing modal
    refreshPeople();
    refreshCredits();
  };

  // Show loading state
  if (people === undefined) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text color="white">Loading contacts...</Text>
      </Box>
    );
  }

  // Show profile confirmation screen
  if (selectedContact) {
    return (
      <ProfileConfirm
        contact={selectedContact}
        onConfirm={handleConfirmSend}
        onCancel={handleCancelSend}
        isSending={isSending}
        sendError={sendError}
        sendSuccess={sendSuccess}
        isLocal={isLocal}
      />
    );
  }

  return (
    <Box flexDirection="column" padding={1}>
      {/* Mode indicator */}
      {isLocal && (
        <Box marginBottom={1}>
          <Text color="green">[LOCAL MODE]</Text>
          <Text dimColor> - Changes saved to CSV files</Text>
        </Box>
      )}

      {/* Credits Progress Bar */}
      <Box marginBottom={1} flexDirection="column">
        <Box>
          <Text bold color="white">Credits Available: </Text>
          <Text color="white">${creditTally?.available ?? 0}</Text>
          <Text dimColor> / </Text>
          <Text>${creditTally?.total ?? 0}</Text>
          <Text dimColor> total</Text>
        </Box>
        <ProgressBar 
          current={creditTally?.available ?? 0} 
          total={creditTally?.total ?? 0} 
        />
        <Box>
          <Text dimColor>
            {creditTally?.count.available ?? 0} available | {creditTally?.count.sent ?? 0} sent
          </Text>
        </Box>
      </Box>

      <Box marginBottom={1}>
        <Text bold color="white">Send Cursor Credits</Text>
        <Text dimColor> ({filteredContacts.length} recipients)</Text>
        {showNotSentOnly && <Text color="yellow"> [Not Sent Only]</Text>}
        {showSentOnly && <Text color="cyan"> [Sent Only]</Text>}
      </Box>

      <ContactTable 
        contacts={filteredContacts} 
        onSelect={handleSelect}
        onBack={handleBack}
        isActive={!isSearchFocused}
      />

      {/* Results count */}
      {searchQuery && (
        <Box marginTop={1}>
          <Text dimColor>
            Found {filteredContacts.length} of {contacts.length} contacts
          </Text>
        </Box>
      )}

      {/* Search Bar with border */}
      <Box 
        marginTop={1} 
        borderStyle="round" 
        borderColor={isSearchFocused ? "white" : "gray"}
        paddingX={1}
      >
        <Text color={isSearchFocused ? "white" : "gray"}>&gt; </Text>
        <TextInput
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Type to filter contacts..."
          focus={isSearchFocused}
        />
      </Box>

      {/* All instructions at the bottom */}
      <Box marginTop={1} gap={2}>
        <Text dimColor={isSearchFocused}><Text inverse> Up/Down </Text> Navigate</Text>
        <Text dimColor={isSearchFocused}><Text inverse> Enter </Text> Select</Text>
        <Text><Text inverse> Tab </Text> {isSearchFocused ? "Exit Search" : "Search"}</Text>
        <Text dimColor={isSearchFocused}><Text inverse> F </Text> Not Sent</Text>
        <Text dimColor={isSearchFocused}><Text inverse> S </Text> Sent Only</Text>
        <Text dimColor={isSearchFocused}><Text inverse> Q </Text> Back</Text>
      </Box>
    </Box>
  );
};

export default SendCredits;
