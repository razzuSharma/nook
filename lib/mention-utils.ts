type MentionIdentity = {
  username?: string | null
  name?: string | null
  email?: string | null
  userId?: string | null
}

export function normalizeMentionHandle(value: string | null | undefined) {
  return (value ?? "")
    .trim()
    .replace(/^@+/, "")
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9._-]/g, "")
    .replace(/[-._]{2,}/g, (match) => match[0] ?? "-")
    .slice(0, 32)
}

export function buildMentionHandle(identity: MentionIdentity) {
  const username = normalizeMentionHandle(identity.username)
  if (username) return username

  const name = normalizeMentionHandle(identity.name)
  if (name) return name

  const emailLocalPart = normalizeMentionHandle(identity.email?.split("@")[0] ?? "")
  if (emailLocalPart) return emailLocalPart

  const userId = normalizeMentionHandle(identity.userId)
  return userId ? `user-${userId.slice(-6)}` : "user"
}

export function extractMentionHandles(body: string) {
  const matches = body.match(/(^|\s)@([a-z0-9][a-z0-9._-]{0,31})/gi) ?? []
  return Array.from(
    new Set(
      matches
        .map((match) => {
          const handle = match.trim().slice(1)
          return normalizeMentionHandle(handle)
        })
        .filter(Boolean)
    )
  )
}
