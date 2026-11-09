/**
 * The demo engine.
 *
 * ClassRelay must be fully usable with no API key, so every AI task has a deterministic
 * fallback here. Nothing in this file is presented as real AI: results are tagged
 * `source: 'demo'` and the UI labels them "Simulated".
 *
 * The engine is rule-based, not random: the same explanation always produces the same
 * class reaction, so the demo is reproducible and can be reasoned about.
 */

import { CLASSMATES, CLASSMATE_IDS, classmateName } from './classmates.js';
import { arr, int, normalizeWords, readAloudShare, str, wordCount, quoteIsReal } from './text.js';

const STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'if', 'then', 'that', 'this', 'these', 'those', 'is', 'are', 'was', 'were',
  'be', 'been', 'being', 'it', 'its', 'of', 'to', 'in', 'on', 'at', 'by', 'for', 'with', 'from', 'as', 'so', 'we',
  'you', 'they', 'he', 'she', 'i', 'my', 'your', 'our', 'their', 'them', 'us', 'me', 'do', 'does', 'did', 'can',
  'could', 'would', 'should', 'will', 'just', 'about', 'into', 'out', 'up', 'down', 'more', 'most', 'some', 'any',
  'there', 'here', 'when', 'where', 'what', 'which', 'who', 'how', 'why', 'not', 'no', 'yes', 'have', 'has', 'had',
  'also', 'like', 'get', 'gets', 'got', 'go', 'goes', 'make', 'makes', 'made', 'use', 'uses', 'used', 'one', 'two',
]);

const contentWords = (text) => normalizeWords(text).filter((w) => w.length > 3 && !STOPWORDS.has(w));

const overlaps = (a, b) => {
  const setB = new Set(contentWords(b));
  return contentWords(a).filter((w) => setB.has(w)).length;
};

const isSampleLesson = (lesson) => /photosynthesis/i.test(`${lesson?.title || ''} ${lesson?.id || ''}`);

const MIN_EXPLAIN_WORDS = 8;

// ---------------------------------------------------------------------------
// Scripted material for the built-in photosynthesis lesson
// ---------------------------------------------------------------------------

const SCRIPTED_QUESTIONS = {
  1: [
    {
      student: 'mika',
      question: 'Wait — you said plants make their own food, but I missed the part where they actually build it. Where does the sugar come from?',
      mood: 'confused',
      gap: 'missing-step',
      reason: 'Mika lost the thread between "producers" and "glucose".',
    },
    {
      student: 'rafa',
      question: 'You called plants "producers". What evidence do we have that they make their own food rather than taking it from somewhere?',
      mood: 'skeptical',
      gap: 'no-evidence',
      reason: 'Rafa wants support for the claim before he accepts it.',
    },
  ],
  2: [
    {
      student: 'rafa',
      question: 'You said chlorophyll absorbs red and blue light. How do we know that — what supports it, instead of it just reflecting green?',
      mood: 'skeptical',
      gap: 'no-evidence',
      reason: 'Rafa is checking whether the claim about colour is backed up.',
    },
    {
      student: 'iya',
      question: 'What if a plant only ever got green light? Would it still grow as fast, or would it struggle?',
      mood: 'curious',
      gap: 'edge-case',
      reason: 'Iya is testing the idea with a change of conditions.',
    },
  ],
  3: [
    {
      student: 'mika',
      question: 'You said carbon dioxide comes in through the stomata — what exactly is a stoma? I do not think you explained that part.',
      mood: 'confused',
      gap: 'missing-step',
      reason: 'Mika noticed a term that was used but never defined.',
    },
    {
      student: 'dev',
      question: 'How does this connect to the oxygen that comes out at the end? Is the carbon dioxide the same thing as the oxygen?',
      mood: 'connecting',
      gap: 'connection',
      reason: 'Dev is linking this slide to the final product of the lesson.',
    },
  ],
  4: [
    {
      student: 'rafa',
      question: 'You said the energy is stored in the chemical bonds of glucose. How do we know the energy is in the bonds and not somewhere else?',
      mood: 'skeptical',
      gap: 'no-evidence',
      reason: 'Rafa is asking for the reason behind a claim.',
    },
    {
      student: 'iya',
      question: 'What happens to the glucose if the plant does not need it straight away? Does it just sit there?',
      mood: 'curious',
      gap: 'edge-case',
      reason: 'Iya is pushing the idea into a situation the slide does not cover.',
    },
  ],
  5: [
    {
      student: 'dev',
      question: 'How does this link back to the water from slide 3? You said the oxygen comes from the water — how does splitting water give oxygen?',
      mood: 'connecting',
      gap: 'connection',
      reason: 'Dev connected this slide to the water mentioned earlier.',
    },
    {
      student: 'mika',
      question: 'Wait — I thought the oxygen came from the carbon dioxide. How can it come from water instead?',
      mood: 'confused',
      gap: 'missing-step',
      reason: 'Mika is mixing up the two raw materials.',
    },
  ],
};

