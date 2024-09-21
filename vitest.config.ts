import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      enabled: true,
      include: ["index.ts"],
      thresholds: {
        100: true,
      },
    },
  },
});
