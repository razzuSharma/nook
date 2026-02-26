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

async function requireActiveRoomMembership(
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
    throw new Error("Only joined room members can access task chat.")
  }

  return membership
}

function requireFileActionRole(role: "viewer" | "member" | "admin") {
  if (role === "viewer") {
    throw new Error("Viewers can view files, but cannot upload or share files.")
  }
}

async function requireTaskInRoom(
  ctx: QueryCtx | MutationCtx,
  roomId: Id<"rooms">,
  taskId: string
) {
  const task = await ctx.db
    .query("roomTasks")
    .withIndex("by_room_taskId", (indexQuery) =>
      indexQuery.eq("roomId", roomId).eq("taskId", taskId)
    )
    .first()

  if (!task) {
    throw new Error("Task not found in this room.")
  }
}

export const listThread = query({
  args: {
    sessionToken: v.string(),
    roomId: v.id("rooms"),
    taskId: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireUserBySession(ctx, args.sessionToken)
    await requireActiveRoomMembership(ctx, args.roomId, user._id as string)
    await requireTaskInRoom(ctx, args.roomId, args.taskId)

    const [messages, files] = await Promise.all([
      ctx.db
        .query("roomTaskMessages")
        .withIndex("by_room_task_createdAt", (indexQuery) =>
          indexQuery.eq("roomId", args.roomId).eq("taskId", args.taskId)
        )
        .order("asc")
        .collect(),
      ctx.db
        .query("roomTaskFiles")
        .withIndex("by_room_task_createdAt", (indexQuery) =>
          indexQuery.eq("roomId", args.roomId).eq("taskId", args.taskId)
        )
        .order("asc")
        .collect(),
    ])
    const events = await ctx.db
      .query("roomTaskEvents")
      .withIndex("by_room_task_createdAt", (indexQuery) =>
        indexQuery.eq("roomId", args.roomId).eq("taskId", args.taskId)
      )
      .order("desc")
      .take(50)

    const userById = new Map<string, { name: string; avatarKey: string }>()
    const mentionedUserIds = new Set<string>()

    for (const message of messages) {
      mentionedUserIds.add(message.authorUserId)
    }
    for (const file of files) {
      mentionedUserIds.add(file.uploadedByUserId)
    }
    for (const event of events) {
      mentionedUserIds.add(event.actorUserId)
    }

    await Promise.all(
      Array.from(mentionedUserIds).map(async (userId) => {
        const normalized = ctx.db.normalizeId("users", userId)
        const doc = normalized ? await ctx.db.get(normalized) : null
        userById.set(userId, {
          name: doc?.name ?? "Unknown User",
          avatarKey: doc?.avatarKey ?? "avatar-1",
        })
      })
    )

    const filesWithResolvedUrl = await Promise.all(
      files.map(async (file) => {
        const resolvedUrl = file.storageId
          ? await ctx.storage.getUrl(file.storageId)
          : file.url
        return {
          id: file._id,
          taskId: file.taskId,
          roomId: file.roomId,
          name: file.name,
          url: resolvedUrl ?? file.url,
          mimeType: file.mimeType ?? "",
          sizeBytes: file.sizeBytes ?? null,
          storageId: file.storageId ?? null,
          createdAt: file.createdAt,
          uploadedByUserId: file.uploadedByUserId,
          uploadedByName:
            userById.get(file.uploadedByUserId)?.name ?? "Unknown User",
          uploadedByAvatarKey:
            userById.get(file.uploadedByUserId)?.avatarKey ?? "avatar-1",
        }
      })
    )

    return {
      messages: messages.map((message) => ({
        id: message._id,
        taskId: message.taskId,
        roomId: message.roomId,
        body: message.body,
        createdAt: message.createdAt,
        updatedAt: message.updatedAt,
        authorUserId: message.authorUserId,
        authorName: userById.get(message.authorUserId)?.name ?? "Unknown User",
        authorAvatarKey:
          userById.get(message.authorUserId)?.avatarKey ?? "avatar-1",
      })),
      files: filesWithResolvedUrl,
      events: events.map((event) => ({
        id: event._id,
        type: event.type,
        message: event.message,
        createdAt: event.createdAt,
        actorUserId: event.actorUserId,
        actorName: userById.get(event.actorUserId)?.name ?? "Unknown User",
        actorAvatarKey: userById.get(event.actorUserId)?.avatarKey ?? "avatar-1",
      })),
    }
  },
})

