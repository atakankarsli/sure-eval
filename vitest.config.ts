import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    root: process.env.ORACLE_ROOT ?? "app",
    globals: true,
    include: ["oracle/**/*.test.ts"],
  },
});
