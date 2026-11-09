/**
 * Typed wrappers around the AI tasks, plus the health probe that tells the UI whether
 * it is running with live AI or the built-in simulation.
 */
import { askTask, getHealth, type HealthInfo } from './api';
import type {
  ClassQuizResult,
  ClassTurnResult,
  ClassroomHistoryEntry,
  ClassmateId,
  Lesson,
  LearningReport,
  PeerSuggestion,
  PeerRoom,
  QuizQuestion,
  SelfAnswer,
  SelfQuiz,
  StudyCard,
  WeakConcept,
} from '@/types';

export { getHealth, type HealthInfo };

export interface ClassTurnPayload {
  lesson: Lesson;
  slideIndex: number;
  slideText: string;
  said: string;
  round: number;
  calledOn: ClassmateId | null;
  answer?: string;
  open: { student: ClassmateId; text: string }[];
  held: { id: string; student: ClassmateId; belief: string; slide: number }[];
  history: ClassroomHistoryEntry[];
  conversation?: unknown[];
  recalled: boolean;
  askedQuestions: string[];
}

export const classTurn = (payload: ClassTurnPayload, signal?: AbortSignal) =>
  askTask<ClassTurnResult>('classTurn', payload, signal);

export const studyCard = (payload: { lesson: Lesson; slideIndex: number; slideText: string }, signal?: AbortSignal) =>
  askTask<StudyCard>('studyCard', payload, signal);

export const classQuiz = (payload: { lesson: Lesson; presented: number[] }, signal?: AbortSignal) =>
  askTask<{ questions: QuizQuestion[]; source: 'ai' | 'demo' }>('classQuiz', payload, signal);

export const gradeClassQuiz = (
  payload: {
    lesson: Lesson;
    presented: number[];
    questions: QuizQuestion[];
    transcript: string;
    ownTranscript: string;
    recalledTranscript: string;
    readAloudSlides: number[];
    misconceptions: unknown[];
  },
  signal?: AbortSignal,
) => askTask<ClassQuizResult>('gradeClassQuiz', payload, signal);

export const selfQuiz = (payload: { lesson: Lesson; presented: number[] }, signal?: AbortSignal) =>
  askTask<SelfQuiz>('selfQuiz', payload, signal);

export const judgeWhy = (
  payload: { question: string; options: string[]; answer: number; explanation: string; why: string },
  signal?: AbortSignal,
) => askTask<{ verdict: SelfAnswer['whyVerdict']; feedback: string; source: 'ai' | 'demo' }>('judgeWhy', payload, signal);

export const learningReport = (
  payload: {
    lesson: Lesson;
    presented: number[];
    history: ClassroomHistoryEntry[];
    classResult: ClassQuizResult | null;
    selfResults: SelfAnswer[] | null;
    misconceptions: unknown[];
  },
  signal?: AbortSignal,
) => askTask<LearningReport>('report', payload, signal);

export const peerSuggestions = (room: PeerRoom, signal?: AbortSignal) =>
  askTask<PeerSuggestion>('peerSuggestions', { room }, signal);

export type { WeakConcept };
