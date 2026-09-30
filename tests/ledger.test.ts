import { describe, expect, it } from "vitest"
import {
  backupSchema,
  entrySchema,
  period,
  rowsFor,
  schedule,
  totals,
  validDate,
  type Entry,
} from "../src/lib/ledger"
const base: Entry = {
  id: "one",
  title: "노트북",
  kind: "expense",
  amount: 100000,
  date: "2026-11-30",
  startPeriod: period("2026-11"),
  endPeriod: period("2027-01"),
  installments: 3,
  category: "생활",
  card: "생활 카드",
  note: "",
  excluded: false,
  exclusionReason: "",
  revision: 1,
}
describe("installment accounting", () => {
  it("preserves principal and crosses a year boundary", () => {
    expect(schedule(100000, 3, period("2026-11"))).toEqual([
      { month: "2026-11", amount: 33333 },
      { month: "2026-12", amount: 33333 },
      { month: "2027-01", amount: 33334 },
    ])
  })
  it("handles a five year schedule without repeated year increments", () => {
    const plan = schedule(100001, 60, period("2026-11"))
    expect(plan.at(-1)?.month).toBe("2031-10")
    expect(plan.reduce((s, p) => s + p.amount, 0)).toBe(100001)
    expect(new Set(plan.map((p) => p.month)).size).toBe(60)
  })
  it("assigns only one payment to each month", () => {
    expect(rowsFor([base], "2026-10")).toHaveLength(0)
    expect(rowsFor([base], "2027-01")[0].monthlyAmount).toBe(33334)
    expect(rowsFor([base], "2027-02")).toHaveLength(0)
  })
  it("excludes transfers and excluded expenses from monthly balance", () => {
    const income = {
      ...base,
      id: "income",
      kind: "income" as const,
      installments: 1,
      amount: 1000000,
      endPeriod: base.startPeriod,
    }
    const transfer = {
      ...income,
      id: "transfer",
      kind: "transfer" as const,
      amount: 100000,
    }
    const excluded = {
      ...base,
      id: "excluded",
      excluded: true,
      exclusionReason: "사업",
    }
    expect(
      totals(rowsFor([base, income, transfer, excluded], "2026-11"))
    ).toEqual({
      income: 1000000,
      expense: 33333,
      balance: 966667,
      excluded: 133333,
      installments: 33333,
    })
  })
  it("rejects fractions, invalid counts and smaller-than-count amounts", () => {
    for (const [a, n] of [
      [1, 2],
      [10.5, 3],
      [100, 0],
      [100, 61],
    ])
      expect(() => schedule(a, n, period("2026-01"))).toThrow()
  })
})
describe("input and backup integrity", () => {
  it("validates leap days and actual month lengths", () => {
    expect(validDate("2024-02-29")).toBe(true)
    expect(validDate("2026-02-29")).toBe(false)
    expect(validDate("2026-04-31")).toBe(false)
  })
  it("rejects forged schedules, unsafe values and missing exclusion reasons", () => {
    for (const changes of [
      { endPeriod: base.startPeriod },
      { amount: Number.MAX_SAFE_INTEGER },
      { amount: 0 },
      { kind: "income" },
      { excluded: true },
    ])
      expect(entrySchema.safeParse({ ...base, ...changes }).success).toBe(false)
  })
  it("rejects duplicate IDs and unknown backup schemas", () => {
    expect(
      backupSchema.safeParse({ version: 1, entries: [base, base] }).success
    ).toBe(false)
    expect(
      backupSchema.safeParse({ version: 2, entries: [base] }).success
    ).toBe(false)
  })
})
