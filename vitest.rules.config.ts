import { defineConfig } from "vitest/config"
export default defineConfig({
  test: {
    include: ["tests/firestore.rules.test.ts"],
    testTimeout: 15000,
    hookTimeout: 30000,
    fileParallelism: false,
  },
})
