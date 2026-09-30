import { useRef, useState } from "react"
import { Dialog, Heading, Modal, ModalOverlay } from "react-aria-components"
import { X, ArrowRight, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  categories,
  entrySchema,
  MAX_AMOUNT,
  money,
  monthAt,
  period,
  schedule,
  today,
  type Entry,
} from "@/lib/ledger"
import type { Repository } from "@/lib/repository"

type Props = {
  entry?: Entry
  month: string
  cards: string[]
  repository: Repository
  close: () => void
  saved: (message: string) => void
}
export function EntryForm({
  entry,
  month,
  cards,
  repository,
  close,
  saved,
}: Props) {
  const [kind, setKind] = useState<Entry["kind"]>(entry?.kind ?? "expense")
  const [amount, setAmount] = useState(String(entry?.amount ?? ""))
  const [count, setCount] = useState(entry?.installments ?? 1)
  const [start, setStart] = useState(entry ? monthAt(entry.startPeriod) : month)
  const [excluded, setExcluded] = useState(entry?.excluded ?? false)
  const [busy, setBusy] = useState(false)
  const lock = useRef(false)
  const [error, setError] = useState("")
  const [confirmDelete, setConfirmDelete] = useState(false)
  const id = useRef(entry?.id ?? crypto.randomUUID())
  let preview: ReturnType<typeof schedule> = []
  try {
    preview = schedule(Number(amount), count, period(start))
  } catch {
    /* incomplete form */
  }
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (lock.current) return
    const form = new FormData(event.currentTarget)
    try {
      const startPeriod = period(start)
      const value = entrySchema.parse({
        id: id.current,
        title: form.get("title"),
        kind,
        amount: Number(amount),
        date: form.get("date"),
        startPeriod,
        endPeriod: startPeriod + count - 1,
        installments: count,
        category: form.get("category"),
        card: kind === "expense" ? String(form.get("card") ?? "").trim() : "",
        note: form.get("note"),
        excluded,
        exclusionReason: excluded ? form.get("reason") : "",
        revision: (entry?.revision ?? 0) + 1,
      })
      lock.current = true
      setBusy(true)
      setError("")
      await repository.save(value, entry?.revision ?? null)
      saved(entry ? "거래를 수정했습니다." : "거래를 저장했습니다.")
      close()
    } catch (e) {
      setError(
        e instanceof Error && "issues" in e
          ? "입력값을 확인하세요. 금액은 원 단위 양수, 할부는 최대 60회입니다."
          : e instanceof Error
            ? e.message
            : "저장에 실패했습니다. 다시 시도하세요."
      )
    } finally {
      lock.current = false
      setBusy(false)
    }
  }
  async function remove() {
    if (!entry || lock.current) return
    lock.current = true
    setBusy(true)
    setError("")
    try {
      await repository.remove(entry)
      saved("거래를 삭제했습니다.")
      close()
    } catch (e) {
      setError(e instanceof Error ? e.message : "삭제에 실패했습니다.")
    } finally {
      lock.current = false
      setBusy(false)
    }
  }
  return (
    <ModalOverlay
      isOpen
      isDismissable={!busy}
      onOpenChange={(open) => {
        if (!open && !busy) close()
      }}
      className="modal-overlay"
    >
      <Modal className="modal">
        <Dialog className="dialog">
          <div className="dialog-header">
            <div>
              <p className="eyebrow">MY ACCOUNT</p>
              <Heading slot="title">
                {entry ? "거래 수정" : "새 거래 기록"}
              </Heading>
            </div>
            <Button
              variant="ghost"
              size="icon"
              aria-label="닫기"
              onPress={close}
              isDisabled={busy}
            >
              <X />
            </Button>
          </div>
          <form onSubmit={submit}>
            <div className="segmented" aria-label="거래 유형">
              {(
                [
                  ["expense", "지출"],
                  ["income", "수입"],
                  ["transfer", "이체"],
                ] as const
              ).map(([value, label]) => (
                <Button
                  key={value}
                  variant="ghost"
                  aria-pressed={kind === value}
                  onPress={() => {
                    setKind(value)
                    if (value !== "expense") setCount(1)
                  }}
                  isDisabled={busy}
                >
                  {label}
                </Button>
              ))}
            </div>
            <label className="amount-field">
              금액 <span>원</span>
              <input
                name="amount"
                aria-label="금액"
                type="number"
                inputMode="numeric"
                min={count}
                max={MAX_AMOUNT}
                step="1"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
                autoFocus
              />
            </label>
            <label>
              항목
              <input
                name="title"
                required
                maxLength={100}
                defaultValue={entry?.title}
                placeholder="어디에 사용하셨나요?"
              />
            </label>
            <div className="form-grid">
              <label>
                거래일
                <input
                  name="date"
                  type="date"
                  min="1900-01-01"
                  max="2100-12-31"
                  required
                  defaultValue={entry?.date ?? today()}
                />
              </label>
              <label>
                {count > 1 ? "첫 귀속월" : "귀속월"}
                <input
                  aria-label="귀속월"
                  type="month"
                  min="1900-01"
                  max="2100-12"
                  value={start}
                  required
                  onChange={(e) => setStart(e.target.value)}
                />
              </label>
            </div>
            <div className="form-grid">
              <label>
                분류
                <input
                  name="category"
                  list="category-list"
                  maxLength={40}
                  required
                  key={kind}
                  defaultValue={
                    entry?.kind === kind
                      ? entry.category
                      : kind === "income"
                        ? "급여"
                        : kind === "transfer"
                          ? "계좌 이체"
                          : "식비"
                  }
                />
                <datalist id="category-list">
                  {(kind === "expense"
                    ? categories
                    : kind === "income"
                      ? ["급여", "기타 수입"]
                      : ["계좌 이체", "카드대금"]
                  ).map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </datalist>
              </label>
              {kind === "expense" && (
                <label>
                  결제수단
                  <input
                    name="card"
                    list="card-list"
                    maxLength={40}
                    defaultValue={entry?.card}
                    placeholder="현금·계좌 (카드명 입력 가능)"
                  />
                  <datalist id="card-list">
                    {cards.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </datalist>
                </label>
              )}
            </div>
            {kind === "expense" && (
              <label>
                결제 방식
                <select
                  aria-label="결제 방식"
                  value={count}
                  onChange={(e) => setCount(Number(e.target.value))}
                >
                  {Array.from({ length: 60 }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={n}>
                      {n === 1 ? "일시불" : `${n}개월 할부`}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {count > 1 && (
              <div className="installment-preview">
                <div className="section-label">
                  할부 미리보기 <span>총 {money(Number(amount) || 0)}원</span>
                </div>
                <p>
                  마지막 회차에 나머지를 반영합니다. 수정·삭제는 전체 회차에
                  적용됩니다.
                </p>
                <div className="schedule">
                  {preview.map((s, i) => (
                    <div key={s.month}>
                      <span>
                        {i + 1}회 · {s.month}
                      </span>
                      <ArrowRight size={12} />
                      <strong>{money(s.amount)}원</strong>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <label>
              메모 <span className="optional">선택</span>
              <textarea
                name="note"
                rows={2}
                maxLength={500}
                defaultValue={entry?.note}
                placeholder="기억해 둘 내용을 남겨보세요."
              />
            </label>
            <label className="check-label">
              <input
                type="checkbox"
                checked={excluded}
                onChange={(e) => setExcluded(e.target.checked)}
              />{" "}
              월 수지 집계에서 제외
            </label>
            {excluded && (
              <label>
                제외 사유
                <input
                  name="reason"
                  required
                  maxLength={100}
                  defaultValue={entry?.exclusionReason}
                  placeholder="예: 사업 비용"
                />
              </label>
            )}
            {kind === "transfer" && (
              <p className="hint">
                계좌 간 이체·카드대금 납부는 수입과 지출에 합산하지 않습니다.
              </p>
            )}
            {error && (
              <p role="alert" className="error">
                {error}
              </p>
            )}
            {confirmDelete && (
              <div className="delete-confirm">
                <p>
                  ‘{entry?.title}’
                  {count > 1 ? "의 전체 할부 회차를" : " 거래를"} 삭제할까요?
                  삭제 후 복원할 수 없습니다.
                </p>
                <Button
                  variant="destructive"
                  isDisabled={busy}
                  onPress={remove}
                >
                  삭제 확인
                </Button>
                <Button
                  variant="ghost"
                  isDisabled={busy}
                  onPress={() => setConfirmDelete(false)}
                >
                  돌아가기
                </Button>
              </div>
            )}
            <div className="dialog-footer">
              {entry && (
                <Button
                  variant="ghost"
                  aria-label="거래 삭제"
                  isDisabled={busy}
                  onPress={() => setConfirmDelete(true)}
                >
                  <Trash2 size={16} />
                </Button>
              )}
              <div className="spacer" />
              <Button variant="outline" isDisabled={busy} onPress={close}>
                취소
              </Button>
              <Button type="submit" isDisabled={busy}>
                {busy ? "저장 중…" : "저장하기"}
              </Button>
            </div>
          </form>
        </Dialog>
      </Modal>
    </ModalOverlay>
  )
}
