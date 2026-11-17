// Tremor-style Dialog, built the same way as Drawer.tsx on @radix-ui/react-dialog.
//
// Radix moves focus into the content on open, traps it there, closes on
// Escape, and returns focus to the trigger on close. Animations use only the
// keyframes defined in tailwind.config.ts (`hide`, `slideUpAndFade`).

import * as DialogPrimitives from "@radix-ui/react-dialog"
import { RiCloseLine } from "@remixicon/react"
import * as React from "react"

import { cx } from "@/lib/utils"

import { Button } from "./Button"

const Dialog = (
  props: React.ComponentPropsWithoutRef<typeof DialogPrimitives.Root>,
) => {
  return <DialogPrimitives.Root {...props} />
}
Dialog.displayName = "Dialog"

// Re-exported as-is. Setting displayName here would rename Radix's shared
// component for every other consumer, including Drawer.
const DialogTrigger = DialogPrimitives.Trigger

const DialogClose = DialogPrimitives.Close

const DialogContent = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitives.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitives.Content>
>(({ className, children, ...props }, forwardedRef) => {
  return (
    <DialogPrimitives.Portal>
      <DialogPrimitives.Overlay
        className={cx(
          // base: the overlay lays out the content, so the content needs no
          // transform and the slide animation cannot fight a translate.
          // items-start + my-auto on the content centers it when it fits;
          // items-center would push a tall dialog's top out of scroll reach.
          "fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4",
          // background color
          "bg-black/30",
          // transition
          "data-[state=closed]:animate-hide",
        )}
      >
        <DialogPrimitives.Content
          ref={forwardedRef}
          className={cx(
            // base
            "relative my-auto w-full max-w-lg rounded-md border p-6 shadow-lg focus:outline-none",
            // border color
            "border-gray-200 dark:border-gray-900",
            // background color
            "bg-white dark:bg-[#090E1A]",
            // transition
            "data-[state=open]:animate-slideUpAndFade data-[state=closed]:animate-hide",
            className,
          )}
          {...props}
        >
          {children}
          {/* Last in DOM order so focus lands on the first form control, not
              on Close. Positioned top-right visually. */}
          <DialogPrimitives.Close asChild>
            <Button
              variant="ghost"
              aria-label="Close"
              className="absolute right-3 top-3 aspect-square p-1 hover:bg-gray-100 hover:dark:bg-gray-400/10"
            >
              <RiCloseLine className="size-5" aria-hidden="true" />
            </Button>
          </DialogPrimitives.Close>
        </DialogPrimitives.Content>
      </DialogPrimitives.Overlay>
    </DialogPrimitives.Portal>
  )
})
DialogContent.displayName = "DialogContent"

const DialogHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => {
  // pr-8 keeps the title clear of the absolutely positioned close button
  return (
    <div className={cx("flex flex-col gap-y-1 pr-8", className)} {...props} />
  )
}
DialogHeader.displayName = "DialogHeader"

const DialogTitle = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitives.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitives.Title>
>(({ className, ...props }, forwardedRef) => (
  <DialogPrimitives.Title
    ref={forwardedRef}
    className={cx(
      // base
      "text-base font-semibold",
      // text color
      "text-gray-900 dark:text-gray-50",
      className,
    )}
    {...props}
  />
))
DialogTitle.displayName = "DialogTitle"

const DialogDescription = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitives.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitives.Description>
>(({ className, ...props }, forwardedRef) => (
  <DialogPrimitives.Description
    ref={forwardedRef}
    className={cx("text-sm text-gray-500 dark:text-gray-500", className)}
    {...props}
  />
))
DialogDescription.displayName = "DialogDescription"

const DialogFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => {
  return (
    <div
      className={cx(
        "flex flex-col-reverse gap-2 sm:flex-row sm:justify-end",
        className,
      )}
      {...props}
    />
  )
}
DialogFooter.displayName = "DialogFooter"

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
}