const SCRIPTED_MISCONCEPTIONS = {
  1: { student: 'mika', belief: 'plants get their food from the soil' },
  2: { student: 'rafa', belief: 'leaves are green because plants absorb green light' },
  3: { student: 'dev', belief: 'carbon dioxide and oxygen are basically the same gas' },
  5: { student: 'iya', belief: 'the oxygen released comes from the carbon dioxide' },
};

const CORRECTION_HINTS = {
  'plants get their food from the soil': ['soil', 'glucose', 'sugar', 'makes', 'make', 'food', 'own'],
  'leaves are green because plants absorb green light': ['reflect', 'reflects', 'absorb', 'absorbs', 'green', 'chlorophyll'],
  'carbon dioxide and oxygen are basically the same gas': ['different', 'oxygen', 'carbon', 'separate', 'not', 'products'],
  'the oxygen released comes from the carbon dioxide': ['water', 'split', 'splits', 'not', 'carbon', 'instead'],
};

const READ_ALOUD_NUDGES = [
  { student: 'mika', line: 'You just read the slide out loud. I can read too — what does it actually mean?' },
  { student: 'dev', line: 'I followed the words, but I am not sure you explained them. Can you say it in your own words?' },
  { student: 'rafa', line: 'That sounded like the slide itself. What is the idea underneath it?' },
  { student: 'iya', line: 'Reading it to me is not quite explaining it. How would you tell a friend about this?' },
];

const WEAK_EXPLANATION_LINES = [
  { student: 'mika', line: 'Wait — that was really short. I do not think I got anything from it.' },
  { student: 'rafa', line: 'I did not hear an explanation there. What are you actually trying to tell us?' },
];

// ---------------------------------------------------------------------------
// Scripted class quiz (photosynthesis)
// ---------------------------------------------------------------------------

export const SCRIPTED_CLASS_QUIZ = [
  {
    id: 'c1',
    slide: 1,
    concept: 'What producers actually do',
    question: 'What do plants do that makes them "producers"?',
    options: [
      'They make their own food (glucose) using light energy.',
      'They take their food from the soil through the roots.',
      'They absorb ready-made food from nearby plants.',
      'They eat small insects to get their sugar.',
    ],
    answer: 0,
    explanation: 'Plants build glucose themselves from light energy, which is what "producer" means.',
    signals: [['glucose', 'light'], ['make', 'food'], ['own', 'food'], ['sugar', 'light'], ['build', 'sugar']],
  },
  {
    id: 'c2',
    slide: 2,
    concept: 'Why leaves are green',
    question: 'Why do leaves look green to us?',
    options: [
      'Chlorophyll absorbs green light and lets the rest through.',
      'Chlorophyll absorbs red and blue light and reflects green light.',
      'Leaves store green-coloured water from the soil.',
      'Green light carries the most energy, so leaves glow green.',
    ],
    answer: 1,
    explanation: 'Chlorophyll uses red and blue light and reflects green, and the reflected green is what we see.',
    signals: [['reflect', 'green'], ['reflects', 'green'], ['chlorophyll', 'reflect'], ['green', 'reflected']],
  },
  {
    id: 'c3',
    slide: 3,
    concept: 'How carbon dioxide gets in',
    question: 'How does carbon dioxide get into the leaf?',
    options: [
      'It is pulled up from the soil with the water.',
      'It is made inside the leaf from the glucose.',
      'It enters from the air through small openings called stomata.',
      'It travels up the stem from the roots.',
    ],
    answer: 2,
    explanation: 'Carbon dioxide comes from the air and passes through the stomata in the leaf.',
    signals: [['stomata'], ['openings'], ['air', 'leaf'], ['carbon', 'air']],
  },
  {
    id: 'c4',
    slide: 4,
    concept: 'Why glucose stores energy',
    question: 'What happens to the energy from sunlight during photosynthesis?',
    options: [
      'It is stored in the chemical bonds of glucose.',
      'It disappears once the sugar has been made.',
      'It is stored as heat inside the leaf.',
      'It turns straight into oxygen gas.',
    ],
    answer: 0,
    explanation: 'The light energy ends up stored in the chemical bonds of glucose, which is why glucose is useful.',
    signals: [['bonds', 'glucose'], ['stored', 'energy'], ['energy', 'bonds'], ['chemical', 'bonds']],
  },
  {
    id: 'c5',
    slide: 5,
    concept: 'Where the released oxygen comes from',
    question: 'Where does the oxygen released by photosynthesis come from?',
    options: [
      'From the carbon dioxide that was absorbed.',
      'From the water molecules that are split.',
      'From the glucose that is not needed.',
      'From the air that was already inside the leaf.',
    ],
    answer: 1,
    explanation: 'The water molecules are split, and the oxygen released comes from that water.',
    signals: [['water', 'oxygen'], ['split', 'water'], ['oxygen', 'water'], ['splitting', 'water']],
  },
];