export const sendMessage = mutation({
  args: {
    sessionToken: v.string(),
    roomId: v.id("rooms"),
    taskId: v.string(),
    body: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireUserBySession(ctx, args.sessionToken)
    await requireActiveRoomMembership(ctx, args.roomId, user._id as string)
    await requireTaskInRoom(ctx, args.roomId, args.taskId)

    const body = args.body.trim()
    if (!body) {
      throw new Error("Message cannot be empty.")
    }

    const now = Date.now()
    await ctx.db.insert("roomTaskMessages", {
      roomId: args.roomId,
      taskId: args.taskId,
      authorUserId: user._id as string,
      body,
      createdAt: now,
      updatedAt: now,
    })

    return { sent: true }
  },
})

export const shareFile = mutation({
  args: {
    sessionToken: v.string(),
    roomId: v.id("rooms"),
    taskId: v.string(),
    name: v.string(),
    url: v.string(),
    mimeType: v.optional(v.string()),
    sizeBytes: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await requireUserBySession(ctx, args.sessionToken)
    const membership = await requireActiveRoomMembership(
      ctx,
      args.roomId,
      user._id as string
    )
    requireFileActionRole(membership.role)
    await requireTaskInRoom(ctx, args.roomId, args.taskId)

    const name = args.name.trim()
    const url = args.url.trim()

    if (!name) {
      throw new Error("File name is required.")
    }
    if (!url) {
      throw new Error("File URL is required.")
    }
    if (!/^https?:\/\//i.test(url)) {
      throw new Error("File URL must start with http:// or https://")
    }

    await ctx.db.insert("roomTaskFiles", {
      roomId: args.roomId,
      taskId: args.taskId,
      uploadedByUserId: user._id as string,
      name,
      url,
      storageId: undefined,
      mimeType: args.mimeType?.trim() || undefined,
      sizeBytes: args.sizeBytes,
      createdAt: Date.now(),
    })

    return { shared: true }
  },
})

export const generateUploadUrl = mutation({
  args: {
    sessionToken: v.string(),
    roomId: v.id("rooms"),
    taskId: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireUserBySession(ctx, args.sessionToken)
    const membership = await requireActiveRoomMembership(
      ctx,
      args.roomId,
      user._id as string
    )
    requireFileActionRole(membership.role)
    await requireTaskInRoom(ctx, args.roomId, args.taskId)

    return {
      uploadUrl: await ctx.storage.generateUploadUrl(),
    }
  },
})

export const shareUploadedFile = mutation({
  args: {
    sessionToken: v.string(),
    roomId: v.id("rooms"),
    taskId: v.string(),
    name: v.string(),
    storageId: v.id("_storage"),
    mimeType: v.optional(v.string()),
    sizeBytes: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await requireUserBySession(ctx, args.sessionToken)
    const membership = await requireActiveRoomMembership(
      ctx,
      args.roomId,
      user._id as string
    )
    requireFileActionRole(membership.role)
    await requireTaskInRoom(ctx, args.roomId, args.taskId)

    const name = args.name.trim()
    if (!name) {
      throw new Error("File name is required.")
    }

    const fileUrl = await ctx.storage.getUrl(args.storageId)
    await ctx.db.insert("roomTaskFiles", {
      roomId: args.roomId,
      taskId: args.taskId,
      uploadedByUserId: user._id as string,
      name,
      url: fileUrl ?? "",
      storageId: args.storageId,
      mimeType: args.mimeType?.trim() || undefined,
      sizeBytes: args.sizeBytes,
      createdAt: Date.now(),
    })

    return { shared: true }
  },
})
