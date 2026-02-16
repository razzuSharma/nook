import { mutation, query } from "./_generated/server"
import type { Id } from "./_generated/dataModel"
import type { MutationCtx } from "./_generated/server"
import { v } from "convex/values"

const defaultRooms = [
  {
    name: "React Wizards",
    description: "Frontend architecture and component optimization.",
    mode: "CAFE MODE",
    membersCount: 6,
    membersMax: 12,
    joinCode: "RW-2026",
    icon: "code" as const,
  },
  {
    name: "SaaS Builders",
    description: "Collaborating on the next generation of SaaS tools.",
    mode: "BUILD SPRINT",
    membersCount: 2,
    membersMax: 8,
    joinCode: "SB-2026",
    icon: "rocket" as const,
  },
  {
    name: "Rust Study Group",
    description: "Learning memory safety and performance together.",
    mode: "SESSION ACTIVE",
    membersCount: 3,
    membersMax: 5,
    joinCode: "RS-2026",
    icon: "cpu" as const,
  },
]

function generateJoinCode() {
  return `NOOK-${Math.random().toString(36).slice(2, 6).toUpperCase()}`
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
    if (existingRooms.length > 0) {
      for (const room of existingRooms) {
        if (room.joinCode) continue
        await ctx.db.patch(room._id, {
          joinCode: generateJoinCode(),
        })
      }
      return
    }

    for (const room of defaultRooms) {
      await ctx.db.insert("rooms", {
        ...room,
        joinCode: room.joinCode,
        createdAt: Date.now(),
      })
    }
  },
})

export const create = mutation({
  args: {
    name: v.string(),
    description: v.string(),
    mode: v.string(),
    membersMax: v.number(),
  },
  handler: async (ctx, args) => {
    const safeMax = Math.min(Math.max(args.membersMax, 2), 30)

    return await ctx.db.insert("rooms", {
      name: args.name.trim(),
      description: args.description.trim(),
      mode: args.mode.trim().toUpperCase(),
      membersCount: 1,
      membersMax: safeMax,
      joinCode: generateJoinCode(),
      icon: "sparkles",
      createdAt: Date.now(),
    })
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
