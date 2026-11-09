import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Brand, BrandMark } from "@/components/layout/brand";

describe("Brand", () => {
  it("é um link para o início com nome acessível e o nome escrito", () => {
    const html = renderToStaticMarkup(<Brand />);
    expect(html).toContain('href="/"');
    expect(html).toContain('aria-label="Vértice, início"');
    expect(html).toContain("vértice");
  });

  it("a marca sozinha é decorativa", () => {
    expect(renderToStaticMarkup(<BrandMark />)).toContain('aria-hidden="true"');
  });
});
