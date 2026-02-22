import { mutation, query } from "./_generated/server"
import type { MutationCtx, QueryCtx } from "./_generated/server"
import type { Id } from "./_generated/dataModel"
import { internal } from "./_generated/api"
import { v } from "convex/values"

const INVITE_TTL_MS = 1000 * 60 * 60 * 24 * 7

function normalizeEmail(value: string) {
  return value.trim().toLowerCase()
}

function toHex(bytes: Uint8Array) {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
}

function randomToken(bytes = 32) {
  const buffer = new Uint8Array(bytes)
  crypto.getRandomValues(buffer)
  return toHex(buffer)
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

async function requireActiveMembership(
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
    throw new Error("Only joined members can manage invites.")
  }

  return membership
}

export const listByRoom = query({
  args: {
    sessionToken: v.string(),
    roomId: v.id("rooms"),
  },
  handler: async (ctx, args) => {
    const user = await requireUserBySession(ctx, args.sessionToken)
    await requireActiveMembership(ctx, args.roomId, user._id as string)

    return await ctx.db
      .query("roomInvites")
      .withIndex("by_room_status", (indexQuery) =>
        indexQuery.eq("roomId", args.roomId).eq("status", "pending")
      )
      .collect()
  },
})

export const create = mutation({
  args: {
    sessionToken: v.string(),
    roomId: v.id("rooms"),
    email: v.string(),
    role: v.union(v.literal("viewer"), v.literal("member"), v.literal("admin")),
    siteUrl: v.string(),
  },
  handler: async (ctx, args) => {
    const inviter = await requireUserBySession(ctx, args.sessionToken)
    await requireActiveMembership(ctx, args.roomId, inviter._id as string)

    const email = normalizeEmail(args.email)
    if (!email) {
      throw new Error("Invite email is required.")
    }

    const now = Date.now()
    const token = randomToken(32)
    const tokenHash = await sha256(token)
    const inviteLink = `${args.siteUrl.replace(/\/+$/, "")}/accept-invite?token=${encodeURIComponent(token)}`

    const existing = await ctx.db
      .query("roomInvites")
      .withIndex("by_room_email_status", (indexQuery) =>
        indexQuery.eq("roomId", args.roomId).eq("email", email).eq("status", "pending")
      )
      .first()

    if (existing) {
      await ctx.db.patch(existing._id, {
        role: args.role,
        invitedByUserId: inviter._id,
        tokenHash,
        createdAt: now,
        expiresAt: now + INVITE_TTL_MS,
      })
    } else {
      await ctx.db.insert("roomInvites", {
        roomId: args.roomId,
        email,
        role: args.role,
        invitedByUserId: inviter._id,
        tokenHash,
        status: "pending",
        createdAt: now,
        expiresAt: now + INVITE_TTL_MS,
      })
    }

    const room = await ctx.db.get(args.roomId)
    await ctx.scheduler.runAfter(0, internal.email.sendRoomInviteEmail, {
      email,
      invitedByName: inviter.name,
      roomName: room?.name ?? "Nook Room",
      inviteLink,
    })

    return { inviteLink }
  },
})

export const revoke = mutation({
  args: {
    sessionToken: v.string(),
    inviteId: v.id("roomInvites"),
  },
  handler: async (ctx, args) => {
    const user = await requireUserBySession(ctx, args.sessionToken)
    const invite = await ctx.db.get(args.inviteId)
    if (!invite) {
      throw new Error("Invite not found.")
    }
    await requireActiveMembership(ctx, invite.roomId, user._id as string)

    await ctx.db.patch(invite._id, {
      status: "revoked",
    })
    return { revoked: true }
  },
})

export const accept = mutation({
  args: {
    sessionToken: v.string(),
    token: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireUserBySession(ctx, args.sessionToken)
    const tokenHash = await sha256(args.token.trim())

    const invite = await ctx.db
      .query("roomInvites")
      .withIndex("by_tokenHash", (indexQuery) =>
        indexQuery.eq("tokenHash", tokenHash)
      )
      .first()

    if (!invite || invite.status !== "pending") {
      throw new Error("Invite is invalid.")
    }
    if (invite.expiresAt <= Date.now()) {
      await ctx.db.patch(invite._id, { status: "expired" })
      throw new Error("Invite has expired.")
    }
    const room = await ctx.db.get(invite.roomId)
    if (!room) {
      throw new Error("Room no longer exists.")
    }

    const existingMembership = await ctx.db
      .query("roomMembers")
      .withIndex("by_room_user", (indexQuery) =>
        indexQuery.eq("roomId", invite.roomId).eq("userId", user._id as string)
      )
      .first()

    const now = Date.now()
    if (existingMembership) {
      await ctx.db.patch(existingMembership._id, {
        role: invite.role,
        status: "active",
        joinedAt: now,
      })
    } else {
      await ctx.db.insert("roomMembers", {
        roomId: invite.roomId,
        userId: user._id as string,
        role: invite.role,
        status: "active",
        joinedAt: now,
      })
    }

    const activeMembers = await ctx.db
      .query("roomMembers")
      .withIndex("by_room", (indexQuery) => indexQuery.eq("roomId", invite.roomId))
      .collect()
    const activeCount = activeMembers.filter((member) => member.status === "active").length
    await ctx.db.patch(room._id, {
      membersCount: Math.min(room.membersMax, activeCount),
    })

    await ctx.db.patch(invite._id, {
      status: "accepted",
      acceptedAt: now,
    })

    return {
      accepted: true,
      roomId: invite.roomId,
    }
  },
})
