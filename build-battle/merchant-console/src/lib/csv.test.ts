import { describe, expect, it } from "vitest"
import { Payment } from "@/data/types"
import {
  DEFAULT_EXPORT_COLUMNS,
  EXPORT_COLUMNS,
  ExportLabel,
  exportFilename,
  exportLabel,
  parseExportOptions,
  toCsv,
} from "./csv"

/**
 * The export is the file ops hands to a merchant, so a broken cell is a
 * support ticket rather than a stack trace. These tests pin the escaping and
 * the column contract; NWP-101 changes which columns ship, not how a cell is
 * written, and these should still pass afterwards.
 */

const payment: Payment = {
  id: "pay_0001",
  merchantId: "mch_01",
  amount: 25000,
  currency: "USD",
  status: "captured",
  method: "card",
  cardBrand: "visa",
  last4: "4242",
  createdAt: "2026-03-14T10:15:00.000Z",
  description: "Order 1180",
}

describe("toCsv", () => {
  it("writes a header row followed by one row per payment", () => {
    const lines = toCsv([payment]).split("\n")
    expect(lines).toHaveLength(2)
    expect(lines[0]).toBe(EXPORT_COLUMNS.join(","))
  })

  it("writes only the requested columns, in the order given", () => {
    expect(toCsv([payment], ["id", "amount"])).toBe(
      ["id,amount", "pay_0001,$250.00"].join("\n"),
    )
  })

  it("quotes cells containing a comma, so amounts do not split", () => {
    const large = { ...payment, amount: 123456789 }
    expect(toCsv([large], ["amount"])).toBe(['amount', '"$1,234,567.89"'].join("\n"))
  })

  it("doubles embedded quotes rather than dropping them", () => {
    const quoted = { ...payment, description: 'Order "rush"' }
    expect(toCsv([quoted], ["description"])).toBe(
      ["description", '"Order ""rush"""'].join("\n"),
    )
  })

  it("keeps a newline inside a description in one quoted cell", () => {
    const multiline = { ...payment, description: "Order 1180\nsecond line" }
    const body = toCsv([multiline], ["description"]).split("\n").slice(1).join("\n")
    expect(body).toBe('"Order 1180\nsecond line"')
  })

  it("resolves the merchant name, and falls back to the id when unknown", () => {
    expect(toCsv([payment], ["merchant"])).toContain("Lumen Coffee Roasters")
    const orphan = { ...payment, merchantId: "mch_missing" }
    expect(toCsv([orphan], ["merchant"])).toContain("mch_missing")
  })

  it("writes an empty cell for a payment with no card", () => {
    const bank: Payment = {
      ...payment,
      method: "bank_transfer",
      cardBrand: null,
      last4: null,
    }
    expect(toCsv([bank], ["card_brand", "last4"])).toBe(
      ["card_brand,last4", ","].join("\n"),
    )
  })

  it("emits a header even with no rows", () => {
    expect(toCsv([], ["id"])).toBe("id")
  })
})

describe("exportFilename", () => {
  it("stamps the UTC date, so two exports on the same day collide by design", () => {
    expect(exportFilename(new Date("2026-03-14T23:00:00.000Z"))).toBe(
      "payments-2026-03-14.csv",
    )
  })
})

// NWP-101: ops chooses columns and scope. Everything below arrives from the
// client, so it is pinned at the parser as well as at the serializer.

const params = (query: string) => new URLSearchParams(query)

describe("toCsv with a chosen column set (NWP-101)", () => {
  it("writes a subset of columns in the order requested, not the canonical order", () => {
    expect(toCsv([payment], ["amount", "id"])).toBe(
      ["amount,id", "$250.00,pay_0001"].join("\n"),
    )
  })

  it("leaves the card last four out of the default column set", () => {
    const header = toCsv([payment], DEFAULT_EXPORT_COLUMNS).split("\n")[0]
    expect(header.split(",")).not.toContain("last4")
    expect(toCsv([payment], DEFAULT_EXPORT_COLUMNS)).not.toContain("4242")
  })

  it("refuses an empty column list rather than writing a file with no columns", () => {
    expect(() => toCsv([payment], [])).toThrow()
  })
})

