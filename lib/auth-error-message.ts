export function toAuthErrorMessage(error: unknown, fallback: string) {
  const raw = error instanceof Error ? error.message : fallback

  const extracted =
    raw.match(/Error:\s*(.*?)(?:\s+at handler|\s+Called by client|$)/i)?.[1]?.trim() ??
    raw.trim()

  const text = extracted.toLowerCase()
  if (text.includes("invalid email or password")) {
    return "Email or password is incorrect. If you forgot it, use Reset password."
  }
  if (text.includes("verify your email")) {
    return "Please verify your email before signing in."
  }
  if (text.includes("already exists")) {
    return "This email is already in use. Use another email or sign in."
  }
  if (text.includes("password reset link is invalid")) {
    return "This reset link is invalid. Request a new password reset email."
  }
  if (text.includes("password reset link has expired")) {
    return "This reset link has expired. Request a new password reset email."
  }

  return extracted || fallback
}
