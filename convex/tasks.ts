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

const LEGACY_SEEDED_TASK_IDS = new Set(["t-1", "t-2", "t-3", "t-4"])

export const list = query({
  args: {
    sessionToken: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx, args.sessionToken)
    return await ctx.db
      .query("tasks")
      .withIndex("by_user_order", (indexQuery) => indexQuery.eq("userId", userId))
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
    const tasks = await ctx.db.query("tasks").collect()

    let deletedTasks = 0
    for (const task of tasks) {
      if (!LEGACY_SEEDED_TASK_IDS.has(task.taskId)) continue
      await ctx.db.delete(task._id)
      deletedTasks += 1
    }

    return { deletedTasks }
  },
})

export const sync = mutation({
  args: {
    sessionToken: v.string(),
    tasks: v.array(
      v.object({
        taskId: v.string(),
        title: v.string(),
        note: v.string(),
        dueDate: v.string(),
        dueTime: v.string(),
        priority: v.union(v.literal("low"), v.literal("medium"), v.literal("high")),
        status: v.union(
          v.literal("todo"),
          v.literal("working"),
          v.literal("completed")
        ),
        order: v.number(),
      })
    ),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx, args.sessionToken)
    const existing = await ctx.db
      .query("tasks")
      .withIndex("by_user_order", (indexQuery) => indexQuery.eq("userId", userId))
      .collect()
    const existingByTaskId = new Map(existing.map((task) => [task.taskId, task]))
    const incomingTaskIds = new Set(args.tasks.map((task) => task.taskId))

    for (const task of existing) {
      if (!incomingTaskIds.has(task.taskId)) {
        await ctx.db.delete(task._id)
      }
    }

    for (const task of args.tasks) {
      const now = Date.now()
      const existingTask = existingByTaskId.get(task.taskId)
      if (existingTask) {
        const becomesCompleted =
          existingTask.status !== "completed" && task.status === "completed"
        const becomesActive =
          existingTask.status === "completed" && task.status !== "completed"

        await ctx.db.patch(existingTask._id, {
          title: task.title,
          note: task.note,
          dueDate: task.dueDate,
          dueTime: task.dueTime,
          priority: task.priority,
          status: task.status,
          order: task.order,
          completedAt: becomesCompleted
            ? now
            : becomesActive
              ? undefined
              : existingTask.completedAt,
          updatedAt: now,
        })
      } else {
        await ctx.db.insert("tasks", {
          userId,
          ...task,
          completedAt: task.status === "completed" ? now : undefined,
          createdAt: now,
          updatedAt: now,
        })
      }
    }
  },
})
