import { describe, expect, it } from "vitest";
import { getRequestIp } from "@/lib/security/audit";

describe("getRequestIp (validação)", () => {
  it("aceita IPv4 e IPv6 válidos no primeiro item de x-forwarded-for", () => {
    expect(getRequestIp(new Headers({ "x-forwarded-for": " 9.9.9.9 , 10.0.0.1" }))).toBe("9.9.9.9");
    expect(getRequestIp(new Headers({ "x-forwarded-for": "2001:db8::1" }))).toBe("2001:db8::1");
  });

  it("valor forjado que não é IP retorna null", () => {
    expect(getRequestIp(new Headers({ "x-forwarded-for": "<script>alert(1)</script>" }))).toBeNull();
    expect(getRequestIp(new Headers({ "x-forwarded-for": "'; DROP TABLE users; --" }))).toBeNull();
  });

  it("string longa (> 64 caracteres) retorna null", () => {
    expect(getRequestIp(new Headers({ "x-forwarded-for": "1".repeat(200) }))).toBeNull();
    expect(getRequestIp(new Headers({ "x-real-ip": "a".repeat(100) }))).toBeNull();
  });

  it("x-forwarded-for inválido cai para x-real-ip válido", () => {
    expect(getRequestIp(new Headers({ "x-forwarded-for": "lixo", "x-real-ip": "8.8.8.8" }))).toBe("8.8.8.8");
  });

  it("ambos inválidos retorna null", () => {
    expect(getRequestIp(new Headers({ "x-forwarded-for": "lixo", "x-real-ip": "mais-lixo" }))).toBeNull();
  });
});
