import { describe, expect, it } from "vitest";
import nextConfig from "../../next.config";

describe("next.config", () => {
  it("limita o corpo das Server Actions bem abaixo do padrão de 1 MB", () => {
    expect(nextConfig.experimental?.serverActions?.bodySizeLimit).toBe("100kb");
  });
});
