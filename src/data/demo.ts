import { currentMonth, period, type Entry } from "@/lib/ledger"
export function demoEntries(): Entry[] {
  const m = currentMonth()
  const p = period(m)
  const data: [string, number, string, string, number, Entry["kind"]][] = [
    ["월 급여", 4200000, "급여", "", 25, "income"],
    ["사이드 프로젝트", 450000, "기타 수입", "", 20, "income"],
    ["동네 마트", 68400, "식비", "생활 카드", 28, "expense"],
    ["커피 한 잔", 5500, "카페·간식", "생활 카드", 28, "expense"],
    ["주말 저녁 식사", 42000, "식비", "생활 카드", 27, "expense"],
    ["정기 교통비", 65000, "교통", "", 26, "expense"],
    ["휴대폰 요금", 59000, "주거·통신", "생활 카드", 25, "expense"],
    ["책과 문구", 32800, "문화·여가", "생활 카드", 24, "expense"],
    ["월세", 750000, "주거·통신", "", 21, "expense"],
    ["온라인 장보기", 84700, "식비", "생활 카드", 18, "expense"],
    ["운동 수업", 120000, "건강", "생활 카드", 15, "expense"],
    ["가을 옷", 139000, "생활·쇼핑", "생활 카드", 12, "expense"],
    ["점심 식사", 12500, "식비", "", 10, "expense"],
    ["저축 계좌로 이체", 500000, "계좌 이체", "", 5, "transfer"],
  ]
  return data
    .map(([title, amount, category, card, day, kind], i) => ({
      id: `demo-${i}`,
      title,
      amount,
      category,
      card,
      kind,
      date: `${m}-${String(day).padStart(2, "0")}`,
      startPeriod: p,
      endPeriod: p,
      installments: 1,
      note: "체험용 예시 데이터",
      excluded: false,
      exclusionReason: "",
      revision: 1,
    }))
    .concat({
      id: "demo-installment",
      title: "노트북",
      amount: 1500000,
      category: "생활·쇼핑",
      card: "생활 카드",
      kind: "expense",
      date: `${m}-03`,
      startPeriod: p,
      endPeriod: p + 5,
      installments: 6,
      note: "체험용 예시 데이터",
      excluded: false,
      exclusionReason: "",
      revision: 1,
    })
}
