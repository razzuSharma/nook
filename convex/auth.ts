import { v } from "convex/values"
import { mutation, query, type MutationCtx } from "./_generated/server"
import type { Doc, Id } from "./_generated/dataModel"
import { internal } from "./_generated/api"

const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30
const VERIFICATION_TTL_MS = 1000 * 60 * 60 * 24
const PASSWORD_RESET_TTL_MS = 1000 * 60 * 30
const AVATAR_KEYS = [
  "avatar-1",
  "avatar-2",
  "avatar-3",
  "avatar-4",
  "avatar-5",
  "avatar-6",
  "avatar-7",
  "avatar-8",
  "avatar-9",
  "avatar-10",
  "avatar-11",
  "avatar-12",
  "avatar-13",
  "avatar-14",
  "avatar-15",
  "avatar-16",
] as const
const DEFAULT_AVATAR_KEY = "avatar-1"
const PROFILE_STATUSES = ["available", "busy", "deep_work", "offline"] as const
const DIGEST_OPTIONS = ["off", "daily", "weekly"] as const
const THEME_OPTIONS = ["system", "light", "dark"] as const
const LEGACY_AVATAR_KEYS = new Set([
  "aurora",
  "atlas",
  "blaze",
  "cinder",
  "dune",
  "ember",
])

function normalizeAvatarKey(avatarKey: string | undefined) {
  if (avatarKey && AVATAR_KEYS.includes(avatarKey as (typeof AVATAR_KEYS)[number])) {
    return avatarKey as (typeof AVATAR_KEYS)[number]
  }
  if (avatarKey && LEGACY_AVATAR_KEYS.has(avatarKey)) {
    return DEFAULT_AVATAR_KEY
  }
  return DEFAULT_AVATAR_KEY
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase()
}

function normalizeProfileStatus(value: string | undefined) {
  if (value && PROFILE_STATUSES.includes(value as (typeof PROFILE_STATUSES)[number])) {
    return value as (typeof PROFILE_STATUSES)[number]
  }
  return "available"
}

function normalizeDigest(value: string | undefined) {
  if (value && DIGEST_OPTIONS.includes(value as (typeof DIGEST_OPTIONS)[number])) {
    return value as (typeof DIGEST_OPTIONS)[number]
  }
  return "daily"
}

function normalizeTheme(value: string | undefined) {
  if (value && THEME_OPTIONS.includes(value as (typeof THEME_OPTIONS)[number])) {
    return value as (typeof THEME_OPTIONS)[number]
  }
  return "system"
}

function toPublicUser(user: Doc<"users">) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    avatarKey: normalizeAvatarKey(user.avatarKey),
    customAvatarUrl: user.customAvatarUrl,
    username: user.username ?? "",
    roleTitle: user.roleTitle ?? "",
    timezone: user.timezone ?? "UTC",
    bio: user.bio ?? "",
    status: normalizeProfileStatus(user.status),
    workingHours: user.workingHours ?? "",
    notificationEmail: user.notificationEmail ?? true,
    notificationInApp: user.notificationInApp ?? true,
    digestFrequency: normalizeDigest(user.digestFrequency),
    themePreference: normalizeTheme(user.themePreference),
    defaultRoomId: user.defaultRoomId,
    emailVerified: Boolean(user.emailVerifiedAt),
  }
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

async function hashPassword(password: string, salt: string) {
  return await sha256(`${salt}:${password}`)
}

async function createSession(ctx: MutationCtx, userId: Id<"users">) {
  const now = Date.now()
  const sessionToken = randomToken(32)
  const tokenHash = await sha256(sessionToken)
  await ctx.db.insert("authSessions", {
    userId,
    tokenHash,
    createdAt: now,
    expiresAt: now + SESSION_TTL_MS,
  })
  return sessionToken
}

async function createVerificationToken(
  ctx: MutationCtx,
  user: Doc<"users">,
  siteUrl: string
) {
  const now = Date.now()
  const rawToken = randomToken(32)
  const tokenHash = await sha256(rawToken)

  await ctx.db.insert("emailVerificationTokens", {
    userId: user._id,
    tokenHash,
    email: user.email,
    createdAt: now,
    expiresAt: now + VERIFICATION_TTL_MS,
  })

  const baseUrl = siteUrl.trim().replace(/\/+$/, "")
  const verificationLink = `${baseUrl}/verify-email?token=${encodeURIComponent(rawToken)}`

  await ctx.scheduler.runAfter(0, internal.email.sendVerificationEmail, {
    email: user.email,
    name: user.name,
    verificationLink,
  })

  return verificationLink
}

