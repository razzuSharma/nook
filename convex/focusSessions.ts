import { mutation, query } from "./_generated/server"
import { v } from "convex/values"

const defaultSessions = [
  {
    sessionId: "session-seed-1",
    intention: "Ship Convex rooms migration",
    reflection: "Connected dashboard rooms and sidebar to Convex successfully.",
    durationMinutes: 42,
    completedAt: "2026-02-16T10:30:00.000Z",
  },
]

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("focusSessions")
      .withIndex("by_createdAt")
      .order("desc")
      .collect()
  },
})

export const ensureDefaults = mutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db.query("focusSessions").first()
    if (existing) {
      return
    }

    for (const session of defaultSessions) {
      await ctx.db.insert("focusSessions", {
        ...session,
        createdAt: Date.now(),
      })
    }
  },
})

export const create = mutation({
  args: {
    sessionId: v.string(),
    intention: v.string(),
    reflection: v.string(),
    durationMinutes: v.number(),
    completedAt: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("focusSessions", {
      sessionId: args.sessionId,
      intention: args.intention.trim(),
      reflection: args.reflection.trim(),
      durationMinutes: args.durationMinutes,
      completedAt: args.completedAt,
      createdAt: Date.now(),
    })
  },
})
