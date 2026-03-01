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
import { useMutation, useQuery } from "convex/react"
import {
  AlertTriangle,
  Crosshair,
  Paperclip,
  GripVertical,
  Info,
  Link2,
  MessageSquare,
  MoreHorizontal,
  PauseCircle,
  Pencil,
  Plus,
  Search,
  Send,
  SlidersHorizontal,
  Trash2,
  UserRound,
} from "lucide-react"

import type { Id } from "@/convex/_generated/dataModel"
import { roomTasksApi } from "@/lib/convex-room-tasks-api"
import { roomsApi } from "@/lib/convex-rooms-api"
import { roomTaskChatApi } from "@/lib/convex-room-task-chat-api"
import { useAuth } from "@/components/providers/auth-provider"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { avatarSrcForKey } from "@/lib/avatar-options"
import { buildMentionHandle, normalizeMentionHandle } from "@/lib/mention-utils"
import { cn } from "@/lib/utils"

type TaskStatus = "todo" | "working" | "blocked" | "completed"
type TaskPriority = "low" | "medium" | "high"
type TaskEffort = "quick" | "half_day" | "full_day" | "multi_day"
type DuePreset = "none" | "today" | "tomorrow" | "this_week" | "next_week" | "custom"

type RoomMember = {
  userId: string
  name: string
  username: string
  email: string
  role: "viewer" | "member" | "admin"
  avatarKey: string
}

type RoomTask = {
  id: string
  title: string
  note: string
  assignee: string
  assigneeUserId?: string
  priority: TaskPriority
  effort?: TaskEffort
  status: TaskStatus
  dueAt?: number
  updatedAt?: number
}

type TaskThreadData = {
  messages: Array<{
    id: string
    body: string
    createdAt: number
    authorUserId: string
    authorName: string
    authorAvatarKey: string
  }>
  files: Array<{
    id: string
    name: string
    url: string
    createdAt: number
    uploadedByUserId: string
    uploadedByName: string
    uploadedByAvatarKey: string
  }>
  events: Array<{
    id: string
    type: string
    message: string
    createdAt: number
    actorUserId: string
    actorName: string
    actorAvatarKey: string
  }>
}

export type RoomTaskFocusTarget = {
  id: string
  title: string
}

type TaskBoardState = Record<TaskStatus, RoomTask[]>
type DueFilter = "all" | "overdue" | "today" | "week" | "none"
type AssigneeFilter = "all" | "mine" | "none" | string
type PriorityFilter = "all" | TaskPriority
type StatusFilter = "all" | TaskStatus | "open"
type SortMode = "manual" | "priority" | "due_soon"

const boardColumns: Array<{
  id: TaskStatus
  label: string
  subtitle: string
}> = [
  { id: "todo", label: "To Do", subtitle: "Planned next" },
  { id: "working", label: "In Progress", subtitle: "Being built now" },
  { id: "blocked", label: "Blocked", subtitle: "Needs unblock" },
  { id: "completed", label: "Completed", subtitle: "Done and verified" },
]

const statusOrder: TaskStatus[] = ["todo", "working", "blocked", "completed"]
const IN_PROGRESS_WIP_LIMIT = 3
const duePresetOptions: Array<{ value: Exclude<DuePreset, "custom" | "none">; label: string }> = [
  { value: "today", label: "Today" },
  { value: "tomorrow", label: "Tomorrow" },
  { value: "this_week", label: "This Week" },
  { value: "next_week", label: "Next Week" },
]

function computeDueAtFromPreset(preset: DuePreset, customValue: string) {
  const now = new Date()
  const atSix = (source: Date) => {
    const date = new Date(source)
    date.setHours(18, 0, 0, 0)
    return date.getTime()
  }

  if (preset === "none") return undefined
  if (preset === "today") return atSix(now)
  if (preset === "tomorrow") {
    const date = new Date(now)
    date.setDate(date.getDate() + 1)
    return atSix(date)
  }
  if (preset === "this_week") {
    const date = new Date(now)
    const day = date.getDay()
    const fridayOffset = day <= 5 ? 5 - day : 12 - day
    date.setDate(date.getDate() + fridayOffset)
    return atSix(date)
  }
  if (preset === "next_week") {
    const date = new Date(now)
    const day = date.getDay()
    const fridayOffset = day <= 5 ? 12 - day : 19 - day
    date.setDate(date.getDate() + fridayOffset)
    return atSix(date)
  }
  if (!customValue) return undefined
  const parsed = new Date(customValue).getTime()
  return Number.isNaN(parsed) ? undefined : parsed
}

function toBoardState(tasks: RoomTask[]): TaskBoardState {
  return {
    todo: tasks.filter((task) => task.status === "todo"),
    working: tasks.filter((task) => task.status === "working"),
    blocked: tasks.filter((task) => task.status === "blocked"),
    completed: tasks.filter((task) => task.status === "completed"),
  }
}

function flattenBoard(board: TaskBoardState): RoomTask[] {
  return statusOrder.flatMap((status) => board[status])
}

function tasksEqual(a: RoomTask[], b: RoomTask[]) {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i += 1) {
    if (
      a[i].id !== b[i].id ||
      a[i].title !== b[i].title ||
      a[i].note !== b[i].note ||
      a[i].assignee !== b[i].assignee ||
      a[i].assigneeUserId !== b[i].assigneeUserId ||
      a[i].dueAt !== b[i].dueAt ||
      a[i].priority !== b[i].priority ||
      a[i].effort !== b[i].effort ||
      a[i].status !== b[i].status
    ) {
      return false
    }
  }
  return true
}

function priorityClass(priority: TaskPriority) {
  if (priority === "high") return "bg-red-500/15 text-red-700 dark:text-red-300"
  if (priority === "medium") return "bg-amber-500/15 text-amber-700 dark:text-amber-300"
  return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
}

function getActiveMentionDraft(value: string, caret: number) {
  const beforeCaret = value.slice(0, caret)
  const match = beforeCaret.match(/(?:^|\s)@([a-z0-9._-]{0,32})$/i)
  if (!match) return null

  return {
    query: normalizeMentionHandle(match[1] ?? ""),
    start: beforeCaret.length - (match[1]?.length ?? 0) - 1,
    end: caret,
  }
}

function renderMessageBody(body: string, mentionHandles: Set<string>) {
  const parts = body.split(/(@[a-z0-9][a-z0-9._-]{0,31})/gi)

  return parts.map((part, index) => {
    if (!part.startsWith("@")) {
      return <React.Fragment key={`${part}-${index}`}>{part}</React.Fragment>
    }

    const handle = normalizeMentionHandle(part.slice(1))
    if (!mentionHandles.has(handle)) {
      return <React.Fragment key={`${part}-${index}`}>{part}</React.Fragment>
    }

    return (
      <span
        key={`${part}-${index}`}
        className="rounded bg-cyan-500/15 px-1 py-0.5 font-medium text-cyan-800 dark:text-cyan-200"
      >
        {part}
      </span>
    )
  })
}

function isStaleBlockedTask(task: RoomTask) {
  return (
    task.status === "blocked" &&
    Boolean(task.updatedAt && Date.now() - task.updatedAt > 24 * 60 * 60 * 1000)
  )
}

function cardStatusClass(status: TaskStatus) {
  if (status === "completed") return "bg-emerald-500/12"
  if (status === "blocked") return "bg-rose-500/12"
  if (status === "working") return "bg-cyan-500/10"
  return "bg-amber-500/10"
}

function dueStateClass(dueAt?: number) {
  if (!dueAt) return "text-muted-foreground"
  const now = Date.now()
  if (dueAt < now) return "text-red-600 dark:text-red-300"
  if (dueAt - now < 24 * 60 * 60 * 1000) return "text-amber-600 dark:text-amber-300"
  return "text-muted-foreground"
}

function formatDueLabel(dueAt?: number) {
  if (!dueAt) return "No due date"
  const now = Date.now()
  if (dueAt < now) {
    const elapsedDays = Math.max(1, Math.floor((now - dueAt) / (24 * 60 * 60 * 1000)))
    return `Overdue · ${elapsedDays} day${elapsedDays > 1 ? "s" : ""}`
  }
  return `Due ${new Date(dueAt).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  })}`
}

function effortLabel(effort?: TaskEffort) {
  if (!effort) return null
  if (effort === "half_day") return "Half day"
  if (effort === "full_day") return "Full day"
  if (effort === "multi_day") return "Multi-day"
  return "Quick"
}

function statusLabel(status: TaskStatus) {
  if (status === "working") return "In Progress"
  if (status === "blocked") return "Blocked"
  if (status === "completed") return "Completed"
  return "To Do"
}

function isTaskDueToday(dueAt: number) {
  const now = new Date()
  const due = new Date(dueAt)
  return (
    due.getFullYear() === now.getFullYear() &&
    due.getMonth() === now.getMonth() &&
    due.getDate() === now.getDate()
  )
}

function isTaskDueThisWeek(dueAt: number) {
  const now = Date.now()
  const inAWeek = now + 7 * 24 * 60 * 60 * 1000
  return dueAt >= now && dueAt <= inAWeek
}

