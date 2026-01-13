import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// Get all available credits
export const listAvailable = query({
  handler: async (ctx) => {
    return await ctx.db
      .query("credits")
      .withIndex("by_status", (q) => q.eq("status", "available"))
      .collect();
  },
});

// Get total available credits
export const totalAvailable = query({
  handler: async (ctx) => {
    const credits = await ctx.db
      .query("credits")
      .withIndex("by_status", (q) => q.eq("status", "available"))
      .collect();
    return credits.reduce((sum, c) => sum + c.amount, 0);
  },
});

// Tally all credits with breakdown by status
export const tallyAll = query({
  handler: async (ctx) => {
    const allCredits = await ctx.db.query("credits").collect();

    const tally = {
      total: 0,
      available: 0,
      assigned: 0,
      sent: 0,
      redeemed: 0,
      count: {
        total: allCredits.length,
        available: 0,
        assigned: 0,
        sent: 0,
        redeemed: 0,
      },
    };

    for (const credit of allCredits) {
      tally.total += credit.amount;
      if (credit.status === "available") {
        tally.available += credit.amount;
        tally.count.available++;
      } else if (credit.status === "assigned") {
        tally.assigned += credit.amount;
        tally.count.assigned++;
      } else if (credit.status === "sent") {
        tally.sent += credit.amount;
        tally.count.sent++;
      } else if (credit.status === "redeemed") {
        tally.redeemed += credit.amount;
        tally.count.redeemed++;
      }
    }

    return tally;
  },
});

export const add = mutation({
  args: {
    url: v.string(),
    code: v.string(),
    amount: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("credits", {
      ...args,
      status: "available",
      checkedAt: Date.now(),
    });
  },
});

export const addIfNotExists = mutation({
  args: {
    url: v.string(),
    code: v.string(),
    amount: v.number(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("credits")
      .withIndex("by_code", (q) => q.eq("code", args.code))
      .first();

    if (existing) {
      return { added: false, existing: true };
    }

    const id = await ctx.db.insert("credits", {
      ...args,
      status: "available",
      checkedAt: Date.now(),
    });

    return { added: true, id };
  },
});

// Assign credit to person
export const assign = mutation({
  args: {
    creditId: v.id("credits"),
    personId: v.id("people"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.creditId, {
      assignedTo: args.personId,
      status: "assigned",
    });
  },
});

// Mark as sent
export const markSent = mutation({
  args: { creditId: v.id("credits") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.creditId, {
      status: "sent",
      sentAt: Date.now(),
    });
  },
});

// List all sent credits with person info (for redemption checking)
export const listSentWithPerson = query({
  handler: async (ctx) => {
    const credits = await ctx.db
      .query("credits")
      .withIndex("by_status", (q) => q.eq("status", "sent"))
      .collect();

    // Join with people to get names
    return Promise.all(
      credits.map(async (credit) => {
        const person = credit.assignedTo
          ? await ctx.db.get(credit.assignedTo)
          : null;
        return { ...credit, person };
      })
    );
  },
});

// Mark credit as redeemed
export const markRedeemed = mutation({
  args: { creditId: v.id("credits") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.creditId, {
      status: "redeemed",
      checkedAt: Date.now(),
    });
  },
});