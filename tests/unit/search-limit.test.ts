import { describe, expect, it } from "vitest";
import { createRateLimiter } from "@/lib/security/rate-limit";
import { isSearchRateLimited, SEARCH_LIMIT_PER_MINUTE } from "@/lib/security/search-limit";
import { isLocalDatabaseUrl } from "@/db/seed-demo";

const newLimiter = () => createRateLimiter({ limit: SEARCH_LIMIT_PER_MINUTE, windowMs: 60_000 });
const ipHeaders = (ip: string) => new Headers({ "x-forwarded-for": ip });
const search = (q: string) => new URL(`https://vertice.test/processos?q=${q}`);

describe("isSearchRateLimited", () => {
  it("permite 120 buscas por minuto do mesmo IP e limita a 121ª", () => {
    const limiter = newLimiter();
    for (let i = 0; i < SEARCH_LIMIT_PER_MINUTE; i++) {
      expect(isSearchRateLimited(search("robo"), ipHeaders("9.9.9.9"), limiter)).toBe(false);
    }
    expect(isSearchRateLimited(search("robo"), ipHeaders("9.9.9.9"), limiter)).toBe(true);
    expect(isSearchRateLimited(search("robo"), ipHeaders("8.8.8.8"), limiter)).toBe(false);
  });

  it("não limita nem consome sem q ou com q só de espaços", () => {
    const limiter = newLimiter();
    for (let i = 0; i < SEARCH_LIMIT_PER_MINUTE + 5; i++) {
      expect(isSearchRateLimited(new URL("https://vertice.test/processos"), ipHeaders("9.9.9.9"), limiter)).toBe(false);
      expect(isSearchRateLimited(search("%20%20"), ipHeaders("9.9.9.9"), limiter)).toBe(false);
    }
    expect(isSearchRateLimited(search("robo"), ipHeaders("9.9.9.9"), limiter)).toBe(false);
  });

  it("nunca limita requisição sem IP válido", () => {
    const limiter = newLimiter();
    for (let i = 0; i < SEARCH_LIMIT_PER_MINUTE + 5; i++) {
      expect(isSearchRateLimited(search("robo"), new Headers(), limiter)).toBe(false);
      expect(isSearchRateLimited(search("robo"), ipHeaders("não-é-ip"), limiter)).toBe(false);
    }
  });
});

describe("isLocalDatabaseUrl", () => {
  it("aceita localhost, 127.0.0.1 e [::1]", () => {
    expect(isLocalDatabaseUrl("postgres://u:p@localhost:5434/db")).toBe(true);
    expect(isLocalDatabaseUrl("postgres://u:p@127.0.0.1:5434/db")).toBe(true);
    expect(isLocalDatabaseUrl("postgres://u:p@[::1]:5434/db")).toBe(true);
  });

  it("recusa host de container, domínio e URL inválida", () => {
    expect(isLocalDatabaseUrl("postgres://u:p@postgres:5432/db")).toBe(false);
    expect(isLocalDatabaseUrl("postgres://u:p@db.exemplo.com.br/db")).toBe(false);
    expect(isLocalDatabaseUrl("isto não é url")).toBe(false);
  });
});
