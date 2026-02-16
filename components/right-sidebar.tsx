"use client"

import * as React from "react"
import { Bell, Calendar, CircleHelp } from "lucide-react"
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip"

export function RightSidebar() {
    const actions = [
        { icon: Bell, label: "Notifications" },
        { icon: Calendar, label: "Calendar" },
    ]

    return (
        <aside className="fixed top-0 right-0 z-40 hidden h-screen w-14 flex-col border-l border-cyan-500/15 bg-background/40 backdrop-blur-md md:flex lg:w-16">
            <div className="flex flex-1 flex-col items-center gap-6 py-4 pt-16">
                <TooltipProvider delayDuration={0}>
                    {actions.map((action) => (
                        <Tooltip key={action.label}>
                            <TooltipTrigger asChild>
                                <button
                                    type="button"
                                    className="flex size-10 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-cyan-500/10 hover:text-cyan-600 dark:hover:text-cyan-400"
                                >
                                    <action.icon className="size-5" />
                                    <span className="sr-only">{action.label}</span>
                                </button>
                            </TooltipTrigger>
                            <TooltipContent side="left" className="bg-slate-900 text-slate-50">
                                <p>{action.label}</p>
                            </TooltipContent>
                        </Tooltip>
                    ))}
                </TooltipProvider>
            </div>

            <div className="flex flex-col items-center py-6">
                <TooltipProvider delayDuration={0}>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <button
                                type="button"
                                className="flex size-10 items-center justify-center rounded-full border border-cyan-500/20 text-muted-foreground transition-colors hover:bg-cyan-500/10 hover:text-cyan-600 dark:hover:text-cyan-400"
                            >
                                <CircleHelp className="size-5" />
                                <span className="sr-only">Help</span>
                            </button>
                        </TooltipTrigger>
                        <TooltipContent side="left" className="bg-slate-900 text-slate-50">
                            <p>Help & Support</p>
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            </div>
        </aside>
    )
}
