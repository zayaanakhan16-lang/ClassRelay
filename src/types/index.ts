/**
 * Shared domain model for ClassRelay.
 *
 * These types are the contract between the browser and the API. The server keeps a
 * mirror copy in `server/lib/types.js` (plain JSDoc) so it can validate payloads
 * without importing TypeScript.
 */

export type ClassmateId = 'mika' | 'rafa' | 'iya' | 'dev';

export interface Classmate {
  id: ClassmateId;
  name: string;
  role: string;
  /** Short line shown under the name in the classroom. */
  tagline: string;
  /** How they question. Used to keep the AI voices distinct. */
  style: string;
  /** Example question shape, shown in the classroom and on the landing page. */
  example: string;
  accent: string;
  /** Hex used for SVG fills where CSS variables are awkward. */
  accentHex: string;
}

export type SlideSource = 'pdf' | 'sample';

export interface Slide {
  /** 1-based slide number. */
  n: number;
  title: string;
  /** Extracted text. Empty for image-only slides. */
  text: string;
  /** Data URL of the rendered slide (PDF only). */
  image?: string;
}

export interface Lesson {
  id: string;
  title: string;
  source: SlideSource;
  fileName?: string;
  slides: Slide[];
  createdAt: number;
}

export type MessageKind = 'statement' | 'question' | 'answer' | 'note' | 'reteach';

export type Mood = 'neutral' | 'confused' | 'skeptical' | 'curious' | 'connecting' | 'satisfied';

/**
 * How hard a classmate's question is. The class starts with a warm-up and escalates as the
 * discussion goes on, the way a real room gets braver once the basics are on the board.
 */
export type Difficulty = 'warmup' | 'core' | 'challenge';

export interface ClassroomMessage {
  id: string;
  who: 'you' | ClassmateId;
  text: string;
  kind: MessageKind;
  slide: number;
  at: number;
  /** Classmate mood, drives the avatar expression and the bubble styling. */
  mood?: Mood;
  /** For a classmate question: how hard it is. */
  difficulty?: Difficulty;
}

/** A classmate who has a hand up, waiting to be called on. */
export interface RaisedHand {
  student: ClassmateId;
  question: string;
  mood: Mood;
  /** Why they raised their hand — surfaced as a nudge, never as the answer. */
  reason: string;
  /** The gap that produced this question, when there is one. */
  gap?: 'missing-step' | 'no-evidence' | 'edge-case' | 'connection' | 'read-aloud';
  /** How hard the question is; the class escalates over the discussion. */
  difficulty?: Difficulty;
}

export interface Misconception {
  student: ClassmateId;
  belief: string;
  /** Slide where the belief first appeared. */
  slide: number;
  corrected: boolean;
  correctedOn?: number;
}

/** One slide's worth of classroom history. */
export interface SlideRecord {
  n: number;
  said: string;
  /** True when the slide was hidden while the student explained it. */
  fromMemory: boolean;
  /** True when the explanation was mostly slide text read out loud. */
  readAloud: boolean;
  conversation: ClassroomMessage[];
  openQuestions: { student: ClassmateId; text: string }[];
}

export interface ClassroomHistoryEntry extends SlideRecord {
  misconceptions: Misconception[];
}

/** Result of one class turn. */
export interface ClassTurnResult {
  /** Classmates now waiting to speak. At most one speaks at a time. */
  hands: RaisedHand[];
  /** A classmate voicing a wrong idea they will keep until corrected. */
  misconception?: { student: ClassmateId; belief: string };
  /** True when the class noticed the student was reading rather than explaining. */
  readAloud: boolean;
  /** Which classmate speaks first this turn. */
  speaker: ClassmateId | null;
  /** The line that classmate says out loud now. */
  line: string;
  /** How hard the spoken question is. */
  difficulty?: Difficulty;
  /** Expression for the speaking classmate. */
  speakerMood?: Mood;
  /** Beliefs from earlier in the class that this turn clearly corrected. */
  corrected?: string[];
  source: 'ai' | 'demo';
}

export interface QuizQuestion {
  id: string;
  slide: number;
  question: string;
  options: string[];
  /** Index into options. Only present in the student's own quiz and the server's answer key. */
  answer?: number;
  explanation?: string;
  concept: string;
}

export type AnswerSource =
  | 'taught'
  | 'never-taught'
  | 'read-aloud'
  | 'unverified-quote'
  | 'quote-unsupported'
  | 'misconception';

