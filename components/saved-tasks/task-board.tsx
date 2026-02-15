"use client"

import * as React from "react"
import {
  closestCorners,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
  type UniqueIdentifier,
} from "@dnd-kit/core"
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { Edit3, GripVertical, Plus } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import type {
  SavedTask,
  TaskPriority,
  TaskStatus,
} from "@/components/saved-tasks/types"

type TaskBoardState = Record<TaskStatus, SavedTask[]>

const boardColumns: Array<{
  id: TaskStatus
  label: string
  subtitle: string
}> = [
  { id: "todo", label: "To Do", subtitle: "Planned next" },
  { id: "working", label: "In Progress", subtitle: "Currently active" },
  { id: "completed", label: "Completed", subtitle: "Recently shipped" },
]

const statusOrder: TaskStatus[] = ["todo", "working", "completed"]

function toBoardState(tasks: SavedTask[]): TaskBoardState {
  return {
    todo: tasks.filter((task) => task.status === "todo"),
    working: tasks.filter((task) => task.status === "working"),
    completed: tasks.filter((task) => task.status === "completed"),
  }
}

function priorityClass(priority: TaskPriority) {
  if (priority === "high") {
    return "bg-red-500/15 text-red-700 dark:text-red-300"
  }

  if (priority === "medium") {
    return "bg-amber-500/15 text-amber-700 dark:text-amber-300"
  }

  return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
}

function cardStatusClass(status: TaskStatus) {
  if (status === "completed") {
    return "bg-emerald-500/12"
  }
  if (status === "working") {
    return "bg-cyan-500/10"
  }
  return "bg-amber-500/10"
}

function formatDue(date: string, time: string) {
  if (!date) return time || "No due time"
  const parsed = new Date(`${date}T00:00:00`)
  const safeDate = Number.isNaN(parsed.getTime())
    ? date
    : parsed.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      })

  return `${safeDate}${time ? ` at ${time}` : ""}`
}

function TaskCard({
  task,
  onEdit,
  isDragging = false,
}: {
  task: SavedTask
  onEdit: (task: SavedTask) => void
  isDragging?: boolean
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({
    id: task.id,
  })

  return (
    <article
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      className={cn(
        "cursor-grab rounded-xl border border-[color:var(--nook-sidebar-border)] bg-background/80 p-3 active:cursor-grabbing",
        cardStatusClass(task.status),
        isDragging && "opacity-70 shadow-md"
      )}
      {...attributes}
      {...listeners}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-2">
          <GripVertical className="mt-0.5 size-4 text-muted-foreground" />
          <h4 className="text-sm font-medium">{task.title}</h4>
        </div>
        <div className="flex items-center gap-2">
          <Badge className={cn("capitalize", priorityClass(task.priority))}>
            {task.priority}
          </Badge>
          <Button
            size="icon"
            variant="ghost"
            className="size-7"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation()
              onEdit(task)
            }}
          >
            <Edit3 className="size-4" />
            <span className="sr-only">Edit task</span>
          </Button>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">{task.note}</p>
      <div className="mt-3 flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          Due: {formatDue(task.dueDate, task.dueTime)}
        </span>
        <span className="text-xs text-muted-foreground">Drag with mouse</span>
      </div>
    </article>
  )
}

function ColumnDropZone({
  id,
  children,
}: {
  id: TaskStatus
  children: React.ReactNode
}) {
  const { setNodeRef, isOver } = useDroppable({ id })

  return (
    <section
      ref={setNodeRef}
      className={cn(
        "rounded-2xl border border-[color:var(--nook-sidebar-border)] bg-background/55 p-3 backdrop-blur transition-colors",
        isOver && "bg-[color:var(--nook-sidebar-input-bg)]"
      )}
    >
      {children}
    </section>
  )
}

