import { mutation, query } from "./_generated/server"
import type { Id } from "./_generated/dataModel"
import type { MutationCtx, QueryCtx } from "./_generated/server"
import { v } from "convex/values"

function generateJoinCode() {
  return `NOOK-${Math.random().toString(36).slice(2, 6).toUpperCase()}`
}

const LEGACY_SEEDED_ROOM_KEYS = new Set([
  "React Wizards::RW-2026",
  "SaaS Builders::SB-2026",
  "Rust Study Group::RS-2026",
])

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

async function requireUserBySession(
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

  return user
}

async function requireAdminMembership(
  ctx: QueryCtx | MutationCtx,
  roomId: Id<"rooms">,
  userId: string
) {
  const membership = await ctx.db
    .query("roomMembers")
    .withIndex("by_room_user", (indexQuery) =>
      indexQuery.eq("roomId", roomId).eq("userId", userId)
    )
    .first()

  if (!membership || membership.status !== "active") {
    throw new Error("Only joined room members can manage room settings.")
  }
  if (membership.role !== "admin") {
    throw new Error("Only room admins can manage room settings.")
  }
}

async function joinRoom(
  ctx: MutationCtx,
  roomId: Id<"rooms">,
  userId: string
) {
  const room = await ctx.db.get(roomId)
  if (!room) {
    throw new Error("Room not found.")
  }

  const existing = await ctx.db
    .query("roomMembers")
    .withIndex("by_room_user", (query) =>
      query.eq("roomId", roomId).eq("userId", userId)
    )
    .first()

  if (existing?.status === "active") {
    return { joined: true, roomId: room._id }
  }

  const roomAccess = room.access ?? "public"
  if (roomAccess !== "public" && !existing) {
    if (roomAccess === "invite_only") {
      throw new Error("This room is invite-only. Ask a member for an invite link.")
    }
    throw new Error("This room is private.")
  }

  const currentActiveMembers = await ctx.db
    .query("roomMembers")
    .withIndex("by_room", (query) => query.eq("roomId", roomId))
    .collect()
  const activeCount = currentActiveMembers.filter(
    (membership) => membership.status === "active"
  ).length

  if (activeCount >= room.membersMax) {
    throw new Error("Room is full.")
  }

  if (existing) {
    await ctx.db.patch(existing._id, {
      status: "active",
      joinedAt: Date.now(),
    })
  } else {
    await ctx.db.insert("roomMembers", {
      roomId,
      userId,
      role: "member",
      status: "active",
      joinedAt: Date.now(),
    })
  }

  await ctx.db.patch(room._id, {
    membersCount: Math.min(room.membersMax, activeCount + 1),
  })

  return { joined: true, roomId: room._id }
}

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("rooms").withIndex("by_createdAt").collect()
  },
})

export const ensureDefaults = mutation({
  args: {},
  handler: async (ctx) => {
    const existingRooms = await ctx.db.query("rooms").collect()
    for (const room of existingRooms) {
      const patch: {
        joinCode?: string
        access?: "public"
      } = {}
      if (!room.access) {
        patch.access = "public"
      }
      if (!room.joinCode && (room.access ?? "public") === "public") {
        patch.joinCode = generateJoinCode()
      }
      if (Object.keys(patch).length > 0) {
        await ctx.db.patch(room._id, patch)
      }
    }
  },
})

export const cleanupSeeded = mutation({
  args: {},
  handler: async (ctx) => {
    const rooms = await ctx.db.query("rooms").collect()
    let deletedRooms = 0

    for (const room of rooms) {
      const key = `${room.name}::${room.joinCode ?? ""}`
      if (!LEGACY_SEEDED_ROOM_KEYS.has(key)) continue

      const members = await ctx.db
        .query("roomMembers")
        .withIndex("by_room", (query) => query.eq("roomId", room._id))
        .collect()

      if (members.length > 0) continue
      await ctx.db.delete(room._id)
      deletedRooms += 1
    }

    return { deletedRooms }
  },
})

export const create = mutation({
  args: {
    name: v.string(),
    description: v.string(),
    mode: v.string(),
    access: v.union(v.literal("public"), v.literal("private"), v.literal("invite_only")),
    icon: v.optional(
      v.union(
        v.literal("code"),
        v.literal("rocket"),
        v.literal("cpu"),
        v.literal("sparkles")
      )
    ),
    membersMax: v.number(),
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const safeMax = Math.min(Math.max(args.membersMax, 2), 30)
    const now = Date.now()

    const roomId = await ctx.db.insert("rooms", {
      name: args.name.trim(),
      description: args.description.trim(),
      mode: args.mode.trim().toUpperCase(),
      access: args.access,
      membersCount: 1,
      membersMax: safeMax,
      joinCode: args.access === "public" ? generateJoinCode() : undefined,
      icon: args.icon ?? "sparkles",
      createdAt: now,
    })

    await ctx.db.insert("roomMembers", {
      roomId,
      userId: args.userId,
      role: "admin",
      status: "active",
      joinedAt: now,
    })

    return roomId
  },
})

