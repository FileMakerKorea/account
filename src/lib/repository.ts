import { openDB } from "idb"
import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  query,
  runTransaction,
  where,
} from "firebase/firestore"
import { db } from "./firebase"
import { backupSchema, entrySchema, type Entry } from "./ledger"

const local = openDB("account-local-v1", 1, {
  upgrade(db) {
    db.createObjectStore("entries", { keyPath: "id" })
  },
})
const channel =
  typeof BroadcastChannel !== "undefined"
    ? new BroadcastChannel("account-ledger")
    : null
const notify = () => {
  window.dispatchEvent(new Event("ledger-change"))
  channel?.postMessage("changed")
}
channel?.addEventListener("message", () =>
  window.dispatchEvent(new Event("ledger-change"))
)
const conflict = () =>
  new Error(
    "다른 화면에서 거래가 변경되었습니다. 창을 닫고 최신 내역을 다시 열어주세요."
  )
export interface Repository {
  watch(
    p: number,
    receive: (entries: Entry[]) => void,
    error: (error: Error) => void
  ): () => void
  save(entry: Entry, expected: number | null): Promise<void>
  remove(entry: Entry): Promise<void>
  all(): Promise<Entry[]>
}
export const localRepository: Repository = {
  watch(p, receive, error) {
    let active = true
    const read = async () => {
      try {
        const records = backupSchema.parse({
          version: 1,
          entries: await (await local).getAll("entries"),
        }).entries
        if (active)
          receive(records.filter((e) => e.startPeriod <= p && e.endPeriod >= p))
      } catch (e) {
        if (active)
          error(
            e instanceof Error
              ? e
              : new Error("저장된 데이터를 읽을 수 없습니다.")
          )
      }
    }
    void read()
    window.addEventListener("ledger-change", read)
    return () => {
      active = false
      window.removeEventListener("ledger-change", read)
    }
  },
  async save(value, expected) {
    const entry = entrySchema.parse(value)
    const tx = (await local).transaction("entries", "readwrite")
    const previous = await tx.store.get(entry.id)
    if ((previous?.revision ?? null) !== expected) {
      tx.abort()
      await tx.done.catch(() => {})
      throw conflict()
    }
    await tx.store.put(entry)
    await tx.done
    notify()
  },
  async remove(entry) {
    const tx = (await local).transaction("entries", "readwrite")
    const previous = await tx.store.get(entry.id)
    if (previous?.revision !== entry.revision) {
      tx.abort()
      await tx.done.catch(() => {})
      throw conflict()
    }
    await tx.store.delete(entry.id)
    await tx.done
    notify()
  },
  async all() {
    return backupSchema.parse({
      version: 1,
      entries: await (await local).getAll("entries"),
    }).entries
  },
}
export async function importLocal(entries: Entry[]) {
  backupSchema.parse({ version: 1, entries })
  const tx = (await local).transaction("entries", "readwrite")
  for (const entry of entries) {
    if (await tx.store.get(entry.id)) {
      tx.abort()
      await tx.done.catch(() => {})
      throw new Error(
        "같은 ID의 거래가 이미 있습니다. 기존 내역은 변경하지 않았습니다."
      )
    }
    await tx.store.add(entry)
  }
  await tx.done
  notify()
}
export function cloudRepository(uid: string): Repository {
  if (!db) throw new Error("Firebase 설정이 필요합니다.")
  const database = db
  const records = collection(database, "users", uid, "entries")
  return {
    watch(p, receive, error) {
      return onSnapshot(
        query(
          records,
          where("startPeriod", "<=", p),
          where("endPeriod", ">=", p)
        ),
        (snapshot) => {
          try {
            receive(snapshot.docs.map((d) => entrySchema.parse(d.data())))
          } catch {
            error(new Error("저장된 데이터 형식을 확인해주세요."))
          }
        },
        error
      )
    },
    async save(value, expected) {
      const entry = entrySchema.parse(value)
      await runTransaction(database, async (tx) => {
        const ref = doc(records, entry.id)
        const previous = await tx.get(ref)
        if ((previous.exists() ? previous.data().revision : null) !== expected)
          throw conflict()
        tx.set(ref, entry)
      })
    },
    async remove(entry) {
      await runTransaction(database, async (tx) => {
        const ref = doc(records, entry.id)
        const previous = await tx.get(ref)
        if (previous.data()?.revision !== entry.revision) throw conflict()
        tx.delete(ref)
      })
    },
    async all() {
      return (await getDocs(records)).docs.map((d) =>
        entrySchema.parse(d.data())
      )
    },
  }
}
