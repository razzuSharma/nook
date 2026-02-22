import { mutation, query } from "./_generated/server"
import type { MutationCtx, QueryCtx } from "./_generated/server"
import { v } from "convex/values"

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

const LEGACY_SEEDED_SESSION_ID = "session-seed-1"

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
    await requireUserId(ctx, args.sessionToken)
  },
})

export const cleanupSeeded = mutation({
  args: {},
  handler: async (ctx) => {
    const sessions = await ctx.db.query("focusSessions").collect()

    let deletedSessions = 0
    for (const session of sessions) {
      if (session.sessionId !== LEGACY_SEEDED_SESSION_ID) continue
      await ctx.db.delete(session._id)
      deletedSessions += 1
    }

    return { deletedSessions }
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
