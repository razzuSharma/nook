import { api } from "@/convex/_generated/api"
import type { FunctionReference } from "convex/server"

type AuthApiShape = {
  viewer: FunctionReference<
    "query",
    "public",
    { sessionToken: string },
    {
      id: string
      name: string
      email: string
      avatarKey: string
      customAvatarUrl?: string
      username: string
      roleTitle: string
      timezone: string
      bio: string
      status: "available" | "busy" | "deep_work" | "offline"
      workingHours: string
      notificationEmail: boolean
      notificationInApp: boolean
      digestFrequency: "off" | "daily" | "weekly"
      themePreference: "system" | "light" | "dark"
      defaultRoomId?: string
      emailVerified: boolean
    } | null
  >
  signUp: FunctionReference<
    "mutation",
    "public",
    { name: string; email: string; password: string; avatarKey: string; siteUrl: string },
    {
      requiresEmailVerification: boolean
      verificationLink: string
    }
  >
  resendVerificationEmail: FunctionReference<
    "mutation",
    "public",
    { email: string; siteUrl: string },
    { verificationLink: string }
  >
  verifyEmail: FunctionReference<
    "mutation",
    "public",
    { token: string },
    {
      sessionToken: string
      user: {
        id: string
        name: string
        email: string
        avatarKey: string
        customAvatarUrl?: string
        username: string
        roleTitle: string
        timezone: string
        bio: string
        status: "available" | "busy" | "deep_work" | "offline"
        workingHours: string
        notificationEmail: boolean
        notificationInApp: boolean
        digestFrequency: "off" | "daily" | "weekly"
        themePreference: "system" | "light" | "dark"
        defaultRoomId?: string
        emailVerified: boolean
      }
    }
  >
  signIn: FunctionReference<
    "mutation",
    "public",
    { email: string; password: string },
    {
      sessionToken: string
      user: {
        id: string
        name: string
        email: string
        avatarKey: string
        customAvatarUrl?: string
        username: string
        roleTitle: string
        timezone: string
        bio: string
        status: "available" | "busy" | "deep_work" | "offline"
        workingHours: string
        notificationEmail: boolean
        notificationInApp: boolean
        digestFrequency: "off" | "daily" | "weekly"
        themePreference: "system" | "light" | "dark"
        defaultRoomId?: string
        emailVerified: boolean
      }
    }
  >
  requestPasswordReset: FunctionReference<
    "mutation",
    "public",
    { email: string; siteUrl: string },
    { message: string }
  >
  resetPassword: FunctionReference<
    "mutation",
    "public",
    { token: string; newPassword: string },
    { reset: boolean }
  >
  updateProfile: FunctionReference<
    "mutation",
    "public",
    {
      sessionToken: string
      name: string
      avatarKey: string
      customAvatarUrl?: string
      username?: string
      roleTitle?: string
      timezone?: string
      bio?: string
      status?: "available" | "busy" | "deep_work" | "offline"
      workingHours?: string
      notificationEmail?: boolean
      notificationInApp?: boolean
      digestFrequency?: "off" | "daily" | "weekly"
      themePreference?: "system" | "light" | "dark"
      defaultRoomId?: string
    },
    {
      id: string
      name: string
      email: string
      avatarKey: string
      customAvatarUrl?: string
      username: string
      roleTitle: string
      timezone: string
      bio: string
      status: "available" | "busy" | "deep_work" | "offline"
      workingHours: string
      notificationEmail: boolean
      notificationInApp: boolean
      digestFrequency: "off" | "daily" | "weekly"
      themePreference: "system" | "light" | "dark"
      defaultRoomId?: string
      emailVerified: boolean
    }
  >
  signOut: FunctionReference<
    "mutation",
    "public",
    { sessionToken: string },
    { signedOut: boolean }
  >
}

export const authApi = (api as unknown as { auth: AuthApiShape }).auth
