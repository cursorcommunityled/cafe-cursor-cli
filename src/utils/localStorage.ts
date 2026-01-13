import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import Papa from "papaparse";

// File names for local storage
const PEOPLE_FILE = "cafe_people.csv";
const CREDITS_FILE = "cafe_credits.csv";

export interface LocalPerson {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  linkedin?: string;
  twitter?: string;
  drink?: string;
  food?: string;
  workingOn?: string;
  sentCredits: boolean;
  createdAt: string;
}

export interface LocalCredit {
  id: string;
  url: string;
  code: string;
  amount: number;
  available: boolean;
  status?: string; // "available", "sent", "redeemed"
  assignedTo?: string;
  createdAt: string;
}

// Generate simple unique ID
const generateId = () => `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

// Get file path
const getFilePath = (filename: string, basePath: string = process.cwd()) => {
  return join(basePath, filename);
};

// --- People Functions ---

export const loadPeople = (basePath?: string): LocalPerson[] => {
  const filepath = getFilePath(PEOPLE_FILE, basePath);
  
  if (!existsSync(filepath)) {
    return [];
  }

  const content = readFileSync(filepath, "utf-8");
  const result = Papa.parse<LocalPerson>(content, { 
    header: true,
    transformHeader: (h) => h.trim(),
    transform: (value, field) => {
      if (field === "sentCredits") {
        return value === "true";
      }
      return value;
    }
  });
  
  return result.data.filter(p => p.email); // Filter out empty rows
};

export const savePeople = (people: LocalPerson[], basePath?: string): void => {
  const filepath = getFilePath(PEOPLE_FILE, basePath);
  const csv = Papa.unparse(people);
  writeFileSync(filepath, csv, "utf-8");
};

export const addPerson = (
  person: Omit<LocalPerson, "id" | "sentCredits" | "createdAt">,
  basePath?: string
): { added: boolean; skipped: boolean } => {
  const people = loadPeople(basePath);
  
  // Check if person already exists by email
  const exists = people.some(p => p.email.toLowerCase() === person.email.toLowerCase());
  
  if (exists) {
    return { added: false, skipped: true };
  }

  const newPerson: LocalPerson = {
    ...person,
    id: generateId(),
    sentCredits: false,
    createdAt: new Date().toISOString(),
  };

  people.push(newPerson);
  savePeople(people, basePath);
  
  return { added: true, skipped: false };
};

export const updatePerson = (
  id: string, 
  updates: Partial<LocalPerson>,
  basePath?: string
): boolean => {
  const people = loadPeople(basePath);
  const index = people.findIndex(p => p.id === id);
  
  if (index === -1) {
    return false;
  }

  people[index] = { ...people[index], ...updates } as LocalPerson;
  savePeople(people, basePath);
  
  return true;
};

export const markPersonSent = (id: string, basePath?: string): boolean => {
  return updatePerson(id, { sentCredits: true }, basePath);
};

// --- Credits Functions ---

export const loadCredits = (basePath?: string): LocalCredit[] => {
  const filepath = getFilePath(CREDITS_FILE, basePath);
  
  if (!existsSync(filepath)) {
    return [];
  }

  const content = readFileSync(filepath, "utf-8");
  const result = Papa.parse<LocalCredit>(content, { 
    header: true,
    transformHeader: (h) => h.trim(),
    transform: (value, field) => {
      if (field === "available") {
        return value === "true";
      }
      if (field === "amount") {
        return parseInt(value, 10) || 0;
      }
      return value;
    }
  });
  
  return result.data.filter(c => c.url); // Filter out empty rows
};

export const saveCredits = (credits: LocalCredit[], basePath?: string): void => {
  const filepath = getFilePath(CREDITS_FILE, basePath);
  const csv = Papa.unparse(credits);
  writeFileSync(filepath, csv, "utf-8");
};

export const addCreditIfNotExists = (
  credit: { url: string; code: string; amount: number },
  basePath?: string
): { added: boolean } => {
  const credits = loadCredits(basePath);
  
  // Check if credit already exists by URL or code
  const exists = credits.some(
    c => c.url === credit.url || c.code === credit.code
  );
  
  if (exists) {
    return { added: false };
  }

  const newCredit: LocalCredit = {
    id: generateId(),
    url: credit.url,
    code: credit.code,
    amount: credit.amount,
    available: true,
    createdAt: new Date().toISOString(),
  };

  credits.push(newCredit);
  saveCredits(credits, basePath);
  
  return { added: true };
};

export const getNextAvailableCredit = (basePath?: string): LocalCredit | null => {
  const credits = loadCredits(basePath);
  return credits.find(c => c.available && !c.assignedTo) || null;
};

export const assignCreditToPerson = (
  creditId: string,
  personId: string,
  basePath?: string
): boolean => {
  const credits = loadCredits(basePath);
  const index = credits.findIndex(c => c.id === creditId);
  
  if (index === -1) {
    return false;
  }

  credits[index]!.assignedTo = personId;
  credits[index]!.available = false;
  saveCredits(credits, basePath);
  
  return true;
};

export const tallyCredits = (basePath?: string): {
  total: number;
  available: number;
  count: { total: number; available: number; sent: number };
} => {
  const credits = loadCredits(basePath);
  
  const available = credits.filter(c => c.available && !c.assignedTo);
  const sent = credits.filter(c => !c.available || c.assignedTo);
  
  return {
    total: credits.reduce((sum, c) => sum + c.amount, 0),
    available: available.reduce((sum, c) => sum + c.amount, 0),
    count: {
      total: credits.length,
      available: available.length,
      sent: sent.length,
    },
  };
};

// Load sent credits with person info (for redemption checking)
export const loadSentCreditsWithPerson = (basePath?: string): Array<{
  credit: LocalCredit;
  person: LocalPerson | null;
}> => {
  const credits = loadCredits(basePath);
  const people = loadPeople(basePath);
  
  // Filter to only sent credits (assigned but not redeemed)
  const sentCredits = credits.filter(c => c.assignedTo && c.status !== "redeemed");
  
  return sentCredits.map(credit => {
    const person = people.find(p => p.id === credit.assignedTo) || null;
    return { credit, person };
  });
};

// Mark a credit as redeemed
export const markCreditRedeemed = (creditId: string, basePath?: string): boolean => {
  const credits = loadCredits(basePath);
  const index = credits.findIndex(c => c.id === creditId);
  
  if (index === -1) {
    return false;
  }

  credits[index]!.status = "redeemed";
  saveCredits(credits, basePath);
  
  return true;
};
