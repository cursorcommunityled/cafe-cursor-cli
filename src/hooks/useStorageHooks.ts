import { useState, useEffect, useCallback } from "react";
import { useQuery as useConvexQuery, useMutation as useConvexMutation, useAction as useConvexAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { useStorage } from "../context/StorageContext.js";
import * as localStorage from "../utils/localStorage.js";

// Type for people list
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

// Type for credit tally
export interface CreditTally {
  total: number;
  available: number;
  count: {
    total: number;
    available: number;
    sent: number;
  };
}

// Hook for listing people
export function usePeopleList(): { data: Person[] | undefined; refresh: () => void } {
  const { isLocal, dataPath } = useStorage();
  const [localData, setLocalData] = useState<Person[] | undefined>(undefined);
  const [refreshKey, setRefreshKey] = useState(0);

  // Cloud query - use "skip" when in local mode
  const cloudData = useConvexQuery(api.people.list, isLocal ? "skip" : {});

  // Load local data
  useEffect(() => {
    if (isLocal) {
      const people = localStorage.loadPeople(dataPath);
      setLocalData(people.map(p => ({
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
      })));
    }
  }, [isLocal, dataPath, refreshKey]);

  const refresh = useCallback(() => {
    setRefreshKey(k => k + 1);
  }, []);

  if (isLocal) {
    return { data: localData, refresh };
  }

  const data = cloudData?.map(p => ({
    id: p._id,
    firstName: p.firstName,
    lastName: p.lastName,
    email: p.email,
    linkedin: p.linkedin,
    twitter: p.twitter,
    drink: p.drink,
    food: p.food,
    workingOn: p.workingOn,
    sentCredits: p.sentCredits,
  }));

  return { data, refresh };
}

// Hook for credit tally
export function useCreditTally(): { data: CreditTally | undefined; refresh: () => void } {
  const { isLocal, dataPath } = useStorage();
  const [localData, setLocalData] = useState<CreditTally | undefined>(undefined);
  const [refreshKey, setRefreshKey] = useState(0);

  // Cloud query - use "skip" when in local mode
  const cloudData = useConvexQuery(api.credits.tallyAll, isLocal ? "skip" : {});

  // Load local data
  useEffect(() => {
    if (isLocal) {
      const tally = localStorage.tallyCredits(dataPath);
      setLocalData(tally);
    }
  }, [isLocal, dataPath, refreshKey]);

  const refresh = useCallback(() => {
    setRefreshKey(k => k + 1);
  }, []);

  if (isLocal) {
    return { data: localData, refresh };
  }

  const data = cloudData ? {
    total: cloudData.total,
    available: cloudData.available,
    count: {
      total: cloudData.count.total,
      available: cloudData.count.available,
      sent: cloudData.count.sent,
    },
  } : undefined;

  return { data, refresh };
}

// Hook for adding a person
export function useAddPerson() {
  const { isLocal, dataPath } = useStorage();
  const cloudMutation = useConvexMutation(api.people.add);

  return useCallback(async (person: {
    firstName: string;
    lastName: string;
    email: string;
    linkedin?: string;
    twitter?: string;
    drink?: string;
    food?: string;
    workingOn?: string;
  }) => {
    if (isLocal) {
      const result = localStorage.addPerson(person, dataPath);
      return { skipped: result.skipped };
    }

    return cloudMutation(person);
  }, [isLocal, dataPath, cloudMutation]);
}

// Hook for adding credits
export function useAddCredit() {
  const { isLocal, dataPath } = useStorage();
  const cloudMutation = useConvexMutation(api.credits.addIfNotExists);

  return useCallback(async (credit: {
    url: string;
    code: string;
    amount: number;
  }) => {
    if (isLocal) {
      return localStorage.addCreditIfNotExists(credit, dataPath);
    }

    return cloudMutation(credit);
  }, [isLocal, dataPath, cloudMutation]);
}

// Hook for sending credits (email in cloud mode, mark as sent in local mode)
export function useSendCredits() {
  const { isLocal, dataPath } = useStorage();
  const cloudAction = useConvexAction(api.email.sendCreditEmail);

  return useCallback(async (personId: string): Promise<{ success: boolean; error?: string }> => {
    if (isLocal) {
      // Get next available credit
      const credit = localStorage.getNextAvailableCredit(dataPath);
      
      if (!credit) {
        return { success: false, error: "No available credits. Please upload more credits first." };
      }

      // Assign credit to person and mark as sent
      localStorage.assignCreditToPerson(credit.id, personId, dataPath);
      localStorage.markPersonSent(personId, dataPath);
      
      return { success: true };
    }

    return cloudAction({ personId: personId as Id<"people"> });
  }, [isLocal, dataPath, cloudAction]);
}

// Type for sent credit with person info
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

// Hook for listing sent credits with person info
export function useSentCredits(): { data: SentCreditWithPerson[] | undefined; refresh: () => void } {
  const { isLocal, dataPath } = useStorage();
  const [localData, setLocalData] = useState<SentCreditWithPerson[] | undefined>(undefined);
  const [refreshKey, setRefreshKey] = useState(0);

  // Cloud query - use "skip" when in local mode
  const cloudData = useConvexQuery(api.credits.listSentWithPerson, isLocal ? "skip" : {});

  // Load local data
  useEffect(() => {
    if (isLocal) {
      const sentCredits = localStorage.loadSentCreditsWithPerson(dataPath);
      setLocalData(sentCredits.map(({ credit, person }) => ({
        id: credit.id,
        url: credit.url,
        code: credit.code,
        amount: credit.amount,
        person: person ? {
          firstName: person.firstName,
          lastName: person.lastName,
          email: person.email,
        } : null,
      })));
    }
  }, [isLocal, dataPath, refreshKey]);

  const refresh = useCallback(() => {
    setRefreshKey(k => k + 1);
  }, []);

  if (isLocal) {
    return { data: localData, refresh };
  }

  const data = cloudData?.map(item => ({
    id: item._id,
    url: item.url,
    code: item.code,
    amount: item.amount,
    person: item.person ? {
      firstName: item.person.firstName,
      lastName: item.person.lastName,
      email: item.person.email,
    } : null,
  }));

  return { data, refresh };
}

// Hook for marking credit as redeemed
export function useMarkRedeemed() {
  const { isLocal, dataPath } = useStorage();
  const cloudMutation = useConvexMutation(api.credits.markRedeemed);

  return useCallback(async (creditId: string): Promise<boolean> => {
    if (isLocal) {
      return localStorage.markCreditRedeemed(creditId, dataPath);
    }

    try {
      await cloudMutation({ creditId: creditId as Id<"credits"> });
      return true;
    } catch {
      return false;
    }
  }, [isLocal, dataPath, cloudMutation]);
}
