import * as React from "react"
import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex field-sizing-content min-h-24 w-full rounded-[10px] border border-line bg-surface px-3 py-2.5 text-base text-ink transition-colors outline-none placeholder:text-ink-3 hover:border-line-strong focus-visible:border-ink focus-visible:outline-3 focus-visible:outline-offset-1 focus-visible:outline-ink/15 disabled:cursor-not-allowed disabled:bg-fact disabled:opacity-60 aria-invalid:border-danger-ink aria-invalid:outline-danger-ink/15",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