describe("DEFAULT_EXPORT_COLUMNS", () => {
  it("is every export column except last4, in canonical order", () => {
    expect(DEFAULT_EXPORT_COLUMNS).toEqual(
      EXPORT_COLUMNS.filter((column) => column !== "last4"),
    )
  })
})

describe("parseExportOptions", () => {
  it("defaults to every column except last4 and the current filter", () => {
    const result = parseExportOptions(params(""))
    expect(result).toEqual({
      ok: true,
      options: { columns: [...DEFAULT_EXPORT_COLUMNS], scope: "filter" },
    })
  })

  it("keeps the requested columns in the requested order", () => {
    const result = parseExportOptions(params("columns=amount,id,last4"))
    expect(result).toEqual({
      ok: true,
      options: { columns: ["amount", "id", "last4"], scope: "filter" },
    })
  })

  it("rejects an empty column list", () => {
    const result = parseExportOptions(params("columns="))
    expect(result.ok).toBe(false)
  })

  it("rejects an unknown column without echoing it back", () => {
    const result = parseExportOptions(params("columns=id,drop_table"))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).not.toContain("drop_table")
  })

  it("rejects a column that only differs by case or whitespace", () => {
    expect(parseExportOptions(params("columns=ID")).ok).toBe(false)
    expect(parseExportOptions(params("columns=id,%20amount")).ok).toBe(false)
  })

  it("rejects an empty entry inside the list", () => {
    expect(parseExportOptions(params("columns=id,,amount")).ok).toBe(false)
  })

  it("rejects a column named twice", () => {
    expect(parseExportOptions(params("columns=id,amount,id")).ok).toBe(false)
  })

  it("rejects columns sent as more than one parameter", () => {
    expect(parseExportOptions(params("columns=id&columns=amount")).ok).toBe(false)
  })

  it("accepts scope=filter and scope=all", () => {
    const filter = parseExportOptions(params("scope=filter"))
    const all = parseExportOptions(params("scope=all"))
    expect(filter.ok && filter.options.scope).toBe("filter")
    expect(all.ok && all.options.scope).toBe("all")
  })

  it("rejects an unknown, empty or repeated scope", () => {
    expect(parseExportOptions(params("scope=everything")).ok).toBe(false)
    expect(parseExportOptions(params("scope=")).ok).toBe(false)
    expect(parseExportOptions(params("scope=all&scope=filter")).ok).toBe(false)
  })
})

describe("exportLabel", () => {
  it("names the status when one is set", () => {
    expect(exportLabel("filter", { status: "disputed" })).toBe("disputed")
  })

  it("says filtered when another filter narrows the rows", () => {
    expect(exportLabel("filter", { status: "all", search: "lumen" })).toBe("filtered")
    expect(exportLabel("filter", { merchantId: "mch_02" })).toBe("filtered")
    expect(exportLabel("filter", { from: "2026-08-01T00:00:00.000Z" })).toBe("filtered")
  })

  it("says all when nothing narrows the rows, including blank search", () => {
    expect(exportLabel("filter", { status: "all" })).toBe("all")
    expect(exportLabel("filter", { search: "   " })).toBe("all")
  })

  it("says all for scope=all even when a filter is set", () => {
    expect(exportLabel("all", { status: "disputed", search: "lumen" })).toBe("all")
  })
})

describe("exportFilename with a scope label (NWP-101)", () => {
  const date = new Date("2026-03-14T23:00:00.000Z")

  it("puts the status in the filename", () => {
    expect(exportFilename(date, "disputed")).toBe("payments-disputed-2026-03-14.csv")
  })

  it("puts filtered in the filename for a non-status filter", () => {
    expect(exportFilename(date, "filtered")).toBe("payments-filtered-2026-03-14.csv")
  })

  it("puts all in the filename for every payment", () => {
    expect(exportFilename(date, "all")).toBe("payments-all-2026-03-14.csv")
  })

  it("refuses a label that could break out of the content-disposition header", () => {
    expect(() =>
      exportFilename(date, 'x"\r\nSet-Cookie: a=b' as ExportLabel),
    ).toThrow()
  })
})
