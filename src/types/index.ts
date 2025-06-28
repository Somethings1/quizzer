export interface QuizAnswer {
  correct: boolean;
  content: string;
  explanation: string;
}

export interface QuizQuestion {
  statement: string;
  answer: QuizAnswer[];
}

export interface TestSession {
  mode: 'taking' | 'reviewing';
  testId: string;
  options?: {
    instantFeedback: boolean;
  };
}

