export type MultipleSelectFeedbackOption = {
  id: string;
  text: string;
  correct?: boolean;
  feedback?: string | null;
};

export type MultipleSelectCorrection = {
  id: string;
  text: string;
  selectedAnswer: string;
  expectedAnswer: string;
  feedback: string;
};

export function buildMultipleSelectCorrections(
  options: MultipleSelectFeedbackOption[],
  selectedIds: string[]
): MultipleSelectCorrection[] {
  const selected = new Set(selectedIds);
  return options.flatMap(option => {
    const wasSelected = selected.has(option.id);
    const isCorrect = option.correct === true;
    if (wasSelected === isCorrect) return [];
    return [
      {
        id: option.id,
        text: option.text,
        selectedAnswer: wasSelected ? "Marcada" : "N\u00e3o marcada",
        expectedAnswer: isCorrect ? "Marcar" : "N\u00e3o marcar",
        feedback: option.feedback ?? "",
      },
    ];
  });
}
