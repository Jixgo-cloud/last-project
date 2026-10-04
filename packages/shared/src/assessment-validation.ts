type AssessmentQuestionInput = {
  id?: string;
  title?: unknown;
  prompt?: unknown;
  difficulty?: unknown;
  points?: unknown;
  starterCode?: unknown;
  solutionCode?: unknown;
  testCases?: unknown;
  evaluationMethod?: unknown;
  rubric?: unknown;
  explanation?: unknown;
  choices?: Array<{ id?: string; text?: unknown; isCorrect?: unknown; order?: unknown }>;
};

type AssessmentInput = {
  title?: unknown;
  type?: unknown;
  timeLimitMinutes?: unknown;
  passingScore?: unknown;
  questions?: AssessmentQuestionInput[];
};

function textValue(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function hasExpectedOutput(value: unknown): boolean {
  if (typeof value === 'string') return value.trim().length > 0;
  if (typeof value === 'number') return Number.isFinite(value);
  return typeof value === 'boolean';
}

function normalizeJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalizeJson);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([key]) => key !== 'id')
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, nested]) => [key, normalizeJson(nested)]),
    );
  }
  return value ?? null;
}

function normalizeRubric(value: unknown): unknown {
  if (typeof value === 'string') return value.trim() || null;
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const rubric = value as Record<string, unknown>;
    if (typeof rubric.customGuidelines === 'string') return rubric.customGuidelines.trim() || null;
  }
  return normalizeJson(value);
}

function normalizedQuestion(question: AssessmentQuestionInput) {
  return {
    title: textValue(question.title),
    prompt: textValue(question.prompt),
    difficulty: question.difficulty ?? 'MEDIUM',
    points: Number(question.points),
    starterCode: textValue(question.starterCode) || null,
    solutionCode: textValue(question.solutionCode) || null,
    testCases: question.evaluationMethod === 'OPEN_ENDED' ? null : normalizeJson(question.testCases),
    evaluationMethod: question.evaluationMethod ?? 'AUTOMATED_TEST_CASES',
    rubric: normalizeRubric(question.rubric),
    explanation: textValue(question.explanation) || null,
    choices: (question.choices ?? []).map((choice) => ({
      text: textValue(choice.text),
      isCorrect: Boolean(choice.isCorrect),
    })),
  };
}

/** Validate assessment content at both the editor and API boundary. */
export function getAssessmentValidationError(input: AssessmentInput): string | null {
  const title = textValue(input.title);
  if (!title) return 'กรุณาระบุชื่อชุดแบบทดสอบ';

  const timeLimit = Number(input.timeLimitMinutes);
  if (!Number.isInteger(timeLimit) || timeLimit < 1 || timeLimit > 240) {
    return 'เวลาทำข้อสอบต้องอยู่ระหว่าง 1 ถึง 240 นาที';
  }

  const passingScore = Number(input.passingScore);
  if (!Number.isFinite(passingScore) || passingScore < 0 || passingScore > 100) {
    return 'คะแนนผ่านต้องอยู่ระหว่าง 0 ถึง 100';
  }

  const questions = input.questions ?? [];
  if (questions.length === 0) return 'กรุณาเพิ่มข้อสอบอย่างน้อย 1 ข้อ';

  for (let index = 0; index < questions.length; index++) {
    const question = questions[index];
    const prefix = `ข้อที่ ${index + 1}: `;
    if (!textValue(question.title)) return `${prefix}กรุณาระบุหัวข้อคำถาม`;
    if (!textValue(question.prompt)) return `${prefix}กรุณาเขียนโจทย์ให้ผู้สมัครเข้าใจว่าต้องทำอะไร`;
    if (!Number.isFinite(Number(question.points)) || Number(question.points) <= 0) {
      return `${prefix}คะแนนของข้อต้องมากกว่า 0`;
    }

    if (input.type === 'THEORY') {
      const choices = question.choices ?? [];
      if (choices.length < 2) return `${prefix}ต้องมีตัวเลือกอย่างน้อย 2 ตัวเลือก`;
      const normalizedTexts = choices.map((choice) => textValue(choice.text));
      if (normalizedTexts.some((text) => !text)) return `${prefix}กรุณากรอกข้อความตัวเลือกให้ครบ`;
      if (normalizedTexts.some((text) => /^(ตัวเลือก|option|choice)\s*[a-z0-9]+$/i.test(text))) {
        return `${prefix}เปลี่ยนข้อความตัวอย่างให้เป็นตัวเลือกคำตอบจริง`;
      }
      if (new Set(normalizedTexts.map((text) => text.toLocaleLowerCase())).size !== normalizedTexts.length) {
        return `${prefix}ตัวเลือกต้องไม่ซ้ำกัน`;
      }
      if (choices.filter((choice) => Boolean(choice.isCorrect)).length !== 1) {
        return `${prefix}กรุณากำหนดคำตอบที่ถูกต้องเพียง 1 ตัวเลือก`;
      }
    } else if (input.type === 'PRACTICAL_CODING') {
      if (question.evaluationMethod === 'AUTOMATED_TEST_CASES') {
        const testCases = Array.isArray(question.testCases) ? question.testCases as Array<Record<string, unknown>> : [];
        if (testCases.length < 2) return `${prefix}กำหนดกรณีทดสอบอย่างน้อย 2 ข้อ`;
        if (!testCases.some((testCase) => !testCase.isHidden)) {
          return `${prefix}ต้องมีกรณีทดสอบที่ผู้สมัครมองเห็นอย่างน้อย 1 ข้อ`;
        }
        if (!testCases.some((testCase) => Boolean(testCase.isHidden))) {
          return `${prefix}ต้องมีกรณีทดสอบที่ซ่อนอย่างน้อย 1 ข้อ`;
        }
        if (testCases.some((testCase) => !hasExpectedOutput(testCase.expectedOutput))) {
          return `${prefix}กรุณาระบุผลลัพธ์ที่คาดหวังของกรณีทดสอบให้ครบ`;
        }
      }
    } else {
      return 'กรุณาเลือกประเภทแบบทดสอบ';
    }
  }

  return null;
}

/** Compare the actual scoring content while ignoring database-only IDs. */
export function assessmentQuestionsMatch(
  existing: AssessmentQuestionInput[],
  incoming: AssessmentQuestionInput[],
): boolean {
  if (existing.length !== incoming.length) return false;
  const existingById = new Map(existing.map((question) => [question.id, normalizedQuestion(question)]));
  if (incoming.some((question) => !question.id || !existingById.has(question.id))) return false;
  return incoming.every((question) => {
    const stored = existingById.get(question.id);
    return JSON.stringify(normalizedQuestion(question)) === JSON.stringify(stored);
  });
}
