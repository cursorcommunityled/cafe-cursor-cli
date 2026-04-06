import { render } from "@react-email/render";
import { Resend } from "resend";
import { CreditEmail } from "../emails/CreditEmail.js";
import * as localStorage from "../utils/localStorage.js";

export interface SendCursorCreditInput {
  dataPath: string;
  email: string;
  firstName: string;
  lastName: string;
}

/**
 * Resolves or creates a person, reserves a credit, optionally emails via Resend,
 * then assigns the credit and marks the person as sent only after a successful send
 * (or immediately when Resend is not configured).
 */
export type CreditDelivery = "email" | "assigned_only";

export async function sendCursorCreditToGuest(
  input: SendCursorCreditInput
): Promise<{ success: boolean; error?: string; delivery?: CreditDelivery }> {
  const { dataPath, email, firstName, lastName } = input;
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail) {
    return { success: false, error: "Missing email" };
  }

  localStorage.addPerson(
    {
      firstName: firstName.trim() || "Guest",
      lastName: lastName.trim() || "",
      email: normalizedEmail,
    },
    dataPath
  );

  const people = localStorage.loadPeople(dataPath);
  const person = people.find((p) => p.email.toLowerCase() === normalizedEmail);
  if (!person) {
    return { success: false, error: "Could not resolve attendee record" };
  }

  const credit = localStorage.getNextAvailableCredit(dataPath);
  if (!credit) {
    return { success: false, error: "No available credits" };
  }

  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL;

  if (!apiKey || !fromEmail) {
    localStorage.assignCreditToPerson(credit.id, person.id, dataPath);
    localStorage.markPersonSent(person.id, dataPath);
    return { success: true, delivery: "assigned_only" };
  }

  const emailHtml = await render(
    CreditEmail({
      firstName: firstName.trim() || person.firstName,
      creditUrl: credit.url,
      code: credit.code,
      amount: credit.amount,
    })
  );

  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({
    from: fromEmail,
    to: person.email,
    subject: `Your Cursor Credits - $${credit.amount}`,
    html: emailHtml,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  localStorage.assignCreditToPerson(credit.id, person.id, dataPath);
  localStorage.markPersonSent(person.id, dataPath);
  return { success: true, delivery: "email" };
}
