"use client"

import Image from "next/image"
import { Check } from "lucide-react"
import { AVATAR_OPTIONS, normalizeAvatarKey } from "@/lib/avatar-options"
import { cn } from "@/lib/utils"

type AvatarPickerProps = {
  value: string
  onChange: (avatarKey: string) => void
  className?: string
}

export function AvatarPicker({ value, onChange, className }: AvatarPickerProps) {
  const selectedKey = normalizeAvatarKey(value)

  return (
    <div
      className={cn(
        "grid grid-cols-4 gap-3 sm:grid-cols-6",
        className
      )}
    >
      {AVATAR_OPTIONS.map((option) => {
        const isSelected = option.key === selectedKey
        return (
          <button
            key={option.key}
            type="button"
            aria-label={option.label}
            aria-pressed={isSelected}
            onClick={() => onChange(option.key)}
            className={cn(
              "group relative overflow-hidden rounded-2xl border bg-background/50 transition-all",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/60",
              "hover:-translate-y-0.5 hover:border-cyan-400/40 hover:shadow-[0_8px_24px_-12px_rgba(6,182,212,0.75)]",
              isSelected
                ? "border-cyan-400/80 shadow-[0_0_0_1px_rgba(34,211,238,0.5),0_16px_30px_-14px_rgba(6,182,212,0.9)]"
                : "border-cyan-500/20"
            )}
          >
            <div className="relative aspect-square">
              <Image
                src={option.src}
                alt={option.label}
                fill
                sizes="(max-width: 768px) 25vw, 96px"
                className={cn(
                  "object-cover transition-transform duration-300",
                  isSelected ? "scale-105" : "group-hover:scale-105"
                )}
              />
            </div>
            <div
              className={cn(
                "absolute inset-x-0 bottom-0 bg-linear-to-t from-slate-950/80 to-transparent px-2 py-1 text-left text-[11px] text-cyan-50",
                isSelected ? "opacity-100" : "opacity-0 transition-opacity group-hover:opacity-100"
              )}
            >
              {option.label}
            </div>
            {isSelected ? (
              <span className="absolute right-2 top-2 inline-flex size-5 items-center justify-center rounded-full bg-cyan-400 text-slate-950">
                <Check className="size-3.5" />
              </span>
            ) : null}
          </button>
        )
      })}
    </div>
  )
}