export const SCRIPTED_SELF_QUIZ = [
  {
    id: 's1',
    slide: 1,
    concept: 'What producers do',
    question: 'Why are plants called producers?',
    options: [
      'They produce oxygen for other living things.',
      'They produce their own food from light energy.',
      'They produce seeds that other animals eat.',
      'They produce glucose from the soil.',
    ],
    answer: 1,
    explanation: 'A producer makes its own food. Plants build glucose using light energy instead of eating other organisms.',
  },
  {
    id: 's2',
    slide: 2,
    concept: 'Why leaves are green',
    question: 'Which statement explains why leaves look green?',
    options: [
      'Chlorophyll reflects green light and absorbs red and blue light.',
      'Chlorophyll absorbs green light and turns it into food.',
      'The leaf stores green water from the roots.',
      'Green light is the only light that reaches leaves.',
    ],
    answer: 0,
    explanation: 'The green light is reflected rather than absorbed, so it reaches our eyes. The absorbed red and blue light powers photosynthesis.',
  },
  {
    id: 's3',
    slide: 3,
    concept: 'The two raw materials',
    question: 'Which two raw materials does photosynthesis need?',
    options: [
      'Oxygen and glucose.',
      'Carbon dioxide and water.',
      'Water and glucose.',
      'Sunlight and oxygen.',
    ],
    answer: 1,
    explanation: 'The word equation is carbon dioxide + water + light energy, so the raw materials are carbon dioxide and water.',
  },
  {
    id: 's4',
    slide: 4,
    concept: 'Why glucose matters',
    question: 'Why does the plant bother to make glucose?',
    options: [
      'To store energy in a form the plant can use later.',
      'To make the leaves look greener.',
      'To get rid of the carbon dioxide.',
      'To cool the leaf down in the sun.',
    ],
    answer: 0,
    explanation: 'Glucose stores the light energy in its chemical bonds, and the plant can release that energy later through respiration.',
  },
  {
    id: 's5',
    slide: 5,
    concept: 'Source of the released oxygen',
    question: 'The oxygen released by photosynthesis comes from…',
    options: [
      'the carbon dioxide taken in from the air.',
      'the water that is split during the reaction.',
      'the glucose the plant has already made.',
      'the chlorophyll inside the chloroplasts.',
    ],
    answer: 1,
    explanation: 'Water molecules are split, and the oxygen released comes from that water, not from the carbon dioxide.',
  },
];

// ---------------------------------------------------------------------------
// Slide analysis
// ---------------------------------------------------------------------------

const WHY_MARKERS = /\b(because|since|so that|which means|this means|the reason|as a result|therefore|why|how)\b/i;
const EVIDENCE_MARKERS = /\b(\d|%|study|studies|evidence|data|proves|prove|experiment|measured)\b/i;

function slideSentences(slide) {
  return String(slide?.text || '')
    .split(/\n+/)
    .flatMap((line) => line.split(/(?<=[.!?])\s+/))
    .map((s) => s.trim())
    .filter((s) => s.length > 12);
}

/** The slide text without its title line, used when suggesting what a re-explanation should cover. */
function slideBody(slide) {
  const lines = String(slide?.text || '')
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  return lines.slice(1).join(' ') || lines[0] || 'the key idea on this slide';
}

/** Generic questions derived from any slide, used when the lesson is not the sample. */
function genericQuestions(slide, index) {
  const sentences = slideSentences(slide);
  const topic = (slide?.title || `slide ${slide?.n}`).trim();
  const first = sentences[0] || topic;
  const phrase = first.split(/\s+/).slice(0, 8).join(' ');
  const rotation = ['mika', 'rafa', 'iya', 'dev'];
  const a = rotation[index % 4];
  const b = rotation[(index + 2) % 4];
  return [
    {
      student: a,
      question:
        a === 'mika'
          ? `Wait — "${phrase}…" — how did you get from that to the next step? I think something was skipped.`
          : a === 'rafa'
            ? `You said "${phrase}". What supports that — why should we believe it?`
            : a === 'iya'
              ? `Would that still be true if the conditions were different? What is the edge case here?`
              : `How does "${topic}" connect to the earlier slides in this lesson?`,
      mood: a === 'mika' ? 'confused' : a === 'rafa' ? 'skeptical' : a === 'iya' ? 'curious' : 'connecting',
      gap: a === 'mika' ? 'missing-step' : a === 'rafa' ? 'no-evidence' : a === 'iya' ? 'edge-case' : 'connection',
      reason: `${classmateName(a)} has a question about the explanation on this slide.`,
    },
    {
      student: b,
      question:
        b === 'dev'
          ? `How does this slide relate to what we covered before? I am trying to see the whole picture.`
          : b === 'iya'
            ? `What would happen in a slightly different situation? I want to check the boundary.`
            : b === 'rafa'
              ? `Which part of that is a claim, and which part is something we can actually check?`
              : `Could you say the middle part again? I lost you between "${phrase}" and the end.`,
      mood: b === 'dev' ? 'connecting' : b === 'iya' ? 'curious' : b === 'rafa' ? 'skeptical' : 'confused',
      gap: b === 'dev' ? 'connection' : b === 'iya' ? 'edge-case' : b === 'rafa' ? 'no-evidence' : 'missing-step',
      reason: `${classmateName(b)} has a second question on this slide.`,
    },
  ];
}

