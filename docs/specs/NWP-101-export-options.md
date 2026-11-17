# SPEC · NWP-101 - Payments export: choose columns and scope

> Written before any code. Generated with `/spec`, then edited by a human.
> Load it as context when you build: `@docs/specs/NWP-101-export-options.md`

**Ticket:** [NWP-101](../tickets/NWP-101.md)
**Author:** Scott Riker Deutsch
**Status:** reviewed (plan approved 17 Nov 2026; build not started)

All code paths below are relative to `build-battle/merchant-console/`.

## Problem

Ops exports payments several times a day for merchant queries and month-end reconciliation, but the export is fixed: every column, current filter only. Card last-four is in every file, so anything sent to a merchant gets cleaned by hand first. That costs Dana's team 3-4 hours a month, and last quarter an unedited file nearly went to the wrong merchant.

## Current state

- `src/app/payments/page.tsx:69` - Export is a plain link to `/api/payments/export` carrying the page's raw query string. No dialog, no options.
- `src/app/api/payments/export/route.ts:11` - validates filters with `parseFilters`, then `filterPayments` + `sortPayments`. It skips `paginate`, so the file already covers every matching row, not one page. Column set and filename are fixed.
- `src/data/queries.ts:18` `parseFilters` is the allowlist for status, sort and direction. `:45` `filterPayments`, `:72` `sortPayments`, `:102` `queryPayments` (returns `total`) are the one query builder.
- `src/app/api/payments/route.ts:4` - `GET /api/payments` returns `queryPayments(...)`, including `total`. This gives the row count for free.
- `src/lib/csv.ts:13` `EXPORT_COLUMNS` (10 columns, includes `last4`). `:58` `toCsv(payments, columns)` already accepts a column subset. `:69` `exportFilename(date)` always returns `payments-YYYY-MM-DD.csv`.
- `src/lib/csv.test.ts` - pins escaping, column order, empty-card cells and the UTC filename. Its header says these must still pass after NWP-101.
- `src/lib/money.ts:15` `formatMoney` is already the single formatter. `toCsv` calls it once per amount cell, and `currency` is already its own column.
- **Mismatch with the docs:** `.claude/rules/components.md` says `src/components/` has a Dialog. It does not. `@radix-ui/react-dialog` is installed and `src/components/Drawer.tsx` wraps it. `Drawer.tsx:55` also uses `animate-dialogOverlayShow`, which `tailwind.config.ts` does not define, so a new Dialog must only use animation classes that exist.
- **Mismatch in the page:** `page.tsx:21` keeps its own status allowlist instead of calling `parseFilters`, and drops `from`, `to`, `sort` and `direction`. The export uses `parseFilters`, so the table and the file can disagree on order and on row count. Measured on the dev server: `/payments?from=2026-08-01T00:00:00.000Z` shows 1,658 in the footer, and the export of that URL returns 167 rows.
- **No error shape yet:** no handler under `src/app/api/` returns an error today, so this ticket sets the shape.
- **Existing bug, not this ticket:** `queries.ts:81` sorts amounts as text (`9000` above `10000`).

## Domain rules

| Rule | Source | What breaks if ignored |
| --- | --- | --- |
| "Anything from the client - column names, currencies, limits, statuses - is checked against an allowlist before it reaches a query, a filename, or the store." | `merchant-console/CLAUDE.md` | Arbitrary input in SQL or a `content-disposition` header |
| "Column names arrive from the client, so validate them server-side." | NWP-101 notes | Same |
| "Payment filtering goes through the builder behind `GET /api/payments`. A second implementation is a bug." | `merchant-console/CLAUDE.md` | Export and table disagree; points lost |
| "Money is integer minor units ... Format once, at the edge, next to its currency code." | `merchant-console/CLAUDE.md` | Amounts drift or get formatted twice |
| "Building this in the browser exports the current page only." | NWP-101 notes | Ships the bug instead of the feature |
| "Dialogs and forms must be operable": labels, accessible name, focus in and back, Escape closes. | `.claude/rules/components.md` | Fails review |

## Approach

Keep the export on the server and add two validated parameters to `GET /api/payments/export`: `columns` (comma-separated, each checked against `EXPORT_COLUMNS`) and `scope` (`filter` or `all`). `scope=all` calls the same builder with empty filters and keeps the requested sort. Unknown columns, a repeated column, an empty column list, or an unknown scope return 400 with `{ error: string }`. No `columns` param means every column except `last4`. `toCsv` also refuses an empty column list, so no code path can write a file with no columns. The filename comes only from validated values: the status when one is set, else `filtered` when another filter is active, else `all`, plus the UTC date. Search text never goes in a filename. In the browser, the Export button opens a small dialog with labelled checkboxes and a scope radio. The row count comes from `GET /api/payments` (`total`) with the same query, and Download is disabled while no column is ticked.

**Considered and rejected:** building the CSV in the browser from the rows already on screen. The table is paginated (`PAGE_SIZE` 20), so this would export one page, and it would bypass server validation. That's the exact failure the ticket warns about.

## File map

