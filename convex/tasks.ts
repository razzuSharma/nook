import { mutation, query } from "./_generated/server"
import type { MutationCtx, QueryCtx } from "./_generated/server"
import { v } from "convex/values"

const defaultTasks = [
  {
    taskId: "t-1",
    title: "Finalize onboarding copy",
    note: "Update welcome messaging and CTA labels.",
    dueDate: "2026-02-15",
    dueTime: "10:00",
    priority: "high" as const,
    status: "todo" as const,
    order: 0,
  },
  {
    taskId: "t-2",
    title: "Prepare sprint board",
    note: "Create initial cards for Q1 delivery scope.",
    dueDate: "2026-02-16",
    dueTime: "13:30",
    priority: "medium" as const,
    status: "todo" as const,
    order: 1,
  },
  {
    taskId: "t-3",
    title: "Refine dashboard metrics",
    note: "Align data labels and card emphasis.",
    dueDate: "2026-02-15",
    dueTime: "15:00",
    priority: "medium" as const,
    status: "working" as const,
    order: 2,
  },
  {
    taskId: "t-4",
    title: "Theme token cleanup",
    note: "Consolidate Nook tokens in globals.",
    dueDate: "2026-02-14",
    dueTime: "17:45",
    priority: "low" as const,
    status: "completed" as const,
    order: 3,
    completedAt: new Date("2026-02-14T17:45:00.000Z").getTime(),
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
    const userId = await requireUserId(ctx, args.sessionToken)
    const existing = await ctx.db
      .query("tasks")
      .withIndex("by_user_order", (indexQuery) => indexQuery.eq("userId", userId))
      .first()
    if (existing) {
      return
    }

    for (const task of defaultTasks) {
      const now = Date.now()
      await ctx.db.insert("tasks", {
        ...task,
        userId,
        completedAt: task.status === "completed" ? task.completedAt ?? now : undefined,
        createdAt: now,
        updatedAt: now,
      })
    }
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