// ---------------------------------------------------------------------------
// Demo: one class turn
// ---------------------------------------------------------------------------

/**
 * @returns {{ hands, speaker, line, readAloud, misconception? }}
 */
export function demoClassTurn(payload) {
  const slideIndex = int(payload.slideIndex, 0);
  const slideNumber = slideIndex + 1;
  const round = Math.max(0, int(payload.round, 0));
  const lesson = payload.lesson || {};
  const slide = arr(lesson.slides).find((s) => int(s.n) === slideNumber) || { n: slideNumber, text: '' };
  const said = str(payload.said, 8000);
  const answer = str(payload.answer, 2000);
  const open = arr(payload.open).filter((q) => CLASSMATES[q?.student] && q.text);
  const held = arr(payload.held).filter((b) => CLASSMATES[b?.student] && b.belief);

  const sample = isSampleLesson(lesson);
  const allSlideText = arr(lesson.slides)
    .map((s) => str(s.text, 4000))
    .join(' \n ');
  const readAloud =
    !payload.recalled &&
    Math.max(readAloudShare(said, slide.text), readAloudShare(said, allSlideText)) >= 0.6;
  const weak = wordCount(said) < MIN_EXPLAIN_WORDS;

  if (round === 0) {
    const scripted = sample
      ? SCRIPTED_QUESTIONS[slideNumber] || []
      : genericQuestions(slide, slideIndex);
    const asked = new Set(arr(payload.askedQuestions));
    let questions = scripted.filter((q) => !asked.has(q.question));

    if (readAloud) {
      const nudge = READ_ALOUD_NUDGES[slideIndex % READ_ALOUD_NUDGES.length];
      questions = [
        { student: nudge.student, question: nudge.line, mood: 'confused', gap: 'read-aloud', reason: 'The class noticed the slide was read rather than explained.' },
        ...questions,
      ];
    } else if (weak) {
      const nudge = WEAK_EXPLANATION_LINES[slideIndex % WEAK_EXPLANATION_LINES.length];
      questions = [
        { student: nudge.student, question: nudge.line, mood: 'confused', gap: 'missing-step', reason: 'The explanation was too short to follow.' },
        ...questions,
      ];
    }
    if (!questions.length) {
      questions = genericQuestions(slide, slideIndex);
    }

    const [first, ...rest] = questions;
    const alreadyHeld = new Set(held.map((b) => b.belief));
    const candidate = sample ? SCRIPTED_MISCONCEPTIONS[slideNumber] : null;
    let misconception;
    if (candidate && !alreadyHeld.has(candidate.belief) && !readAloud) {
      misconception = { student: candidate.student, belief: candidate.belief };
    }

    return {
      hands: rest.map((q, i) => ({ student: q.student, question: q.question, mood: q.mood, reason: q.reason, gap: q.gap, difficulty: difficultyAt(i + 1) })),
      speaker: first.student,
      line: first.question,
      difficulty: difficultyAt(0),
      readAloud,
      ...(misconception ? { misconception } : {}),
    };
  }

  // Later rounds: did the answer resolve the open question(s)?
  const calledOn = CLASSMATES[payload.calledOn] ? payload.calledOn : null;
  const target = calledOn || open[0]?.student || null;
  const sufficient =
    wordCount(answer) >= 5 && (overlaps(answer, open.find((q) => q.student === target)?.text || '') >= 1 || wordCount(answer) >= 12);

  const resolved = new Set();
  if (target && sufficient) resolved.add(target);

  const stillOpen = open.filter((q) => !resolved.has(q.student));

  // Misconception correction: a clear "no, actually…" in the answer.
  const corrected = [];
  for (const belief of held) {
    const words = normalizeWords(answer);
    const hints = CORRECTION_HINTS[belief.belief] || [];
    const denies = /\b(not|no|never|isn't|doesn't|aren't|actually|instead|rather|wrong|reflects|different)\b/i.test(answer);
    if (denies && wordCount(answer) >= 6 && hints.some((h) => words.includes(h))) {
      corrected.push(belief);
    }
  }

  const nextSpeaker = stillOpen[0]?.student || null;
  let line = '';
  if (stillOpen.length && !resolved.size) {
    line = followUp(target, stillOpen.find((q) => q.student === target)?.text || '');
  } else if (corrected.length) {
    line = '';
  }

  return {
    hands: stillOpen.map((q, i) => ({ student: q.student, question: q.text, mood: q.mood || 'neutral', reason: 'Still waiting for a clear answer.', difficulty: difficultyAt(i) })),
    speaker: line ? target : nextSpeaker,
    line: line || (stillOpen.length ? '' : ''),
    difficulty: difficultyAt(0),
    readAloud: false,
    corrected: corrected.map((b) => b.belief),
  };
}

/** Easy first, then core, then challenge — the demo engine escalates the same way the prompt does. */
function difficultyAt(index) {
  return index <= 0 ? 'warmup' : index === 1 ? 'core' : 'challenge';
}

function followUp(student, question) {
  if (student === 'mika') return 'Hmm, I am still not sure I follow. Can you say the missing step out loud?';
  if (student === 'rafa') return 'That still does not tell me why. What is the reason behind it?';
  if (student === 'iya') return 'Okay, but what if the situation changed? Does your answer still hold?';
  if (student === 'dev') return 'I still do not see how that connects to the rest of the lesson. Can you link it?';
  return `Could you go a bit further? I am not sure that answered: ${str(question, 120)}`;
}

// ---------------------------------------------------------------------------
// Demo: class quiz
// ---------------------------------------------------------------------------

function genericClassQuiz(slides) {
  const questions = [];
  let index = 0;
  for (const slide of slides) {
    index++;
    const sentences = slideSentences(slide);
    if (!sentences.length) continue;
    const target = sentences[0];
    const words = normalizeWords(target);
    const keyIndex = words.findIndex((w) => w.length > 5 && !STOPWORDS.has(w));
    const key = keyIndex === -1 ? words[0] : words[keyIndex];
    const blanked = target.replace(new RegExp(`\\b${key}\\b`, 'i'), '_____');
    const others = [];
    for (const other of slides) {
      if (other.n === slide.n) continue;
      for (const s of slideSentences(other)) {
        const w = normalizeWords(s).find((x) => x.length > 5 && !STOPWORDS.has(x) && x !== key);
        if (w && !others.includes(w)) others.push(w);
        if (others.length >= 3) break;
      }
      if (others.length >= 3) break;
    }
    const options = [key, ...others].map((o) => o.charAt(0).toUpperCase() + o.slice(1));
    questions.push({
      id: `g${index}`,
      slide: slide.n,
      concept: slide.title || `Slide ${slide.n}`,
      question: `According to your slides: ${blanked}`,
      options,
      answer: 0,
      explanation: `Your slide says: ${target}`,
      signals: [[key], [key, 'light']],
    });
  }
  return questions;
}

export function demoClassQuiz(lesson, presentedNumbers) {
  const slides = arr(lesson?.slides).filter((s) => presentedNumbers.includes(int(s.n)));
  if (isSampleLesson(lesson)) {
    return SCRIPTED_CLASS_QUIZ.filter((q) => presentedNumbers.includes(q.slide)).map((q) => ({ ...q }));
  }
  return genericClassQuiz(slides);
}

function findQuote(transcript, groups) {
  const sentences = String(transcript || '')
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
  for (const group of groups) {
    for (const sentence of sentences) {
      const words = normalizeWords(sentence);
      if (group.every((g) => words.includes(g))) return sentence.slice(0, 240);
    }
  }
  return '';
}

function relevantMisconception(question, misconceptions) {
  return misconceptions.find((m) => !m.corrected && int(m.slide) === int(question.slide));
}

/**
 * Grades the class quiz deterministically, applying the same honesty rules as the real
 * path: a real quote or no answer, reading is not teaching, and a wrong idea the student
 * never corrected is reproduced rather than silently fixed.
 */
export function demoGradeClassQuiz({ lesson, questions, transcript, ownTranscript, readAloudSlides, misconceptions }) {
  const spoken = normalizeWords(transcript);
  const own = normalizeWords(ownTranscript || transcript);
  const answers = [];
  const notes = [];

  for (const q of questions) {
    const quote = findQuote(transcript, q.signals || []);
    const ownQuote = findQuote(ownTranscript || transcript, q.signals || []);
    const readAloudHere = readAloudSlides.includes(int(q.slide));

    for (const student of CLASSMATE_IDS) {
      const belief = relevantMisconception(q, misconceptions);
      if (belief && belief.student === student) {
        answers.push({
          id: q.id,
          student,
          choice: wrongOption(q),
          quote: '',
          source: 'misconception',
          reason: `${classmateName(student)} answered from the wrong idea it was still holding (\u201c${belief.belief}\u201d) because you never corrected it in class.`,
        });
        continue;
      }
      if (!quote || !quoteIsReal(quote, spoken)) {
        answers.push({
          id: q.id,
          student,
          choice: null,
          quote: '',
          source: 'never-taught',
          reason: 'You never taught this clearly enough to answer.',
        });
        continue;
      }
      if (readAloudHere && !ownQuote) {
        answers.push({
          id: q.id,
          student,
          choice: null,
          quote: '',
          source: 'read-aloud',
          reason: `These words were read off the slide (\u201c${quote}\u201d), not explained in your own words.`,
        });
        continue;
      }
      answers.push({
        id: q.id,
        student,
        choice: int(q.answer, 0),
        quote: ownQuote || quote,
        source: 'taught',
        reason: 'Your explanation covered this, so it answered from what you said.',
      });
    }
  }

  const blanks = answers.filter((a) => a.choice === null).length;
  if (blanks) notes.push(`${blanks} answer(s) were left blank because the class was never taught those ideas clearly.`);
  if (readAloudSlides.length) notes.push(`Slide ${readAloudSlides.join(', ')} was mostly read out loud, so reading it did not count as teaching.`);
  return { questions, answers, notes };
}

function wrongOption(q) {
  const correct = int(q.answer, 0);
  return correct === 0 ? 1 : 0;
}

// ---------------------------------------------------------------------------
// Demo: the student's own quiz
// ---------------------------------------------------------------------------

export function demoSelfQuiz(lesson, presentedNumbers) {
  if (isSampleLesson(lesson)) {
    return SCRIPTED_SELF_QUIZ.filter((q) => presentedNumbers.includes(q.slide)).map((q) => ({ ...q }));
  }
  return demoClassQuiz(lesson, presentedNumbers).map((q, i) => ({
    ...q,
    id: `s${i + 1}`,
    question: q.question.replace('According to your slides:', 'Fill in from memory:'),
  }));
}

/** Heuristic judgement of the student's one-sentence reasoning. */
export function demoJudgeWhy(question, why) {
  const words = normalizeWords(why);
  if (words.length < 3) {
    return { verdict: 'weak', feedback: 'Write at least one full sentence explaining the reason.' };
  }
  const causal = /\b(because|since|so|therefore|which means|this means|as a result|so that)\b/i.test(why);
  const reference = `${question?.explanation || ''} ${question?.question || ''}`;
  const relevant = overlaps(why, reference) >= 1;
  if (words.length >= 8 && causal && relevant) {
    return { verdict: 'strong', feedback: 'That is a clear reason, and it uses the right idea. Nice.' };
  }
  if (words.length >= 6 && (causal || relevant)) {
    return { verdict: 'partial', feedback: 'You are close. Try to name the exact reason the answer works, not just the answer itself.' };
  }
  return { verdict: 'weak', feedback: 'This restates the answer rather than explaining why it is right. Add the reason behind it.' };
}

// ---------------------------------------------------------------------------
// Demo: study card
// ---------------------------------------------------------------------------

const SCRIPTED_STUDY = {
  1: {
    meaning:
      'Photosynthesis is how a plant makes its own food. The plant is a producer: instead of eating other things, it builds glucose (a sugar) using energy from light.',
    example: 'Think of the leaf as a tiny kitchen that uses sunlight instead of electricity to cook sugar.',
    why: 'Plants need a supply of energy-rich food to grow, and they make it themselves from light.',
    mistake: 'A common mistake is thinking plants get their food from the soil. The soil gives water and minerals, but the sugar is made in the leaf.',
    gaps: 'The slide does not explain exactly how light energy becomes chemical energy — that is the part to look up.',
  },
  2: {
    meaning:
      'Sunlight supplies the energy for photosynthesis. Chlorophyll, the green pigment in chloroplasts, absorbs the light. It takes in red and blue light and reflects green light.',
    example: 'A green filter in front of a lamp: the leaf keeps the red and blue and bounces the green back at you.',
    why: 'Because green light is reflected rather than absorbed, it reaches our eyes, which is why leaves look green.',
    mistake: 'It is tempting to say plants "absorb green light". They do the opposite: they reflect it.',
    gaps: 'The slide does not say which specific wavelengths are best absorbed — you may want to check a textbook.',
  },
  3: {
    meaning:
      'Photosynthesis needs two raw materials: water and carbon dioxide. Water is taken up by the roots and carried up the stem. Carbon dioxide comes from the air and enters the leaf through small openings called stomata.',
    example: 'The stomata work like tiny windows in the leaf that open to let air in.',
    why: 'Both materials are needed because they supply the atoms the plant rearranges into glucose.',
    mistake: 'Carbon dioxide and oxygen are not the same gas — they are different molecules with different jobs here.',
    gaps: 'The slide does not explain what opens and closes the stomata.',
  },
  4: {
    meaning:
      'The energy captured from sunlight is stored in the chemical bonds of glucose. The plant uses glucose for respiration to release energy for growth, and can store the rest as starch or use it for cellulose in cell walls.',
    example: 'Glucose is like a charged battery the plant can spend whenever it needs energy.',
    why: 'Energy has to be kept in a stable form, and chemical bonds are a compact way to store it.',
    mistake: 'Glucose is not just "food" that disappears — it is stored and reused, so the plant can call on that energy later.',
    gaps: 'The slide does not say how the bonds actually capture the energy.',
  },
  5: {
    meaning:
      'Oxygen is released as a by-product of photosynthesis. It comes from the water molecules that are split, not from the carbon dioxide. That released oxygen is the main source of oxygen in the atmosphere.',
    example: 'Picture the water molecule being taken apart, and one of its pieces floats away as oxygen.',
    why: 'Water is split during the reaction, and the oxygen it releases leaves the leaf.',
    mistake: 'Many people think the oxygen comes from carbon dioxide. It comes from the water instead.',
    gaps: 'The slide does not explain what happens to the hydrogen left over from splitting water.',
  },
};

export function demoStudyCard(lesson, slideIndex) {
  const slide = arr(lesson?.slides).find((s) => int(s.n) === slideIndex + 1);
  const text = String(slide?.text || '').trim();
  if (text.replace(/\s+/g, ' ').length < 40) {
    return {
      slide: slideIndex + 1,
      thin: true,
      meaning: '',
      example: '',
      why: '',
      mistake: '',
      gaps: 'This slide has almost no text, so there is nothing reliable to study from it here. Check your notes or textbook for this part.',
      source: 'demo',
    };
  }
  const scripted = isSampleLesson(lesson) ? SCRIPTED_STUDY[slideIndex + 1] : null;
  if (scripted) return { slide: slideIndex + 1, thin: false, ...scripted, source: 'demo' };

  const sentences = slideSentences(slide);
  const hasWhy = WHY_MARKERS.test(text);
  const hasEvidence = EVIDENCE_MARKERS.test(text);
  return {
    slide: slideIndex + 1,
    thin: false,
    meaning: sentences.slice(0, 3).join(' ') || text.slice(0, 400),
    example: 'Try to connect this to something you already know from everyday life — that is the fastest way to make it stick.',
    why: hasWhy ? 'The slide gives a reason, so keep it in mind when you explain.' : '',
    mistake: 'Watch out for terms the slide uses without defining them; classmates will ask about those.',
    gaps: hasEvidence
      ? 'The slide makes claims — be ready to say what supports them.'
      : 'The slide does not explain why this is true, so be ready to say what you know and what you are unsure about.',
    source: 'demo',
  };
}

// ---------------------------------------------------------------------------
// Demo: learning report
// ---------------------------------------------------------------------------

export function demoReport({ lesson, history, classResult, selfResults, misconceptions, presentedNumbers }) {
  const historyArr = arr(history);
  const readAloudSlides = historyArr.filter((h) => h.readAloud).map((h) => int(h.n)).filter(Boolean);
  const transcript = historyArr.map((h) => str(h.said, 8000)).join(' \n\n ');

  const wrong = [];
  const missed = [];
  const struggled = [];
  const why = [];
  const slideFixes = [];
  const strengths = [];

  const questionsById = new Map(arr(classResult?.questions).map((q) => [q.id, q]));

  // Missed: questions the class could not answer.
  for (const answer of arr(classResult?.answers).filter((a) => a.source === 'never-taught')) {
    const q = questionsById.get(answer.id);
    if (!q || missed.some((m) => m.slide === q.slide && m.concept === q.concept)) continue;
    missed.push({
      slide: q.slide,
      concept: q.concept,
      why: 'You never explained this in your own words, so the class could not answer it.',
    });
  }

  // Wrong: slides where the student read the slide instead of explaining it.
  for (const n of readAloudSlides) {
    const entry = historyArr.find((h) => int(h.n) === n);
    const slide = arr(lesson?.slides).find((s) => int(s.n) === n);
    const said = str(entry?.said, 400);
    wrong.push({
      slide: n,
      youSaid: said,
      quoteVerified: true,
      correct: `In your own words, slide ${n} should explain: ${slideBody(slide)}`,
    });
    slideFixes.push({ slide: n, fix: 'Say what this slide means as if to a younger student, with one example, without reading it out.' });
  }

  // Struggled: questions left open when the student moved on.
  for (const entry of historyArr) {
    for (const open of arr(entry.openQuestions)) {
      struggled.push({
        slide: int(entry.n),
        question: open.text,
        strongAnswer: `A strong answer would name the missing step and explain it with a concrete example from slide ${entry.n}.`,
      });
    }
  }

  // Why: self-quiz questions the student could not reason about.
  for (const result of arr(selfResults)) {
    if (result.whyVerdict === 'weak' || result.whyVerdict === 'partial') {
      const q = questionsById.get(result.id);
      if (!q) continue;
      why.push({
        slide: q.slide,
        question: `Why is the correct answer to \u201c${q.question}\u201d right?`,
        strongAnswer: q.explanation || 'Name the reason, not just the answer.',
      });
    }
  }

  const misconceptionItems = arr(misconceptions).map((m) => ({
    ...m,
    name: classmateName(m.student),
    correct: m.corrected
      ? 'You corrected this in class. Good.'
      : `The class still believes \u201c${m.belief}\u201d. State clearly why that is wrong: ${correctIdea(m.belief)}`,
  }));
  for (const m of misconceptionItems.filter((x) => !x.corrected)) {
    missed.push({ slide: m.slide, concept: `Correcting: ${m.belief}`, why: correctIdea(m.belief) });
  }

  // Strengths: slides explained in the student's own words, with enough detail.
  for (const entry of historyArr) {
    if (entry.readAloud) continue;
    if (wordCount(entry.said) >= 35) {
      strengths.push(`You explained slide ${entry.n} in your own words instead of reading it — that is what made it teachable.`);
    }
  }
  const taught = arr(classResult?.answers).filter((a) => a.source === 'taught').length;
  if (taught >= 8) strengths.push('The class answered most questions from your words, so your explanations were clear enough to follow.');

  const nextSteps = [];
  if (readAloudSlides.length) nextSteps.push(`Re-explain slide ${readAloudSlides.join(', ')} from memory, without reading the slide.`);
  if (missed.length) nextSteps.push(`Cover the ideas you skipped, starting with: ${missed.slice(0, 2).map((m) => m.concept).join(', ')}.`);
  if (struggled.length) nextSteps.push('Answer the class questions you left open, one sentence each.');
  if (why.length) nextSteps.push('For each quiz question you missed, write the reason the right answer is right.');
  if (misconceptionItems.some((m) => !m.corrected)) nextSteps.push('Correct the idea the class is still holding, with a clear "that is not right, because…".');
  if (!nextSteps.length) nextSteps.push('Teach this lesson again to someone else and see if they can answer every question.');

  const weakConcepts = buildWeakConcepts(missed, wrong, struggled);

  const headline = readAloudSlides.length
    ? 'You have the words, but you read more than you explained — the next step is your own version.'
    : missed.length
      ? 'Solid start. A few ideas were never explained clearly, and those are the ones to re-teach.'
      : 'You explained the lesson well enough that your classmates could follow it.';

  return {
    headline,
    wrong,
    missed: dedupeBy(missed, (m) => `${m.slide}-${m.concept}`),
    struggled,
    why,
    misconceptions: misconceptionItems,
    slideFixes: dedupeBy(slideFixes, (f) => f.slide),
    strengths: strengths.slice(0, 5),
    nextSteps: nextSteps.slice(0, 5),
    weakConcepts: dedupeBy(weakConcepts, (c) => c.concept).slice(0, 6),
    source: 'demo',
  };
}

function buildWeakConcepts(missed, wrong, struggled) {
  const out = [];
  for (const m of missed) {
    out.push({
      id: `wc-${m.slide}-${out.length}`,
      slide: m.slide,
      concept: m.concept,
      detail: m.why,
      shareLevel: 'concept-only',
    });
  }
  for (const w of wrong) {
    out.push({
      id: `wc-${w.slide}-${out.length}`,
      slide: w.slide,
      concept: `Explaining slide ${w.slide} in my own words`,
      detail: 'I read the slide out loud instead of explaining it, so I am not sure I really understand it yet.',
      shareLevel: 'concept-only',
    });
  }
  for (const s of struggled.slice(0, 2)) {
    out.push({
      id: `wc-q-${out.length}`,
      slide: 0,
      concept: s.question.slice(0, 90),
      detail: 'I could not answer this question in class and would like help with it.',
      shareLevel: 'concept-only',
    });
  }
  if (!out.length) {
    out.push({
      id: 'wc-generic',
      slide: 1,
      concept: 'Explaining the lesson to someone else',
      detail: 'I want to practise explaining this so it sticks.',
      shareLevel: 'concept-only',
    });
  }
  return out;
}

function correctIdea(belief) {
  if (/soil/i.test(belief)) return 'the plant makes its own food (glucose) in the leaf using light energy; the soil supplies water and minerals, not food.';
  if (/absorb.*green/i.test(belief)) return 'chlorophyll reflects green light and absorbs red and blue light; the reflected green is what we see.';
  if (/carbon dioxide and oxygen/i.test(belief)) return 'carbon dioxide and oxygen are different gases: carbon dioxide goes in, oxygen comes out.';
  if (/oxygen.*carbon dioxide/i.test(belief)) return 'the released oxygen comes from the water molecules that are split, not from the carbon dioxide.';
  return 'state the correct version clearly and explain why the other idea is wrong.';
}

function dedupeBy(list, key) {
  const seen = new Set();
  return list.filter((item) => {
    const k = key(item);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

// ---------------------------------------------------------------------------
// Demo: AI peer support suggestions
// ---------------------------------------------------------------------------

export function demoPeerSuggestions(room) {
  const contributions = arr(room?.contributions).filter((c) => !c.parentId);
  const kinds = new Set(contributions.map((c) => c.kind));
  const commonIdeas = [];
  if (kinds.has('analogy')) commonIdeas.push('Several people reached for an analogy, which suggests the idea is easier to hold as a picture than as a definition.');
  if (kinds.has('example')) commonIdeas.push('More than one person gave a concrete example — comparing those examples may be the fastest route in.');
  if (kinds.has('explanation')) commonIdeas.push('The explanations agree on the core idea, so that core idea is probably the part to lock in first.');
  if (kinds.has('how-i-learned-it')) commonIdeas.push('Someone shared how they personally understood it, which often works better than a formal explanation.');
  if (!commonIdeas.length) commonIdeas.push('There are not many contributions yet. Try adding one example and see what others add.');
  return {
    summary: `${contributions.length} contribution(s) so far, covering ${[...kinds].length} different ways of explaining the idea.`,
    commonIdeas,
    simplerExplanation: `Start from the plain version: say what the concept does in one sentence, then add one example. Peers here are describing the same core idea in different words, so pick the wording that feels closest to how you think.`,
    suggestedQuestion: room?.question
      ? `Try asking a follow-up that names the specific step you are unsure about, for example: "Which part happens first, and what causes the next step?"`
      : 'Ask a follow-up that names the exact step you are unsure about, so others can answer something precise.',
    source: 'demo',
  };
}
