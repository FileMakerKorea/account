import { initializeApp } from "firebase/app"
import { getAuth, connectAuthEmulator } from "firebase/auth"
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore"
const env = import.meta.env
const config = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  appId: env.VITE_FIREBASE_APP_ID,
}
export const firebaseConfigured = Object.values(config).every(Boolean)
const app = firebaseConfigured ? initializeApp(config) : null
export const auth = app ? getAuth(app) : null
export const db = app ? getFirestore(app) : null
if (auth && db && env.DEV && env.VITE_USE_EMULATORS === "true") {
  connectAuthEmulator(auth, "http://127.0.0.1:9195", { disableWarnings: true })
  connectFirestoreEmulator(db, "127.0.0.1", 8185)
}
