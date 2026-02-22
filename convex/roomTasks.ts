import { mutation, query } from "./_generated/server"
import { v } from "convex/values"

export const listByRoom = query({
  args: {
    roomId: v.id("rooms"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("roomTasks")
      .withIndex("by_room_order", (query) => query.eq("roomId", args.roomId))
      .collect()
  },
})

export const syncByRoom = mutation({
  args: {
    roomId: v.id("rooms"),
    tasks: v.array(
      v.object({
        taskId: v.string(),
        title: v.string(),
        note: v.string(),
        assignee: v.string(),
        assigneeUserId: v.optional(v.id("users")),
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
    const existing = await ctx.db
      .query("roomTasks")
      .withIndex("by_room_order", (query) => query.eq("roomId", args.roomId))
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
          assignee: task.assignee,
          assigneeUserId: task.assigneeUserId,
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
        await ctx.db.insert("roomTasks", {
          roomId: args.roomId,
          taskId: task.taskId,
          title: task.title,
          note: task.note,
          assignee: task.assignee,
          assigneeUserId: task.assigneeUserId,
          priority: task.priority,
          status: task.status,
          order: task.order,
          createdAt: now,
          updatedAt: now,
          completedAt: task.status === "completed" ? now : undefined,
        })
      }
    }
  },
})
