import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

import {
  addingPerson,
  type PersonTestCase,
  addingCredit,
  gettingNextAvailableCredit,
  type CreditStorageTestCase,
  tallyingCredits,
  type TallyTestCase,
  extractingUrlsFrom,
  type UrlExtractionTestCase,
  person,
  credit,
  scenario,
} from "./dsl";

import {
  loadPeople,
  addPerson,
  loadCredits,
  saveCredits,
  addCreditIfNotExists,
  getNextAvailableCredit,
  tallyCredits,
} from "../src/utils/localStorage";

describe("URL Extraction", () => {
  const REFERRAL_REGEX = /https?:\/\/cursor\.com\/referral\?code=[A-Z0-9]+/gi;

  const extractUrls = (content: string): string[] => {
    const matches = content.match(REFERRAL_REGEX);
    return matches ? [...new Set(matches)] : [];
  };

  const testCases: UrlExtractionTestCase[] = [
    extractingUrlsFrom("https://cursor.com/referral?code=ABC123").shouldFind([
      "https://cursor.com/referral?code=ABC123",
    ]),

    extractingUrlsFrom(
      "Multiple: https://cursor.com/referral?code=AAA and https://cursor.com/referral?code=BBB"
    ).shouldFind([
      "https://cursor.com/referral?code=AAA",
      "https://cursor.com/referral?code=BBB",
    ]),

    extractingUrlsFrom(
      "Duplicate: https://cursor.com/referral?code=DUP https://cursor.com/referral?code=DUP"
    ).shouldFind(["https://cursor.com/referral?code=DUP"]),

    extractingUrlsFrom("No referral URLs here").shouldFindNothing(),

    extractingUrlsFrom("https://other.com/referral?code=XYZ").shouldFindNothing(),
  ];

  testCases.forEach(({ content, expected }) => {
    test(`extracts ${expected.length} URL(s) from "${content.slice(0, 40)}..."`, () => {
      const result = extractUrls(content);
      expect(result).toEqual(expected);
    });
  });
});

describe("People Storage", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "cafe-test-"));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  describe("adding people", () => {
    test("adds new person to empty storage", () => {
      const testCase: PersonTestCase = addingPerson(
        person("John", "Doe", "john@example.com")
      )
        .toEmptyStorage()
        .shouldSucceed();

      const result = addPerson(testCase.person, tempDir);

      expect(result.added).toBe(testCase.expected.added!);
      expect(result.skipped).toBe(testCase.expected.skipped!);

      const people = loadPeople(tempDir);
      expect(people.length).toBe(testCase.expected.totalPeople!);
    });

    test("skips duplicate email (case insensitive)", () => {
      // Setup existing person
      const existing = person("John", "Doe", "john@example.com");
      addPerson(existing, tempDir);

      // Try to add same email with different case
      const duplicate = person("Johnny", "Doe", "JOHN@EXAMPLE.COM");

      const result = addPerson(duplicate, tempDir);

      expect(result.added).toBe(false);
      expect(result.skipped).toBe(true);

      const people = loadPeople(tempDir);
      expect(people.length).toBe(1);
      expect(people[0]?.firstName).toBe("John"); // Original kept
    });

    test("allows different emails", () => {
      addPerson(person("John", "Doe", "john@example.com"), tempDir);
      const result = addPerson(person("Jane", "Doe", "jane@example.com"), tempDir);

      expect(result.added).toBe(true);

      const people = loadPeople(tempDir);
      expect(people.length).toBe(2);
    });
  });

  describe("person with optional fields", () => {
    test("stores optional fields correctly", () => {
      const fullPerson = person("Alice", "Smith", "alice@test.com", {
        linkedin: "linkedin.com/in/alice",
        twitter: "@alice",
        drink: "Coffee",
        food: "Croissant",
        workingOn: "AI Startup",
      });

      addPerson(fullPerson, tempDir);

      const people = loadPeople(tempDir);
      expect(people[0]?.linkedin).toBe("linkedin.com/in/alice");
      expect(people[0]?.twitter).toBe("@alice");
      expect(people[0]?.drink).toBe("Coffee");
      expect(people[0]?.food).toBe("Croissant");
      expect(people[0]?.workingOn).toBe("AI Startup");
    });
  });
});

