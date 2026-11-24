import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import config from "../../next.config";

describe("fontes e CSP", () => {
  it("CSP não libera Google Fonts e o layout não carrega fontes de fora @spec:AC-067", async () => {
    const rules = await config.headers!();
    const csp = rules.flatMap((r) => r.headers).find((h) => h.key === "Content-Security-Policy")!.value;
    expect(csp).not.toMatch(/fonts\.googleapis\.com|fonts\.gstatic\.com/);
    expect(csp).toMatch(/font-src 'self'(;|$)/);
    const layout = readFileSync("src/app/layout.tsx", "utf8");
    expect(layout).not.toMatch(/https?:\/\//);
    expect(layout).toMatch(/@fontsource\/caprasimo/);
    expect(layout).toMatch(/@fontsource\/hanken-grotesk/);
  });
});
