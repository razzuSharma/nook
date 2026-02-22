"use client"

import * as React from "react"
import Image from "next/image"
import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { useAuth } from "@/components/providers/auth-provider"
import { AvatarPicker } from "@/components/avatar/avatar-picker"
import { avatarSrcForKey, normalizeAvatarKey } from "@/lib/avatar-options"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"

export default function ProfilePage() {
  const { user, updateProfile } = useAuth()
  const [name, setName] = React.useState(user?.name ?? "")
  const [avatarKey, setAvatarKey] = React.useState(user?.avatarKey ?? "avatar-1")
  const [error, setError] = React.useState<string | null>(null)
  const [isSaving, setIsSaving] = React.useState(false)

  React.useEffect(() => {
    if (!user) return
    setName(user.name)
    setAvatarKey(normalizeAvatarKey(user.avatarKey))
  }, [user])

  async function onSave() {
    setError(null)
    setIsSaving(true)
    try {
      await updateProfile({
        name,
        avatarKey: normalizeAvatarKey(avatarKey),
      })
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to update profile.")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 64)",
          "--header-height": "calc(var(--spacing) * 12)",
        } as React.CSSProperties
      }
    >
      <AppSidebar variant="sidebar" />
      <SidebarInset className="overflow-hidden bg-[radial-gradient(circle_at_20%_-10%,rgba(6,182,212,0.2),transparent_35%),radial-gradient(circle_at_95%_5%,rgba(20,184,166,0.2),transparent_35%),linear-gradient(180deg,#f4fbfc_0%,#eef9fb_100%)] dark:bg-[radial-gradient(circle_at_20%_-10%,rgba(6,182,212,0.22),transparent_35%),radial-gradient(circle_at_95%_5%,rgba(20,184,166,0.2),transparent_35%),linear-gradient(180deg,#05171a_0%,#031116_100%)]">
        <SiteHeader currentPage="Profile" />
        <div className="flex flex-1 flex-col px-4 py-5 md:px-6 md:py-6 lg:pr-20">
          <div className="mx-auto w-full max-w-4xl space-y-5">
            <Card className="border-cyan-500/20 bg-background/70">
              <CardHeader>
                <CardTitle>Profile</CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="flex items-center gap-3">
                  <div className="relative size-[72px] overflow-hidden rounded-2xl border border-cyan-400/40 bg-cyan-500/10 shadow-[0_10px_30px_-16px_rgba(6,182,212,0.9)]">
                    <Image
                      src={avatarSrcForKey(avatarKey)}
                      alt="Selected avatar"
                      fill
                      sizes="72px"
                      className="object-cover"
                    />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{user?.email}</p>
                    <p className="text-xs text-muted-foreground">
                      Pick your avatar style.
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="profile-name">
                    Name
                  </label>
                  <Input
                    id="profile-name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Your name"
                  />
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-medium">Avatar</p>
                  <AvatarPicker value={avatarKey} onChange={setAvatarKey} />
                </div>

                {error ? <p className="text-sm text-red-600">{error}</p> : null}

                <Button
                  type="button"
                  className="bg-cyan-500 text-slate-950 hover:bg-cyan-400"
                  disabled={isSaving}
                  onClick={() => {
                    void onSave()
                  }}
                >
                  {isSaving ? "Saving..." : "Save profile"}
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
