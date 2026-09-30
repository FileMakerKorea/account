import path from "path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              name: "firebase",
              test: /node_modules.*(?:@firebase|firebase)/,
              priority: 20,
            },
            {
              name: "ui",
              test: /node_modules.*(?:react|@react|@internationalized)/,
              priority: 10,
            },
          ],
        },
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
})