export function TaskBoard({ initialTasks }: { initialTasks: SavedTask[] }) {
  const [board, setBoard] = React.useState<TaskBoardState>(() =>
    toBoardState(initialTasks)
  )
  const [draftTitle, setDraftTitle] = React.useState("")
  const [draftNote, setDraftNote] = React.useState("")
  const [draftDueDate, setDraftDueDate] = React.useState("")
  const [draftDueTime, setDraftDueTime] = React.useState("")
  const [draftPriority, setDraftPriority] = React.useState<TaskPriority>("medium")
  const [activeId, setActiveId] = React.useState<string | null>(null)
  const [editingTaskId, setEditingTaskId] = React.useState<string | null>(null)
  const [editTitle, setEditTitle] = React.useState("")
  const [editNote, setEditNote] = React.useState("")
  const [editDueDate, setEditDueDate] = React.useState("")
  const [editDueTime, setEditDueTime] = React.useState("")
  const [editPriority, setEditPriority] = React.useState<TaskPriority>("medium")

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const findContainer = React.useCallback(
    (id: UniqueIdentifier): TaskStatus | null => {
      const value = String(id)
      if (statusOrder.includes(value as TaskStatus)) {
        return value as TaskStatus
      }

      for (const status of statusOrder) {
        if (board[status].some((task) => task.id === value)) {
          return status
        }
      }

      return null
    },
    [board]
  )

  const activeTask = React.useMemo(() => {
    if (!activeId) return null
    for (const status of statusOrder) {
      const found = board[status].find((task) => task.id === activeId)
      if (found) return found
    }
    return null
  }, [activeId, board])

  const editingTask = React.useMemo(() => {
    if (!editingTaskId) return null
    for (const status of statusOrder) {
      const found = board[status].find((task) => task.id === editingTaskId)
      if (found) return found
    }
    return null
  }, [editingTaskId, board])

  function addTask() {
    const title = draftTitle.trim()
    const note = draftNote.trim()
    if (!title || !note || !draftDueDate || !draftDueTime) return

    const newTask: SavedTask = {
      id: `t-${Date.now()}`,
      title,
      note,
      dueDate: draftDueDate,
      dueTime: draftDueTime,
      priority: draftPriority,
      status: "todo",
    }

    setBoard((prev) => ({
      ...prev,
      todo: [newTask, ...prev.todo],
    }))
    setDraftTitle("")
    setDraftNote("")
    setDraftDueDate("")
    setDraftDueTime("")
    setDraftPriority("medium")
  }

  function openEdit(task: SavedTask) {
    setEditingTaskId(task.id)
    setEditTitle(task.title)
    setEditNote(task.note)
    setEditDueDate(task.dueDate)
    setEditDueTime(task.dueTime)
    setEditPriority(task.priority)
  }

  function saveTaskEdit() {
    if (!editingTaskId) return

    setBoard((prev) => {
      const next = { ...prev }
      for (const status of statusOrder) {
        next[status] = prev[status].map((task) =>
          task.id === editingTaskId
            ? {
                ...task,
                title: editTitle.trim() || task.title,
                note: editNote.trim() || task.note,
                dueDate: editDueDate.trim() || task.dueDate,
                dueTime: editDueTime.trim() || task.dueTime,
                priority: editPriority,
              }
            : task
        )
      }
      return next
    })

    setEditingTaskId(null)
  }

  function onDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id))
  }

  function onDragEnd(event: DragEndEvent) {
    setActiveId(null)
    const { active, over } = event

    if (!over) return

    const activeContainer = findContainer(active.id)
    const overContainer = findContainer(over.id)
    if (!activeContainer || !overContainer) return

    if (activeContainer === overContainer) {
      setBoard((prev) => {
        const items = [...prev[activeContainer]]
        const oldIndex = items.findIndex((task) => task.id === String(active.id))
        const overIndex = items.findIndex((task) => task.id === String(over.id))
        if (oldIndex < 0 || overIndex < 0 || oldIndex === overIndex) return prev

        return {
          ...prev,
          [activeContainer]: arrayMove(items, oldIndex, overIndex),
        }
      })
      return
    }

    setBoard((prev) => {
      const sourceItems = [...prev[activeContainer]]
      const targetItems = [...prev[overContainer]]
      const sourceIndex = sourceItems.findIndex(
        (task) => task.id === String(active.id)
      )
      if (sourceIndex < 0) return prev

      const [moved] = sourceItems.splice(sourceIndex, 1)
      const overId = String(over.id)
      const overIsColumn = overId === overContainer
      const targetIndex = overIsColumn
        ? targetItems.length
        : targetItems.findIndex((task) => task.id === overId)
      const insertAt = targetIndex < 0 ? targetItems.length : targetIndex

      targetItems.splice(insertAt, 0, { ...moved, status: overContainer })

      return {
        ...prev,
        [activeContainer]: sourceItems,
        [overContainer]: targetItems,
      }
    })
  }

  const canAddTask =
    draftTitle.trim().length > 0 &&
    draftNote.trim().length > 0 &&
    draftDueDate.length > 0 &&
    draftDueTime.length > 0

  return (
    <div className="space-y-5">
      <Card className="border-[color:var(--nook-sidebar-border)] bg-background/70 backdrop-blur">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Quick Add Task</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <Input
              value={draftTitle}
              onChange={(event) => setDraftTitle(event.target.value)}
              placeholder="Task title"
              className="border-[color:var(--nook-sidebar-border)] bg-[color:var(--nook-sidebar-input-bg)]"
            />
            <textarea
              value={draftNote}
              onChange={(event) => setDraftNote(event.target.value)}
              placeholder="Task description"
              className="min-h-20 w-full rounded-md border border-[color:var(--nook-sidebar-border)] bg-[color:var(--nook-sidebar-input-bg)] px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--nook-accent)]"
            />
            <div className="grid gap-3 md:grid-cols-4">
              <Input
                type="date"
                value={draftDueDate}
                onChange={(event) => setDraftDueDate(event.target.value)}
                className="border-[color:var(--nook-sidebar-border)] bg-[color:var(--nook-sidebar-input-bg)]"
              />
              <Input
                type="time"
                value={draftDueTime}
                onChange={(event) => setDraftDueTime(event.target.value)}
                className="border-[color:var(--nook-sidebar-border)] bg-[color:var(--nook-sidebar-input-bg)]"
              />
              <Select
                value={draftPriority}
                onValueChange={(value) => setDraftPriority(value as TaskPriority)}
              >
                <SelectTrigger className="w-full border-[color:var(--nook-sidebar-border)]">
                  <SelectValue placeholder="Priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
              <Button
                type="button"
                onClick={addTask}
                disabled={!canAddTask}
                className="bg-[color:var(--nook-accent)] text-slate-950 hover:bg-[color:var(--nook-accent-strong)] disabled:opacity-50"
              >
                <Plus />
                Add Task
              </Button>
            </div>
            <Button
              type="button"
              variant="ghost"
              className="h-auto justify-start px-0 text-xs text-muted-foreground hover:bg-transparent"
            >
              Fill title, description, date, and time to add a task.
            </Button>
          </div>
        </CardContent>
      </Card>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
      >
        <div className="grid gap-4 lg:grid-cols-3">
          {boardColumns.map((column) => {
            const columnTasks = board[column.id]

            return (
              <ColumnDropZone key={column.id} id={column.id}>
                <div className="mb-3 flex items-start justify-between">
                  <div>
                    <h3 className="text-base font-semibold">{column.label}</h3>
                    <p className="text-xs text-muted-foreground">{column.subtitle}</p>
                  </div>
                  <Badge variant="secondary">{columnTasks.length}</Badge>
                </div>

                <SortableContext
                  items={columnTasks.map((task) => task.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-3">
                    {columnTasks.length === 0 && (
                      <p className="rounded-xl border border-dashed border-[color:var(--nook-sidebar-border)] px-3 py-6 text-center text-sm text-muted-foreground">
                        No tasks here yet
                      </p>
                    )}

                    {columnTasks.map((task) => (
                      <TaskCard key={task.id} task={task} onEdit={openEdit} />
                    ))}
                  </div>
                </SortableContext>
              </ColumnDropZone>
            )
          })}
        </div>

        <DragOverlay>
          {activeTask ? (
            <article className="w-[280px] rounded-xl border border-[color:var(--nook-sidebar-border)] bg-background/95 p-3 shadow-xl">
              <div className="mb-2 flex items-start justify-between gap-2">
                <h4 className="text-sm font-medium">{activeTask.title}</h4>
                <Badge className={cn("capitalize", priorityClass(activeTask.priority))}>
                  {activeTask.priority}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">{activeTask.note}</p>
              <p className="mt-2 text-xs text-muted-foreground">
                Due: {formatDue(activeTask.dueDate, activeTask.dueTime)}
              </p>
            </article>
          ) : null}
        </DragOverlay>
      </DndContext>

      <Drawer
        open={Boolean(editingTask)}
        onOpenChange={(open) => {
          if (!open) setEditingTaskId(null)
        }}
      >
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Edit Task</DrawerTitle>
            <DrawerDescription>
              Update task details and keep your board current.
            </DrawerDescription>
          </DrawerHeader>
          <div className="space-y-4 px-4 pb-2">
            <div className="space-y-2">
              <p className="text-sm font-medium">Title</p>
              <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">Note</p>
              <textarea
                value={editNote}
                onChange={(e) => setEditNote(e.target.value)}
                className="min-h-20 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <p className="text-sm font-medium">Due Date</p>
                <Input
                  type="date"
                  value={editDueDate}
                  onChange={(e) => setEditDueDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium">Time</p>
                <Input
                  type="time"
                  value={editDueTime}
                  onChange={(e) => setEditDueTime(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium">Priority</p>
                <Select
                  value={editPriority}
                  onValueChange={(value) => setEditPriority(value as TaskPriority)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Priority" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DrawerFooter>
            <Button
              onClick={saveTaskEdit}
              className="bg-[color:var(--nook-accent)] text-slate-950 hover:bg-[color:var(--nook-accent-strong)]"
            >
              Save Changes
            </Button>
            <Button variant="outline" onClick={() => setEditingTaskId(null)}>
              Cancel
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </div>
  )
}
