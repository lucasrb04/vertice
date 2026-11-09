import { describe, expect, it } from "vitest";
import { errorsFor, splitPrefixedErrors, withoutFieldError } from "@/components/projects/form-errors";
import { addTagRef, removeTagRef, tagRefKey } from "@/components/tags/tag-refs";
import { deadlineLabel } from "@/lib/projects/labels";

const ID_A = "8f6b1c2e-1d3a-4c5b-9e7f-0a1b2c3d4e5f";

describe("deadlineLabel", () => {
  it("usa o texto fixo DEADLINE_LABEL com o dia em dd/mm/aaaa", () => {
    expect(deadlineLabel("2026-11-06")).toBe("Inscrições até 06/11/2026, 23h59 (horário de Brasília)");
  });
});

describe("addTagRef", () => {
  const names = { [ID_A]: "Visão Computacional" };

  it("adiciona tag nova pelo nome aparado", () => {
    expect(addTagRef([], { name: "  Python " }, names, 10)).toEqual([{ name: "Python" }]);
  });

  it("não repete nomes com o mesmo slug normalizado", () => {
    const refs = addTagRef([{ name: "Python" }], { name: "python " }, names, 10);
    expect(refs).toEqual([{ name: "Python" }]);
  });

  it("não repete tag nova igual a uma existente já escolhida", () => {
    const refs = addTagRef([{ id: ID_A }], { name: "visao computacional" }, names, 10);
    expect(refs).toEqual([{ id: ID_A }]);
  });

  it("não repete o mesmo id", () => {
    expect(addTagRef([{ id: ID_A }], { id: ID_A }, names, 10)).toEqual([{ id: ID_A }]);
  });

  it("respeita o máximo e ignora nomes sem caracteres aproveitáveis", () => {
    expect(addTagRef([{ name: "a1" }], { name: "b2" }, names, 1)).toEqual([{ name: "a1" }]);
    expect(addTagRef([], { name: "🚀" }, names, 10)).toEqual([]);
  });

  it("remove pela chave", () => {
    const refs = [{ id: ID_A }, { name: "Python" }];
    expect(removeTagRef(refs, tagRefKey({ name: "Python" }))).toEqual([{ id: ID_A }]);
  });
});

describe("form errors", () => {
  it("separa erros do wizard por prefixo", () => {
    const { project, opportunity, rest } = splitPrefixedErrors(
      { "project.name": ["curto"], "opportunity.externalUrl": ["https"], other: ["x"] },
      ["project", "opportunity"],
    );
    expect(project).toEqual({ name: ["curto"] });
    expect(opportunity).toEqual({ externalUrl: ["https"] });
    expect(rest).toEqual({ other: ["x"] });
  });

  it("errorsFor junta o campo e seus subcaminhos", () => {
    const errors = { "tags.THEME": ["max"], "tags.THEME.0.name": ["curto"], title: ["t"] };
    expect(errorsFor(errors, "tags.THEME")).toEqual(["max", "curto"]);
    expect(errorsFor(errors, "tags")).toEqual(["max", "curto"]);
    expect(errorsFor(errors, "titl")).toEqual([]);
    expect(errorsFor(undefined, "title")).toEqual([]);
  });
});

describe("withoutFieldError", () => {
  it("remove o campo e os seus subcaminhos, sem tocar nos vizinhos", () => {
    const errors = { courseId: ["a"], "tags.0": ["b"], tagsExtra: ["c"], message: ["d"] };
    expect(withoutFieldError(errors, "tags")).toEqual({ courseId: ["a"], tagsExtra: ["c"], message: ["d"] });
    expect(withoutFieldError(errors, "courseId")).toEqual({ "tags.0": ["b"], tagsExtra: ["c"], message: ["d"] });
  });

  it("sem erro do campo devolve o mesmo objeto, para não renderizar à toa", () => {
    const errors = { courseId: ["a"] };
    expect(withoutFieldError(errors, "currentSemester")).toBe(errors);
  });
});