export const updateSettings = mutation({
  args: {
    sessionToken: v.string(),
    roomId: v.id("rooms"),
    name: v.string(),
    description: v.string(),
    access: v.union(v.literal("public"), v.literal("private"), v.literal("invite_only")),
    membersMax: v.number(),
  },
  handler: async (ctx, args) => {
    const user = await requireUserBySession(ctx, args.sessionToken)
    await requireAdminMembership(ctx, args.roomId, user._id as string)

    const room = await ctx.db.get(args.roomId)
    if (!room) {
      throw new Error("Room not found.")
    }

    const safeMax = Math.min(Math.max(args.membersMax, 2), 30)
    const normalizedAccess = args.access
    const shouldHaveJoinCode = normalizedAccess === "public"

    await ctx.db.patch(room._id, {
      name: args.name.trim(),
      description: args.description.trim(),
      access: normalizedAccess,
      membersMax: safeMax,
      joinCode: shouldHaveJoinCode ? room.joinCode ?? generateJoinCode() : undefined,
      membersCount: Math.min(room.membersCount, safeMax),
    })

    return { updated: true }
  },
})

export const joinedRoomIdsByUser = query({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const memberships = await ctx.db
      .query("roomMembers")
      .withIndex("by_user", (query) => query.eq("userId", args.userId))
      .collect()

    return memberships
      .filter((membership) => membership.status === "active")
      .map((membership) => membership.roomId)
  },
})

export const pinnedRoomIdsByUser = query({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const pins = await ctx.db
      .query("roomPins")
      .withIndex("by_user", (query) => query.eq("userId", args.userId))
      .collect()
    return pins.map((pin) => pin.roomId)
  },
})

export const togglePin = mutation({
  args: {
    roomId: v.id("rooms"),
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("roomPins")
      .withIndex("by_room_user", (query) =>
        query.eq("roomId", args.roomId).eq("userId", args.userId)
      )
      .first()

    if (existing) {
      await ctx.db.delete(existing._id)
      return { pinned: false }
    }

    await ctx.db.insert("roomPins", {
      roomId: args.roomId,
      userId: args.userId,
      pinnedAt: Date.now(),
    })
    return { pinned: true }
  },
})

export const joinByRoomId = mutation({
  args: {
    roomId: v.id("rooms"),
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    return await joinRoom(ctx, args.roomId, args.userId)
  },
})

export const joinByCode = mutation({
  args: {
    code: v.string(),
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const normalized = args.code.trim().toUpperCase()
    if (!normalized) {
      throw new Error("Join code is required.")
    }

    const room = await ctx.db
      .query("rooms")
      .withIndex("by_joinCode", (query) => query.eq("joinCode", normalized))
      .first()

    if (!room) {
      throw new Error("Invalid room code.")
    }
    if ((room.access ?? "public") !== "public") {
      throw new Error("This room does not support join by code.")
    }

    return await joinRoom(ctx, room._id, args.userId)
  },
})

export const leaveRoom = mutation({
  args: {
    roomId: v.id("rooms"),
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const room = await ctx.db.get(args.roomId)
    if (!room) {
      throw new Error("Room not found.")
    }

    const membership = await ctx.db
      .query("roomMembers")
      .withIndex("by_room_user", (query) =>
        query.eq("roomId", args.roomId).eq("userId", args.userId)
      )
      .first()

    if (!membership || membership.status !== "active") {
      return { left: false }
    }

    await ctx.db.patch(membership._id, {
      status: "left",
    })

    const membersAfter = await ctx.db
      .query("roomMembers")
      .withIndex("by_room", (query) => query.eq("roomId", args.roomId))
      .collect()
    const activeCount = membersAfter.filter(
      (item) => item.status === "active"
    ).length

    await ctx.db.patch(room._id, {
      membersCount: Math.max(0, Math.min(room.membersMax, activeCount)),
    })

    return { left: true }
  },
})

export const listMembersByRoom = query({
  args: {
    sessionToken: v.string(),
    roomId: v.id("rooms"),
  },
  handler: async (ctx, args) => {
    const user = await requireUserBySession(ctx, args.sessionToken)

    const currentMembership = await ctx.db
      .query("roomMembers")
      .withIndex("by_room_user", (indexQuery) =>
        indexQuery.eq("roomId", args.roomId).eq("userId", user._id as string)
      )
      .first()

    if (!currentMembership || currentMembership.status !== "active") {
      throw new Error("Only joined members can view room members.")
    }

    const memberships = await ctx.db
      .query("roomMembers")
      .withIndex("by_room", (indexQuery) => indexQuery.eq("roomId", args.roomId))
      .collect()

    const activeMemberships = memberships.filter(
      (membership) => membership.status === "active"
    )

    const members = await Promise.all(
      activeMemberships.map(async (membership) => {
        const normalizedUserId = ctx.db.normalizeId("users", membership.userId)
        const memberUser = normalizedUserId
          ? await ctx.db.get(normalizedUserId)
          : null
        return {
          userId: membership.userId,
          role: membership.role,
          name: memberUser?.name ?? "Unknown User",
          email: memberUser?.email ?? "",
          avatarKey: memberUser?.avatarKey ?? "avatar-1",
        }
      })
    )

    return members
  },
})
