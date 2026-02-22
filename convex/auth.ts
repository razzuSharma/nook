import { v } from "convex/values"
import { mutation, query, type MutationCtx } from "./_generated/server"
import type { Doc, Id } from "./_generated/dataModel"
import { internal } from "./_generated/api"

const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30
const VERIFICATION_TTL_MS = 1000 * 60 * 60 * 24

function normalizeEmail(value: string) {
  return value.trim().toLowerCase()
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

    return {
      id: user._id,
      name: user.name,
      email: user.email,
      emailVerified: Boolean(user.emailVerifiedAt),
    }
  },
})

export const signUp = mutation({
  args: {
    name: v.string(),
    email: v.string(),
    password: v.string(),
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

    if (existing && existing.emailVerifiedAt) {
      throw new Error("An account with this email already exists.")
    }

    const now = Date.now()
    const passwordSalt = randomToken(16)
    const passwordHash = await hashPassword(password, passwordSalt)

    let userId: Id<"users">
    if (existing) {
      await ctx.db.patch(existing._id, {
        name,
        passwordSalt,
        passwordHash,
        updatedAt: now,
      })
      userId = existing._id
    } else {
      userId = await ctx.db.insert("users", {
        email,
        name,
        passwordHash,
        passwordSalt,
        createdAt: now,
        updatedAt: now,
      })
    }

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

    if (!user) {
      throw new Error("No account found for this email.")
    }
    if (user.emailVerifiedAt) {
      throw new Error("This email is already verified.")
    }

    const verificationLink = await createVerificationToken(ctx, user, args.siteUrl)
    return { verificationLink }
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
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        emailVerified: true,
      },
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
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        emailVerified: true,
      },
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
