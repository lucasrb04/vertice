import { describe, expect, it } from "vitest";
import { assertTestDatabase } from "@/db/test-db-guard";

describe("assertTestDatabase", () => {
  it("aceita NODE_ENV=test com banco *_test", () => {
    expect(() => assertTestDatabase("test", "postgresql://u:p@localhost:5433/vertice_test")).not.toThrow();
  });
  it("recusa o banco de desenvolvimento", () => {
    expect(() => assertTestDatabase("test", "postgresql://u:p@localhost:5434/vertice_db")).toThrow(/recusado/);
  });
  it("recusa NODE_ENV diferente de test mesmo com banco *_test", () => {
    expect(() => assertTestDatabase("development", "postgresql://u:p@localhost:5433/vertice_test")).toThrow(/recusado/);
  });
  it("recusa URL inválida", () => {
    expect(() => assertTestDatabase("test", "nao-e-url")).toThrow(/recusado/);
  });
});
