"use client"

import * as React from "react"
import { Link2, Paperclip, Send } from "lucide-react"

import { avatarSrcForKey } from "@/lib/avatar-options"
import { cn } from "@/lib/utils"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { TabsContent } from "@/components/ui/tabs"

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

const threadItemStyle = {
  contentVisibility: "auto",
  containIntrinsicSize: "96px",
} as React.CSSProperties

const threadMessageItemStyle = {
  contentVisibility: "auto",
  containIntrinsicSize: "140px",
} as React.CSSProperties

export function ThreadSheetPanels({
  threadTab,
  thread,
  userId,
  messageReactions,
  renderMessageBody,
  roomMentionHandleSet,
  threadMessageInputRef,
  threadMessage,
  setThreadMessage,
  threadMessageCaretFallback,
  setThreadMessageCaret,
  mentionSuggestions,
  activeMentionIndex,
  setActiveMentionIndex,
  applyMention,
  setThreadTab,
  postThreadMessage,
  canManageFiles,
  isUploadingThreadFile,
  setThreadUploadFile,
  threadUploadFile,
  uploadThreadFile,
  showFileLinkInput,
  setShowFileLinkInput,
  threadFileUrl,
  setThreadFileUrl,
  postThreadFile,
  toggleMessageReaction,
}: {
  threadTab: "chat" | "files" | "history"
  thread: TaskThreadData | undefined
  userId?: string
  messageReactions: Record<string, string[]>
  renderMessageBody: (body: string, mentionHandles: Set<string>) => React.ReactNode
  roomMentionHandleSet: Set<string>
  threadMessageInputRef: React.RefObject<HTMLInputElement | null>
  threadMessage: string
  setThreadMessage: (value: string) => void
  threadMessageCaretFallback: number
  setThreadMessageCaret: (value: number) => void
  mentionSuggestions: Array<{
    userId: string
    name: string
    handle: string
    avatarKey: string
  }>
  activeMentionIndex: number
  setActiveMentionIndex: React.Dispatch<React.SetStateAction<number>>
  applyMention: (memberHandle: string) => void
  setThreadTab: (value: "chat" | "files" | "history") => void
  postThreadMessage: () => Promise<void>
  canManageFiles: boolean
  isUploadingThreadFile: boolean
  setThreadUploadFile: (file: File | null) => void
  threadUploadFile: File | null
  uploadThreadFile: () => Promise<void>
  showFileLinkInput: boolean
  setShowFileLinkInput: React.Dispatch<React.SetStateAction<boolean>>
  threadFileUrl: string
  setThreadFileUrl: (value: string) => void
  postThreadFile: () => Promise<void>
  toggleMessageReaction: (messageId: string, emoji: string) => void
}) {
  return (
    <>
      <TabsContent value="chat" forceMount className={cn("flex min-h-0 flex-1 flex-col px-4 py-3", threadTab !== "chat" && "hidden")}>
        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto rounded-md border border-[color:var(--nook-sidebar-border)] bg-[color:var(--nook-sidebar-input-bg)] p-3">
          {thread === undefined ? (
            <p className="text-xs text-muted-foreground">Loading thread...</p>
          ) : thread.messages.length === 0 ? (
            <p className="text-xs text-muted-foreground">No messages yet.</p>
          ) : (
            thread.messages.map((message) => {
              const isMe = Boolean(userId && message.authorUserId === userId)
              const reactions = messageReactions[message.id] ?? []

              return (
                <div
                  key={message.id}
                  style={threadMessageItemStyle}
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
                            onClick={() => toggleMessageReaction(message.id, emoji)}
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
                setThreadMessageCaret(
                  event.currentTarget.selectionStart ?? threadMessageCaretFallback
                )
              }}
              onKeyUp={(event) => {
                setThreadMessageCaret(
                  event.currentTarget.selectionStart ?? threadMessageCaretFallback
                )
              }}
              onSelect={(event) => {
                setThreadMessageCaret(
                  event.currentTarget.selectionStart ?? threadMessageCaretFallback
                )
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

      <TabsContent value="files" forceMount className={cn("flex min-h-0 flex-1 flex-col px-4 py-3", threadTab !== "files" && "hidden")}>
        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto rounded-md border border-[color:var(--nook-sidebar-border)] bg-[color:var(--nook-sidebar-input-bg)] p-3">
          {thread === undefined ? (
            <p className="text-xs text-muted-foreground">Loading files...</p>
          ) : thread.files.length === 0 ? (
            <p className="text-xs text-muted-foreground">No files shared yet.</p>
          ) : (
            thread.files.map((file) => (
              <article
                key={file.id}
                style={threadItemStyle}
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
              onChange={(event) => setThreadUploadFile(event.target.files?.[0] ?? null)}
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

      <TabsContent value="history" forceMount className={cn("flex min-h-0 flex-1 flex-col px-4 py-3", threadTab !== "history" && "hidden")}>
        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto rounded-md border border-[color:var(--nook-sidebar-border)] bg-[color:var(--nook-sidebar-input-bg)] p-3">
          {thread === undefined ? (
            <p className="text-xs text-muted-foreground">Loading history...</p>
          ) : thread.events.length === 0 ? (
            <p className="text-xs text-muted-foreground">No history yet.</p>
          ) : (
            thread.events.map((event) => (
              <article
                key={event.id}
                style={threadItemStyle}
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
    </>
  )
}
