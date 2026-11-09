import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"
import { Slot } from "radix-ui"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-[11px] border border-transparent bg-clip-padding text-[0.95rem] font-bold whitespace-nowrap transition-[background-color,border-color,color,box-shadow] duration-150 ease-out outline-none select-none focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ink active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-[18px]",
  {
    variants: {
      variant: {
        default: "border-ipe bg-ipe text-ink hover:border-ipe-hover hover:bg-ipe-hover",
        outline:
          "border-line bg-surface text-ink hover:border-line-strong hover:bg-surface-2 aria-expanded:border-line-strong aria-expanded:bg-surface-2",
        ink: "border-ink bg-ink text-white hover:bg-stone-800",
        secondary: "bg-fact text-ink hover:bg-line aria-expanded:bg-line",
        ghost: "text-ink hover:bg-fact aria-expanded:bg-fact",
        destructive:
          "border-danger-ink/25 bg-danger-soft text-danger-ink hover:border-danger-ink/45 hover:bg-[#fbdcd8]",
        link: "h-auto! px-0! font-semibold text-ink underline underline-offset-4 hover:decoration-2",
      },
      size: {
        default:
          "h-10 gap-2 px-4 has-data-[icon=inline-end]:pr-3 has-data-[icon=inline-start]:pl-3",
        xs: "h-7 gap-1 rounded-lg px-2.5 text-xs [&_svg:not([class*='size-'])]:size-3.5",
        sm: "h-9 gap-1.5 rounded-[10px] px-3 text-sm [&_svg:not([class*='size-'])]:size-4",
        lg: "h-11 gap-2 px-5 text-base",
        icon: "size-10",
        "icon-xs": "size-7 rounded-lg [&_svg:not([class*='size-'])]:size-3.5",
        "icon-sm": "size-9 rounded-[10px]",
        "icon-lg": "size-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