async function createPasswordResetToken(
  ctx: MutationCtx,
  user: Doc<"users">,
  siteUrl: string
) {
  const now = Date.now()
  const rawToken = randomToken(32)
  const tokenHash = await sha256(rawToken)

  await ctx.db.insert("passwordResetTokens", {
    userId: user._id,
    tokenHash,
    email: user.email,
    createdAt: now,
    expiresAt: now + PASSWORD_RESET_TTL_MS,
    usedAt: undefined,
  })

  const baseUrl = siteUrl.trim().replace(/\/+$/, "")
  const resetLink = `${baseUrl}/reset-password?token=${encodeURIComponent(rawToken)}`

  await ctx.scheduler.runAfter(0, internal.email.sendPasswordResetEmail, {
    email: user.email,
    name: user.name,
    resetLink,
  })

  return resetLink
}

async function requireUserBySessionToken(ctx: MutationCtx, sessionToken: string) {
  const tokenHash = await sha256(sessionToken)
  const session = await ctx.db
    .query("authSessions")
    .withIndex("by_tokenHash", (query) => query.eq("tokenHash", tokenHash))
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

export const viewer = query({
  args: {
    sessionToken: v.string(),
  },
  handler: async (ctx, args) => {
    const tokenHash = await sha256(args.sessionToken)
    const session = await ctx.db
      .query("authSessions")
      .withIndex("by_tokenHash", (query) => query.eq("tokenHash", tokenHash))
      .first()
    if (!session) return null
    if (session.expiresAt <= Date.now()) return null

    const user = await ctx.db.get(session.userId)
    if (!user) return null

    return toPublicUser(user)
  },
})

export const signUp = mutation({
  args: {
    name: v.string(),
    email: v.string(),
    password: v.string(),
    avatarKey: v.optional(v.string()),
    siteUrl: v.string(),
  },
  handler: async (ctx, args) => {
    const email = normalizeEmail(args.email)
    const name = args.name.trim() || email.split("@")[0] || "Nook User"
    const password = args.password

    if (!email) {
      throw new Error("Email is required.")
    }
    if (password.trim().length < 6) {
      throw new Error("Password must be at least 6 characters.")
    }

    const existing = await ctx.db
      .query("users")
      .withIndex("by_email", (query) => query.eq("email", email))
      .first()

    if (existing) {
      throw new Error("An account with this email already exists. Use another email or sign in.")
    }

    const now = Date.now()
    const passwordSalt = randomToken(16)
    const passwordHash = await hashPassword(password, passwordSalt)
    const avatarKey = normalizeAvatarKey(args.avatarKey)

    const userId: Id<"users"> = await ctx.db.insert("users", {
      email,
      name,
      avatarKey,
      passwordHash,
      passwordSalt,
      createdAt: now,
      updatedAt: now,
    })

    const user = await ctx.db.get(userId)
    if (!user) {
      throw new Error("Unable to create account.")
    }

    const verificationLink = await createVerificationToken(ctx, user, args.siteUrl)
    return {
      requiresEmailVerification: true,
      verificationLink,
    }
  },
})

export const resendVerificationEmail = mutation({
  args: {
    email: v.string(),
    siteUrl: v.string(),
  },
  handler: async (ctx, args) => {
    const email = normalizeEmail(args.email)
    if (!email) {
      throw new Error("Email is required.")
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (query) => query.eq("email", email))
      .first()

    if (!user || user.emailVerifiedAt) {
      return { verificationLink: "" }
    }

    const verificationLink = await createVerificationToken(ctx, user, args.siteUrl)
    return { verificationLink }
  },
})

export const requestPasswordReset = mutation({
  args: {
    email: v.string(),
    siteUrl: v.string(),
  },
  handler: async (ctx, args) => {
    const email = normalizeEmail(args.email)
    if (!email) {
      throw new Error("Email is required.")
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (query) => query.eq("email", email))
      .first()

    if (user && user.emailVerifiedAt) {
      await createPasswordResetToken(ctx, user, args.siteUrl)
    }

    return {
      message:
        "If this email is registered, we sent a password reset link.",
    }
  },
})

export const resetPassword = mutation({
  args: {
    token: v.string(),
    newPassword: v.string(),
  },
  handler: async (ctx, args) => {
    const tokenHash = await sha256(args.token.trim())
    const resetToken = await ctx.db
      .query("passwordResetTokens")
      .withIndex("by_tokenHash", (query) => query.eq("tokenHash", tokenHash))
      .first()

    if (!resetToken || resetToken.usedAt) {
      throw new Error("This password reset link is invalid.")
    }
    if (resetToken.expiresAt <= Date.now()) {
      throw new Error("This password reset link has expired.")
    }

    const user = await ctx.db.get(resetToken.userId)
    if (!user) {
      throw new Error("User not found.")
    }
    if (args.newPassword.trim().length < 6) {
      throw new Error("Password must be at least 6 characters.")
    }

    const now = Date.now()
    const passwordSalt = randomToken(16)
    const passwordHash = await hashPassword(args.newPassword, passwordSalt)

    await ctx.db.patch(user._id, {
      passwordSalt,
      passwordHash,
      updatedAt: now,
    })
    await ctx.db.patch(resetToken._id, {
      usedAt: now,
    })

    const existingSessions = await ctx.db
      .query("authSessions")
      .withIndex("by_user", (query) => query.eq("userId", user._id))
      .collect()
    for (const session of existingSessions) {
      await ctx.db.delete(session._id)
    }

    return { reset: true }
  },
})

export const verifyEmail = mutation({
  args: {
    token: v.string(),
  },
  handler: async (ctx, args) => {
    const tokenHash = await sha256(args.token.trim())
    const verification = await ctx.db
      .query("emailVerificationTokens")
      .withIndex("by_tokenHash", (query) => query.eq("tokenHash", tokenHash))
      .first()

    if (!verification || verification.usedAt) {
      throw new Error("This verification link is invalid.")
    }
    if (verification.expiresAt <= Date.now()) {
      throw new Error("This verification link has expired.")
    }

    const user = await ctx.db.get(verification.userId)
    if (!user) {
      throw new Error("User not found.")
    }

    const now = Date.now()
    await ctx.db.patch(verification._id, {
      usedAt: now,
    })

    if (!user.emailVerifiedAt) {
      await ctx.db.patch(user._id, {
        emailVerifiedAt: now,
        updatedAt: now,
      })
    }

    const sessionToken = await createSession(ctx, user._id)

    return {
      sessionToken,
      user: toPublicUser({
        ...user,
        emailVerifiedAt: now,
      }),
    }
  },
})

export const signIn = mutation({
  args: {
    email: v.string(),
    password: v.string(),
  },
  handler: async (ctx, args) => {
    const email = normalizeEmail(args.email)
    if (!email) throw new Error("Email is required.")
    if (!args.password.trim()) throw new Error("Password is required.")

    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (query) => query.eq("email", email))
      .first()
    if (!user) {
      throw new Error("Invalid email or password.")
    }

    const expectedHash = await hashPassword(args.password, user.passwordSalt)
    if (expectedHash !== user.passwordHash) {
      throw new Error("Invalid email or password.")
    }

    if (!user.emailVerifiedAt) {
      throw new Error("Please verify your email before signing in.")
    }

    const sessionToken = await createSession(ctx, user._id)
    return {
      sessionToken,
      user: toPublicUser(user),
    }
  },
})

