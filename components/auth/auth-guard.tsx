"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/components/providers/auth-provider"

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const { isReady, user } = useAuth()

  React.useEffect(() => {
    if (!isReady) return
    if (!user) {
      router.replace("/sign-in")
    }
  }, [isReady, user, router])

  if (!isReady || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Loading your workspace...
      </div>
    )
  }

  return <>{children}</>
}
