"use client"

import { Button } from "@/components/Button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/Dialog"
import type { ExportColumn, ExportScope } from "@/lib/csv"
import { cx } from "@/lib/utils"
import { Download } from "lucide-react"
import { useEffect, useId, useState } from "react"

// Typed against ExportColumn, so adding a column to EXPORT_COLUMNS without a
// label here is a compile error rather than a blank checkbox.
const COLUMN_LABELS: Record<ExportColumn, string> = {
  id: "Payment ID",
  created_at: "Date (UTC)",
  merchant: "Merchant",
  description: "Description",
  status: "Status",
  method: "Method",
  card_brand: "Card brand",
  last4: "Card last four",
  amount: "Amount",
  currency: "Currency",
}

const SCOPE_OPTIONS: { value: ExportScope; label: string }[] = [
  { value: "filter", label: "Current filter" },
  { value: "all", label: "All payments" },
]

type RowCount =
  | { state: "loading" }
  | { state: "ready"; total: number }
  | { state: "error" }

const controlClasses = cx(
  "size-4 shrink-0 accent-blue-500",
  "outline-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2",
)

/**
 * Export button plus the dialog that sets columns and scope.
 *
 * The column lists come from the server page (EXPORT_COLUMNS and
 * DEFAULT_EXPORT_COLUMNS in src/lib/csv.ts) so there is one source of truth.
 * The row count asks GET /api/payments with the same query the export will
 * use, so the number shown is the number of rows in the file. The server
 * validates everything again; the checks here are only a convenience.
 */
