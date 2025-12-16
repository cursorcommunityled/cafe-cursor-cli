import { readFile } from "fs/promises";

export interface Attendee {
  firstName: string;
  lastName: string;
  email: string;
  linkedin?: string;
  twitter?: string;
  drink?: string;
  food?: string;
  workingOn?: string;
}

// Column mappings from CSV header to our field names
const COLUMN_MAP: Record<string, keyof Attendee> = {
  first_name: "firstName",
  last_name: "lastName",
  email: "email",
  "What is your LinkedIn profile?": "linkedin",
  "What is your X (Twitter) handle?": "twitter",
  "What would you like to drink?": "drink",
  "What would you like for Snacks?": "food",
  "What are you working on?": "workingOn",
};

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

export async function parseAttendeeCSV(filepath: string): Promise<Attendee[]> {
  const content = await readFile(filepath, "utf-8");
  const lines = content.split("\n").filter((line) => line.trim());

  if (lines.length < 2) {
    throw new Error("CSV must have a header row and at least one data row");
  }

  const headers = parseCSVLine(lines[0]!);
  const columnIndexes: Partial<Record<keyof Attendee, number>> = {};

  // Map headers to column indexes
  headers.forEach((header, index) => {
    const fieldName = COLUMN_MAP[header];
    if (fieldName) {
      columnIndexes[fieldName] = index;
    }
  });

  // Validate required columns
  if (columnIndexes.firstName === undefined) {
    throw new Error("Missing required column: first_name");
  }
  if (columnIndexes.lastName === undefined) {
    throw new Error("Missing required column: last_name");
  }
  if (columnIndexes.email === undefined) {
    throw new Error("Missing required column: email");
  }

  const attendees: Attendee[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]!);

    const firstName = values[columnIndexes.firstName!] || "";
    const lastName = values[columnIndexes.lastName!] || "";
    const email = values[columnIndexes.email!] || "";

    // Skip rows without required fields
    if (!firstName || !lastName || !email) {
      continue;
    }

    const attendee: Attendee = {
      firstName,
      lastName,
      email,
    };

    // Add optional fields if present
    if (columnIndexes.linkedin !== undefined && values[columnIndexes.linkedin]) {
      attendee.linkedin = values[columnIndexes.linkedin];
    }
    if (columnIndexes.twitter !== undefined && values[columnIndexes.twitter]) {
      attendee.twitter = values[columnIndexes.twitter];
    }
    if (columnIndexes.drink !== undefined && values[columnIndexes.drink]) {
      attendee.drink = values[columnIndexes.drink];
    }
    if (columnIndexes.food !== undefined && values[columnIndexes.food]) {
      attendee.food = values[columnIndexes.food];
    }
    if (columnIndexes.workingOn !== undefined && values[columnIndexes.workingOn]) {
      attendee.workingOn = values[columnIndexes.workingOn];
    }

    attendees.push(attendee);
  }

  return attendees;
}
