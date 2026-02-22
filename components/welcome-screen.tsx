"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { useAuth } from "@/components/providers/auth-provider";
import { Button } from "@/components/ui/button";

export function WelcomeScreen() {
  const { user } = useAuth()

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_20%_0%,color-mix(in_oklch,var(--nook-accent)_32%,transparent),transparent_38%),radial-gradient(circle_at_90%_10%,color-mix(in_oklch,var(--nook-accent-strong)_26%,transparent),transparent_36%),linear-gradient(180deg,var(--nook-surface)_0%,var(--background)_100%)] px-4 py-10">
      <div className="pointer-events-none absolute inset-0">
        <div className="animate-[nook-float_9s_ease-in-out_infinite] absolute -top-24 left-1/2 size-80 -translate-x-1/2 rounded-full bg-(--nook-accent)/20 blur-3xl" />
        <div className="animate-[nook-float_11s_ease-in-out_infinite_reverse] absolute right-0 bottom-0 size-72 rounded-full bg-(--nook-accent-strong)/15 blur-3xl" />
      </div>

      <section className="relative w-full max-w-3xl rounded-3xl border border-nook-sidebar-border bg-background/70 p-6 text-center shadow-2xl backdrop-blur-xl md:p-10">
        <div className="animate-[nook-glow_2.6s_ease-in-out_infinite] mx-auto mb-4 flex h-11 w-11 items-center justify-center overflow-hidden rounded-full">
          <img src="/nook-logo.png" alt="Nook logo" className="size-full object-cover mt-1 dark:block hidden" />
          <img src="/nook-logo-light.png" alt="Nook logo" className="size-full scale-[1] -translate-x-[0px] object-cover mt-0 dark:hidden block" />
        </div>
        <p className="text-sm font-medium tracking-wide text-muted-foreground">
          Welcome to Nook
        </p>
        <h1 className="mt-2 text-balance text-3xl font-semibold tracking-tight md:text-5xl">
          Enter your focus workspace
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-pretty text-sm text-muted-foreground md:text-base">
          Rooms, tasks, and live collaboration in one calm dashboard. Start your
          session when you are ready.
        </p>

        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button
            asChild
            size="lg"
            className="group bg-nook-accent text-slate-950 hover:bg-nook-accent-strong"
          >
            <Link href={user ? "/dashboard" : "/sign-in"}>
              {user ? "Enter the new world of cafe and code." : "Sign in to enter Nook."}
              <ArrowRight className="transition-transform duration-200 group-hover:translate-x-1" />
            </Link>
          </Button>
          {!user ? (
            <Button asChild size="lg" variant="outline">
              <Link href="/sign-up">Create account</Link>
            </Button>
          ) : null}
        </div>
      </section>

      <style jsx>{`
        @keyframes nook-float {
          0%,
          100% {
            transform: translate3d(0, 0, 0);
          }
          50% {
            transform: translate3d(0, -20px, 0);
          }
        }
        @keyframes nook-glow {
          0%,
          100% {
            box-shadow: 0 0 0 0
              color-mix(in oklch, var(--nook-accent) 40%, transparent);
          }
          50% {
            box-shadow: 0 0 0 14px
              color-mix(in oklch, var(--nook-accent) 0%, transparent);
          }
        }
      `}</style>
    </main>
  );
}
