import React from "react"
import ReactDOM from "react-dom/client"
import { I18nProvider } from "react-aria-components"
import { ThemeProvider } from "@/components/theme-provider"
import App from "./App"
import "./index.css"
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <I18nProvider locale="ko-KR">
      <ThemeProvider defaultTheme="light" storageKey="account-theme">
        <App />
      </ThemeProvider>
    </I18nProvider>
  </React.StrictMode>
)
