import { useEffect, useMemo, useRef, useState } from "react"
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from "firebase/auth"
import {
  ArrowDownLeft,
  ArrowUpRight,
  ArrowLeftRight,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Download,
  LayoutDashboard,
  ListFilter,
  ListOrdered,
  LogOut,
  Menu,
  Moon,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  Sun,
  Upload,
  Wallet,
  X,
  CircleHelp,
  Landmark,
  ArrowRight,
  Inbox,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { EntryForm } from "@/components/entry-form"
import { useTheme } from "@/components/theme-provider"
import { auth, firebaseConfigured } from "@/lib/firebase"
import {
  cloudRepository,
  importLocal,
  localRepository,
  type Repository,
} from "@/lib/repository"
import {
  backupSchema,
  currentMonth,
  money,
  monthAt,
  period,
  rowsFor,
  totals,
  type Entry,
  type Row,
} from "@/lib/ledger"
import { demoEntries } from "@/data/demo"

const pages = [
  { id: "overview", label: "월별 현황", icon: LayoutDashboard },
  { id: "transactions", label: "전체 거래", icon: ListOrdered },
  { id: "cards", label: "카드 관리", icon: CreditCard },
  { id: "installments", label: "할부 관리", icon: CalendarDays },
  { id: "connections", label: "은행·카드 연결", icon: Landmark },
  { id: "settings", label: "설정", icon: Settings },
] as const
type Page = (typeof pages)[number]["id"]
function pageFromHash(): Page {
  const p = location.hash.slice(1)
  return pages.some((v) => v.id === p) ? (p as Page) : "overview"
}

export default function App() {
  const [user, setUser] = useState<User | null>(null)
  const [ready, setReady] = useState(!firebaseConfigured)
  const [localMode, setLocalMode] = useState(!firebaseConfigured)
  const [error, setError] = useState("")
  const [signing, setSigning] = useState(false)
  useEffect(
    () =>
      auth
        ? onAuthStateChanged(
            auth,
            (u) => {
              setUser(u)
              setReady(true)
            },
            () => {
              setError("로그인 상태를 확인할 수 없습니다. 새로고침해주세요.")
              setReady(true)
            }
          )
        : undefined,
    []
  )
  const repository = useMemo(
    () => (user && !localMode ? cloudRepository(user.uid) : localRepository),
    [user, localMode]
  )
  async function login() {
    if (!auth) {
      setError("Firebase 프로젝트 설정 후 로그인할 수 있습니다.")
      return
    }
    setSigning(true)
    setError("")
    try {
      await signInWithPopup(auth, new GoogleAuthProvider())
      setLocalMode(false)
    } catch {
      setError(
        "로그인하지 못했습니다. 팝업 허용 및 Firebase 인증 설정을 확인해주세요."
      )
    } finally {
      setSigning(false)
    }
  }
  if (!ready)
    return (
      <div className="loading-screen" role="status">
        장부를 준비하고 있습니다…
      </div>
    )
  if (!localMode && !user)
    return (
      <div className="login-page">
        <div className="brand-mark">
          <Wallet />
        </div>
        <p className="eyebrow">ACCOUNT</p>
        <h1>
          내 돈의 흐름을,
          <br />
          한눈에 명확하게.
        </h1>
        <p>
          매일의 작은 기록이 만드는 나만의 가계부.
          <br />
          안전하게 로그인하고 기록을 시작하세요.
        </p>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <Button size="lg" isDisabled={signing} onPress={login}>
          {signing ? "로그인 중…" : "Google로 시작하기"}
          <ArrowRight size={16} />
        </Button>
        <Button variant="ghost" onPress={() => setLocalMode(true)}>
          이 브라우저에서 먼저 사용하기
        </Button>
        <small>은행·카드 자동 조회는 아직 연결되지 않았습니다.</small>
      </div>
    )
  return (
    <Ledger
      key={localMode ? "local" : user?.uid}
      repository={repository}
      localMode={localMode}
      user={user}
      login={login}
      signing={signing}
      authError={error}
      logout={async () => {
        if (auth) await signOut(auth)
        setLocalMode(!firebaseConfigured)
      }}
    />
  )
}
function Ledger({
  repository,
  localMode,
  user,
  login,
  signing,
  authError,
  logout,
}: {
  repository: Repository
  localMode: boolean
  user: User | null
  login: () => Promise<void>
  signing: boolean
  authError: string
  logout: () => Promise<void>
}) {
  const [page, setPage] = useState<Page>(pageFromHash)
  const [month, setMonth] = useState(currentMonth)
  const [entries, setEntries] = useState<Entry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const [retry, setRetry] = useState(0)
  const [search, setSearch] = useState("")
  const [kind, setKind] = useState("all")
  const [category, setCategory] = useState("all")
  const [card, setCard] = useState("all")
  const [pageNumber, setPageNumber] = useState(1)
  const [editor, setEditor] = useState<Entry | "new" | null>(null)
  const [menu, setMenu] = useState(false)
  const [working, setWorking] = useState(false)
  const file = useRef<HTMLInputElement>(null)
  const { theme, setTheme } = useTheme()
  useEffect(() => {
    // A new subscription must not display the preceding month's financial totals.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true)
    setError("")
    setEntries([])
    return repository.watch(
      period(month),
      (data) => {
        setEntries(data)
        setLoading(false)
      },
      () => {
        setError(
          "내역을 불러오지 못했습니다. 연결 상태와 접근 권한을 확인해주세요."
        )
        setLoading(false)
      }
    )
  }, [month, repository, retry])
  useEffect(() => {
    const handle = () => {
      setPage(pageFromHash())
      setPageNumber(1)
      setSearch("")
      setKind("all")
      setCategory("all")
      setCard("all")
    }
    window.addEventListener("hashchange", handle)
    return () => window.removeEventListener("hashchange", handle)
  }, [])
  useEffect(() => {
    if (notice) {
      const timer = setTimeout(() => setNotice(""), 5000)
      return () => clearTimeout(timer)
    }
  }, [notice])
  const rows = useMemo(() => rowsFor(entries, month), [entries, month])
  const sum = totals(rows)
  const cards = [...new Set(entries.map((e) => e.card).filter(Boolean))]
  const filtered = rows.filter(
    (e) =>
      (!search ||
        `${e.title} ${e.note} ${e.category} ${e.card}`
          .toLowerCase()
          .includes(search.toLowerCase())) &&
      (kind === "all" ||
        (kind === "excluded"
          ? e.excluded || e.kind === "transfer"
          : e.kind === kind)) &&
      (category === "all" || e.category === category) &&
      (card === "all" || e.card === card) &&
      (page !== "installments" || e.installments > 1)
  )
  const maxPage = Math.max(1, Math.ceil(filtered.length / 8))
  const shownPage = Math.min(pageNumber, maxPage)
  const shown = filtered.slice((shownPage - 1) * 8, shownPage * 8)
  const grouped = Object.entries(
    rows
      .filter((e) => e.kind === "expense" && !e.excluded)
      .reduce<Record<string, number>>(
        (all, e) => ({
          ...all,
          [e.category]: (all[e.category] ?? 0) + e.monthlyAmount,
        }),
        {}
      )
  ).sort((a, b) => b[1] - a[1])
  function navigate(next: Page) {
    location.hash = next
    setPage(next)
    setMenu(false)
    setPageNumber(1)
    setSearch("")
    setKind("all")
    setCategory("all")
    setCard("all")
  }
  function changeMonth(value: string) {
    try {
      period(value)
      setMonth(value)
      setPageNumber(1)
      setCategory("all")
      setCard("all")
    } catch {
      /* retain valid selection */
    }
  }
  async function loadDemo() {
    setWorking(true)
    try {
      await importLocal(demoEntries())
      setNotice("체험용 예시 내역을 추가했습니다. 실제 금융 데이터가 아닙니다.")
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "예시를 불러오지 못했습니다.")
    } finally {
      setWorking(false)
    }
  }
  async function exportData() {
    setWorking(true)
    try {
      const all = await repository.all()
      const blob = new Blob(
        [JSON.stringify({ version: 1, entries: all }, null, 2)],
        { type: "application/json" }
      )
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `account-${currentMonth()}.json`
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      setNotice(`${all.length}건을 내보냈습니다.`)
    } catch {
      setNotice("내보내기에 실패했습니다. 다시 시도해주세요.")
    } finally {
      setWorking(false)
    }
  }
  async function restore(selected: File | undefined) {
    if (!selected) return
    setWorking(true)
    try {
      if (selected.size > 10_000_000)
        throw new Error("10MB 이하의 백업 파일을 선택하세요.")
      const data = backupSchema.parse(JSON.parse(await selected.text()))
      await importLocal(data.entries)
      setNotice(`${data.entries.length}건을 가져왔습니다.`)
    } catch (e) {
      setNotice(
        e instanceof Error && e.message.includes("ID")
          ? e.message
          : "가져오지 못했습니다. ACCOUNT 백업 형식과 금액·날짜를 확인해주세요."
      )
    } finally {
      setWorking(false)
      if (file.current) file.current.value = ""
    }
  }
  const title = pages.find((p) => p.id === page)?.label
  return (
    <div className="app-shell">
      {menu && (
        <button
          className="sidebar-scrim"
          aria-label="메뉴 닫기"
          onClick={() => setMenu(false)}
        />
      )}
      <aside
        id="sidebar-navigation"
        className={`sidebar ${menu ? "open" : ""}`}
      >
        <a
          href="#overview"
          className="brand"
          onClick={() => navigate("overview")}
        >
          <span className="brand-mark">
            <Wallet size={19} />
          </span>
          <span>
            ACCOUNT<span className="brand-caption">PERSONAL FINANCE</span>
          </span>
        </a>
        <div className="workspace">
          <span className="avatar">나</span>
          <div>
            <strong>나의 가계부</strong>
            <small>개인 워크스페이스</small>
          </div>
          <span className="workspace-dot" />
        </div>
        <p className="nav-caption">나의 기록</p>
        <nav aria-label="주 메뉴">
          {pages.map(({ id, label, icon: Icon }) => (
            <Button
              key={id}
              variant="ghost"
              className={`nav-item ${page === id ? "selected" : ""} ${id === "settings" ? "nav-settings" : ""}`}
              aria-current={page === id ? "page" : undefined}
              onPress={() => navigate(id)}
            >
              <Icon size={18} />
              {label}
              {id === "connections" && <span className="soon">예정</span>}
            </Button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="private-note">
            <ShieldCheck size={18} />
            <div>
              <strong>오직 나를 위한 기록</strong>
              <p>
                {localMode
                  ? "이 브라우저에 저장됩니다."
                  : "내 계정에 안전하게 저장됩니다."}
              </p>
            </div>
          </div>
          <div className="sidebar-account">
            <span className="avatar small">
              {user && !localMode
                ? (user.displayName?.slice(0, 1) ?? "나")
                : "나"}
            </span>
            <div>
              <strong>
                {user && !localMode ? user.displayName : "개인 장부"}
              </strong>
              <small>{localMode ? "로컬 모드" : "Firebase 연결됨"}</small>
            </div>
            <Button
              variant="ghost"
              size="icon"
              aria-label="설정 열기"
              onPress={() => navigate("settings")}
            >
              <Settings size={16} />
            </Button>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <Button
              variant="ghost"
              size="icon"
              className="mobile-menu"
              aria-label="메뉴 열기"
              aria-expanded={menu}
              aria-controls="sidebar-navigation"
              onPress={() => setMenu(true)}
            >
              <Menu />
            </Button>
            <span>나의 가계부</span>
            <span className="slash">/</span>
            <strong>{title}</strong>
          </div>
          <div className="topbar-actions">
            <span className="mode-badge">
              <span />
              {localMode ? "이 브라우저에 저장" : "클라우드 저장"}
            </span>
            <Button
              variant="ghost"
              size="icon"
              aria-label={theme === "dark" ? "라이트 모드" : "다크 모드"}
              onPress={() => setTheme(theme === "dark" ? "light" : "dark")}
            >
              {theme === "dark" ? <Sun /> : <Moon />}
            </Button>
            <span className="avatar small">나</span>
          </div>
        </header>
        <main id="main-content">
          <div className="page-heading">
            <div>
              <p className="eyebrow">YOUR MONEY, AT A GLANCE</p>
              <h1>{title}</h1>
              <p>
                {page === "overview"
                  ? "한 달의 흐름을 살펴보고, 더 나은 내일을 준비하세요."
                  : page === "transactions"
                    ? "작은 지출부터 소중한 수입까지, 모든 기록을 한곳에."
                    : page === "cards"
                      ? "카드별 사용액을 확인하고 지출 흐름을 관리하세요."
                      : page === "installments"
                        ? "나누어 낸 금액도, 한눈에 명확하게."
                        : page === "connections"
                          ? "내 금융 내역을 연결하기 위한 준비 공간입니다."
                          : "나에게 맞는 기록 환경을 관리하세요."}
              </p>
            </div>
            {!["settings", "connections"].includes(page) && (
              <Button size="lg" onPress={() => setEditor("new")}>
                <Plus size={17} />
                거래 추가
              </Button>
            )}
          </div>
          {["overview", "transactions", "cards", "installments"].includes(
            page
          ) && (
            <>
              <div className="month-toolbar">
                <div className="month-picker">
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="이전 달"
                    isDisabled={month === "1900-01"}
                    onPress={() => changeMonth(monthAt(period(month) - 1))}
                  >
                    <ChevronLeft />
                  </Button>
                  <label>
                    <CalendarDays size={17} />
                    <input
                      aria-label="조회 월"
                      type="month"
                      min="1900-01"
                      max="2100-12"
                      value={month}
                      onChange={(e) => changeMonth(e.target.value)}
                    />
                  </label>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="다음 달"
                    isDisabled={month === "2100-12"}
                    onPress={() => changeMonth(monthAt(period(month) + 1))}
                  >
                    <ChevronRight />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onPress={() => changeMonth(currentMonth())}
                  >
                    이번 달
                  </Button>
                </div>
                <span className="muted toolbar-caption">
                  귀속월 기준 · 원화 KRW
                </span>
              </div>
              {error ? (
                <div role="alert" className="error-panel">
                  <p>{error}</p>
                  <Button
                    variant="outline"
                    onPress={() => setRetry((v) => v + 1)}
                  >
                    다시 시도
                  </Button>
                </div>
              ) : loading ? (
                <div className="loading-panel" role="status">
                  <div className="skeleton" />
                  <div className="skeleton" />
                  <p>이번 달 기록을 불러오는 중…</p>
                </div>
              ) : (
                <>
                  {page === "overview" && (
                    <>
                      <div className="summary-grid">
                        <Metric
                          label="이번 달 수입"
                          amount={sum.income}
                          icon={<ArrowDownLeft />}
                          detail="집계에 포함된 수입"
                        />
                        <Metric
                          label="이번 달 지출"
                          amount={sum.expense}
                          icon={<ArrowUpRight />}
                          detail={`${rows.filter((r) => r.kind === "expense" && !r.excluded).length}건의 지출 기록`}
                        />
                        <Metric
                          label="이번 달 수지"
                          amount={sum.balance}
                          icon={<Wallet />}
                          detail="수입 − 지출 · 은행 잔고와 다름"
                          featured
                        />
                        <Metric
                          label="이번 달 할부"
                          amount={sum.installments}
                          icon={<CalendarDays />}
                          detail={`${rows.filter((r) => r.installments > 1 && !r.excluded).length}건의 할부 진행 중`}
                        />
                      </div>
                      <div className="insights-grid">
                        <section className="panel category-panel">
                          <div className="panel-heading">
                            <h2>어디에 사용했나요?</h2>
                            <span className="muted">분류별 지출</span>
                          </div>
                          {grouped.length ? (
                            <>
                              <div
                                className="distribution"
                                role="img"
                                aria-label={grouped
                                  .map(([c, a]) => `${c} ${money(a)}원`)
                                  .join(", ")}
                              >
                                {grouped.map(([c, a], i) => (
                                  <span
                                    key={c}
                                    style={{
                                      width: `${(a / sum.expense) * 100}%`,
                                      background: `var(--chart-${(i % 5) + 1})`,
                                    }}
                                  />
                                ))}
                              </div>
                              <div className="category-list">
                                {grouped.slice(0, 5).map(([c, a], i) => (
                                  <div key={c}>
                                    <span
                                      className="legend-dot"
                                      style={{
                                        background: `var(--chart-${(i % 5) + 1})`,
                                      }}
                                    />
                                    <span>{c}</span>
                                    <span className="muted percentage">
                                      {Math.round((a / sum.expense) * 100)}%
                                    </span>
                                    <strong>
                                      {money(a)}
                                      <small> 원</small>
                                    </strong>
                                  </div>
                                ))}
                              </div>
                              {grouped.length > 5 && (
                                <p className="hint">
                                  외 {grouped.length - 5}개 분류 ·{" "}
                                  {money(
                                    grouped
                                      .slice(5)
                                      .reduce((s, [, a]) => s + a, 0)
                                  )}
                                  원
                                </p>
                              )}
                            </>
                          ) : (
                            <div className="chart-empty">
                              <div className="empty-chart" />
                              <p>지출을 기록하면 분류별 흐름이 보입니다.</p>
                            </div>
                          )}
                        </section>
                        <section className="panel monthly-note">
                          <div className="panel-heading">
                            <h2>이번 달 기록</h2>
                            <ListFilter size={17} />
                          </div>
                          <div className="note-number">
                            {rows.length}
                            <span>개의 거래</span>
                          </div>
                          <p>기록이 쌓일수록 돈의 흐름이 선명해집니다.</p>
                          <div className="note-line">
                            <span>집계 제외·이체</span>
                            <strong>{money(sum.excluded)}원</strong>
                          </div>
                          <div className="note-line">
                            <span>카드 사용</span>
                            <strong>
                              {money(
                                rows
                                  .filter(
                                    (r) =>
                                      r.card &&
                                      r.kind === "expense" &&
                                      !r.excluded
                                  )
                                  .reduce((n, r) => n + r.monthlyAmount, 0)
                              )}
                              원
                            </strong>
                          </div>
                          <div className="note-footer">
                            <CircleHelp size={14} />
                            <span>
                              이체와 제외 내역은 월 수지에 포함되지 않아요.
                            </span>
                          </div>
                        </section>
                      </div>
                    </>
                  )}
                  {page === "cards" && (
                    <section className="cards-grid">
                      {cards.length ? (
                        cards.map((name) => (
                          <button
                            key={name}
                            className={`payment-card ${card === name ? "active" : ""}`}
                            onClick={() => {
                              setCard(card === name ? "all" : name)
                              setPageNumber(1)
                            }}
                          >
                            <div>
                              <CreditCard />
                              <span>직접 기록한 카드</span>
                            </div>
                            <h2>{name}</h2>
                            <strong>
                              {money(
                                rows
                                  .filter(
                                    (e) =>
                                      e.card === name &&
                                      e.kind === "expense" &&
                                      !e.excluded
                                  )
                                  .reduce((n, e) => n + e.monthlyAmount, 0)
                              )}
                              <small> 원</small>
                            </strong>
                            <footer>
                              <span>귀속월 사용액 · 청구금액 아님</span>
                              <ArrowRight size={16} />
                            </footer>
                          </button>
                        ))
                      ) : (
                        <Empty
                          title="아직 카드 기록이 없어요"
                          description="거래 추가에서 결제수단에 카드 이름을 입력하세요."
                          action={() => setEditor("new")}
                          actionLabel="첫 거래 추가"
                        />
                      )}
                    </section>
                  )}
                  <section className="panel transactions-panel">
                    <div className="panel-heading">
                      <div className="heading-with-count">
                        <h2>
                          {page === "installments"
                            ? "이번 달 할부 내역"
                            : "거래 내역"}
                        </h2>
                        <span className="count-badge">{filtered.length}</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onPress={exportData}
                        isDisabled={working}
                      >
                        <Download size={14} />
                        전체 내보내기
                      </Button>
                    </div>
                    <div className="filters">
                      <div className="search-box">
                        <Search size={16} />
                        <input
                          aria-label="거래 검색"
                          placeholder="항목, 메모 검색"
                          value={search}
                          onChange={(e) => {
                            setSearch(e.target.value)
                            setPageNumber(1)
                          }}
                        />
                        {search && (
                          <button
                            aria-label="검색 지우기"
                            onClick={() => setSearch("")}
                          >
                            <X size={14} />
                          </button>
                        )}
                      </div>
                      <select
                        aria-label="유형 필터"
                        value={kind}
                        onChange={(e) => {
                          setKind(e.target.value)
                          setPageNumber(1)
                        }}
                      >
                        <option value="all">모든 유형</option>
                        <option value="expense">지출</option>
                        <option value="income">수입</option>
                        <option value="transfer">이체</option>
                        <option value="excluded">제외·이체</option>
                      </select>
                      <select
                        aria-label="분류 필터"
                        value={category}
                        onChange={(e) => {
                          setCategory(e.target.value)
                          setPageNumber(1)
                        }}
                      >
                        <option value="all">모든 분류</option>
                        {[...new Set(rows.map((e) => e.category))].map((c) => (
                          <option key={c}>{c}</option>
                        ))}
                      </select>
                      <select
                        aria-label="결제수단 필터"
                        value={card}
                        onChange={(e) => {
                          setCard(e.target.value)
                          setPageNumber(1)
                        }}
                      >
                        <option value="all">모든 결제수단</option>
                        <option value="">현금·계좌</option>
                        {cards.map((c) => (
                          <option key={c}>{c}</option>
                        ))}
                      </select>
                    </div>
                    {shown.length ? (
                      <>
                        <div className="table-scroll">
                          <table>
                            <thead>
                              <tr>
                                <th>거래일</th>
                                <th>항목</th>
                                <th>분류</th>
                                <th>결제수단</th>
                                <th className="number">금액</th>
                                <th className="action-cell">
                                  <span className="sr-only">편집</span>
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {shown.map((e) => (
                                <TransactionRow
                                  key={e.id}
                                  row={e}
                                  edit={() => setEditor(e)}
                                />
                              ))}
                            </tbody>
                          </table>
                        </div>
                        <footer className="table-footer">
                          <span>
                            {(shownPage - 1) * 8 + 1}–
                            {Math.min(shownPage * 8, filtered.length)} /{" "}
                            {filtered.length}건{" "}
                            <span className="filter-total">
                              · 필터 지출 {money(totals(filtered).expense)}원
                            </span>
                          </span>
                          <div>
                            <Button
                              variant="outline"
                              size="icon-sm"
                              aria-label="이전 페이지"
                              isDisabled={shownPage === 1}
                              onPress={() => setPageNumber(shownPage - 1)}
                            >
                              <ChevronLeft />
                            </Button>
                            <span>
                              {shownPage} / {maxPage}
                            </span>
                            <Button
                              variant="outline"
                              size="icon-sm"
                              aria-label="다음 페이지"
                              isDisabled={shownPage === maxPage}
                              onPress={() => setPageNumber(shownPage + 1)}
                            >
                              <ChevronRight />
                            </Button>
                          </div>
                        </footer>
                      </>
                    ) : (
                      <Empty
                        title={
                          rows.length
                            ? "검색 결과가 없어요"
                            : "아직 기록된 거래가 없어요"
                        }
                        description={
                          rows.length
                            ? "검색어나 필터를 바꿔보세요."
                            : "첫 수입이나 지출을 기록하며 이번 달을 시작해보세요."
                        }
                        action={
                          rows.length
                            ? () => {
                                setSearch("")
                                setKind("all")
                                setCategory("all")
                                setCard("all")
                              }
                            : () => setEditor("new")
                        }
                        actionLabel={
                          rows.length ? "필터 초기화" : "첫 거래 추가"
                        }
                      />
                    )}
                  </section>
                  {localMode && (
                    <div className="local-banner">
                      <ShieldCheck size={17} />
                      <p>
                        현재 기록은 이 브라우저에만 저장됩니다.{" "}
                        <span>중요한 내역은 JSON으로 내보내 보관하세요.</span>
                      </p>
                      {rows.length === 0 && (
                        <Button
                          variant="outline"
                          size="sm"
                          isDisabled={working}
                          onPress={loadDemo}
                        >
                          예시 데이터로 둘러보기
                        </Button>
                      )}
                    </div>
                  )}
                </>
              )}
            </>
          )}
          {page === "connections" && (
            <section className="panel connection-panel">
              <span className="large-icon">
                <Landmark size={30} />
              </span>
              <span className="status-label">연동 준비 중</span>
              <h2>은행과 카드 내역을 한곳에서</h2>
              <p>
                현재는 직접 기록한 거래를 관리할 수 있습니다.
                <br />
                실제 금융 내역 조회는 제공사의 개인 이용 조건을 확인한 뒤
                연결합니다.
              </p>
              <div className="connection-steps">
                <div>
                  <Check />
                  <span>Firebase 기반 앱 구성</span>
                </div>
                <div>
                  <span className="step-dot">2</span>
                  <span>금융 API 개인 이용 자격·요금 확인</span>
                </div>
                <div>
                  <span className="step-dot">3</span>
                  <span>본인 인증 및 실제 내역 조회 연결</span>
                </div>
              </div>
              <p className="hint">
                현재 조회된 은행 잔액·카드 승인 내역은 없습니다.
              </p>
            </section>
          )}
          {page === "settings" && (
            <div className="settings-grid">
              <section className="panel settings-panel">
                <h2>계정과 저장 방식</h2>
                <p>
                  {localMode
                    ? "브라우저 저장소를 사용하고 있습니다. 기기 간 자동 동기화는 되지 않습니다."
                    : "Firebase 계정에 연결되어 있습니다. 내 UID의 거래만 조회하고 수정합니다."}
                </p>
                <div className="setting-row">
                  <span>현재 저장소</span>
                  <span className="status-label">
                    {localMode ? "이 브라우저" : "Cloud Firestore"}
                  </span>
                </div>
                {localMode ? (
                  <>
                    <p className="hint">
                      {firebaseConfigured
                        ? "로그인 후에는 별도의 클라우드 장부가 열립니다. 로컬 내역은 자동 업로드되지 않습니다."
                        : "Firebase 프로젝트 정보가 설정되면 Google 로그인을 사용할 수 있습니다."}
                    </p>
                    <Button
                      variant="outline"
                      isDisabled={!firebaseConfigured || signing}
                      onPress={login}
                    >
                      {signing ? "로그인 중…" : "Google로 로그인"}
                    </Button>
                  </>
                ) : (
                  <Button
                    variant="outline"
                    onPress={() => {
                      void logout().catch(() =>
                        setNotice("로그아웃에 실패했습니다. 다시 시도하세요.")
                      )
                    }}
                  >
                    <LogOut size={15} />
                    로그아웃
                  </Button>
                )}
                {authError && (
                  <p role="alert" className="error">
                    {authError}
                  </p>
                )}
              </section>
              <section className="panel settings-panel">
                <h2>백업과 가져오기</h2>
                <p>
                  거래 원금과 할부 정보를 함께 보관합니다. 내보낸 파일에는 개인
                  거래 내용이 포함됩니다.
                </p>
                <div className="button-row">
                  <Button
                    variant="outline"
                    isDisabled={working}
                    onPress={exportData}
                  >
                    <Download size={15} />
                    JSON 내보내기
                  </Button>
                  {localMode && (
                    <Button
                      variant="outline"
                      isDisabled={working}
                      onPress={() => file.current?.click()}
                    >
                      <Upload size={15} />
                      백업 가져오기
                    </Button>
                  )}
                </div>
                <input
                  ref={file}
                  type="file"
                  accept="application/json,.json"
                  hidden
                  onChange={(e) => void restore(e.target.files?.[0])}
                />
                <p className="hint">
                  {localMode
                    ? "가져오기는 새 ID의 거래만 추가합니다. 중복이나 잘못된 데이터가 있으면 전체를 취소합니다."
                    : "현재 클라우드는 내보내기를 지원합니다. 백업 복원은 로컬 모드에서 검증할 수 있습니다."}
                </p>
              </section>
              <section className="panel settings-panel">
                <h2>화면 테마</h2>
                <p>익숙하고 편안한 화면을 선택하세요.</p>
                <div className="button-row">
                  {(["light", "dark", "system"] as const).map((t) => (
                    <Button
                      key={t}
                      variant={theme === t ? "default" : "outline"}
                      onPress={() => setTheme(t)}
                    >
                      {t === "light"
                        ? "라이트"
                        : t === "dark"
                          ? "다크"
                          : "시스템"}
                    </Button>
                  ))}
                </div>
              </section>
              <section className="panel settings-panel">
                <h2>집계 기준</h2>
                <p>
                  수입에서 지출을 뺀 월 수지를 표시합니다. 은행의 실제 잔고가
                  아닙니다. 거래별 제외 사유와 분류는 거래 수정에서 관리합니다.
                </p>
                <ul>
                  <li>귀속월 기준으로 집계</li>
                  <li>이체·카드대금 납부는 수지에서 제외</li>
                  <li>할부의 나머지 금액은 마지막 회차에 반영</li>
                  <li>할부 수정·삭제는 전체 계약에 적용</li>
                </ul>
                {localMode && (
                  <Button
                    variant="outline"
                    isDisabled={working}
                    onPress={loadDemo}
                  >
                    체험용 예시 데이터 추가
                  </Button>
                )}
              </section>
            </div>
          )}
          <footer className="page-footer">
            <span>
              ACCOUNT <span>· 나의 일상을 담는 기록</span>
            </span>
            <span>개인 가계부</span>
          </footer>
        </main>
      </div>
      {editor && (
        <EntryForm
          entry={editor === "new" ? undefined : editor}
          month={month}
          cards={cards}
          repository={repository}
          close={() => setEditor(null)}
          saved={setNotice}
        />
      )}
      <div
        className={`toast ${notice ? "visible" : ""}`}
        role="status"
        aria-live="polite"
      >
        {notice && (
          <>
            <Check size={17} />
            {notice}
            <button aria-label="알림 닫기" onClick={() => setNotice("")}>
              <X size={15} />
            </button>
          </>
        )}
      </div>
    </div>
  )
}
function Metric({
  label,
  amount,
  icon,
  detail,
  featured = false,
}: {
  label: string
  amount: number
  icon: React.ReactNode
  detail: string
  featured?: boolean
}) {
  return (
    <section className={`metric ${featured ? "featured" : ""}`}>
      <div>
        <span>{label}</span>
        {icon}
      </div>
      <strong>
        {money(amount)}
        <small> 원</small>
      </strong>
      <p>{detail}</p>
    </section>
  )
}
function TransactionRow({ row: e, edit }: { row: Row; edit: () => void }) {
  const Icon =
    e.kind === "income"
      ? ArrowDownLeft
      : e.kind === "transfer"
        ? ArrowLeftRight
        : ArrowUpRight
  return (
    <tr>
      <td className="date-cell">
        {e.date.slice(5).replace("-", ".")}
        <span>{e.date.slice(0, 4)}</span>
      </td>
      <td>
        <div className="transaction-title">
          <span className="transaction-icon">
            <Icon size={16} />
          </span>
          <div>
            <button className="title-button" onClick={edit}>
              {e.title}
            </button>
            <small>
              {e.installments > 1
                ? `할부 ${e.sequence}/${e.installments}회 · `
                : ""}
              {e.excluded
                ? `집계 제외 · ${e.exclusionReason}`
                : e.kind === "transfer"
                  ? "이체 · 집계 제외"
                  : e.kind === "income"
                    ? "수입"
                    : e.note || "지출"}
            </small>
          </div>
        </div>
      </td>
      <td>
        <span className="category-badge">{e.category}</span>
      </td>
      <td className="muted payment-cell">{e.card || "현금·계좌"}</td>
      <td className="number">
        <strong>
          {e.kind === "income" ? "+" : e.kind === "expense" ? "−" : ""}
          {money(e.monthlyAmount)}
        </strong>
        <small> 원</small>
      </td>
      <td className="action-cell">
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`${e.title} 수정`}
          onPress={edit}
        >
          <ChevronRight size={15} />
        </Button>
      </td>
    </tr>
  )
}
function Empty({
  title,
  description,
  action,
  actionLabel,
}: {
  title: string
  description: string
  action: () => void
  actionLabel: string
}) {
  return (
    <div className="empty-state">
      <span className="empty-icon">
        <Inbox size={24} />
      </span>
      <h3>{title}</h3>
      <p>{description}</p>
      <Button variant="outline" onPress={action}>
        {actionLabel}
      </Button>
    </div>
  )
}
