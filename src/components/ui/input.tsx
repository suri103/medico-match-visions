
import * as React from "react"

import { cn } from "@/lib/utils"

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          // NOTE: deliberately NOT `flex`. Applying display:flex to the host
          // breaks WebKit's internal date/time shadow DOM: the
          // ::-webkit-calendar-picker-indicator is a flex item whose content is
          // a background image, so it has no min-content width and collapses to
          // zero (invisible calendar/clock icon), while the datetime-edit text
          // is stranded at the left instead of letting the icon pin right.
          // `w-full` already handles width, so flex contributed nothing.
          "h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base font-medium text-foreground ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-80 disabled:text-gray-800 md:text-sm",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