export const signOut = mutation({
  args: {
    sessionToken: v.string(),
  },
  handler: async (ctx, args) => {
    const tokenHash = await sha256(args.sessionToken)
    const sessions = await ctx.db
      .query("authSessions")
      .withIndex("by_tokenHash", (query) => query.eq("tokenHash", tokenHash))
      .collect()

    for (const session of sessions) {
      await ctx.db.delete(session._id)
    }

    return { signedOut: true }
  },
})

export const updateProfile = mutation({
  args: {
    sessionToken: v.string(),
    name: v.string(),
    avatarKey: v.string(),
    username: v.optional(v.string()),
    roleTitle: v.optional(v.string()),
    timezone: v.optional(v.string()),
    bio: v.optional(v.string()),
    status: v.optional(
      v.union(
        v.literal("available"),
        v.literal("busy"),
        v.literal("deep_work"),
        v.literal("offline")
      )
    ),
    workingHours: v.optional(v.string()),
    notificationEmail: v.optional(v.boolean()),
    notificationInApp: v.optional(v.boolean()),
    digestFrequency: v.optional(
      v.union(v.literal("off"), v.literal("daily"), v.literal("weekly"))
    ),
    themePreference: v.optional(
      v.union(v.literal("system"), v.literal("light"), v.literal("dark"))
    ),
    defaultRoomId: v.optional(v.id("rooms")),
    customAvatarUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireUserBySessionToken(ctx, args.sessionToken)
    const safeName = args.name.trim()
    const safeAvatarKey = normalizeAvatarKey(args.avatarKey)
    if (!safeName) {
      throw new Error("Name is required.")
    }

    await ctx.db.patch(user._id, {
      name: safeName,
      avatarKey: safeAvatarKey,
      username: args.username?.trim() || undefined,
      roleTitle: args.roleTitle?.trim() || undefined,
      timezone: args.timezone?.trim() || "UTC",
      bio: args.bio?.trim() || undefined,
      status: normalizeProfileStatus(args.status),
      workingHours: args.workingHours?.trim() || undefined,
      notificationEmail: args.notificationEmail ?? true,
      notificationInApp: args.notificationInApp ?? true,
      digestFrequency: normalizeDigest(args.digestFrequency),
      themePreference: normalizeTheme(args.themePreference),
      defaultRoomId: args.defaultRoomId,
      customAvatarUrl: args.customAvatarUrl?.trim() || undefined,
      updatedAt: Date.now(),
    })

    const updated = await ctx.db.get(user._id)
    if (!updated) {
      throw new Error("Unable to load updated profile.")
    }
    return toPublicUser(updated)
  },
})