function taskMatchesFilters(
  task: RoomTask,
  opts: {
    search: string
    assignee: AssigneeFilter
    priority: PriorityFilter
    status: StatusFilter
    due: DueFilter
    userId?: string
  }
) {
  const search = opts.search.trim().toLowerCase()
  if (
    search &&
    !`${task.title} ${task.note} ${task.assignee}`.toLowerCase().includes(search)
  ) {
    return false
  }

  if (opts.assignee === "mine") {
    if (!opts.userId || task.assigneeUserId !== opts.userId) return false
  } else if (opts.assignee === "none") {
    if (task.assigneeUserId) return false
  } else if (opts.assignee !== "all" && task.assigneeUserId !== opts.assignee) {
    return false
  }

  if (opts.priority !== "all" && task.priority !== opts.priority) {
    return false
  }
  if (opts.status === "open" && task.status === "completed") return false
  if (opts.status !== "all" && opts.status !== "open" && task.status !== opts.status) {
    return false
  }

  if (opts.due === "none") return !task.dueAt
  if (!task.dueAt && opts.due !== "all") return false
  if (opts.due === "overdue" && task.dueAt && task.dueAt >= Date.now()) return false
  if (opts.due === "today" && task.dueAt && !isTaskDueToday(task.dueAt)) return false
  if (opts.due === "week" && task.dueAt && !isTaskDueThisWeek(task.dueAt)) return false

  return true
}

function sortTasks(tasks: RoomTask[], mode: SortMode) {
  if (mode === "manual") return tasks
  const copy = [...tasks]
  if (mode === "priority") {
    const score: Record<TaskPriority, number> = { high: 0, medium: 1, low: 2 }
    return copy.sort((left, right) => score[left.priority] - score[right.priority])
  }
  return copy.sort((left, right) => {
    if (!left.dueAt && !right.dueAt) return 0
    if (!left.dueAt) return 1
    if (!right.dueAt) return -1
    return left.dueAt - right.dueAt
  })
}

