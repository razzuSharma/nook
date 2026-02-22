import { mutation, query } from "./_generated/server"
import type { MutationCtx, QueryCtx } from "./_generated/server"
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

function toHex(bytes: Uint8Array) {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
}

async function sha256(value: string) {
  const data = new TextEncoder().encode(value)
  const digest = await crypto.subtle.digest("SHA-256", data)
  return toHex(new Uint8Array(digest))
}

async function requireUserId(
  ctx: QueryCtx | MutationCtx,
  sessionToken: string
) {
  const tokenHash = await sha256(sessionToken)
  const session = await ctx.db
    .query("authSessions")
    .withIndex("by_tokenHash", (indexQuery) =>
      indexQuery.eq("tokenHash", tokenHash)
    )
    .first()

  if (!session || session.expiresAt <= Date.now()) {
    throw new Error("Unauthorized.")
  }

  const user = await ctx.db.get(session.userId)
  if (!user) {
    throw new Error("Unauthorized.")
  }

  return user._id
}

export const list = query({
  args: {
    sessionToken: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx, args.sessionToken)
    return await ctx.db
      .query("focusSessions")
      .withIndex("by_user_createdAt", (indexQuery) =>
        indexQuery.eq("userId", userId)
      )
      .order("desc")
      .collect()
  },
})

export const ensureDefaults = mutation({
  args: {
    sessionToken: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx, args.sessionToken)
    const existing = await ctx.db
      .query("focusSessions")
      .withIndex("by_user_createdAt", (indexQuery) =>
        indexQuery.eq("userId", userId)
      )
      .first()
    if (existing) {
      return
    }

    for (const session of defaultSessions) {
      await ctx.db.insert("focusSessions", {
        ...session,
        userId,
        createdAt: Date.now(),
      })
    }
  },
})

export const create = mutation({
  args: {
    sessionToken: v.string(),
    sessionId: v.string(),
    intention: v.string(),
    reflection: v.string(),
    durationMinutes: v.number(),
    completedAt: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx, args.sessionToken)
    return await ctx.db.insert("focusSessions", {
      userId,
      sessionId: args.sessionId,
      intention: args.intention.trim(),
      reflection: args.reflection.trim(),
      durationMinutes: args.durationMinutes,
      completedAt: args.completedAt,
      createdAt: Date.now(),
    })
  },
})
