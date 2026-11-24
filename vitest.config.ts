import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  test: {
    include: ["tests/**/*.test.ts"],
    globalSetup: ["tests/global-setup.ts"],
    fileParallelism: false,
    env: { NODE_ENV: "test", AUTH_SECRET: "segredo-de-teste-com-mais-de-32-caracteres!!" },
    setupFiles: ["dotenv/config"],
  },
});
