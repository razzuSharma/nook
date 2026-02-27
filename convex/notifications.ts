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

export const listByViewer = query({
  args: {
    sessionToken: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx, args.sessionToken)
    const limit = Math.min(Math.max(args.limit ?? 20, 1), 50)
    const docs = await ctx.db
      .query("userNotifications")
      .withIndex("by_user_createdAt", (query) => query.eq("userId", userId))
      .order("desc")
      .take(limit)

    const unreadCount = docs.filter((item) => !item.readAt).length
    return {
      unreadCount,
      items: docs.map((doc) => ({
        id: doc._id,
        type: doc.type,
        title: doc.title,
        message: doc.message,
        roomId: doc.roomId,
        taskId: doc.taskId,
        readAt: doc.readAt ?? null,
        createdAt: doc.createdAt,
      })),
    }
  },
})

export const markRead = mutation({
  args: {
    sessionToken: v.string(),
    notificationId: v.id("userNotifications"),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx, args.sessionToken)
    const doc = await ctx.db.get(args.notificationId)
    if (!doc) return { updated: false }
    if (doc.userId !== userId) {
      throw new Error("Unauthorized.")
    }
    if (doc.readAt) return { updated: true }
    await ctx.db.patch(args.notificationId, { readAt: Date.now() })
    return { updated: true }
  },
})

export const markAllRead = mutation({
  args: {
    sessionToken: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx, args.sessionToken)
    const docs = await ctx.db
      .query("userNotifications")
      .withIndex("by_user_createdAt", (query) => query.eq("userId", userId))
      .order("desc")
      .take(200)
    const unread = docs.filter((doc) => !doc.readAt)
    for (const doc of unread) {
      await ctx.db.patch(doc._id, { readAt: Date.now() })
    }
    return { updated: unread.length }
  },
})
