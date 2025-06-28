import Dexie from 'dexie';
import { QuizQuestion } from '../types';

export interface StoredTest {
  id: string;
  name: string;
  createdAt: number;
  questions: QuizQuestion[];
  attempts: {
    id: string;
    time: number;
    duration: number;
    selectedAnswers: Record<number, string[]>;
    score: number;
  }[];
}

class QuizDB extends Dexie {
  tests: Dexie.Table<StoredTest, string>;

  constructor() {
    super('QuizDB');
    this.version(1).stores({
      tests: 'id, name, createdAt',
    });
    this.tests = this.table('tests');
  }
}

export const db = new QuizDB();