/** A classmate's answer to one quiz question. */
export interface ClassAnswer {
  id: string;
  student: ClassmateId;
  /** null means the classmate left it blank. */
  choice: number | null;
  /** The student's own words the answer rests on. */
  quote: string;
  /** Why the answer was accepted or rejected — always shown, never hidden. */
  reason: string;
  source: AnswerSource;
}

export interface ClassQuizResult {
  questions: QuizQuestion[];
  answers: ClassAnswer[];
  source: 'ai' | 'demo';
  notes: string[];
}

/** The student's own quiz. */
export interface SelfQuiz {
  questions: QuizQuestion[];
  source: 'ai' | 'demo';
}

export interface SelfAnswer {
  id: string;
  choice: number | null;
  /** The student's one-sentence "why is the correct answer right?" reasoning. */
  why: string;
  correct: boolean;
  whyVerdict: 'strong' | 'partial' | 'weak' | 'unjudged';
  whyFeedback?: string;
}

export interface ReportItemWrong {
  slide: number;
  youSaid: string;
  quoteVerified: boolean;
  correct: string;
}

export interface ReportItemMissed {
  slide: number;
  concept: string;
  why: string;
}

export interface ReportItemStruggled {
  slide: number;
  question: string;
  strongAnswer: string;
}

export interface ReportItemWhy {
  slide: number;
  question: string;
  strongAnswer: string;
}

export interface ReportItemMisconception extends Misconception {
  name: string;
  correct: string;
}

export interface LearningReport {
  headline: string;
  wrong: ReportItemWrong[];
  missed: ReportItemMissed[];
  struggled: ReportItemStruggled[];
  why: ReportItemWhy[];
  misconceptions: ReportItemMisconception[];
  slideFixes: { slide: number; fix: string }[];
  strengths: string[];
  nextSteps: string[];
  /** Concepts the student can choose to take to a peer room. */
  weakConcepts: WeakConcept[];
  source: 'ai' | 'demo';
}

export interface WeakConcept {
  id: string;
  slide: number;
  concept: string;
  /** A neutral, student-authored description of what is confusing. */
  detail: string;
  /** Optional question the student wants peers to answer. */
  question?: string;
  /** How much of their own explanation they are willing to share. */
  shareLevel: 'concept-only' | 'with-example' | 'with-explanation';
  /** Only filled when shareLevel allows it. */
  sharedExcerpt?: string;
}

/** Study card shown before presenting, generated only from the slides. */
export interface StudyCard {
  slide: number;
  thin: boolean;
  meaning: string;
  example: string;
  why: string;
  mistake: string;
  gaps: string;
  source: 'ai' | 'demo';
}

// ---------- PeerRelay ----------

export type ContributionKind = 'explanation' | 'example' | 'analogy' | 'question' | 'how-i-learned-it';

export interface PeerContribution {
  id: string;
  roomId: string;
  kind: ContributionKind;
  author: string;
  text: string;
  at: number;
  helpful: number;
  /** True when the original student marked this as helpful. */
  markedByOwner: boolean;
  /** AI-generated content is always labelled. */
  aiGenerated: boolean;
  /** A reply to another contribution (used for follow-up questions). */
  parentId?: string;
  /** True when written by the room owner. */
  byOwner: boolean;
}

export interface PeerRoom {
  id: string;
  title: string;
  concept: string;
  detail: string;
  question?: string;
  shareLevel: WeakConcept['shareLevel'];
  sharedExcerpt?: string;
  subject?: string;
  ownerLabel: string;
  createdAt: number;
  updatedAt: number;
  status: 'open' | 'reteaching' | 'closed';
  contributions: PeerContribution[];
  /** Contributions the owner marked as helping them understand. */
  understanding?: string;
}

export interface PeerRoomSummary {
  id: string;
  title: string;
  concept: string;
  subject?: string;
  createdAt: number;
  contributionCount: number;
  open: boolean;
  ownerLabel: string;
}

export interface PeerSuggestion {
  summary: string;
  commonIdeas: string[];
  simplerExplanation: string;
  suggestedQuestion: string;
  /** Suggestions are labelled in the UI. */
  source: 'ai' | 'demo';
}

// ---------- Session ----------

export interface ClassroomSession {
  lesson: Lesson;
  /** Slide numbers the student actually presented. */
  presented: number[];
  history: ClassroomHistoryEntry[];
  misconceptions: Misconception[];
  endedEarly: boolean;
}

export interface ApiError {
  error: string;
  status: number;
}
