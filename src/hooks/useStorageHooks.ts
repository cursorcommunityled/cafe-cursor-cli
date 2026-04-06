import { useState, useEffect, useCallback } from "react";
import { useStorage } from "../context/StorageContext.js";
import * as localStorage from "../utils/localStorage.js";
import {
  sendCursorCreditToGuest,
  type CreditDelivery,
} from "../services/sendCursorCreditEmail.js";

export interface Person {
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
}

export interface CreditTally {
  total: number;
  available: number;
  count: {
    total: number;
    available: number;
    sent: number;
  };
}

export function usePeopleList(): { data: Person[] | undefined; refresh: () => void } {
  const { dataPath } = useStorage();
  const [localData, setLocalData] = useState<Person[] | undefined>(undefined);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const people = localStorage.loadPeople(dataPath);
    setLocalData(
      people.map((p) => ({
        id: p.id,
        firstName: p.firstName,
        lastName: p.lastName,
        email: p.email,
        linkedin: p.linkedin,
        twitter: p.twitter,
        drink: p.drink,
        food: p.food,
        workingOn: p.workingOn,
        sentCredits: p.sentCredits,
      }))
    );
  }, [dataPath, refreshKey]);

  const refresh = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  return { data: localData, refresh };
}

export function useCreditTally(): { data: CreditTally | undefined; refresh: () => void } {
  const { dataPath } = useStorage();
  const [localData, setLocalData] = useState<CreditTally | undefined>(undefined);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const tally = localStorage.tallyCredits(dataPath);
    setLocalData(tally);
  }, [dataPath, refreshKey]);

  const refresh = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  return { data: localData, refresh };
}

export function useAddPerson() {
  const { dataPath } = useStorage();

  return useCallback(
    async (person: {
      firstName: string;
      lastName: string;
      email: string;
      linkedin?: string;
      twitter?: string;
      drink?: string;
      food?: string;
      workingOn?: string;
    }) => {
      return localStorage.addPerson(person, dataPath);
    },
    [dataPath]
  );
}

export function useAddCredit() {
  const { dataPath } = useStorage();

  return useCallback(
    async (credit: { url: string; code: string; amount: number }) => {
      return localStorage.addCreditIfNotExists(credit, dataPath);
    },
    [dataPath]
  );
}

export function useSendCredits() {
  const { dataPath } = useStorage();

  return useCallback(
    async (
      personId: string
    ): Promise<{ success: boolean; error?: string; delivery?: CreditDelivery }> => {
      const people = localStorage.loadPeople(dataPath);
      const person = people.find((p) => p.id === personId);
      if (!person) {
        return { success: false, error: "Person not found" };
      }

      return sendCursorCreditToGuest({
        dataPath,
        email: person.email,
        firstName: person.firstName,
        lastName: person.lastName,
      });
    },
    [dataPath]
  );
}

export interface SentCreditWithPerson {
  id: string;
  url: string;
  code: string;
  amount: number;
  person: {
    firstName: string;
    lastName: string;
    email: string;
  } | null;
}

export function useSentCredits(): { data: SentCreditWithPerson[] | undefined; refresh: () => void } {
  const { dataPath } = useStorage();
  const [localData, setLocalData] = useState<SentCreditWithPerson[] | undefined>(undefined);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const sentCredits = localStorage.loadSentCreditsWithPerson(dataPath);
    setLocalData(
      sentCredits.map(({ credit, person }) => ({
        id: credit.id,
        url: credit.url,
        code: credit.code,
        amount: credit.amount,
        person: person
          ? {
              firstName: person.firstName,
              lastName: person.lastName,
              email: person.email,
            }
          : null,
      }))
    );
  }, [dataPath, refreshKey]);

  const refresh = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  return { data: localData, refresh };
}

export function useMarkRedeemed() {
  const { dataPath } = useStorage();

  return useCallback(
    async (creditId: string): Promise<boolean> => {
      return localStorage.markCreditRedeemed(creditId, dataPath);
    },
    [dataPath]
  );
}