| File | Add or change | Why |
| --- | --- | --- |
| `src/lib/csv.ts` | Change | `parseExportOptions` checks `columns` and `scope` against allowlists. `DEFAULT_EXPORT_COLUMNS` is every column except `last4`. `exportFilename(date, label?)` takes a validated scope label, and with no label it behaves as today so the existing test still passes. `toCsv` throws on an empty column list; its own default stays `EXPORT_COLUMNS` because the existing header test pins it |
| `src/lib/csv.test.ts` | Change | Extend (don't replace): a subset of columns in the requested order, last-four excluded by default, an empty selection; then unknown and repeated columns, scope, and filename variants |
| `src/app/api/payments/export/route.ts` | Change | Read and validate `columns` and `scope`, return 400 on bad input, pass the filename through |
| `src/components/Dialog.tsx` | Add | Tremor-style wrapper over `@radix-ui/react-dialog`, same pattern as `Drawer.tsx`. No new dependency |
| `src/app/payments/export-dialog.tsx` | Add | Client component: checkboxes, scope radios, row count, Download |
| `src/app/payments/page.tsx` | Change | Replace the Export link with the dialog, passing the current query |

## Plan

Order set by the engineer: route and validation first, dialog second, tests after.

1. **Validation and route** (`csv.ts`, `export/route.ts`) - done when: `/api/payments/export?columns=id,amount&status=disputed` downloads `payments-disputed-<date>.csv` with two columns and 33 rows, `columns=id,drop_table`, `columns=id,id`, `columns=` and `scope=everything` each return 400 with `{ error }`, a bare export has no `last4` header, and `scope=all` returns all 1,658 payments.
2. **Dialog component** - done when: it opens, takes focus, closes on Escape, and returns focus to the Export button.
3. **Export dialog on `/payments`** - done when: last-four is unticked on open, the row count matches what the export returns for the current filter and 1,658 for all payments, Download is disabled with nothing ticked, and the downloaded file matches the choices.
4. **Run `npm test`** - done when: the existing 28 tests still pass before any new test is added.
5. **Add tests to `csv.test.ts`** - done when: there are cases for a subset of columns in the requested order, last-four excluded by default, and an empty selection (parser and serializer), plus unknown and repeated columns, scope, and filenames for `disputed`, `filtered` and `all`.
6. **Run `npm test` again and check yourself** - `npm test` summary, `npm run lint`, `npx tsc --noEmit`, the dialog checked in the browser, then `/ship-ready` before the PR.

## Verification

| Acceptance criterion | How it is proven |
| --- | --- |
| Choose columns; last-four off by default | `csv.test.ts` default-set case; open the dialog and see last-four unticked; a bare export link has no `last4` header |
| Scope: current filter (default) or all; row count before download | Dialog opens on current filter; count equals the rows in the downloaded file (and the table footer, for every filter the UI can set); switching to all shows 1,658 |
| Filename reflects scope and date | `csv.test.ts` filename cases; download with status=disputed and check the name |
| Minor units internally, formatted once, currency in its own column | `formatMoney` stays the only formatter, called once in `toCsv`; existing `$250.00` and `"$1,234,567.89"` tests still pass |
| No columns disables Download | Untick all and Download is disabled; the server also returns 400 for `columns=` |

## Risks

- **Row count drift:** the table builds its filters in `page.tsx:21`, not `parseFilters`. Counting through `GET /api/payments` with the same query keeps the count equal to what the export will return.
- **Header injection:** the filename sits inside `content-disposition`. Only allowlisted words and the date may reach it.
- **Breaking old links:** a link without `columns` now silently drops `last4`. This is intended, and the PR must say so.
- **Copying a broken pattern:** the close button at `src/components/Drawer.tsx:113` is icon-only with no accessible name. The new Dialog must give its close button an `aria-label` or screen-reader text.

## Out of scope

- The text-based amount sort at `queries.ts:81` (flag it in the PR; separate fix).
- Moving `page.tsx` onto `parseFilters`.
- Saved export presets, other formats (XLSX), and anything on NWP-102.
- Pre-existing issues from a baseline `/ship-ready` run on 17 Nov, before any NWP-101 code: float math and cross-currency sums in `src/data/metrics.ts:31,53,73` and `src/data/analytics.ts:54,73,126`; day buckets in server local time at `src/data/metrics.ts:25`; a second payments sort at `src/app/overview/page.tsx:20`; unlabelled controls in `filter-bar.tsx:52,66,84`, `period-controls.tsx:17`, `AppSidebar.tsx:75`, `Sidebar.tsx:150`, `BarChart.tsx:175` and `ComboChart.tsx:180`. List them in the PR under "Bugs fixed along the way" only if fixed; otherwise note them for the reviewer.

## Open questions

- **Resolved:** `scope=all` keeps the requested sort and direction, since only the filter changes.
- **Resolved:** no route handler returns an error today (checked `src/app/api/`), so the shape is `{ error: string }` with status 400.
- **Resolved:** the amount cell stays `formatMoney` output with a symbol (`€52.44`, `"$1,234.56"`), next to the `currency` column. `formatMoney` is the single formatter and existing tests pin its output; a plain decimal would need a second formatter.
