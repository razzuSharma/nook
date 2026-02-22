import { mutation, query } from "./_generated/server"
import type { MutationCtx, QueryCtx } from "./_generated/server"
import type { Id } from "./_generated/dataModel"
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

async function requireActiveRoomMembership(
  ctx: QueryCtx | MutationCtx,
  roomId: Id<"rooms">,
  userId: Id<"users">
) {
  const membership = await ctx.db
    .query("roomMembers")
    .withIndex("by_room_user", (indexQuery) =>
      indexQuery.eq("roomId", roomId).eq("userId", userId)
    )
    .first()

  if (!membership || membership.status !== "active") {
    throw new Error("Only joined room members can access room focus.")
  }
}

function clampDuration(minutes: number) {
  return Math.min(Math.max(minutes, 5), 180)
}

export const listPresence = query({
  args: {
    sessionToken: v.string(),
    roomId: v.id("rooms"),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx, args.sessionToken)
    await requireActiveRoomMembership(ctx, args.roomId, userId)

    const docs = await ctx.db
      .query("roomFocusPresence")
      .withIndex("by_room_updatedAt", (indexQuery) =>
        indexQuery.eq("roomId", args.roomId)
      )
      .order("desc")
      .collect()

    const memberships = await ctx.db
      .query("roomMembers")
      .withIndex("by_room", (indexQuery) => indexQuery.eq("roomId", args.roomId))
      .collect()
    const activeMemberIds = new Set(
      memberships
        .filter((membership) => membership.status === "active")
        .map((membership) => membership.userId)
    )

    const visible = docs.filter(
      (doc) =>
        doc.visibility !== "private" &&
        doc.status === "focusing" &&
        activeMemberIds.has(doc.userId)
    )

    const withUser = await Promise.all(
      visible.map(async (doc) => {
        const user = await ctx.db.get(doc.userId)
        return {
          id: doc._id,
          userId: doc.userId,
          userName: user?.name ?? "Unknown User",
          userEmail: user?.email ?? "",
          userAvatarKey: user?.avatarKey ?? "avatar-1",
          status: doc.status,
          intention: doc.intention,
          taskId: doc.taskId,
          visibility: doc.visibility,
          startedAt: doc.startedAt ?? null,
          endsAt: doc.endsAt ?? null,
          updatedAt: doc.updatedAt,
        }
      })
    )

    return withUser
  },
})

export const start = mutation({
  args: {
    sessionToken: v.string(),
    roomId: v.id("rooms"),
    intention: v.string(),
    durationMinutes: v.number(),
    taskId: v.optional(v.string()),
    visibility: v.union(
      v.literal("private"),
      v.literal("room"),
      v.literal("room_with_reflection")
    ),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx, args.sessionToken)
    await requireActiveRoomMembership(ctx, args.roomId, userId)

    const now = Date.now()
    const durationMinutes = clampDuration(args.durationMinutes)
    const endsAt = now + durationMinutes * 60 * 1000
    const intention = args.intention.trim() || "Deep Work"

    const existing = await ctx.db
      .query("roomFocusPresence")
      .withIndex("by_room_user", (indexQuery) =>
        indexQuery.eq("roomId", args.roomId).eq("userId", userId)
      )
      .first()

    const patch = {
      status: "focusing" as const,
      intention,
      taskId: args.taskId,
      visibility: args.visibility,
      startedAt: now,
      endsAt,
      updatedAt: now,
    }

    if (existing) {
      await ctx.db.patch(existing._id, patch)
      return { started: true, presenceId: existing._id }
    }

    const createdId = await ctx.db.insert("roomFocusPresence", {
      roomId: args.roomId,
      userId,
      ...patch,
    })

    return { started: true, presenceId: createdId }
  },
})

export const markDone = mutation({
  args: {
    sessionToken: v.string(),
    roomId: v.id("rooms"),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx, args.sessionToken)
    await requireActiveRoomMembership(ctx, args.roomId, userId)

    const existing = await ctx.db
      .query("roomFocusPresence")
      .withIndex("by_room_user", (indexQuery) =>
        indexQuery.eq("roomId", args.roomId).eq("userId", userId)
      )
      .first()

    if (!existing) {
      return { updated: false }
    }

    await ctx.db.patch(existing._id, {
      status: "done",
      endsAt: Date.now(),
      updatedAt: Date.now(),
    })

    return { updated: true }
  },
})

export const complete = mutation({
  args: {
    sessionToken: v.string(),
    roomId: v.id("rooms"),
    reflection: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx, args.sessionToken)
    await requireActiveRoomMembership(ctx, args.roomId, userId)

    const now = Date.now()
    const existing = await ctx.db
      .query("roomFocusPresence")
      .withIndex("by_room_user", (indexQuery) =>
        indexQuery.eq("roomId", args.roomId).eq("userId", userId)
      )
      .first()

    if (!existing) {
      return { completed: false }
    }

    const startedAt = existing.startedAt ?? now
    const elapsedMinutes = Math.max(
      1,
      Math.round((Math.max(now, startedAt) - startedAt) / 60000)
    )
    const reflection =
      existing.visibility === "room_with_reflection"
        ? (args.reflection ?? "").trim()
        : ""

    await ctx.db.insert("roomFocusSessions", {
      roomId: args.roomId,
      userId,
      intention: existing.intention,
      taskId: existing.taskId,
      durationMinutes: elapsedMinutes,
      reflection,
      visibility: existing.visibility,
      completedAt: now,
      createdAt: now,
    })

    await ctx.db.patch(existing._id, {
      status: "done",
      endsAt: now,
      updatedAt: now,
    })

    return { completed: true }
  },
})