export function ExportDialog({
  query,
  columns,
  defaultColumns,
}: {
  /** The current page's query string, without a leading `?`. */
  query: string
  columns: readonly ExportColumn[]
  defaultColumns: readonly ExportColumn[]
}) {
  const baseId = useId()
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<ExportColumn[]>([...defaultColumns])
  const [scope, setScope] = useState<ExportScope>("filter")
  const [count, setCount] = useState<RowCount>({ state: "loading" })
  const [downloading, setDownloading] = useState(false)
  const [downloadError, setDownloadError] = useState<string | null>(null)

  // Count the rows the export will contain, every time the dialog opens or
  // the scope changes. A stale response is aborted so it cannot overwrite a
  // newer count.
  useEffect(() => {
    if (!open) return
    const controller = new AbortController()
    setCount({ state: "loading" })

    const countQuery = scope === "all" ? "" : query
    fetch(`/api/payments?${countQuery}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`Row count request failed with ${response.status}`)
        }
        const body: unknown = await response.json()
        const total = (body as { total?: unknown }).total
        if (typeof total !== "number") {
          throw new Error("Row count response had no numeric total")
        }
        setCount({ state: "ready", total })
      })
      .catch(() => {
        // An abort is this effect's own cleanup, not a failure. Any other
        // failure is reported on screen by the error state below.
        if (controller.signal.aborted) return
        setCount({ state: "error" })
      })

    return () => controller.abort()
  }, [open, scope, query])

  // Every open starts from the safe defaults: last four unticked, current
  // filter. A choice made for one file must not leak into the next.
  const handleOpenChange = (next: boolean) => {
    if (next) {
      setSelected([...defaultColumns])
      setScope("filter")
      setDownloadError(null)
    }
    setOpen(next)
  }

  // Keep the selection in canonical column order, whatever order it was ticked.
  const toggleColumn = (column: ExportColumn, checked: boolean) => {
    setSelected((current) =>
      columns.filter((c) => (c === column ? checked : current.includes(c))),
    )
  }

  const exportUrl = () => {
    const params = new URLSearchParams(query)
    params.delete("page")
    params.set("columns", selected.join(","))
    params.set("scope", scope)
    return `/api/payments/export?${params.toString()}`
  }

  const download = async () => {
    setDownloading(true)
    setDownloadError(null)
    try {
      const response = await fetch(exportUrl())
      if (!response.ok) {
        let message = `Export failed with status ${response.status}.`
        if (response.headers.get("content-type")?.includes("application/json")) {
          const body = (await response.json()) as { error?: unknown }
          if (typeof body.error === "string") message = body.error
        }
        throw new Error(message)
      }

      const disposition = response.headers.get("content-disposition") ?? ""
      const filename =
        /filename="([^"]+)"/.exec(disposition)?.[1] ?? "payments.csv"
      const href = URL.createObjectURL(await response.blob())
      const link = document.createElement("a")
      link.href = href
      link.download = filename
      document.body.appendChild(link)
      link.click()
      link.remove()
      // Revoke after the browser has had time to start the download.
      window.setTimeout(() => URL.revokeObjectURL(href), 10_000)
      setOpen(false)
    } catch (error) {
      // Shown in the dialog's role="alert" message.
      setDownloadError(
        error instanceof Error ? error.message : "Export failed. Try again.",
      )
    } finally {
      setDownloading(false)
    }
  }

  const nothingSelected = selected.length === 0
  const hintId = `${baseId}-hint`
  const countId = `${baseId}-count`

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="secondary" className="w-full gap-2 py-1.5 sm:w-fit">
          <Download
            className="-ml-0.5 size-4 shrink-0 text-gray-400 dark:text-gray-600"
            aria-hidden="true"
          />
          Export
        </Button>
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Export payments</DialogTitle>
          <DialogDescription>
            Choose the columns and rows for the CSV file.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-6 flex flex-col gap-6">
          <fieldset>
            <legend className="text-sm font-medium text-gray-900 dark:text-gray-50">
              Columns
            </legend>
            <p className="mt-1 text-sm text-gray-500">
              Card last four is off by default. Leave it off for files going to
              a merchant.
            </p>
            <div className="mt-3 grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2">
              {columns.map((column) => {
                const id = `${baseId}-column-${column}`
                return (
                  <div key={column} className="flex items-center gap-2">
                    <input
                      id={id}
                      type="checkbox"
                      checked={selected.includes(column)}
                      onChange={(event) =>
                        toggleColumn(column, event.target.checked)
                      }
                      className={controlClasses}
                    />
                    <label
                      htmlFor={id}
                      className="text-sm text-gray-700 dark:text-gray-300"
                    >
                      {COLUMN_LABELS[column]}
                    </label>
                  </div>
                )
              })}
            </div>
          </fieldset>

          <fieldset>
            <legend className="text-sm font-medium text-gray-900 dark:text-gray-50">
              Rows
            </legend>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:gap-6">
              {SCOPE_OPTIONS.map((option) => {
                const id = `${baseId}-scope-${option.value}`
                return (
                  <div key={option.value} className="flex items-center gap-2">
                    <input
                      id={id}
                      type="radio"
                      name={`${baseId}-scope`}
                      value={option.value}
                      checked={scope === option.value}
                      onChange={() => setScope(option.value)}
                      className={controlClasses}
                    />
                    <label
                      htmlFor={id}
                      className="text-sm text-gray-700 dark:text-gray-300"
                    >
                      {option.label}
                    </label>
                  </div>
                )
              })}
            </div>
          </fieldset>

          <p
            id={countId}
            aria-live="polite"
            className="rounded-md bg-gray-50 px-3 py-2 text-sm text-gray-700 dark:bg-gray-900 dark:text-gray-300"
          >
            {count.state === "loading" && "Counting payments…"}
            {count.state === "error" &&
              "Couldn't count the payments. The file will still include every matching row."}
            {count.state === "ready" &&
              (count.total === 0
                ? "No payments match. The file will contain the header row only."
                : `${count.total.toLocaleString("en-US")} ${
                    count.total === 1 ? "payment" : "payments"
                  } will be exported.`)}
          </p>

          {downloadError && (
            <p role="alert" className="text-sm text-red-600 dark:text-red-500">
              {downloadError}
            </p>
          )}
        </div>

        <DialogFooter className="mt-6">
          <DialogClose asChild>
            <Button variant="secondary" className="py-1.5">
              Cancel
            </Button>
          </DialogClose>
          <Button
            variant="primary"
            className="gap-2 py-1.5"
            disabled={nothingSelected}
            isLoading={downloading}
            loadingText="Downloading…"
            aria-describedby={nothingSelected ? hintId : countId}
            onClick={download}
          >
            Download CSV
          </Button>
        </DialogFooter>
        {nothingSelected && (
          <p id={hintId} className="mt-2 text-right text-sm text-gray-500">
            Choose at least one column to download.
          </p>
        )}
      </DialogContent>
    </Dialog>
  )
}
