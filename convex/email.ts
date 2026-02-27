import { internalAction } from "./_generated/server"
import { v } from "convex/values"

export const sendVerificationEmail = internalAction({
  args: {
    email: v.string(),
    name: v.string(),
    verificationLink: v.string(),
  },
  handler: async (_ctx, args) => {
    const apiKey = process.env.RESEND_API_KEY
    const fromEmail = process.env.RESEND_FROM_EMAIL

    if (!apiKey || !fromEmail) {
      console.log(
        `[nook-auth] Verification email fallback for ${args.email}: ${args.verificationLink}`
      )
      return { sent: false, provider: "none" as const }
    }

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [args.email],
        subject: "Verify your Nook account",
        html: `
          <div style="font-family:Arial,sans-serif;line-height:1.5">
            <h2>Verify your email</h2>
            <p>Hi ${args.name || "there"},</p>
            <p>Click the link below to verify your Nook account:</p>
            <p><a href="${args.verificationLink}">${args.verificationLink}</a></p>
            <p>This link expires in 24 hours.</p>
          </div>
        `,
      }),
    })

    if (!response.ok) {
      const details = await response.text()
      console.error("[nook-auth] resend failure", details)
      return { sent: false, provider: "resend" as const }
    }

    return { sent: true, provider: "resend" as const }
  },
})

export const sendRoomInviteEmail = internalAction({
  args: {
    email: v.string(),
    invitedByName: v.string(),
    roomName: v.string(),
    inviteLink: v.string(),
  },
  handler: async (_ctx, args) => {
    const apiKey = process.env.RESEND_API_KEY
    const fromEmail = process.env.RESEND_FROM_EMAIL

    if (!apiKey || !fromEmail) {
      console.log(
        `[nook-invite] Invite fallback for ${args.email}: ${args.inviteLink}`
      )
      return { sent: false, provider: "none" as const }
    }

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [args.email],
        subject: `${args.invitedByName} invited you to ${args.roomName}`,
        html: `
          <div style="font-family:Arial,sans-serif;line-height:1.5">
            <h2>You are invited to a Nook room</h2>
            <p>${args.invitedByName} invited you to join <strong>${args.roomName}</strong>.</p>
            <p>Accept invite:</p>
            <p><a href="${args.inviteLink}">${args.inviteLink}</a></p>
          </div>
        `,
      }),
    })

    if (!response.ok) {
      const details = await response.text()
      console.error("[nook-invite] resend failure", details)
      return { sent: false, provider: "resend" as const }
    }

    return { sent: true, provider: "resend" as const }
  },
})

export const sendPasswordResetEmail = internalAction({
  args: {
    email: v.string(),
    name: v.string(),
    resetLink: v.string(),
  },
  handler: async (_ctx, args) => {
    const apiKey = process.env.RESEND_API_KEY
    const fromEmail = process.env.RESEND_FROM_EMAIL

    if (!apiKey || !fromEmail) {
      console.log(
        `[nook-auth] Password reset fallback for ${args.email}: ${args.resetLink}`
      )
      return { sent: false, provider: "none" as const }
    }

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [args.email],
        subject: "Reset your Nook password",
        html: `
          <div style="font-family:Arial,sans-serif;line-height:1.5">
            <h2>Password reset request</h2>
            <p>Hi ${args.name || "there"},</p>
            <p>Click the link below to reset your Nook password:</p>
            <p><a href="${args.resetLink}">${args.resetLink}</a></p>
            <p>This link expires in 30 minutes.</p>
          </div>
        `,
      }),
    })

    if (!response.ok) {
      const details = await response.text()
      console.error("[nook-auth] resend failure", details)
      return { sent: false, provider: "resend" as const }
    }

    return { sent: true, provider: "resend" as const }
  },
})