function BaseTaskCard({
  task,
  assigneeAvatarKey,
  unreadCount = 0,
  latestReply,
  onEdit,
  onStartFocus,
  onDiscuss,
  dragBindings,
  isDraggable = false,
}: {
  task: RoomTask
  assigneeAvatarKey?: string
  unreadCount?: number
  latestReply?: { authorName?: string; body?: string } | null
  onEdit?: (task: RoomTask) => void
  onStartFocus?: (task: RoomTaskFocusTarget) => void
  onDiscuss?: (task: RoomTask) => void
  dragBindings?: React.HTMLAttributes<HTMLElement>
  isDraggable?: boolean
}) {
  const hasActions = Boolean(onStartFocus || onDiscuss || onEdit)
  const isStaleBlocked = isStaleBlockedTask(task)

  return (
    <article
      className={cn(
        "rounded-xl border border-[color:var(--nook-sidebar-border)] bg-background/80 p-3.5",
        isDraggable && "cursor-grab active:cursor-grabbing",
        cardStatusClass(task.status),
        isStaleBlocked && "border-rose-500/35 shadow-[0_0_0_1px_rgba(244,63,94,0.12)]"
      )}
      {...(isDraggable ? dragBindings : undefined)}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-2">
          {isDraggable ? (
            <GripVertical className="mt-0.5 size-4 text-muted-foreground" />
          ) : (
            <PauseCircle className="mt-0.5 size-4 text-muted-foreground" />
          )}
          <h4 className="min-w-0 break-words pr-1 text-sm font-semibold leading-5">
            {task.title}
          </h4>
        </div>
        <div className="flex items-center gap-1">
          {unreadCount > 0 ? (
            <Badge className="bg-cyan-500/15 text-cyan-800 dark:text-cyan-200">
              {unreadCount} new
            </Badge>
          ) : null}
          {task.priority === "high" ? (
            <Badge className={cn("capitalize", priorityClass(task.priority))}>
              {task.priority}
            </Badge>
          ) : null}
          {hasActions ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-7"
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={(event) => event.stopPropagation()}
                >
                  <MoreHorizontal className="size-4" />
                  <span className="sr-only">Task actions</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {onStartFocus ? (
                  <DropdownMenuItem
                    onClick={() => {
                      onStartFocus({ id: task.id, title: task.title })
                    }}
                  >
                    <Crosshair className="size-4" />
                    Focus Task
                  </DropdownMenuItem>
                ) : null}
                {onDiscuss ? (
                  <DropdownMenuItem
                    onClick={() => {
                      onDiscuss(task)
                    }}
                  >
                    <MessageSquare className="size-4" />
                    Discuss Task
                  </DropdownMenuItem>
                ) : null}
                {onEdit ? (
                  <DropdownMenuItem
                    onClick={() => {
                      onEdit(task)
                    }}
                  >
                    <Pencil className="size-4" />
                    Edit Task
                  </DropdownMenuItem>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>
      </div>
      <p className={cn("mt-1 text-xs", dueStateClass(task.dueAt))}>
        {formatDueLabel(task.dueAt)}
      </p>
      {isStaleBlocked ? (
        <p className="mt-1 text-[11px] font-medium text-rose-700 dark:text-rose-300">
          Blocked for more than 24h
        </p>
      ) : null}
      {latestReply?.body ? (
        <p className="mt-1 line-clamp-2 text-[11px] text-muted-foreground">
          <span className="font-medium text-foreground/80">
            {latestReply.authorName === "You" ? "You" : latestReply.authorName}:
          </span>{" "}
          {latestReply.body}
        </p>
      ) : null}
      {task.effort && task.effort !== "quick" ? (
        <p className="mt-1 text-[11px] text-muted-foreground">Effort: {effortLabel(task.effort)}</p>
      ) : null}
      <div className="mt-3 flex items-center gap-2">
        {task.assigneeUserId && task.assignee ? (
          <div className="inline-flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
            <Avatar className="size-5 border border-cyan-500/25">
              <AvatarImage
                src={avatarSrcForKey(assigneeAvatarKey)}
                alt={task.assignee}
              />
              <AvatarFallback>
                {task.assignee
                  .split(" ")
                  .map((part) => part[0] ?? "")
                  .join("")
                  .slice(0, 2)
                  .toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <span className="truncate">{task.assignee}</span>
          </div>
        ) : (
          <div className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <UserRound className="size-3.5" />
            Unassigned
          </div>
        )}
      </div>
    </article>
  )
}

function SortableTaskCard(props: {
  task: RoomTask
  assigneeAvatarKey?: string
  unreadCount?: number
  latestReply?: { authorName?: string; body?: string } | null
  onEdit?: (task: RoomTask) => void
  onStartFocus?: (task: RoomTaskFocusTarget) => void
  onDiscuss?: (task: RoomTask) => void
}) {
  const { task } = props
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: task.id,
  })

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
    >
      <BaseTaskCard
        {...props}
        isDraggable
        dragBindings={{ ...attributes, ...listeners }}
      />
    </div>
  )
}

function ColumnDropZone({
  id,
  children,
  muted = false,
}: {
  id: TaskStatus
  children: React.ReactNode
  muted?: boolean
}) {
  const { setNodeRef, isOver } = useDroppable({ id })
  return (
    <section
      ref={setNodeRef}
      className={cn(
        "rounded-2xl border border-[color:var(--nook-sidebar-border)] bg-background/55 p-3 backdrop-blur transition-colors",
        muted && "border-dashed bg-transparent opacity-65 shadow-none",
        isOver && "bg-[color:var(--nook-sidebar-input-bg)]"
      )}
    >
      {children}
    </section>
  )
}

export function RoomTaskBoard({
  roomId,
  onStartFocusTask,
  initialDueFilter = "all",
  initialStatusFilter = "all",
  initialThreadTaskId = null,
  initialThreadTab = "chat",
}: {
  roomId: Id<"rooms">
  onStartFocusTask?: (task: RoomTaskFocusTarget) => void
  initialDueFilter?: DueFilter
  initialStatusFilter?: StatusFilter
  initialThreadTaskId?: string | null
  initialThreadTab?: "chat" | "files" | "history"
}) {
  const { sessionToken, user } = useAuth()
  const docs = useQuery(roomTasksApi.listByRoom, { roomId }) as
    | Array<{
        taskId: string
        title: string
        note: string
        assignee: string
        assigneeUserId?: string
        priority: TaskPriority
        effort?: TaskEffort
        status: TaskStatus
        dueAt?: number
        updatedAt: number
      }>
    | undefined
  const membersQuery = useQuery(
    roomsApi.listMembersByRoom,
    sessionToken ? { sessionToken, roomId } : "skip"
  ) as RoomMember[] | undefined
  const members = React.useMemo(() => membersQuery ?? [], [membersQuery])

  const memberNameById = React.useMemo(
    () => new Map(members.map((member) => [member.userId, member.name])),
    [members]
  )
  const memberAvatarById = React.useMemo(
    () => new Map(members.map((member) => [member.userId, member.avatarKey])),
    [members]
  )
  const currentMember = React.useMemo(
    () => members.find((member) => member.userId === user?.id) ?? null,
    [members, user?.id]
  )
  const canEditTasks = currentMember?.role === "member" || currentMember?.role === "admin"
  const canManageFiles = canEditTasks

  const syncByRoom = useMutation(roomTasksApi.syncByRoom)
  const sendThreadMessage = useMutation(roomTaskChatApi.sendMessage)
  const markThreadRead = useMutation(roomTaskChatApi.markThreadRead)
  const shareThreadFile = useMutation(roomTaskChatApi.shareFile)
  const generateThreadUploadUrl = useMutation(roomTaskChatApi.generateUploadUrl)
  const shareUploadedThreadFile = useMutation(roomTaskChatApi.shareUploadedFile)

  const serverTasks = React.useMemo(() => {
    if (!docs) return []
    return docs.map((task) => ({
      id: task.taskId,
      title: task.title,
      note: task.note,
      assignee: task.assignee,
      assigneeUserId: task.assigneeUserId,
      priority: task.priority,
      effort: task.effort,
      status: task.status,
      dueAt: task.dueAt,
      updatedAt: task.updatedAt,
    }))
  }, [docs])

  const [board, setBoard] = React.useState<TaskBoardState>(() => toBoardState([]))
  const [draftTitle, setDraftTitle] = React.useState("")
  const [draftNote, setDraftNote] = React.useState("")
  const [draftAssigneeUserId, setDraftAssigneeUserId] = React.useState("none")
  const [draftPriority, setDraftPriority] = React.useState<TaskPriority>("medium")
  const [draftEffort, setDraftEffort] = React.useState<TaskEffort>("quick")
  const [draftStatus, setDraftStatus] = React.useState<TaskStatus>("todo")
  const [draftDuePreset, setDraftDuePreset] = React.useState<DuePreset>("none")
  const [showDraftSpecificDue, setShowDraftSpecificDue] = React.useState(false)
  const [draftDueAt, setDraftDueAt] = React.useState("")
  const [isAddTaskOpen, setIsAddTaskOpen] = React.useState(false)
  const [searchQuery, setSearchQuery] = React.useState("")
  const [assigneeFilter, setAssigneeFilter] = React.useState<AssigneeFilter>("all")
  const [priorityFilter, setPriorityFilter] = React.useState<PriorityFilter>("all")
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>(initialStatusFilter)
  const [dueFilter, setDueFilter] = React.useState<DueFilter>(initialDueFilter)
  const [sortMode, setSortMode] = React.useState<SortMode>("manual")
  const [activeId, setActiveId] = React.useState<string | null>(null)
  const [editingTaskId, setEditingTaskId] = React.useState<string | null>(null)
  const [editTitle, setEditTitle] = React.useState("")
  const [editNote, setEditNote] = React.useState("")
  const [editAssigneeUserId, setEditAssigneeUserId] = React.useState("none")
  const [editPriority, setEditPriority] = React.useState<TaskPriority>("medium")
  const [editEffort, setEditEffort] = React.useState<TaskEffort>("quick")
  const [editStatus, setEditStatus] = React.useState<TaskStatus>("todo")
  const [editDuePreset, setEditDuePreset] = React.useState<DuePreset>("custom")
  const [showEditSpecificDue, setShowEditSpecificDue] = React.useState(false)
  const [editDueAt, setEditDueAt] = React.useState("")
  const [threadTaskId, setThreadTaskId] = React.useState<string | null>(null)
  const [threadTab, setThreadTab] = React.useState<"chat" | "files" | "history">(initialThreadTab)
  const [threadMessage, setThreadMessage] = React.useState("")
  const [threadMessageCaret, setThreadMessageCaret] = React.useState(0)
  const [threadFileUrl, setThreadFileUrl] = React.useState("")
  const [threadUploadFile, setThreadUploadFile] = React.useState<File | null>(null)
  const [isUploadingThreadFile, setIsUploadingThreadFile] = React.useState(false)
  const uploadInFlightRef = React.useRef(false)
  const [showFileLinkInput, setShowFileLinkInput] = React.useState(false)
  const [messageReactions, setMessageReactions] = React.useState<
    Record<string, string[]>
  >({})
  const [threadError, setThreadError] = React.useState<string | null>(null)
  const [activeMentionIndex, setActiveMentionIndex] = React.useState(0)
  const threadMessageInputRef = React.useRef<HTMLInputElement | null>(null)

  React.useEffect(() => {
    setStatusFilter(initialStatusFilter)
  }, [initialStatusFilter])

  React.useEffect(() => {
    setDueFilter(initialDueFilter)
  }, [initialDueFilter])

  const thread = useQuery(
    roomTaskChatApi.listThread,
    sessionToken && threadTaskId
      ? { sessionToken, roomId, taskId: threadTaskId }
      : "skip"
  ) as TaskThreadData | undefined
  const threadSummaries = useQuery(
    roomTaskChatApi.listTaskThreadSummaries,
    sessionToken ? { sessionToken, roomId } : "skip"
  ) as
    | Array<{
        taskId: string
        latestMessageAt?: number
        latestAuthorUserId?: string
        latestAuthorName?: string
        latestBody?: string
        messageCount: number
        unreadCount: number
      }>
    | undefined
  const markedThreadReadsRef = React.useRef<Record<string, number>>({})

  const threadSummaryByTaskId = React.useMemo(
    () => new Map((threadSummaries ?? []).map((summary) => [summary.taskId, summary])),
    [threadSummaries]
  )

  React.useEffect(() => {
    if (!initialThreadTaskId) return
    setThreadTaskId(initialThreadTaskId)
    setThreadTab(initialThreadTab)
    setShowFileLinkInput(false)
    setThreadError(null)
  }, [initialThreadTab, initialThreadTaskId])

  React.useEffect(() => {
    if (!threadTaskId) return
    const summary = threadSummaryByTaskId.get(threadTaskId)
    if (!summary?.latestMessageAt) return
    if ((summary.unreadCount ?? 0) <= 0) return
    if (markedThreadReadsRef.current[threadTaskId] === summary.latestMessageAt) return
    markedThreadReadsRef.current[threadTaskId] = summary.latestMessageAt
    void markThreadRead({
      sessionToken: sessionToken as string,
      roomId,
      taskId: threadTaskId,
      readAt: summary.latestMessageAt,
    })
  }, [markThreadRead, roomId, sessionToken, threadSummaryByTaskId, threadTaskId])

  const roomMentionMembers = React.useMemo(
    () =>
      members
        .map((member) => ({
          ...member,
          handle: buildMentionHandle({
            username: member.username,
            name: member.name,
            email: member.email,
            userId: member.userId,
          }),
        }))
        .filter((member, index, all) => {
          return (
            member.userId !== user?.id &&
            all.findIndex((item) => item.handle === member.handle) === index
          )
        }),
    [members, user?.id]
  )
  const roomMentionHandleSet = React.useMemo(
    () => new Set(roomMentionMembers.map((member) => member.handle)),
    [roomMentionMembers]
  )
  const activeMentionDraft = React.useMemo(
    () => getActiveMentionDraft(threadMessage, threadMessageCaret),
    [threadMessage, threadMessageCaret]
  )
  const mentionSuggestions = React.useMemo(() => {
    if (!activeMentionDraft) return []
    if (!activeMentionDraft.query) return roomMentionMembers.slice(0, 6)

    return roomMentionMembers
      .filter((member) => {
        const query = activeMentionDraft.query
        return (
          member.handle.includes(query) ||
          member.name.toLowerCase().includes(query) ||
          member.email.toLowerCase().includes(query)
        )
      })
      .slice(0, 6)
  }, [activeMentionDraft, roomMentionMembers])

  React.useEffect(() => {
    setActiveMentionIndex(0)
  }, [activeMentionDraft?.query])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  React.useEffect(() => {
    setBoard((prev) => {
      const boardTasks = flattenBoard(prev)
      if (tasksEqual(boardTasks, serverTasks)) return prev
      return toBoardState(serverTasks)
    })
  }, [serverTasks])

  function persist(next: TaskBoardState) {
    const payload = flattenBoard(next).map((task, index) => ({
      taskId: task.id,
      title: task.title,
      note: task.note,
      assignee: task.assignee,
      assigneeUserId: task.assigneeUserId as Id<"users"> | undefined,
      priority: task.priority,
      effort: task.effort,
      status: task.status,
      dueAt: task.dueAt,
      order: index,
    }))
    void syncByRoom({
      roomId,
      actorUserId: user?.id,
      tasks: payload,
    })
  }

  const findContainer = React.useCallback(
    (id: UniqueIdentifier): TaskStatus | null => {
      const value = String(id)
      if (statusOrder.includes(value as TaskStatus)) return value as TaskStatus
      for (const status of statusOrder) {
        if (board[status].some((task) => task.id === value)) return status
      }
      return null
    },
    [board]
  )

  const activeTask = React.useMemo(() => {
    if (!activeId) return null
    for (const status of statusOrder) {
      const task = board[status].find((item) => item.id === activeId)
      if (task) return task
    }
    return null
  }, [activeId, board])

  const editingTask = React.useMemo(() => {
    if (!editingTaskId) return null
    for (const status of statusOrder) {
      const task = board[status].find((item) => item.id === editingTaskId)
      if (task) return task
    }
    return null
  }, [editingTaskId, board])

  const threadTask = React.useMemo(() => {
    if (!threadTaskId) return null
    for (const status of statusOrder) {
      const task = board[status].find((item) => item.id === threadTaskId)
      if (task) return task
    }
    return null
  }, [threadTaskId, board])

  async function postThreadMessage() {
    if (!sessionToken || !threadTaskId) return
    const body = threadMessage.trim()
    if (!body) return

    setThreadError(null)
    try {
      await sendThreadMessage({
        sessionToken,
        roomId,
        taskId: threadTaskId,
        body,
      })
      setThreadMessage("")
      setThreadMessageCaret(0)
    } catch (error) {
      setThreadError(error instanceof Error ? error.message : "Unable to send message.")
    }
  }

  function applyMention(memberHandle: string) {
    if (!activeMentionDraft) return

    const nextMessage = `${threadMessage.slice(0, activeMentionDraft.start)}@${memberHandle} ${threadMessage.slice(activeMentionDraft.end)}`
    const nextCaret = activeMentionDraft.start + memberHandle.length + 2
    setThreadMessage(nextMessage)
    setThreadMessageCaret(nextCaret)

    window.requestAnimationFrame(() => {
      threadMessageInputRef.current?.focus()
      threadMessageInputRef.current?.setSelectionRange(nextCaret, nextCaret)
    })
  }

  async function postThreadFile() {
    if (!canManageFiles) {
      setThreadError("Your role can view files, but cannot share files.")
      return
    }
    if (!sessionToken || !threadTaskId) return
    const url = threadFileUrl.trim()
    if (!url) return

    const safeName = (() => {
      try {
        const parsed = new URL(url)
        const tail = parsed.pathname.split("/").filter(Boolean).at(-1)
        return tail || parsed.hostname
      } catch {
        return "Shared link"
      }
    })()

    setThreadError(null)
    try {
      await shareThreadFile({
        sessionToken,
        roomId,
        taskId: threadTaskId,
        name: safeName,
        url,
      })
      setThreadFileUrl("")
      setShowFileLinkInput(false)
    } catch (error) {
      setThreadError(error instanceof Error ? error.message : "Unable to share file.")
    }
  }

  async function uploadThreadFile() {
    if (!canManageFiles) {
      setThreadError("Your role can view files, but cannot upload files.")
      return
    }
    if (!sessionToken || !threadTaskId || !threadUploadFile) return
    if (uploadInFlightRef.current) return

    uploadInFlightRef.current = true
    setIsUploadingThreadFile(true)
    setThreadError(null)
    try {
      const { uploadUrl } = await generateThreadUploadUrl({
        sessionToken,
        roomId,
        taskId: threadTaskId,
      })

      const uploadResult = await fetch(uploadUrl, {
        method: "POST",
        headers: {
          "Content-Type": threadUploadFile.type || "application/octet-stream",
        },
        body: threadUploadFile,
      })

      if (!uploadResult.ok) {
        throw new Error("Upload failed.")
      }

      const { storageId } = (await uploadResult.json()) as { storageId: Id<"_storage"> }
      await shareUploadedThreadFile({
        sessionToken,
        roomId,
        taskId: threadTaskId,
        name: threadUploadFile.name,
        storageId,
        mimeType: threadUploadFile.type || undefined,
        sizeBytes: threadUploadFile.size,
      })

      setThreadUploadFile(null)
    } catch (error) {
      setThreadError(error instanceof Error ? error.message : "Unable to upload file.")
    } finally {
      uploadInFlightRef.current = false
      setIsUploadingThreadFile(false)
    }
  }

  function toggleMessageReaction(messageId: string, emoji: string) {
    setMessageReactions((prev) => {
      const current = prev[messageId] ?? []
      const exists = current.includes(emoji)
      return {
        ...prev,
        [messageId]: exists
          ? current.filter((value) => value !== emoji)
          : [...current, emoji],
      }
    })
  }

  function addTask() {
    if (!canEditTasks) return
    const title = draftTitle.trim()
    const note = draftNote.trim()
    if (!title || !note) return

    const assigneeUserId = draftAssigneeUserId === "none" ? undefined : draftAssigneeUserId
    const assignee = assigneeUserId ? memberNameById.get(assigneeUserId) ?? "" : ""
    const dueAt = computeDueAtFromPreset(draftDuePreset, draftDueAt)

    const task: RoomTask = {
      id: `rt-${Date.now()}`,
      title,
      note,
      assignee,
      assigneeUserId,
      priority: draftPriority,
      effort: draftEffort,
      status: draftStatus,
      dueAt,
    }

    setBoard((prev) => {
      const next = {
        ...prev,
        [draftStatus]: [task, ...prev[draftStatus]],
      }
      persist(next)
      return next
    })
    setDraftTitle("")
    setDraftNote("")
    setDraftAssigneeUserId("none")
    setDraftPriority("medium")
    setDraftEffort("quick")
    setDraftStatus("todo")
    setDraftDuePreset("none")
    setShowDraftSpecificDue(false)
    setDraftDueAt("")
    setIsAddTaskOpen(false)
  }

  function openAddTask(status: TaskStatus = "todo") {
    if (!canEditTasks) return
    setDraftStatus(status)
    setDraftDuePreset("none")
    setShowDraftSpecificDue(false)
    setIsAddTaskOpen(true)
  }

  function openEdit(task: RoomTask) {
    if (!canEditTasks) return
    setEditingTaskId(task.id)
    setEditTitle(task.title)
    setEditNote(task.note)
    setEditAssigneeUserId(task.assigneeUserId ?? "none")
    setEditPriority(task.priority)
    setEditEffort(task.effort ?? "quick")
    setEditStatus(task.status)
    setEditDuePreset(task.dueAt ? "custom" : "none")
    setShowEditSpecificDue(Boolean(task.dueAt))
    setEditDueAt(task.dueAt ? new Date(task.dueAt).toISOString().slice(0, 16) : "")
  }

  function saveTaskEdit() {
    if (!canEditTasks) return
    if (!editingTaskId) return
    const nextStatus = editStatus
    const assigneeUserId = editAssigneeUserId === "none" ? undefined : editAssigneeUserId
    const assignee = assigneeUserId ? memberNameById.get(assigneeUserId) ?? "" : ""
    const dueAt = computeDueAtFromPreset(editDuePreset, editDueAt)

    setBoard((prev) => {
      const next = { ...prev }
      let updated: RoomTask | null = null
      for (const status of statusOrder) {
        next[status] = prev[status].filter((task) => {
          if (task.id !== editingTaskId) return true
          updated = {
            ...task,
            title: editTitle.trim() || task.title,
            note: editNote.trim() || task.note,
            assignee,
            assigneeUserId,
            priority: editPriority,
            effort: editEffort,
            status: nextStatus,
            dueAt,
          }
          return false
        })
      }
      if (!updated) return prev
      next[nextStatus] = [updated, ...next[nextStatus]]
      persist(next)
      return next
    })
    setEditingTaskId(null)
  }

  function deleteTask(taskId: string) {
    if (!canEditTasks) return
    setBoard((prev) => {
      const next = { ...prev }
      for (const status of statusOrder) {
        next[status] = prev[status].filter((task) => task.id !== taskId)
      }
      persist(next)
      return next
    })
    setEditingTaskId(null)
  }

  function onDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id))
  }

  function onDragEnd(event: DragEndEvent) {
    if (!canEditTasks) {
      setActiveId(null)
      return
    }
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
        const next = {
          ...prev,
          [activeContainer]: arrayMove(items, oldIndex, overIndex),
        }
        persist(next)
        return next
      })
      return
    }

    setBoard((prev) => {
      const sourceItems = [...prev[activeContainer]]
      const targetItems = [...prev[overContainer]]
      const sourceIndex = sourceItems.findIndex((task) => task.id === String(active.id))
      if (sourceIndex < 0) return prev
      const [moved] = sourceItems.splice(sourceIndex, 1)
      const overId = String(over.id)
      const overIsColumn = overId === overContainer
      const targetIndex = overIsColumn
        ? targetItems.length
        : targetItems.findIndex((task) => task.id === overId)
      const insertAt = targetIndex < 0 ? targetItems.length : targetIndex
      targetItems.splice(insertAt, 0, { ...moved, status: overContainer })
      const next = {
        ...prev,
        [activeContainer]: sourceItems,
        [overContainer]: targetItems,
      }
      persist(next)
      return next
    })
  }

  const canAddTask = draftTitle.trim().length > 0 && draftNote.trim().length > 0
  const boardTasks = React.useMemo(() => flattenBoard(board), [board])
  const boardMetrics = React.useMemo(() => {
    const now = Date.now()
    const openTasks = boardTasks.filter((task) => task.status !== "completed")
    return {
      overdue: openTasks.filter((task) => task.dueAt && task.dueAt < now).length,
      dueToday: openTasks.filter((task) => task.dueAt && isTaskDueToday(task.dueAt)).length,
      blocked: openTasks.filter((task) => task.status === "blocked").length,
      mineOpen: openTasks.filter((task) => user?.id && task.assigneeUserId === user.id).length,
    }
  }, [boardTasks, user?.id])
  const hasActiveFilters =
    searchQuery.trim().length > 0 ||
    assigneeFilter !== "all" ||
    priorityFilter !== "all" ||
    statusFilter !== "all" ||
    dueFilter !== "all" ||
    sortMode !== "manual"
  const activeFilterPills = React.useMemo(() => {
    const pills: string[] = []
    if (searchQuery.trim()) pills.push(`Search: ${searchQuery.trim()}`)
    if (assigneeFilter !== "all") {
      if (assigneeFilter === "mine") pills.push("Assignee: Mine")
      else if (assigneeFilter === "none") pills.push("Assignee: Unassigned")
      else pills.push(`Assignee: ${memberNameById.get(assigneeFilter) ?? "Custom"}`)
    }
    if (priorityFilter !== "all") pills.push(`Priority: ${priorityFilter}`)
    if (statusFilter !== "all") pills.push(`Status: ${statusFilter}`)
    if (dueFilter !== "all") pills.push(`Due: ${dueFilter}`)
    if (sortMode !== "manual") pills.push(`Sort: ${sortMode.replace("_", " ")}`)
    return pills
  }, [
    assigneeFilter,
    dueFilter,
    memberNameById,
    priorityFilter,
    statusFilter,
    searchQuery,
    sortMode,
  ])

  const visibleBoard = React.useMemo(() => {
    const filterOpts = {
      search: searchQuery,
      assignee: assigneeFilter,
      priority: priorityFilter,
      status: statusFilter,
      due: dueFilter,
      userId: user?.id,
    }
    return {
      todo: sortTasks(board.todo.filter((task) => taskMatchesFilters(task, filterOpts)), sortMode),
      working: sortTasks(
        board.working.filter((task) => taskMatchesFilters(task, filterOpts)),
        sortMode
      ),
      blocked: sortTasks(
        board.blocked.filter((task) => taskMatchesFilters(task, filterOpts)),
        sortMode
      ),
      completed: sortTasks(
        board.completed.filter((task) => taskMatchesFilters(task, filterOpts)),
        sortMode
      ),
    } as TaskBoardState
  }, [assigneeFilter, board, dueFilter, priorityFilter, searchQuery, sortMode, statusFilter, user?.id])

  function clearFilters() {
    setSearchQuery("")
    setAssigneeFilter("all")
    setPriorityFilter("all")
    setStatusFilter("all")
    setDueFilter("all")
    setSortMode("manual")
  }
  const nowTasks = React.useMemo(() => board.working.slice(0, 4), [board.working])
  const nextTasks = React.useMemo(() => board.todo.slice(0, 4), [board.todo])
  const blockedTasks = React.useMemo(() => board.blocked.slice(0, 4), [board.blocked])
  const isWipOverLimit = board.working.length > IN_PROGRESS_WIP_LIMIT

  return (
    <div className="space-y-5">
      <Card className="border-[color:var(--nook-sidebar-border)] bg-background/70 backdrop-blur">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-lg">Task Manager View</CardTitle>
            <Button
              type="button"
              size="sm"
              onClick={() => openAddTask("todo")}
              disabled={!canEditTasks}
              className="bg-[color:var(--nook-accent)] text-slate-950 hover:bg-[color:var(--nook-accent-strong)]"
            >
              <Plus className="size-4" />
              {canEditTasks ? "Add Task" : "Read Only"}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 pt-0">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="rounded-full border border-red-500/30 bg-red-500/10 px-3 py-1 text-red-700 dark:text-red-300">
              Overdue: {boardMetrics.overdue}
            </span>
            <span className="rounded-full border border-[color:var(--nook-sidebar-border)] bg-[color:var(--nook-sidebar-input-bg)] px-3 py-1 text-muted-foreground">
              Due Today: {boardMetrics.dueToday}
            </span>
            <span className="rounded-full border border-rose-500/30 bg-rose-500/10 px-3 py-1 text-rose-700 dark:text-rose-300">
              Blocked: {boardMetrics.blocked}
            </span>
            <span className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-cyan-700 dark:text-cyan-300">
              My Open: {boardMetrics.mineOpen}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[260px] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search title, note, assignee..."
                className="pl-9"
              />
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5">
                  <SlidersHorizontal className="size-4" />
                  Filters
                  {activeFilterPills.length > 0 ? (
                    <Badge
                      variant="secondary"
                      className="ml-1 rounded-full px-1.5 py-0 text-[10px]"
                    >
                      {activeFilterPills.length}
                    </Badge>
                  ) : null}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-72">
                <DropdownMenuLabel>Assignee</DropdownMenuLabel>
                <DropdownMenuItem onSelect={() => setAssigneeFilter("all")}>
                  {assigneeFilter === "all" ? "• " : ""}
                  All assignees
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setAssigneeFilter("mine")}>
                  {assigneeFilter === "mine" ? "• " : ""}
                  My tasks
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setAssigneeFilter("none")}>
                  {assigneeFilter === "none" ? "• " : ""}
                  Unassigned
                </DropdownMenuItem>
                {members.map((member) => (
                  <DropdownMenuItem
                    key={member.userId}
                    onSelect={() => setAssigneeFilter(member.userId)}
                  >
                    {assigneeFilter === member.userId ? "• " : ""}
                    {member.name}
                  </DropdownMenuItem>
                ))}

                <DropdownMenuSeparator />
                <DropdownMenuLabel>Priority</DropdownMenuLabel>
                <DropdownMenuItem onSelect={() => setPriorityFilter("all")}>
                  {priorityFilter === "all" ? "• " : ""}
                  All priorities
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setPriorityFilter("high")}>
                  {priorityFilter === "high" ? "• " : ""}
                  High
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setPriorityFilter("medium")}>
                  {priorityFilter === "medium" ? "• " : ""}
                  Medium
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setPriorityFilter("low")}>
                  {priorityFilter === "low" ? "• " : ""}
                  Low
                </DropdownMenuItem>

                <DropdownMenuSeparator />
                <DropdownMenuLabel>Status</DropdownMenuLabel>
                <DropdownMenuItem onSelect={() => setStatusFilter("all")}>
                  {statusFilter === "all" ? "• " : ""}
                  Any status
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setStatusFilter("open")}>
                  {statusFilter === "open" ? "• " : ""}
                  Open only
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setStatusFilter("todo")}>
                  {statusFilter === "todo" ? "• " : ""}
                  To do
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setStatusFilter("working")}>
                  {statusFilter === "working" ? "• " : ""}
                  In progress
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setStatusFilter("blocked")}>
                  {statusFilter === "blocked" ? "• " : ""}
                  Blocked
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setStatusFilter("completed")}>
                  {statusFilter === "completed" ? "• " : ""}
                  Completed
                </DropdownMenuItem>

                <DropdownMenuSeparator />
                <DropdownMenuLabel>Due Date</DropdownMenuLabel>
                <DropdownMenuItem onSelect={() => setDueFilter("all")}>
                  {dueFilter === "all" ? "• " : ""}
                  Any due date
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setDueFilter("overdue")}>
                  {dueFilter === "overdue" ? "• " : ""}
                  Overdue
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setDueFilter("today")}>
                  {dueFilter === "today" ? "• " : ""}
                  Due today
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setDueFilter("week")}>
                  {dueFilter === "week" ? "• " : ""}
                  Due this week
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setDueFilter("none")}>
                  {dueFilter === "none" ? "• " : ""}
                  No due date
                </DropdownMenuItem>

                <DropdownMenuSeparator />
                <DropdownMenuLabel>Sort</DropdownMenuLabel>
                <DropdownMenuItem onSelect={() => setSortMode("manual")}>
                  {sortMode === "manual" ? "• " : ""}
                  Manual board order
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setSortMode("priority")}>
                  {sortMode === "priority" ? "• " : ""}
                  Priority first
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setSortMode("due_soon")}>
                  {sortMode === "due_soon" ? "• " : ""}
                  Due soon first
                </DropdownMenuItem>

                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={clearFilters}>Reset all filters</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="size-8">
                    <Info className="size-4 text-muted-foreground" />
                    <span className="sr-only">Ordering info</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent sideOffset={6}>
                  {!canEditTasks
                    ? "Viewer mode: task editing and drag-and-drop are disabled."
                    : hasActiveFilters
                    ? "Filtered view: drag-and-drop is disabled."
                    : "Manual mode: drag-and-drop is enabled."}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            {hasActiveFilters ? (
              <Button variant="outline" size="sm" onClick={clearFilters}>
                Clear
              </Button>
            ) : null}
          </div>
          {activeFilterPills.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {activeFilterPills.map((pill) => (
                <Badge
                  key={pill}
                  variant="secondary"
                  className="rounded-full border border-[color:var(--nook-sidebar-border)] bg-[color:var(--nook-sidebar-input-bg)] px-2 py-0.5 text-[11px] font-normal"
                >
                  {pill}
                </Badge>
              ))}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card className="border-[color:var(--nook-sidebar-border)] bg-background/70 backdrop-blur">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Flow Snapshot</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          <section className="rounded-lg border border-cyan-500/20 bg-cyan-500/5 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-cyan-700 dark:text-cyan-300">
              Now
            </p>
            <ul className="mt-2 space-y-1.5 text-sm">
              {nowTasks.length === 0 ? (
                <li className="text-xs text-muted-foreground">No active tasks.</li>
              ) : (
                nowTasks.map((task) => (
                  <li key={`now-${task.id}`} className="line-clamp-1">
                    {task.title}
                  </li>
                ))
              )}
            </ul>
          </section>
          <section className="rounded-lg border border-cyan-500/20 bg-cyan-500/5 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-cyan-700 dark:text-cyan-300">
              Next
            </p>
            <ul className="mt-2 space-y-1.5 text-sm">
              {nextTasks.length === 0 ? (
                <li className="text-xs text-muted-foreground">Queue is clear.</li>
              ) : (
                nextTasks.map((task) => (
                  <li key={`next-${task.id}`} className="line-clamp-1">
                    {task.title}
                  </li>
                ))
              )}
            </ul>
          </section>
          <section className="rounded-lg border border-rose-500/25 bg-rose-500/10 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-rose-700 dark:text-rose-300">
              Blocked
            </p>
            <ul className="mt-2 space-y-1.5 text-sm">
              {blockedTasks.length === 0 ? (
                <li className="text-xs text-muted-foreground">No blockers right now.</li>
              ) : (
                blockedTasks.map((task) => (
                  <li key={`blocked-${task.id}`} className="line-clamp-1">
                    {task.title}
                  </li>
                ))
              )}
            </ul>
          </section>
        </CardContent>
      </Card>

      {hasActiveFilters || !canEditTasks ? (
          <div className="overflow-x-auto pb-1">
            <div className="grid min-w-[960px] gap-4 lg:grid-cols-4">
              {boardColumns.map((column) => {
                const items = visibleBoard[column.id]
                return (
                  <section
                    key={column.id}
                    className={cn(
                      "rounded-2xl border border-[color:var(--nook-sidebar-border)] bg-background/55 p-3 backdrop-blur",
                      items.length === 0 &&
                        "border-dashed bg-transparent/10 opacity-70 shadow-none"
                    )}
                  >
                    <div className="mb-3 flex items-start justify-between">
                      <div>
                        <h3
                          className={cn(
                            "text-base font-semibold",
                            items.length === 0 && "text-foreground/75"
                          )}
                        >
                          {column.label}
                        </h3>
                        <p className="text-xs font-medium text-foreground/70 dark:text-foreground/75">
                          {column.subtitle}
                        </p>
                        {column.id === "working" && isWipOverLimit ? (
                          <p className="mt-1 inline-flex items-center gap-1 text-[11px] text-amber-700 dark:text-amber-300">
                            <AlertTriangle className="size-3.5" />
                            WIP limit exceeded ({board.working.length}/{IN_PROGRESS_WIP_LIMIT})
                          </p>
                        ) : null}
                      </div>
                      <Badge variant="secondary">{items.length}</Badge>
                    </div>
                    <div className="space-y-3">
                      {items.map((task) => (
                        <BaseTaskCard
                          key={task.id}
                          task={task}
                          assigneeAvatarKey={
                            task.assigneeUserId
                              ? memberAvatarById.get(task.assigneeUserId)
                              : undefined
                          }
                          unreadCount={threadSummaryByTaskId.get(task.id)?.unreadCount ?? 0}
                          latestReply={
                            threadSummaryByTaskId.get(task.id)?.latestBody
                              ? {
                                  authorName:
                                    threadSummaryByTaskId.get(task.id)?.latestAuthorUserId ===
                                    user?.id
                                      ? "You"
                                      : threadSummaryByTaskId.get(task.id)?.latestAuthorName,
                                  body: threadSummaryByTaskId.get(task.id)?.latestBody,
                                }
                              : null
                          }
                          onEdit={canEditTasks ? openEdit : undefined}
                          onStartFocus={onStartFocusTask}
                          onDiscuss={(selectedTask) => {
                            setThreadTaskId(selectedTask.id)
                            setThreadTab("chat")
                            setShowFileLinkInput(false)
                            setThreadError(null)
                          }}
                        />
                      ))}
                    </div>
                    <Button
                      type="button"
                      variant={items.length === 0 ? "outline" : "ghost"}
                      size="sm"
                      className={cn(
                        "mt-3 w-full justify-start hover:text-foreground",
                        items.length === 0
                          ? "border-dashed text-muted-foreground"
                          : "text-muted-foreground"
                      )}
                      onClick={() => openAddTask(column.id)}
                      disabled={!canEditTasks}
                    >
                      <Plus className="size-4" />
                      {canEditTasks ? "Add task" : "View only"}
                    </Button>
                  </section>
                )
              })}
            </div>
          </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
        >
          <div className="overflow-x-auto pb-1">
            <div className="grid min-w-[960px] gap-4 lg:grid-cols-4">
              {boardColumns.map((column) => {
                const items = board[column.id]
                return (
                  <ColumnDropZone key={column.id} id={column.id} muted={items.length === 0}>
                    <div className="mb-3 flex items-start justify-between">
                      <div>
                        <h3
                          className={cn(
                            "text-base font-semibold",
                            items.length === 0 && "text-foreground/75"
                          )}
                        >
                          {column.label}
                        </h3>
                        <p className="text-xs font-medium text-foreground/70 dark:text-foreground/75">
                          {column.subtitle}
                        </p>
                        {column.id === "working" && isWipOverLimit ? (
                          <p className="mt-1 inline-flex items-center gap-1 text-[11px] text-amber-700 dark:text-amber-300">
                            <AlertTriangle className="size-3.5" />
                            WIP limit exceeded ({board.working.length}/{IN_PROGRESS_WIP_LIMIT})
                          </p>
                        ) : null}
                      </div>
                      <Badge variant="secondary">{items.length}</Badge>
                    </div>
                    <SortableContext
                      items={items.map((task) => task.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      <div className="space-y-3">
                        {items.map((task) => (
                          <SortableTaskCard
                            key={task.id}
                            task={task}
                            assigneeAvatarKey={
                              task.assigneeUserId
                                ? memberAvatarById.get(task.assigneeUserId)
                                : undefined
                            }
                            unreadCount={threadSummaryByTaskId.get(task.id)?.unreadCount ?? 0}
                            latestReply={
                              threadSummaryByTaskId.get(task.id)?.latestBody
                                ? {
                                    authorName:
                                      threadSummaryByTaskId.get(task.id)?.latestAuthorUserId ===
                                      user?.id
                                        ? "You"
                                        : threadSummaryByTaskId.get(task.id)?.latestAuthorName,
                                    body: threadSummaryByTaskId.get(task.id)?.latestBody,
                                  }
                                : null
                            }
                            onEdit={canEditTasks ? openEdit : undefined}
                            onStartFocus={onStartFocusTask}
                            onDiscuss={(selectedTask) => {
                              setThreadTaskId(selectedTask.id)
                              setThreadTab("chat")
                              setShowFileLinkInput(false)
                              setThreadError(null)
                            }}
                          />
                        ))}
                      </div>
                    </SortableContext>
                    <Button
                      type="button"
                      variant={items.length === 0 ? "outline" : "ghost"}
                      size="sm"
                      className={cn(
                        "mt-3 w-full justify-start hover:text-foreground",
                        items.length === 0
                          ? "border-dashed text-muted-foreground"
                          : "text-muted-foreground"
                      )}
                      onClick={() => openAddTask(column.id)}
                      disabled={!canEditTasks}
                    >
                      <Plus className="size-4" />
                      {canEditTasks ? "Add task" : "View only"}
                    </Button>
                  </ColumnDropZone>
                )
              })}
            </div>
          </div>
          <DragOverlay>
            {activeTask ? (
              <article className="w-[280px] rounded-xl border border-[color:var(--nook-sidebar-border)] bg-background/95 p-3 shadow-xl">
                <div className="mb-2 flex items-start justify-between gap-2">
                  <h4 className="text-sm font-medium">{activeTask.title}</h4>
                  {activeTask.priority === "high" ? (
                    <Badge className={cn("capitalize", priorityClass(activeTask.priority))}>
                      {activeTask.priority}
                    </Badge>
                  ) : null}
                </div>
                <p className="text-xs text-muted-foreground">{activeTask.note}</p>
                {activeTask.assigneeUserId && activeTask.assignee ? (
                  <div className="mt-2 inline-flex items-center gap-2 text-xs text-muted-foreground">
                    <Avatar className="size-5 border border-cyan-500/25">
                      <AvatarImage
                        src={avatarSrcForKey(
                          memberAvatarById.get(activeTask.assigneeUserId)
                        )}
                        alt={activeTask.assignee}
                      />
                      <AvatarFallback>
                        {activeTask.assignee
                          .split(" ")
                          .map((part) => part[0] ?? "")
                          .join("")
                          .slice(0, 2)
                          .toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    Assigned: {activeTask.assignee}
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-muted-foreground">Assigned: Unassigned</p>
                )}
              </article>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      <Dialog open={isAddTaskOpen} onOpenChange={setIsAddTaskOpen}>
        <DialogContent className="border-[color:var(--nook-sidebar-border)] bg-[color:var(--nook-sidebar-bg-end)] p-0 sm:max-w-[560px]">
          <DialogHeader className="border-b border-[color:var(--nook-sidebar-border)] px-5 py-4 text-left">
            <DialogTitle>Add Room Task</DialogTitle>
            <DialogDescription>Create a task directly in the selected column.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 px-5 py-4">
            <Input
              value={draftTitle}
              onChange={(event) => setDraftTitle(event.target.value)}
              placeholder="Task title"
              className="border-[color:var(--nook-sidebar-border)] bg-[color:var(--nook-sidebar-input-bg)]"
            />
            <textarea
              value={draftNote}
              onChange={(event) => setDraftNote(event.target.value)}
              placeholder="What needs to be done?"
              rows={3}
              className="min-h-0 w-full resize-y rounded-md border border-[color:var(--nook-sidebar-border)] bg-[color:var(--nook-sidebar-input-bg)] px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--nook-accent)]"
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <Select
                value={draftStatus}
                onValueChange={(value) => setDraftStatus(value as TaskStatus)}
              >
                <SelectTrigger className="w-full border-[color:var(--nook-sidebar-border)]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todo">To Do</SelectItem>
                  <SelectItem value="working">In Progress</SelectItem>
                  <SelectItem value="blocked">Blocked</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
              <Select value={draftAssigneeUserId} onValueChange={setDraftAssigneeUserId}>
                <SelectTrigger className="w-full border-[color:var(--nook-sidebar-border)]">
                  <SelectValue placeholder="Assign to" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Unassigned</SelectItem>
                  {members.map((member) => (
                    <SelectItem key={member.userId} value={member.userId}>
                      {member.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
              <Select
                value={draftEffort}
                onValueChange={(value) => setDraftEffort(value as TaskEffort)}
              >
                <SelectTrigger className="w-full border-[color:var(--nook-sidebar-border)]">
                  <SelectValue placeholder="Effort" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="quick">Quick</SelectItem>
                  <SelectItem value="half_day">Half day</SelectItem>
                  <SelectItem value="full_day">Full day</SelectItem>
                  <SelectItem value="multi_day">Multi-day</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Deadline</p>
              <div className="flex flex-wrap gap-2">
                {duePresetOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => {
                      setDraftDuePreset(option.value)
                      setShowDraftSpecificDue(false)
                    }}
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                      draftDuePreset === option.value
                        ? "border-cyan-400/70 bg-cyan-500/18 text-cyan-700 shadow-[0_0_0_1px_rgba(34,211,238,0.2)] dark:text-cyan-200"
                        : "border-[color:var(--nook-sidebar-border)] bg-[color:var(--nook-sidebar-input-bg)] text-muted-foreground hover:border-cyan-500/45 hover:text-foreground"
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <button
                type="button"
                className="text-xs text-cyan-700 underline dark:text-cyan-300"
                onClick={() => {
                  setDraftDuePreset("custom")
                  setShowDraftSpecificDue((prev) => !prev || draftDuePreset !== "custom")
                }}
              >
                Pick specific date
              </button>
              {showDraftSpecificDue && draftDuePreset === "custom" ? (
                <Input
                  type="datetime-local"
                  value={draftDueAt}
                  onChange={(event) => setDraftDueAt(event.target.value)}
                  className="border-[color:var(--nook-sidebar-border)] bg-[color:var(--nook-sidebar-input-bg)]"
                />
              ) : null}
            </div>
          </div>
          <DialogFooter className="border-t border-[color:var(--nook-sidebar-border)] px-5 py-4 sm:justify-end">
            <Button
              type="button"
              onClick={addTask}
              disabled={!canEditTasks || !canAddTask}
              className="bg-[color:var(--nook-accent)] text-slate-950 hover:bg-[color:var(--nook-accent-strong)] disabled:opacity-50"
            >
              <Plus className="size-4" />
              Add Task
            </Button>
            <Button type="button" variant="outline" onClick={() => setIsAddTaskOpen(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Drawer
        open={Boolean(editingTask)}
        onOpenChange={(open) => {
          if (!open) setEditingTaskId(null)
        }}
      >
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Edit Room Task</DrawerTitle>
            <DrawerDescription>Update details and assignee.</DrawerDescription>
          </DrawerHeader>
          <div className="space-y-4 px-4 pb-2">
            <Input value={editTitle} onChange={(event) => setEditTitle(event.target.value)} />
            <textarea
              value={editNote}
              onChange={(event) => setEditNote(event.target.value)}
              className="min-h-20 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <Select value={editAssigneeUserId} onValueChange={setEditAssigneeUserId}>
              <SelectTrigger>
                <SelectValue placeholder="Assign to" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Unassigned</SelectItem>
                {members.map((member) => (
                  <SelectItem key={member.userId} value={member.userId}>
                    {member.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="grid gap-4 sm:grid-cols-2">
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
              <Select
                value={editEffort}
                onValueChange={(value) => setEditEffort(value as TaskEffort)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Effort" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="quick">Quick</SelectItem>
                  <SelectItem value="half_day">Half day</SelectItem>
                  <SelectItem value="full_day">Full day</SelectItem>
                  <SelectItem value="multi_day">Multi-day</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={editStatus}
                onValueChange={(value) => setEditStatus(value as TaskStatus)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todo">To Do</SelectItem>
                  <SelectItem value="working">In Progress</SelectItem>
                  <SelectItem value="blocked">Blocked</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Deadline</p>
              <div className="flex flex-wrap gap-2">
                {duePresetOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => {
                      setEditDuePreset(option.value)
                      setShowEditSpecificDue(false)
                    }}
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                      editDuePreset === option.value
                        ? "border-cyan-400/70 bg-cyan-500/18 text-cyan-700 shadow-[0_0_0_1px_rgba(34,211,238,0.2)] dark:text-cyan-200"
                        : "border-input bg-[color:var(--nook-sidebar-input-bg)] text-muted-foreground hover:border-cyan-500/45 hover:text-foreground"
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <button
                type="button"
                className="text-xs text-cyan-700 underline dark:text-cyan-300"
                onClick={() => {
                  setEditDuePreset("custom")
                  setShowEditSpecificDue((prev) => !prev || editDuePreset !== "custom")
                }}
              >
                Pick specific date
              </button>
              <button
                type="button"
                className="ml-3 text-xs text-muted-foreground underline"
                onClick={() => {
                  setEditDuePreset("none")
                  setShowEditSpecificDue(false)
                  setEditDueAt("")
                }}
              >
                Clear deadline
              </button>
              {showEditSpecificDue && editDuePreset === "custom" ? (
                <Input
                  type="datetime-local"
                  value={editDueAt}
                  onChange={(event) => setEditDueAt(event.target.value)}
                />
              ) : null}
            </div>
          </div>
          <DrawerFooter>
            <Button
              onClick={saveTaskEdit}
              disabled={!canEditTasks}
              className="bg-[color:var(--nook-accent)] text-slate-950 hover:bg-[color:var(--nook-accent-strong)]"
            >
              Save Changes
            </Button>
            {editingTask ? (
              <Button variant="outline" onClick={() => deleteTask(editingTask.id)} disabled={!canEditTasks}>
                <Trash2 />
                Delete Task
              </Button>
            ) : null}
            <Button variant="outline" onClick={() => setEditingTaskId(null)}>
              Cancel
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      <Sheet
        open={Boolean(threadTaskId)}
        onOpenChange={(open) => {
          if (!open) {
            setThreadTaskId(null)
            setThreadError(null)
          }
        }}
      >
        <SheetContent side="right" className="w-full gap-0 p-0 sm:max-w-lg">
          <SheetHeader className="border-b border-[color:var(--nook-sidebar-border)] pb-3">
            <div className="pr-8">
              <SheetTitle>Task Discussion</SheetTitle>
              <SheetDescription
                className="mt-1 whitespace-normal break-words"
                title={threadTask?.title}
              >
                {threadTask ? threadTask.title : "Discuss this task and share files."}
              </SheetDescription>
            </div>
            {threadTask ? (
              <div className="flex items-center gap-2">
                <Badge variant="secondary">{statusLabel(threadTask.status)}</Badge>
                <Badge className={cn("capitalize", priorityClass(threadTask.priority))}>
                  {threadTask.priority}
                </Badge>
              </div>
            ) : null}
          </SheetHeader>

          <Tabs
            value={threadTab}
            onValueChange={(value) =>
              setThreadTab(value as "chat" | "files" | "history")
            }
            className="flex min-h-0 flex-1"
          >
            <div className="border-b border-[color:var(--nook-sidebar-border)] px-4 pt-3">
              <TabsList variant="line" className="w-full justify-start">
                <TabsTrigger value="chat">Chat</TabsTrigger>
                <TabsTrigger value="files">Files</TabsTrigger>
                <TabsTrigger value="history">History</TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="chat" className="flex min-h-0 flex-1 flex-col px-4 py-3">
              <div className="min-h-0 flex-1 space-y-2 overflow-y-auto rounded-md border border-[color:var(--nook-sidebar-border)] bg-[color:var(--nook-sidebar-input-bg)] p-3">
                {thread === undefined ? (
                  <p className="text-xs text-muted-foreground">Loading thread...</p>
                ) : thread.messages.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No messages yet.</p>
                ) : (
                  thread.messages.map((message) => {
                    const isMe = Boolean(user?.id && message.authorUserId === user.id)
                    const reactions = messageReactions[message.id] ?? []
                    return (
                      <div
                        key={message.id}
                        className={cn("flex", isMe ? "justify-end" : "justify-start")}
                      >
                        <article
                          className={cn(
                            "w-fit max-w-[90%] rounded-md border px-3 py-2 text-sm",
                            isMe
                              ? "border-cyan-500/40 bg-cyan-500/15"
                              : "border-[color:var(--nook-sidebar-border)] bg-background/70"
                          )}
                        >
                          <div className="mb-1 flex items-center justify-between gap-3">
                            <span className="text-xs font-medium">
                              {isMe ? "You" : message.authorName}
                            </span>
                            <span className="text-[11px] text-muted-foreground">
                              {new Date(message.createdAt).toLocaleTimeString()}
                            </span>
                          </div>
                          <p className="text-sm">
                            {renderMessageBody(message.body, roomMentionHandleSet)}
                          </p>
                          <div className="mt-2 flex items-center gap-1">
                            {["👍", "✅", "🔥"].map((emoji) => {
                              const active = reactions.includes(emoji)
                              return (
                                <button
                                  key={emoji}
                                  type="button"
                                  className={cn(
                                    "rounded-full border px-2 py-0.5 text-xs transition-colors",
                                    active
                                      ? "border-cyan-500/40 bg-cyan-500/15"
                                      : "border-[color:var(--nook-sidebar-border)] bg-background/60"
                                  )}
                                  onClick={() =>
                                    toggleMessageReaction(message.id, emoji)
                                  }
                                >
                                  {emoji}
                                </button>
                              )
                            })}
                          </div>
                        </article>
                      </div>
                    )
                  })
                )}
              </div>
              <form
                className="mt-3 flex gap-2"
                onSubmit={(event) => {
                  event.preventDefault()
                  void postThreadMessage()
                }}
              >
                <div className="relative flex-1">
                  <Input
                    ref={threadMessageInputRef}
                    value={threadMessage}
                    onChange={(event) => {
                      setThreadMessage(event.target.value)
                      setThreadMessageCaret(event.target.selectionStart ?? event.target.value.length)
                    }}
                    onClick={(event) => {
                      setThreadMessageCaret(event.currentTarget.selectionStart ?? threadMessage.length)
                    }}
                    onKeyUp={(event) => {
                      setThreadMessageCaret(event.currentTarget.selectionStart ?? threadMessage.length)
                    }}
                    onSelect={(event) => {
                      setThreadMessageCaret(event.currentTarget.selectionStart ?? threadMessage.length)
                    }}
                    onKeyDown={(event) => {
                      if (mentionSuggestions.length === 0) return

                      if (event.key === "ArrowDown") {
                        event.preventDefault()
                        setActiveMentionIndex((prev) => (prev + 1) % mentionSuggestions.length)
                        return
                      }
                      if (event.key === "ArrowUp") {
                        event.preventDefault()
                        setActiveMentionIndex((prev) =>
                          prev === 0 ? mentionSuggestions.length - 1 : prev - 1
                        )
                        return
                      }
                      if (event.key === "Enter" || event.key === "Tab") {
                        event.preventDefault()
                        applyMention(mentionSuggestions[activeMentionIndex]?.handle ?? "")
                        return
                      }
                      if (event.key === "Escape") {
                        setActiveMentionIndex(0)
                      }
                    }}
                    placeholder="Write a message about this task... Use @ to mention someone."
                    className="pr-20"
                  />
                  {mentionSuggestions.length > 0 ? (
                    <div className="absolute inset-x-0 bottom-full z-10 mb-2 rounded-md border border-[color:var(--nook-sidebar-border)] bg-background shadow-lg">
                      <ul className="max-h-64 overflow-y-auto py-1">
                        {mentionSuggestions.map((member, index) => (
                          <li key={member.userId}>
                            <button
                              type="button"
                              className={cn(
                                "flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-accent",
                                index === activeMentionIndex && "bg-accent"
                              )}
                              onMouseDown={(event) => {
                                event.preventDefault()
                                applyMention(member.handle)
                              }}
                            >
                              <Avatar className="size-7">
                                <AvatarImage
                                  src={avatarSrcForKey(member.avatarKey)}
                                  alt={member.name}
                                />
                                <AvatarFallback>{member.name.slice(0, 2)}</AvatarFallback>
                              </Avatar>
                              <span className="min-w-0 flex-1">
                                <span className="block truncate font-medium">{member.name}</span>
                                <span className="block truncate text-xs text-muted-foreground">
                                  @{member.handle}
                                </span>
                              </span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1">
                    <button
                      type="button"
                      className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                      onClick={() => setThreadTab("files")}
                      aria-label="Open attachments"
                    >
                      <Paperclip className="size-4" />
                    </button>
                  </div>
                </div>
                <Button
                  type="submit"
                  className="bg-[color:var(--nook-accent)] text-slate-950 hover:bg-[color:var(--nook-accent-strong)]"
                >
                  <Send className="size-4" />
                  Send
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="files" className="flex min-h-0 flex-1 flex-col px-4 py-3">
              <div className="min-h-0 flex-1 space-y-2 overflow-y-auto rounded-md border border-[color:var(--nook-sidebar-border)] bg-[color:var(--nook-sidebar-input-bg)] p-3">
                {thread === undefined ? (
                  <p className="text-xs text-muted-foreground">Loading files...</p>
                ) : thread.files.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No files shared yet.</p>
                ) : (
                  thread.files.map((file) => (
                    <article
                      key={file.id}
                      className="rounded-md border border-[color:var(--nook-sidebar-border)] bg-background/70 px-3 py-2"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <a
                          href={file.url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-2 text-sm font-medium text-cyan-700 underline dark:text-cyan-300"
                        >
                          <Link2 className="size-3.5" />
                          {file.name}
                        </a>
                        <span className="text-[11px] text-muted-foreground">
                          {new Date(file.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Shared by {file.uploadedByName}
                      </p>
                    </article>
                  ))
                )}
              </div>

              <div
                className="mt-3 rounded-lg border border-dashed border-[color:var(--nook-sidebar-border)] bg-background/40 p-4 text-center"
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault()
                  if (isUploadingThreadFile || !canManageFiles) return
                  const file = event.dataTransfer.files?.[0]
                  if (file) setThreadUploadFile(file)
                }}
              >
                <p className="text-sm font-medium">Drop a file here</p>
                <p className="mt-1 text-xs text-muted-foreground">or browse from your device</p>
                <div className="mt-3 flex items-center justify-center gap-2">
                  <Input
                    type="file"
                    disabled={isUploadingThreadFile || !canManageFiles}
                    onChange={(event) =>
                      setThreadUploadFile(event.target.files?.[0] ?? null)
                    }
                    className="max-w-[240px]"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    disabled={!threadUploadFile || isUploadingThreadFile || !canManageFiles}
                    onClick={() => {
                      void uploadThreadFile()
                    }}
                  >
                    {isUploadingThreadFile ? "Uploading..." : "Upload"}
                  </Button>
                </div>
                <button
                  type="button"
                  className="mt-3 text-xs text-cyan-700 underline dark:text-cyan-300"
                  disabled={!canManageFiles}
                  onClick={() => setShowFileLinkInput((prev) => !prev)}
                >
                  or paste a link
                </button>
                {showFileLinkInput ? (
                  <div className="mt-2 flex gap-2">
                    <Input
                      value={threadFileUrl}
                      disabled={!canManageFiles}
                      onChange={(event) => setThreadFileUrl(event.target.value)}
                      placeholder="https://..."
                    />
                    <Button
                      type="button"
                      variant="outline"
                      disabled={!canManageFiles}
                      onClick={() => {
                        void postThreadFile()
                      }}
                    >
                      Share
                    </Button>
                  </div>
                ) : null}
              </div>
            </TabsContent>

            <TabsContent value="history" className="flex min-h-0 flex-1 flex-col px-4 py-3">
              <div className="min-h-0 flex-1 space-y-2 overflow-y-auto rounded-md border border-[color:var(--nook-sidebar-border)] bg-[color:var(--nook-sidebar-input-bg)] p-3">
                {thread === undefined ? (
                  <p className="text-xs text-muted-foreground">Loading history...</p>
                ) : thread.events.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No history yet.</p>
                ) : (
                  thread.events.map((event) => (
                    <article
                      key={event.id}
                      className="rounded-md border border-[color:var(--nook-sidebar-border)] bg-background/70 px-3 py-2"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="inline-flex items-center gap-2">
                          <Avatar className="size-6 border border-cyan-500/25">
                            <AvatarImage
                              src={avatarSrcForKey(event.actorAvatarKey)}
                              alt={event.actorName}
                            />
                            <AvatarFallback>
                              {event.actorName
                                .split(" ")
                                .map((part) => part[0] ?? "")
                                .join("")
                                .slice(0, 2)
                                .toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-xs font-medium">{event.actorName}</span>
                        </div>
                        <span className="text-[11px] text-muted-foreground">
                          {new Date(event.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{event.message}</p>
                    </article>
                  ))
                )}
              </div>
            </TabsContent>
          </Tabs>

          {threadError ? (
            <p className="border-t border-[color:var(--nook-sidebar-border)] px-4 py-2 text-sm text-red-600">
              {threadError}
            </p>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  )
}
