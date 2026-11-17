import { merchantById } from "@/data/merchants"
import { Payment, PaymentFilters, PaymentStatus } from "@/data/types"
import { formatMoney } from "./money"

/**
 * CSV export for the payments table.
 *
 * Ops chooses the columns and the scope (NWP-101). Both arrive from the
 * client, so `parseExportOptions` checks them against the allowlists below
 * before anything reaches the query builder, the file, or the filename.
 */

export const EXPORT_COLUMNS = [
  "id",
  "created_at",
  "merchant",
  "description",
  "status",
  "method",
  "card_brand",
  "last4",
  "amount",
  "currency",
] as const

export type ExportColumn = (typeof EXPORT_COLUMNS)[number]

/**
 * What an export contains when the request names no columns: everything
 * except the card last four. Files sent to merchants must not carry card
 * data unless someone opted in, so old `/api/payments/export` links now drop
 * `last4` on purpose.
 */
export const DEFAULT_EXPORT_COLUMNS: readonly ExportColumn[] =
  EXPORT_COLUMNS.filter((column) => column !== "last4")

/** `filter` exports the current filter; `all` exports every payment. */
export const EXPORT_SCOPES = ["filter", "all"] as const

export type ExportScope = (typeof EXPORT_SCOPES)[number]

export interface ExportOptions {
  columns: ExportColumn[]
  scope: ExportScope
}

export type ExportOptionsResult =
  | { ok: true; options: ExportOptions }
  | { ok: false; error: string }

function isExportColumn(value: string): value is ExportColumn {
  return (EXPORT_COLUMNS as readonly string[]).includes(value)
}

function isExportScope(value: string): value is ExportScope {
  return (EXPORT_SCOPES as readonly string[]).includes(value)
}

/**
 * Validates the `columns` and `scope` query parameters.
 *
 * `columns` is one comma-separated list. Missing means the default set; an
 * empty list, an unknown column, or a column named twice is rejected.
 * `scope` is `filter` (the default) or `all`. Error messages never echo the
 * client's input back, so they are safe to show a user as-is.
 */
export function parseExportOptions(
  params: URLSearchParams,
): ExportOptionsResult {
  const columnParams = params.getAll("columns")
  const scopeParams = params.getAll("scope")

  if (columnParams.length > 1) {
    return {
      ok: false,
      error: "Send columns once, as a single comma-separated list.",
    }
  }
  if (scopeParams.length > 1) {
    return { ok: false, error: "Send scope once." }
  }

  let columns: ExportColumn[] = [...DEFAULT_EXPORT_COLUMNS]
  if (columnParams.length === 1) {
    const raw = columnParams[0]
    if (raw === "") {
      return { ok: false, error: "Choose at least one column to export." }
    }

    const requested = raw.split(",")
    const valid: ExportColumn[] = []
    for (const column of requested) {
      if (!isExportColumn(column)) {
        return {
          ok: false,
          error: `Unknown column. Allowed columns: ${EXPORT_COLUMNS.join(", ")}.`,
        }
      }
      if (valid.includes(column)) {
        return { ok: false, error: "Each column can be chosen only once." }
      }
      valid.push(column)
    }
    columns = valid
  }

  let scope: ExportScope = "filter"
  if (scopeParams.length === 1) {
    const raw = scopeParams[0]
    if (!isExportScope(raw)) {
      return {
        ok: false,
        error: `Unknown scope. Allowed scopes: ${EXPORT_SCOPES.join(", ")}.`,
      }
    }
    scope = raw
  }

  return { ok: true, options: { columns, scope } }
}

/** The only words that may appear in an export filename besides the date. */
export type ExportLabel = PaymentStatus | "filtered" | "all"

/**
 * Names what a file contains: the status when one is set, `filtered` when
 * another filter narrows the rows, otherwise `all`. Search text, merchant ids
 * and dates never reach the filename.
 */
export function exportLabel(
  scope: ExportScope,
  filters: PaymentFilters,
): ExportLabel {
  if (scope === "all") return "all"
  if (filters.status && filters.status !== "all") return filters.status
  if (
    filters.merchantId ||
    filters.search?.trim() ||
    filters.from ||
    filters.to
  ) {
    return "filtered"
  }
  return "all"
}

function escapeCell(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`
  return value
}

function cell(payment: Payment, column: ExportColumn): string {
  switch (column) {
    case "id":
      return payment.id
    case "created_at":
      return payment.createdAt
    case "merchant":
      return merchantById(payment.merchantId)?.name ?? payment.merchantId
    case "description":
      return payment.description
    case "status":
      return payment.status
    case "method":
      return payment.method
    case "card_brand":
      return payment.cardBrand ?? ""
    case "last4":
      return payment.last4 ?? ""
    case "amount":
      return formatMoney(payment.amount, payment.currency)
    case "currency":
      return payment.currency
  }
}

export function toCsv(
  payments: Payment[],
  columns: readonly ExportColumn[] = EXPORT_COLUMNS,
): string {
  if (columns.length === 0) {
    throw new Error("toCsv needs at least one column; refusing to write an empty file.")
  }
  const header = columns.join(",")
  const rows = payments.map((payment) =>
    columns.map((column) => escapeCell(cell(payment, column))).join(","),
  )
  return [header, ...rows].join("\n")
}

// The filename sits inside a content-disposition header. The label is typed
// to allowlisted words, and this check holds even if a caller bypasses types.
const SAFE_LABEL = /^[a-z_]+$/

export function exportFilename(
  date = new Date(),
  label?: ExportLabel,
): string {
  const day = date.toISOString().slice(0, 10)
  if (label === undefined) return `payments-${day}.csv`
  if (!SAFE_LABEL.test(label)) {
    throw new Error("Export filename label must be lowercase letters only.")
  }
  return `payments-${label}-${day}.csv`
}