describe("Credits Storage", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "cafe-test-"));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  describe("adding credits", () => {
    test("adds new credit to empty storage", () => {
      const testCase: CreditStorageTestCase = addingCredit(credit("ABC123", 20))
        .toEmptyStorage()
        .shouldSucceed();

      const result = addCreditIfNotExists(testCase.credit!, tempDir);

      expect(result.added).toBe(testCase.expected.added!);

      const credits = loadCredits(tempDir);
      expect(credits.length).toBe(1);
      expect(credits[0]?.code).toBe("ABC123");
      expect(credits[0]?.amount).toBe(20);
      expect(credits[0]?.available).toBe(true);
    });

    test("skips duplicate URL", () => {
      addCreditIfNotExists(credit("EXISTING", 20), tempDir);

      const result = addCreditIfNotExists(credit("EXISTING", 20), tempDir);

      expect(result.added).toBe(false);

      const credits = loadCredits(tempDir);
      expect(credits.length).toBe(1);
    });

    test("allows different codes", () => {
      addCreditIfNotExists(credit("CODE1", 20), tempDir);
      const result = addCreditIfNotExists(credit("CODE2", 20), tempDir);

      expect(result.added).toBe(true);

      const credits = loadCredits(tempDir);
      expect(credits.length).toBe(2);
    });
  });

  describe("getting next available credit", () => {
    test("returns null from empty storage", () => {
      const testCase = gettingNextAvailableCredit()
        .fromEmptyStorage()
        .shouldReturnNull();

      const result = getNextAvailableCredit(tempDir);

      expect(result).toBeNull();
    });

    test("returns first available credit", () => {
      // Add credits
      addCreditIfNotExists(credit("FIRST", 20), tempDir);
      addCreditIfNotExists(credit("SECOND", 25), tempDir);

      const result = getNextAvailableCredit(tempDir);

      expect(result).not.toBeNull();
      expect(result?.code).toBe("FIRST");
    });

    test("skips unavailable credits", () => {
      // Add available credit
      addCreditIfNotExists(credit("AVAILABLE", 20), tempDir);

      // Manually mark first as unavailable
      const credits = loadCredits(tempDir);
      credits[0]!.available = false;
      saveCredits(credits, tempDir);

      // Add another available one
      addCreditIfNotExists(credit("STILLGOOD", 25), tempDir);

      const result = getNextAvailableCredit(tempDir);

      expect(result?.code).toBe("STILLGOOD");
    });

    test("skips assigned credits", () => {
      addCreditIfNotExists(credit("ASSIGNED", 20), tempDir);
      addCreditIfNotExists(credit("UNASSIGNED", 25), tempDir);

      // Mark first as assigned
      const credits = loadCredits(tempDir);
      credits[0]!.assignedTo = "some-person-id";
      saveCredits(credits, tempDir);

      const result = getNextAvailableCredit(tempDir);

      expect(result?.code).toBe("UNASSIGNED");
    });
  });
});

describe("Credit Tally", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "cafe-test-"));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  const tallyTestCases: TallyTestCase[] = [
    // Empty storage
    tallyingCredits([]).shouldEqual({
      total: 0,
      available: 0,
      count: { total: 0, available: 0, sent: 0 },
    }),

    // All available
    tallyingCredits([
      { ...credit("A"), available: true },
      { ...credit("B"), available: true },
    ]).shouldEqual({
      total: 40,
      available: 40,
      count: { total: 2, available: 2, sent: 0 },
    }),

    // Mixed availability
    tallyingCredits([
      { ...credit("AVAIL1", 20), available: true },
      { ...credit("AVAIL2", 25), available: true },
      { ...credit("SENT", 15), available: false },
    ]).shouldEqual({
      total: 60,
      available: 45,
      count: { total: 3, available: 2, sent: 1 },
    }),

    // All sent
    tallyingCredits([
      { ...credit("SENT1", 20), available: false },
      { ...credit("SENT2", 30), available: false, assignedTo: "person-1" },
    ]).shouldEqual({
      total: 50,
      available: 0,
      count: { total: 2, available: 0, sent: 2 },
    }),
  ];

  tallyTestCases.forEach(({ credits, expected }, index) => {
    test(`tally scenario ${index + 1}: ${expected.count.available} available, ${expected.count.sent} sent`, () => {
      // Setup credits
      credits.forEach((c) => {
        addCreditIfNotExists({ url: c.url, code: c.code, amount: c.amount }, tempDir);
      });

      // Apply availability/assignment
      const stored = loadCredits(tempDir);
      credits.forEach((c, i) => {
        if (stored[i]) {
          stored[i]!.available = c.available ?? true;
          if (c.assignedTo) stored[i]!.assignedTo = c.assignedTo;
        }
      });
      saveCredits(stored, tempDir);

      const result = tallyCredits(tempDir);

      expect(result.total).toBe(expected.total);
      expect(result.available).toBe(expected.available);
      expect(result.count.total).toBe(expected.count.total);
      expect(result.count.available).toBe(expected.count.available);
      expect(result.count.sent).toBe(expected.count.sent);
    });
  });
});

