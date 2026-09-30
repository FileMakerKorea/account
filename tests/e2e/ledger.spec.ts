import { expect, test } from "@playwright/test"
test("create, reload, edit, exclude, delete and cancel a transaction", async ({
  page,
}) => {
  await page.goto("/")
  await page.getByRole("button", { name: "거래 추가", exact: true }).click()
  await page.getByLabel("금액", { exact: true }).fill("12345")
  await page.getByLabel("항목", { exact: true }).fill("테스트 점심")
  await page.getByRole("button", { name: "저장하기" }).click()
  await expect(
    page.getByRole("button", { name: "테스트 점심", exact: true })
  ).toBeVisible()
  await expect(page.locator(".metric").nth(1)).toContainText("12,345")
  await page.reload()
  await page.getByRole("button", { name: "테스트 점심", exact: true }).click()
  await page.getByLabel("금액", { exact: true }).fill("15000")
  await page.getByLabel("월 수지 집계에서 제외").check()
  await page.getByLabel("제외 사유").fill("사업 비용")
  await page.getByRole("button", { name: "저장하기" }).click()
  await expect(page.locator(".metric").nth(1)).toContainText("0 원")
  await expect(page.getByText("집계 제외 · 사업 비용")).toBeVisible()
  await page.getByRole("button", { name: "거래 추가", exact: true }).click()
  await page.getByLabel("항목", { exact: true }).fill("취소할 거래")
  await page.getByRole("button", { name: "취소", exact: true }).click()
  await expect(
    page.getByRole("button", { name: "취소할 거래", exact: true })
  ).toHaveCount(0)
  await page.getByRole("button", { name: "테스트 점심", exact: true }).click()
  await page.getByRole("button", { name: "거래 삭제" }).click()
  await page.getByRole("button", { name: "삭제 확인" }).click()
  await expect(
    page.getByRole("button", { name: "테스트 점심", exact: true })
  ).toHaveCount(0)
})
test("installment spans years and keeps exact principal", async ({ page }) => {
  await page.goto("/")
  await page.getByLabel("조회 월").fill("2026-11")
  await page.getByRole("button", { name: "거래 추가", exact: true }).click()
  await page.getByLabel("금액", { exact: true }).fill("100000")
  await page.getByLabel("항목", { exact: true }).fill("연말 할부")
  await page.getByLabel("결제 방식").selectOption("3")
  await expect(page.locator(".schedule")).toContainText("2027-01")
  await expect(page.locator(".schedule")).toContainText("33,334")
  await page.getByRole("button", { name: "저장하기" }).click()
  await page.getByLabel("조회 월").fill("2027-01")
  await expect(page.locator(".metric").nth(1)).toContainText("33,334")
  await page.getByLabel("조회 월").fill("2027-02")
  await expect(
    page.getByRole("button", { name: "연말 할부", exact: true })
  ).toHaveCount(0)
})
test("demo filters, mobile menu and theme", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" })
  await page.goto("/")
  await page.getByRole("button", { name: "예시 데이터로 둘러보기" }).click()
  await expect(page.locator("tbody tr")).toHaveCount(8)
  await page.getByLabel("거래 검색").fill("월세")
  await expect(page.locator("tbody tr")).toHaveCount(1)
  await page.getByRole("button", { name: "다크 모드", exact: true }).click()
  await expect(page.locator("html")).toHaveClass(/dark/)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByRole("button", { name: "메뉴 열기" }).click()
  await page.getByRole("button", { name: "카드 관리", exact: true }).click()
  await expect(
    page.getByRole("heading", { name: "카드 관리", exact: true })
  ).toBeVisible()
  await expect(page.locator(".sidebar")).toHaveCSS("visibility", "hidden")
  await page.getByRole("button", { name: "알림 닫기" }).click()
  await page.screenshot({
    path: "test-results/mobile-dark.png",
    fullPage: true,
  })
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    390
  )
})
test("two open editors detect a stale revision", async ({ page, context }) => {
  await page.goto("/")
  await page.getByRole("button", { name: "예시 데이터로 둘러보기" }).click()
  const second = await context.newPage()
  await second.goto("/")
  await page.getByRole("button", { name: "동네 마트", exact: true }).click()
  await second.getByRole("button", { name: "동네 마트", exact: true }).click()
  await page.getByLabel("금액", { exact: true }).fill("100")
  await page.getByRole("button", { name: "저장하기" }).click()
  await second.getByLabel("금액", { exact: true }).fill("200")
  await second.getByRole("button", { name: "저장하기" }).click()
  await expect(second.getByRole("alert")).toContainText(
    "다른 화면에서 거래가 변경"
  )
  await expect(second.getByRole("dialog")).toBeVisible()
})
test("backup import validates atomically and export preserves the records", async ({
  page,
}) => {
  await page.goto("/#settings")
  const now = new Date()
  const p = now.getFullYear() * 12 + now.getMonth()
  const entry = {
    id: "backup-one",
    title: "복원된 거래",
    kind: "expense",
    amount: 1234,
    date: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`,
    startPeriod: p,
    endPeriod: p,
    installments: 1,
    category: "기타",
    card: "",
    note: "",
    excluded: false,
    exclusionReason: "",
    revision: 1,
  }
  const upload = async (entries: object[]) =>
    page.locator("input[type=file]").setInputFiles({
      name: "backup.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify({ version: 1, entries })),
    })
  await upload([entry])
  await expect(page.getByRole("status")).toContainText("1건을 가져왔습니다.")
  await upload([
    { ...entry, id: "new-but-rollback", title: "취소되어야 함" },
    entry,
  ])
  await expect(page.getByRole("status")).toContainText("같은 ID의 거래")
  const downloadPromise = page.waitForEvent("download")
  await page.getByRole("button", { name: "JSON 내보내기" }).click()
  const download = await downloadPromise
  const stream = await download.createReadStream()
  let content = ""
  for await (const chunk of stream!) content += chunk.toString()
  expect(JSON.parse(content).entries).toEqual([entry])
  await upload([{ ...entry, id: "invalid", amount: -1 }])
  await expect(page.getByRole("status")).toContainText("가져오지 못했습니다.")
  await page.getByRole("button", { name: "월별 현황", exact: true }).click()
  await expect(page.locator("tbody tr")).toHaveCount(1)
})
