import { z } from "zod"

export const MAX_AMOUNT = 999_999_999_999
export const categories = [
  "식비",
  "카페·간식",
  "생활·쇼핑",
  "교통",
  "주거·통신",
  "건강",
  "문화·여가",
  "교육",
  "기타",
]
export const money = (value: number) =>
  new Intl.NumberFormat("ko-KR").format(value)
export const currentMonth = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
}
export const today = () => {
  const d = new Date()
  return `${currentMonth()}-${String(d.getDate()).padStart(2, "0")}`
}
export function period(month: string) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))
    throw new Error("올바른 연월을 입력하세요.")
  const [y, m] = month.split("-").map(Number)
  if (y < 1900 || y > 2100)
    throw new Error("1900~2100년 사이의 연월을 입력하세요.")
  return y * 12 + m - 1
}
export function monthAt(p: number) {
  return `${Math.floor(p / 12)}-${String((p % 12) + 1).padStart(2, "0")}`
}
export function validDate(date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false
  const d = new Date(`${date}T12:00:00Z`)
  return (
    !isNaN(d.getTime()) &&
    d.toISOString().slice(0, 10) === date &&
    date >= "1900-01-01" &&
    date <= "2100-12-31"
  )
}
export const entrySchema = z
  .object({
    id: z.string().min(1).max(100),
    title: z.string().trim().min(1, "항목을 입력하세요.").max(100),
    kind: z.enum(["expense", "income", "transfer"]),
    amount: z.number().int().min(1).max(MAX_AMOUNT),
    date: z.string().refine(validDate, "올바른 거래일을 입력하세요."),
    startPeriod: z.number().int().min(22800).max(25211),
    endPeriod: z.number().int().min(22800).max(25211),
    installments: z.number().int().min(1).max(60),
    category: z.string().trim().min(1).max(40),
    card: z.string().trim().max(40),
    note: z.string().max(500),
    excluded: z.boolean(),
    exclusionReason: z.string().max(100),
    revision: z.number().int().min(1),
  })
  .strict()
  .superRefine((e, ctx) => {
    if (e.endPeriod !== e.startPeriod + e.installments - 1)
      ctx.addIssue({ code: "custom", message: "할부 기간이 맞지 않습니다." })
    if (e.amount < e.installments)
      ctx.addIssue({
        code: "custom",
        message: "총액은 할부 횟수 이상이어야 합니다.",
      })
    if (e.kind !== "expense" && e.installments !== 1)
      ctx.addIssue({ code: "custom", message: "할부는 지출에만 적용됩니다." })
    if (e.excluded && !e.exclusionReason.trim())
      ctx.addIssue({ code: "custom", message: "집계 제외 사유를 입력하세요." })
  })
export type Entry = z.infer<typeof entrySchema>
export type Row = Entry & { monthlyAmount: number; sequence: number }
export function schedule(amount: number, count: number, start: number) {
  if (
    !Number.isSafeInteger(amount) ||
    amount < count ||
    amount > MAX_AMOUNT ||
    !Number.isInteger(count) ||
    count < 1 ||
    count > 60 ||
    !Number.isInteger(start)
  )
    throw new Error("할부 금액·횟수를 확인하세요.")
  const base = Math.floor(amount / count)
  return Array.from({ length: count }, (_, i) => ({
    month: monthAt(start + i),
    amount: base + (i === count - 1 ? amount % count : 0),
  }))
}
export function rowsFor(entries: Entry[], month: string): Row[] {
  const p = period(month)
  return entries
    .filter((e) => e.startPeriod <= p && e.endPeriod >= p)
    .map((e) => ({
      ...e,
      sequence: p - e.startPeriod + 1,
      monthlyAmount: schedule(e.amount, e.installments, e.startPeriod)[
        p - e.startPeriod
      ].amount,
    }))
    .sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id))
}
export function totals(rows: Row[]) {
  const sum = (predicate: (e: Row) => boolean) =>
    rows.filter(predicate).reduce((n, e) => n + e.monthlyAmount, 0)
  const income = sum((e) => e.kind === "income" && !e.excluded)
  const expense = sum((e) => e.kind === "expense" && !e.excluded)
  return {
    income,
    expense,
    balance: income - expense,
    excluded: sum((e) => e.excluded || e.kind === "transfer"),
    installments: sum(
      (e) => e.kind === "expense" && e.installments > 1 && !e.excluded
    ),
  }
}
export const backupSchema = z
  .object({ version: z.literal(1), entries: z.array(entrySchema).max(10000) })
  .strict()
  .superRefine((v, ctx) => {
    if (new Set(v.entries.map((e) => e.id)).size !== v.entries.length)
      ctx.addIssue({ code: "custom", message: "중복된 거래 ID가 있습니다." })
  })
