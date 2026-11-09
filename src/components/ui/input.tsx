import * as React from "react"
import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "h-11 w-full min-w-0 rounded-[10px] border border-line bg-surface px-3 py-1 text-base text-ink transition-colors outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-ink-3 hover:border-line-strong focus-visible:border-ink focus-visible:outline-3 focus-visible:outline-offset-1 focus-visible:outline-ink/15 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-fact disabled:opacity-60 aria-invalid:border-danger-ink aria-invalid:outline-danger-ink/15",
        className
      )}
      {...props}
    />
  )
}

export { Input }
