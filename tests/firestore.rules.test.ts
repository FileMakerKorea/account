import { readFileSync } from "node:fs"
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest"
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing"
import {
  doc,
  setDoc,
  getDoc,
  deleteDoc,
  collection,
  getDocs,
  query,
  where,
} from "firebase/firestore"
let env: RulesTestEnvironment
const data = {
  id: "test",
  title: "할부",
  kind: "expense",
  amount: 100000,
  date: "2026-11-30",
  startPeriod: 24322,
  endPeriod: 24324,
  installments: 3,
  category: "생활",
  card: "",
  note: "",
  excluded: false,
  exclusionReason: "",
  revision: 1,
}
describe("Firestore owner and entry rules", () => {
  beforeAll(async () => {
    env = await initializeTestEnvironment({
      projectId: "demo-account",
      firestore: {
        host: "127.0.0.1",
        port: 8185,
        rules: readFileSync("firestore.rules", "utf8"),
      },
    })
  })
  beforeEach(async () => {
    await env.clearFirestore()
  })
  afterAll(async () => {
    await env.cleanup()
  })
  it("permits owner CRUD and the monthly query", async () => {
    const db = env.authenticatedContext("alice").firestore()
    const ref = doc(db, "users/alice/entries/test")
    await assertSucceeds(setDoc(ref, data))
    await assertSucceeds(getDoc(ref))
    await assertSucceeds(
      getDocs(
        query(
          collection(db, "users/alice/entries"),
          where("startPeriod", "<=", 24323),
          where("endPeriod", ">=", 24323)
        )
      )
    )
    await assertSucceeds(setDoc(ref, { ...data, title: "수정", revision: 2 }))
    await assertSucceeds(deleteDoc(ref))
  })
  it("denies unauthenticated and cross-user access", async () => {
    const owner = env.authenticatedContext("alice").firestore()
    await setDoc(doc(owner, "users/alice/entries/test"), data)
    for (const db of [
      env.unauthenticatedContext().firestore(),
      env.authenticatedContext("bob").firestore(),
    ]) {
      const ref = doc(db, "users/alice/entries/test")
      await assertFails(getDoc(ref))
      await assertFails(setDoc(ref, data))
      await assertFails(deleteDoc(ref))
    }
  })
  it("rejects forged financial data and extra fields", async () => {
    const db = env.authenticatedContext("alice").firestore()
    for (const changed of [
      { amount: 0 },
      { amount: 1.2 },
      { endPeriod: 24399 },
      { installments: 61 },
      { id: "other" },
      { kind: "income" },
      { excluded: true },
      { revision: 2 },
      { secret: "bad" },
      { date: "2026-02-30" },
    ])
      await assertFails(
        setDoc(doc(db, "users/alice/entries/test"), { ...data, ...changed })
      )
  })
  it("requires revision increments", async () => {
    const ref = doc(
      env.authenticatedContext("alice").firestore(),
      "users/alice/entries/test"
    )
    await setDoc(ref, data)
    await assertFails(setDoc(ref, { ...data, title: "stale" }))
    await assertSucceeds(setDoc(ref, { ...data, revision: 2 }))
  })
})
