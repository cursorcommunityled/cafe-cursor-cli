import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // People/Attendees table
  people: defineTable({
    firstName: v.string(),
    lastName: v.string(),
    email: v.string(),
    linkedin: v.optional(v.string()),
    twitter: v.optional(v.string()),
    drink: v.optional(v.string()),
    food: v.optional(v.string()),
    workingOn: v.optional(v.string()),
    sentCredits: v.boolean(),
  }).index("by_email", ["email"]),

  // Credits table
  credits: defineTable({
    url: v.string(),
    code: v.string(),
    amount: v.number(),
    status: v.string(), // "available", "assigned", "sent", "redeemed"
    assignedTo: v.optional(v.id("people")),
    checkedAt: v.number(), // timestamp
    sentAt: v.optional(v.number()),
  })
    .index("by_status", ["status"])
    .index("by_code", ["code"])
    .index("by_assignedTo", ["assignedTo"]),
});