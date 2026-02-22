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