describe("Business Scenarios", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "cafe-test-"));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  test(
    scenario("First-time attendee gets assigned a credit")
      .given("an empty people storage")
      .and("available credits")
      .when("adding a new attendee")
      .then("attendee is stored")
      .and("can be assigned a credit")
      .build().name,
    () => {
      // Given: available credits
      addCreditIfNotExists(credit("GIFT20", 20), tempDir);

      // When: adding attendee
      const attendee = person("New", "Attendee", "new@cafe.com");
      const addResult = addPerson(attendee, tempDir);

      // Then: attendee is stored
      expect(addResult.added).toBe(true);

      const people = loadPeople(tempDir);
      expect(people.length).toBe(1);

      // And: can get next credit for assignment
      const nextCredit = getNextAvailableCredit(tempDir);
      expect(nextCredit).not.toBeNull();
      expect(nextCredit?.code).toBe("GIFT20");
    }
  );

  test(
    scenario("Returning attendee is not duplicated")
      .given("an attendee already in storage")
      .when("adding same email again")
      .then("original record is preserved")
      .and("no duplicate created")
      .build().name,
    () => {
      // Given: existing attendee
      addPerson(person("Original", "Person", "repeat@cafe.com"), tempDir);

      // When: adding same email
      const result = addPerson(person("Different", "Name", "repeat@cafe.com"), tempDir);

      // Then: skipped
      expect(result.skipped).toBe(true);

      // And: original preserved
      const people = loadPeople(tempDir);
      expect(people.length).toBe(1);
      expect(people[0]?.firstName).toBe("Original");
    }
  );

  test(
    scenario("No credits available")
      .given("all credits are assigned")
      .when("requesting next credit")
      .then("null is returned")
      .build().name,
    () => {
      // Given: all credits assigned
      addCreditIfNotExists(credit("USED1", 20), tempDir);
      addCreditIfNotExists(credit("USED2", 20), tempDir);

      const credits = loadCredits(tempDir);
      credits.forEach((c) => {
        c.available = false;
      });
      saveCredits(credits, tempDir);

      // When: requesting next
      const result = getNextAvailableCredit(tempDir);

      // Then: null
      expect(result).toBeNull();
    }
  );

  test(
    scenario("Credit amounts are correctly tallied after partial sending")
      .given("credits with various amounts")
      .when("some are marked as sent")
      .then("tally reflects correct totals")
      .build().name,
    () => {
      // Given: various credits
      addCreditIfNotExists(credit("BIG", 50), tempDir);
      addCreditIfNotExists(credit("MED", 25), tempDir);
      addCreditIfNotExists(credit("SMALL", 10), tempDir);

      // When: mark one as sent
      const credits = loadCredits(tempDir);
      credits[0]!.available = false; // BIG is sent

      saveCredits(credits, tempDir);

      // Then: tally is correct
      const tally = tallyCredits(tempDir);
      expect(tally.total).toBe(85);
      expect(tally.available).toBe(35); // MED + SMALL
      expect(tally.count.available).toBe(2);
      expect(tally.count.sent).toBe(1);
    }
  );
});
