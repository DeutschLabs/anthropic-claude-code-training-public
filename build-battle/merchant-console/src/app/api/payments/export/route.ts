import { filterPayments, parseFilters, sortPayments } from "@/data/queries"
import { PaymentFilters } from "@/data/types"
import {
  exportFilename,
  exportLabel,
  parseExportOptions,
  toCsv,
} from "@/lib/csv"
import { NextRequest, NextResponse } from "next/server"

/**
 * Exports payments as CSV.
 *
 * `columns` and `scope` are validated by `parseExportOptions` before anything
 * else runs; bad input gets 400 with `{ error }`. Filters go through
 * `parseFilters` and the same builder as `GET /api/payments`, without
 * pagination, so the file holds every matching row. `scope=all` drops the
 * filters but keeps the requested sort.
 */
export function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams

  const parsed = parseExportOptions(params)
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 })
  }
  const { columns, scope } = parsed.options

  const filters = parseFilters(params)
  const scoped: PaymentFilters =
    scope === "all"
      ? { status: "all", sort: filters.sort, direction: filters.direction }
      : filters

  const rows = sortPayments(
    filterPayments(scoped),
    scoped.sort,
    scoped.direction,
  )
  const filename = exportFilename(new Date(), exportLabel(scope, filters))

  return new Response(toCsv(rows, columns), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
    },
  })
}
