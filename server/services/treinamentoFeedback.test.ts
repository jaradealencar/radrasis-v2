import { describe, expect, it } from "vitest";
import { buildMultipleSelectCorrections } from "./treinamentoFeedback";

describe("buildMultipleSelectCorrections", () => {
  it("returns feedback only for omitted correct choices and selected distractors", () => {
    const corrections = buildMultipleSelectCorrections(
      [
        { id: "right_marked", text: "Correta marcada", correct: true },
        { id: "right_omitted", text: "Correta esquecida", correct: true },
        {
          id: "wrong_marked",
          text: "Errada marcada",
          correct: false,
          feedback: "Nao marque esta opção.",
        },
        {
          id: "wrong_omitted",
          text: "Errada deixada em branco",
          correct: false,
        },
      ],
      ["right_marked", "wrong_marked"]
    );

    expect(corrections).toEqual([
      {
        id: "right_omitted",
        text: "Correta esquecida",
        selectedAnswer: "Não marcada",
        expectedAnswer: "Marcar",
        feedback: "",
      },
      {
        id: "wrong_marked",
        text: "Errada marcada",
        selectedAnswer: "Marcada",
        expectedAnswer: "Não marcar",
        feedback: "Nao marque esta opção.",
      },
    ]);
  });
});
