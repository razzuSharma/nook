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
    actorUserId: v.optional(v.string()),
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
          v.literal("blocked"),
          v.literal("completed")
        ),
        dueAt: v.optional(v.number()),
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
    const actorUserId = args.actorUserId ?? "system"
    const now = Date.now()

    const logEvent = async (taskId: string, type: string, message: string) => {
      await ctx.db.insert("roomTaskEvents", {
        roomId: args.roomId,
        taskId,
        actorUserId,
        type,
        message,
        createdAt: Date.now(),
      })
    }

    for (const task of existing) {
      if (!incomingTaskIds.has(task.taskId)) {
        await ctx.db.delete(task._id)
        await logEvent(task.taskId, "deleted", `Removed task "${task.title}".`)
      }
    }

    for (const task of args.tasks) {
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
          dueAt: task.dueAt,
          completedAt: becomesCompleted
            ? now
            : becomesActive
              ? undefined
              : existingTask.completedAt,
          updatedAt: now,
        })

        if (existingTask.title !== task.title) {
          await logEvent(task.taskId, "title_updated", `Renamed task to "${task.title}".`)
        }
        if (existingTask.status !== task.status) {
          await logEvent(task.taskId, "status_updated", `Moved task to ${task.status}.`)
        }
        if (
          (existingTask.assigneeUserId ?? undefined) !==
          (task.assigneeUserId ?? undefined)
        ) {
          await logEvent(
            task.taskId,
            "assignee_updated",
            task.assignee
              ? `Assigned task to ${task.assignee}.`
              : "Cleared assignee."
          )
        }
        if ((existingTask.dueAt ?? undefined) !== (task.dueAt ?? undefined)) {
          await logEvent(
            task.taskId,
            "due_updated",
            task.dueAt
              ? `Set due date to ${new Date(task.dueAt).toLocaleString()}.`
              : "Cleared due date."
          )
        }
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
          dueAt: task.dueAt,
          createdAt: now,
          updatedAt: now,
          completedAt: task.status === "completed" ? now : undefined,
        })
        await logEvent(task.taskId, "created", `Created task "${task.title}".`)
      }
    }
  },
})
