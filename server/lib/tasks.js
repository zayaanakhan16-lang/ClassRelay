/**
 * The AI task layer.
 *
 * Every task has two paths:
 *   1. a real provider prompt (OpenAI-compatible or Gemini), and
 *   2. the deterministic demo engine in `demo.js`.
 *
 * The demo path runs whenever no key is configured, and also as a safety net when a live
 * call fails, so the classroom never dead-ends in front of an audience. Results always
 * carry `source: 'ai' | 'demo'` and the UI labels simulated output clearly.
 *
 * The honesty rules live here, not in the prompt alone. A model cannot award a point for
 * a quote the student never said: `quoteIsReal` and `readAloudShare` decide that.
 */

import { AiError, complete, parseJson } from './ai.js';
import { CLASSMATES, CLASSMATE_IDS, classmateName, personaBlock, SAFETY } from './classmates.js';
import {
  arr,
  fitPerSlide,
  formatMaterial,
  int,
  normalizeWords,
  presenterText,
  quoteFound,
  quoteIsReal,
  readAloudShare,
  realQuote,
  str,
  wordCount,
} from './text.js';
import {
  demoClassQuiz,
  demoClassTurn,
  demoGradeClassQuiz,
  demoJudgeWhy,
  demoPeerSuggestions,
  demoReport,
  demoSelfQuiz,
  demoStudyCard,
} from './demo.js';

export class TaskError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

export const MAX_ROUNDS = 6;
const MAX_QUESTIONS = 8;

const TASK_LABELS = {
  classTurn: 'Class reacting',
  studyCard: 'Writing a study card',
  classQuiz: 'Writing the class quiz',
  gradeClassQuiz: 'Classmates taking the quiz',
  selfQuiz: 'Writing your quiz',
  judgeWhy: 'Reading your reasoning',
  report: 'Writing your learning report',
  peerSuggestions: 'Summarising peer explanations',
};

/** Runs the real path, falling back to the demo engine on any AI failure. */
async function aiOrDemo(ctx, label, realFn, demoFn) {
  if (!ctx.provider) return demoFn();
  try {
    return await realFn(ctx.provider, ctx);
  } catch (err) {
    if (err instanceof AiError) {
      console.warn(`[classrelay] ${label} fell back to demo mode: ${err.message}`);
      const result = await demoFn();
      const note = `Live AI was unavailable (${err.message}) so this step used the built-in simulation.`;
      return { ...result, source: 'demo', notes: [...(result.notes || []), note] };
    }
    throw err;
  }
}

const presentedSlides = (lesson, presented) =>
  arr(lesson?.slides).filter((s) => presented.map(Number).includes(int(s.n)));

const transcriptFor = (history) =>
  arr(history)
    .map((h) => str(h?.said, 8000))
    .filter(Boolean)
    .join('\n\n');

// ---------------------------------------------------------------------------
// 1. classTurn — the class reacts to one explanation or one answer
// ---------------------------------------------------------------------------

const HOLD_PRIORITY = { mika: 0, rafa: 1, iya: 2, dev: 3 };

async function realClassTurn(provider, ctx) {
  const p = ctx.payload;
  const slideIndex = int(p.slideIndex, 0);
  const round = Math.max(0, Math.min(MAX_ROUNDS, int(p.round, 0)));
  const calledOn = CLASSMATES[p.calledOn] ? p.calledOn : null;
  const open = arr(p.open).filter((q) => CLASSMATES[q?.student] && q.text);
  const held = arr(p.held)
    .filter((b) => CLASSMATES[b?.student] && b.belief)
    .slice(0, 12);
  const lastRound = round >= MAX_ROUNDS;
  const said = str(p.said, 8000);
  const answer = str(p.answer, 2000);
  const allSlides = arr(p.lesson?.slides)
    .map((s) => str(s?.text, 4000))
    .join(' \n ');
  const recalled = round === 0 && p.recalled === true;
  const readAloud =
    !recalled && Math.max(readAloudShare(said, p.slideText), readAloudShare(said, allSlides)) >= 0.6;
  const weak = wordCount(said) < 8;

  const system = `You simulate four high school students in a class while a classmate (the presenter) teaches a lesson slide by slide. The presenter is learning the topic by teaching it, so your questions should make them think harder.
The students:
${personaBlock}

How the students behave:
- They only talk to the presenter, never to each other. They never answer each other's questions.
- They are learners: they never explain the correct answer or teach the presenter. When the presenter is wrong or vague, they push back or ask a question that makes them rethink.
- They remember everything the presenter said in this class, including answers given to other students.
- Questions target real gaps: skipped steps, undefined terms, claims with no reason, missing "why", things that contradict the slide, edge cases, missing examples, and connections not made.
- Write like real teenagers: one or two short sentences each, no emojis.
- The class gets harder as the discussion goes on. Label every question with "difficulty":
  - "warmup" — early and gentle: check a basic fact or a definition the presenter just gave. Use this first, before anything else.
  - "core" — the middle of the lesson: ask the presenter to explain WHY, to justify a step, or to connect two ideas.
  - "challenge" — hard and probing: edge cases, counter-examples, "what if the conditions changed", "how do you know that is always true", or a follow-up that attacks the weakest part of the explanation.
  - Early on, lean "warmup" and "core". As the presenter answers and the discussion deepens, move steadily toward "challenge". A student who is still unsatisfied after a vague answer should escalate their own question from "core" to "challenge".

Moods: "following" (their explanation made it click), "unsure", "confused", "slide" (understood from the slide text itself, not from an explanation), "curious", "connecting", "skeptical".

Common misconceptions:
- A student may arrive believing a well-known wrong idea. If one fits this slide and the presenter has not addressed it, ONE student may voice it sincerely as a statement or question that assumes it is true. Put the wrong belief in a few words in "misconception". Never reveal it is a test.
- A student who voiced a misconception keeps believing it until the presenter clearly says it is wrong and why. Only then set "corrected": true.
- WRONG IDEAS STILL HELD (listed in the prompt) are from earlier in the class. If this turn clearly says one is wrong and why, put its id in "fixed".
${SAFETY}

${
  round === 0
    ? `This turn: the presenter just finished explaining the slide.
- Pick the 1 to 3 students with the most useful questions; they raise their hands ("handUp": true) and speak ("say").
- If the presenter said almost nothing, Mika raises her hand and says she did not get anything.
${readAloud ? '- IMPORTANT: the presenter mostly read the slide out loud word for word instead of explaining it. One student points this out naturally and asks what it actually means, in their own words.' : ''}
- The others keep their hands down and leave "say" empty.`
    : `This turn: the presenter just answered ${calledOn ? `${CLASSMATES[calledOn].name}, whom they called on` : 'the whole room'}.
- Students with an open question: if it has now been answered clearly and correctly, they lower their hands ("handUp": false) and say a very short acknowledgement. If not, they keep their hands up and ${calledOn ? 'wait quietly unless they must object' : '"say" ONE short follow-up'}.
- A student holding a misconception lowers their hand only if the presenter clearly corrected it.
${lastRound ? '- This is the last round on this slide: nobody asks a NEW question.' : '- At most one student who had no question may raise a hand with a new question, and only if the answer raised something important or was wrong.'}`
}

Return JSON only, with one entry for each of the four students, plus "fixed" (ids of wrong ideas corrected this turn, often empty):
{"students":[{"id":"mika","mood":"confused","handUp":true,"say":"...","difficulty":"warmup","misconception":"","corrected":false}],"fixed":[]}`;

  const otherSlides = arr(p.lesson?.slides)
    .filter((s) => int(s.n) !== slideIndex + 1)
    .map((s) => ({ n: s.n, text: str(s?.text, 600) }));

  const prompt = `OTHER SLIDES IN THIS LESSON (for reference; students see the current slide):
${formatMaterial(otherSlides, 6000) || '(none)'}

SLIDES THE PRESENTER HAS ALREADY EXPLAINED:
${arr(p.history)
  .map(
    (h) =>
      `[Slide ${int(h.n)}] Presenter explained: ${str(h.said, 900) || '(nothing)'}${
        h.readAloud ? ' (they mostly read this slide out loud)' : ''
      }${h.fromMemory ? ' (slide was hidden — explained from memory)' : ''}`,
  )
  .join('\n\n') || '(this is the first slide)'}

CURRENT SLIDE ${slideIndex + 1} SHOWS:
${str(p.slideText, 4000) || '(no text on this slide)'}

THE PRESENTER'S EXPLANATION OF THIS SLIDE:
${said || '(nothing)'}

WRONG IDEAS STILL HELD:
${held.map((b) => `${b.id}. ${CLASSMATES[b.student].name} believes "${str(b.belief, 200)}" (slide ${int(b.slide)})`).join('\n') || '(none)'}

${
  round > 0
    ? `DISCUSSION SO FAR:
${arr(p.conversation)
  .slice(-12)
  .map((m) => `${m.who === 'you' ? 'Presenter' : CLASSMATES[m.who]?.name || m.who}: ${str(m.text, 400)}`)
  .join('\n') || '(none)'}

QUESTIONS STILL OPEN (hands up):
${open.map((q) => `${CLASSMATES[q.student].name}: ${str(q.text, 300)}`).join('\n') || '(none)'}

THE PRESENTER'S NEW ANSWER${calledOn ? ` (to ${CLASSMATES[calledOn].name})` : ' (to the whole room)'}:
${answer || '(no answer)'}`
    : ''
}`;

  const text = await complete(provider, { system, prompt, temperature: 0.8, maxTokens: 900, signal: ctx.signal });
  const out = parseJson(text);
  const byId = new Map();
  for (const st of arr(out.students)) if (CLASSMATES[st?.id] && !byId.has(st.id)) byId.set(st.id, st);

  const wasOpen = new Set(open.map((q) => q.student));
  let newHands = 0;
  const students = [];
  for (const id of CLASSMATE_IDS) {
    const st = byId.get(id) || {};
    const say = str(st.say, 400).trim();
    let handUp = Boolean(st.handUp) && Boolean(say || wasOpen.has(id));
    if (handUp && !wasOpen.has(id) && round > 0 && (lastRound || newHands++ >= 1)) handUp = false;
    students.push({
      id,
      mood: String(st.mood || 'neutral'),
      handUp,
      say,
      difficulty: clientDifficulty(st.difficulty, round),
      misconception: str(st.misconception, 200).trim(),
      corrected: st.corrected === true,
    });
  }

  return finishClassTurn({ students, fixed: arr(out.fixed), open, held, round, readAloud, slideIndex });
}

const CLIENT_DIFFICULTIES = new Set(['warmup', 'core', 'challenge']);
/** Maps whatever the model returns onto the three difficulty tiers, biased by how far in we are. */
function clientDifficulty(value, round = 0) {
  const v = String(value || '').toLowerCase().trim();
  if (CLIENT_DIFFICULTIES.has(v)) return v;
  if (v === 'easy' || v === 'basic' || v === 'simple') return 'warmup';
  if (v === 'hard' || v === 'tricky' || v === 'deep') return 'challenge';
  if (v === 'medium' || v === 'moderate') return 'core';
  // No label from the model: fall back to the round so the class still escalates.
  return round <= 0 ? 'warmup' : round <= 2 ? 'core' : 'challenge';
}

/** Maps the free-form moods a model may return onto the set the client renders. */
const CLIENT_MOODS = new Set(['neutral', 'confused', 'skeptical', 'curious', 'connecting', 'satisfied']);
const MOOD_ALIASES = {
  following: 'satisfied',
  happy: 'satisfied',
  pleased: 'satisfied',
  unsure: 'confused',
  puzzled: 'confused',
  lost: 'confused',
  slide: 'neutral',
  thinking: 'neutral',
  curious: 'curious',
  connecting: 'connecting',
  skeptical: 'skeptical',
  doubtful: 'skeptical',
};
const clientMood = (mood) => {
  const key = String(mood || '').trim().toLowerCase();
  if (CLIENT_MOODS.has(key)) return key;
  return MOOD_ALIASES[key] || 'neutral';
};

/** Shared post-processing for both the AI and demo class-turn results. */
function finishClassTurn({ students, fixed, open, held, round, readAloud, slideIndex }) {
  const believer = new Map(open.filter((q) => q.belief).map((q) => [q.student, q.belief]));
  const correctedBeliefs = [];
  for (const b of held) {
    if (fixed.includes(b.id) || fixed.includes(b.belief) || students.find((s) => s.id === b.student)?.corrected) {
      correctedBeliefs.push(b.belief);
    }
  }

  const speakers = students.filter((s) => s.handUp && s.say);
  speakers.sort((a, b) => (HOLD_PRIORITY[a.id] ?? 9) - (HOLD_PRIORITY[b.id] ?? 9));
  const speaking = speakers[0] || null;

  let misconception;
  if (round === 0) {
    const candidate = students.find((s) => s.misconception && s.handUp && !held.some((b) => b.belief === s.misconception));
    if (candidate) misconception = { student: candidate.id, belief: candidate.misconception };
  }

  const hands = students
    .filter((s) => s.handUp && s.id !== speaking?.id)
    .map((s) => ({
      student: s.id,
      question: s.say || open.find((q) => q.student === s.id)?.text || '',
      mood: clientMood(s.mood),
      difficulty: s.difficulty || 'core',
      reason: believer.has(s.id) ? `Still believes "${believer.get(s.id)}".` : 'Waiting for a clear answer.',
      gap: s.mood === 'skeptical' ? 'no-evidence' : s.mood === 'connecting' ? 'connection' : s.mood === 'curious' ? 'edge-case' : 'missing-step',
    }))
    .filter((h) => h.question);

  const speakerMood = clientMood(speaking?.mood);
  return {
    hands,
    speaker: speaking?.id || null,
    line: speaking?.say || '',
    speakerMood,
    difficulty: speaking?.difficulty || 'core',
    readAloud,
    corrected: correctedBeliefs,
    ...(misconception ? { misconception } : {}),
  };
}

export async function classTurn(payload, ctx) {
  const slideIndex = int(payload.slideIndex, 0);
  const demo = () => {
    const r = demoClassTurn(payload);
    return {
      hands: r.hands || [],
      speaker: r.speaker,
      line: r.line || '',
      difficulty: r.difficulty || 'core',
      readAloud: Boolean(r.readAloud),
      corrected: r.corrected || [],
      ...(r.misconception ? { misconception: r.misconception } : {}),
      source: 'demo',
      slide: slideIndex + 1,
    };
  };
  const real = async (provider, c) => {
    const r = await realClassTurn(provider, { ...c, payload });
    return { ...r, source: 'ai', slide: slideIndex + 1 };
  };
  return aiOrDemo({ ...ctx, payload }, TASK_LABELS.classTurn, real, demo);
}

// ---------------------------------------------------------------------------
// 2. studyCard — a short card built only from the slides
// ---------------------------------------------------------------------------

const MIN_STUDY_CHARS = 40;

async function realStudyCard(provider, ctx) {
  const p = ctx.payload;
  const slideIndex = int(p.slideIndex, 0);
  const slideText = str(p.slideText, 4000).trim();
  if (slideText.replace(/\s+/g, ' ').length < MIN_STUDY_CHARS) {
    return {
      slide: slideIndex + 1,
      thin: true,
      meaning: '',
      example: '',
      why: '',
      mistake: '',
      gaps: 'This slide has almost no text, so there is nothing reliable to study from it here. Check your notes or textbook for this part.',
      source: 'ai',
    };
  }
  const system = `You are a patient tutor. A student is about to explain ONE slide to classmates but may be seeing this topic for the first time. Help them understand this slide so they can explain it in their own words.
Write a short study card:
- "meaning": what the slide means, in 2 to 4 short, plain sentences. Define any key term the slide uses.
- "example": ONE everyday example or comparison that makes the idea click (1 or 2 sentences). It may use everyday life but must not add new facts about the topic.
- "why": the reason or mechanism behind the main idea (1 to 3 sentences), ONLY if the slides give it or clearly imply it. Otherwise leave it empty.
- "mistake": one common misunderstanding and the correct view (1 or 2 sentences), agreeing with the slides. Empty if none fits.
- "gaps": what the slides do NOT explain that a classmate is likely to ask, so the student can look it up. Empty if nothing important is missing.
Accuracy rules:
- Every fact about the topic must come from the slides below. Never add facts or numbers the slides do not support, even if you know them.
- Do not just repeat the slide's sentences; say it in simpler words.
- Write in the same language as the slides.
${SAFETY}

Return JSON only: {"meaning":"","example":"","why":"","mistake":"","gaps":""}`;
  const prompt = `THE SLIDE TO LEARN (slide ${slideIndex + 1}):
${slideText}

OTHER SLIDES IN THIS LESSON (context only):
${formatMaterial(
  arr(p.lesson?.slides)
    .filter((s) => int(s.n) !== slideIndex + 1)
    .map((s) => ({ n: s.n, text: str(s?.text, 600) })),
  6000,
) || '(none)'}`;
  const text = await complete(provider, { system, prompt, temperature: 0.3, maxTokens: 900, signal: ctx.signal });
  const out = parseJson(text);
  const card = {
    slide: slideIndex + 1,
    thin: false,
    meaning: str(out.meaning, 700).trim(),
    example: str(out.example, 400).trim(),
    why: str(out.why, 500).trim(),
    mistake: str(out.mistake, 400).trim(),
    gaps: str(out.gaps, 400).trim(),
    source: 'ai',
  };
  if (!card.meaning) throw new AiError('The study card could not be written.', 502, 'error');
  return card;
}

export async function studyCard(payload, ctx) {
  return aiOrDemo(
    { ...ctx, payload },
    TASK_LABELS.studyCard,
    realStudyCard,
    () => demoStudyCard(payload.lesson, int(payload.slideIndex, 0)),
  );
}

// ---------------------------------------------------------------------------
// 3. classQuiz — questions written from the slides (the answer key)
// ---------------------------------------------------------------------------

async function realClassQuiz(provider, ctx) {
  const p = ctx.payload;
  const material = presentedSlides(p.lesson, arr(p.presented));
  if (!material.length) throw new TaskError('No slides were presented.');
  const system = `You are a careful teacher writing a short multiple-choice quiz about a lesson, to check whether a student taught it well.
Rules:
- Write one question per slide where possible, at most ${MAX_QUESTIONS}, only about the slides listed.
- 4 options each, exactly one clearly correct, the others plausible but wrong.
- Questions must be answerable from the slide material alone (that is the answer key).
- "concept" is a 3 to 6 word label for the idea being tested.
- "explanation" is one sentence saying why the correct option is right.
- Do not write trick questions and do not rely on outside knowledge.
${SAFETY}

Return JSON only:
{"questions":[{"slide":1,"concept":"","question":"","options":["","","",""],"answer":0,"explanation":""}]}`;
  const prompt = `LESSON MATERIAL (the answer key):
${formatMaterial(material, 16000)}`;
  const text = await complete(provider, { system, prompt, temperature: 0.4, maxTokens: 2500, signal: ctx.signal });
  const out = parseJson(text);
  const questions = arr(out.questions)
    .slice(0, MAX_QUESTIONS)
    .map((q, i) => {
      const options = arr(q.options).slice(0, 4).map((o) => str(o, 300));
      if (options.length < 3) return null;
      return {
        id: `c${i + 1}`,
        slide: int(q.slide, 1),
        concept: str(q.concept, 80) || `Slide ${int(q.slide, 1)}`,
        question: str(q.question, 400),
        options,
        answer: Math.max(0, Math.min(options.length - 1, int(q.answer, 0))),
        explanation: str(q.explanation, 500),
      };
    })
    .filter(Boolean);
  if (!questions.length) throw new AiError('The quiz could not be written.', 502, 'error');
  return { questions, source: 'ai' };
}

export async function classQuiz(payload, ctx) {
  return aiOrDemo(
    { ...ctx, payload },
    TASK_LABELS.classQuiz,
    realClassQuiz,
    () => ({ questions: demoClassQuiz(payload.lesson, arr(payload.presented).map(Number)), source: 'demo' }),
  );
}

// ---------------------------------------------------------------------------
// 4. gradeClassQuiz — the class answers using only the student's words
// ---------------------------------------------------------------------------

async function realGradeClassQuiz(provider, ctx) {
  const p = ctx.payload;
  const questions = arr(p.questions).slice(0, MAX_QUESTIONS);
  if (!questions.length) throw new TaskError('No quiz questions were sent.');
  const transcript = fitPerSlide(str(p.transcript, 60000), 20000);
  const spokenWords = normalizeWords(transcript);
  const ownWords = normalizeWords(fitPerSlide(str(p.ownTranscript || p.transcript, 60000), 20000));
  const recalledWords = normalizeWords(str(p.recalledTranscript, 40000));
  const readAloudSlides = arr(p.readAloudSlides).map(Number);
  const slideText = ` ${normalizeWords(presentedSlides(p.lesson, arr(p.presented)).map((s) => str(s.text, 4000)).join(' \n ')).join(' ')} `;
  const beliefs = new Map();
  arr(p.misconceptions)
    .filter((b) => CLASSMATES[b?.student] && b.belief)
    .slice(0, 12)
    .forEach((b, i) => beliefs.set(`B${i + 1}`, { student: b.student, belief: str(b.belief, 200).trim() }));

  const system = `You simulate four high school students taking a quiz after a classmate (the presenter) taught them a lesson:
${personaBlock}

The most important rules:
- The students know NOTHING about this topic except the presenter's words below. They did not read the slides. They have NO outside knowledge, even about famous facts.
- A student may only pick an option if the presenter's words clearly teach it. For every pick, "quote" must copy, word for word, the part of the presenter's words (at least 4 words) that taught it. Prefer their own explanation over a definition they repeated.
- If the presenter explained something wrongly, the student believes them and picks the matching wrong option, quoting the wrong explanation.
- If nothing the presenter said teaches the answer, the student leaves it blank: "choice": null and "quote": "". Never guess and never use elimination.
${beliefs.size ? `- Some students still hold a WRONG IDEA the presenter never corrected (listed below). On a question about that idea, that student picks the option matching their wrong idea, and "quote" is the wrong idea's id (for example "B1").` : ''}
${SAFETY}

Return JSON only, ONE entry per question for the class's usual answer, plus "others" only for students who answer differently:
{"answers":[{"id":"c1","choice":0,"quote":"...","others":[{"student":"rafa","choice":null,"quote":""}]}]}`;

  const prompt = `THE PRESENTER'S WORDS (everything they said in class):
${transcript || '(the presenter said nothing)'}
${beliefs.size ? `\nWRONG IDEAS STILL HELD (never corrected):\n${[...beliefs].map(([id, b]) => `${id}. ${CLASSMATES[b.student].name} believes: "${b.belief}"`).join('\n')}\n` : ''}
QUIZ:
${questions.map((q) => `${q.id}. ${q.question}\n${q.options.map((o, i) => `   ${i}) ${o}`).join('\n')}`).join('\n\n')}`;

  const text = await complete(provider, { system, prompt, temperature: 0.2, maxTokens: 4000, signal: ctx.signal });
  const out = parseJson(text);

  const ids = new Set(questions.map((q) => q.id));
  const expanded = [];
  for (const a of arr(out.answers)) {
    if (!a || typeof a !== 'object') continue;
    if (CLASSMATES[a.student]) {
      expanded.push(a);
      continue;
    }
    const others = new Map(arr(a.others).filter((o) => CLASSMATES[o?.student]).map((o) => [o.student, o]));
    for (const id of CLASSMATE_IDS) expanded.push({ ...(others.get(id) || { choice: a.choice, quote: a.quote }), id: a.id, student: id });
  }

  const answers = [];
  const seen = new Set();
  for (const a of expanded) {
    if (!ids.has(a?.id) || !CLASSMATES[a?.student]) continue;
    const key = `${a.id}:${a.student}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const question = questions.find((q) => q.id === a.id);
    let choice = a.choice === null || a.choice === undefined || a.choice === '' ? null : int(a.choice, -1);
    if (choice !== null && (choice < 0 || choice > question.options.length - 1)) choice = null;
    let quote = str(a.quote ?? a.because, 400).trim();

    const beliefId = quote.replace(/[^a-z0-9]/gi, '').toUpperCase();
    if (choice !== null && beliefs.get(beliefId)?.student === a.student) {
      const { belief } = beliefs.get(beliefId);
      answers.push({
        id: a.id,
        student: a.student,
        choice,
        quote: belief,
        source: 'misconception',
        reason: `${classmateName(a.student)} still believed \u201c${belief}\u201d, because you never corrected it.`,
      });
      continue;
    }

    if (choice !== null && quoteIsReal(quote, spokenWords)) {
      const real = realQuote(quote, spokenWords);
      if (real) quote = real;
      else choice = null;
    } else if (choice !== null) {
      choice = null;
    }

    if (choice !== null && !quoteIsReal(quote, recalledWords)) {
      const readOut = readAloudSlides.includes(int(question.slide)) && !quoteIsReal(quote, ownWords);
      const copiedOnly = !readOut && readAloudShare(quote, slideText) >= 0.6;
      if (readOut || copiedOnly) {
        answers.push({
          id: a.id,
          student: a.student,
          choice: null,
          quote: '',
          source: 'read-aloud',
          reason: readOut
            ? `These words were read off the slide (\u201c${quote}\u201d), not explained in your own words.`
            : `These words were copied from the slide (\u201c${quote}\u201d) with no explanation of your own around them.`,
        });
        continue;
      }
    }

    answers.push({
      id: a.id,
      student: a.student,
      choice,
      quote: choice === null ? '' : quote,
      source: choice === null ? 'unverified-quote' : 'taught',
      reason: choice === null ? 'Your words could not be verified as teaching this, so it counts as blank.' : `You said: \u201c${quote}\u201d`,
    });
  }

  for (const q of questions) {
    for (const s of CLASSMATE_IDS) {
      if (!seen.has(`${q.id}:${s}`)) {
        answers.push({ id: q.id, student: s, choice: null, quote: '', source: 'never-taught', reason: 'You never taught this clearly enough to answer.' });
      }
    }
  }

  const notes = classQuizNotes(answers, readAloudSlides);
  return { questions, answers, notes, source: 'ai' };
}

/** Short plain-language notes that explain a class-quiz tally to the student. */
function classQuizNotes(answers, readAloudSlides) {
  const notes = [];
  const blanks = answers.filter((a) => a.choice === null).length;
  const readAloud = answers.filter((a) => a.source === 'read-aloud').length;
  const unsupported = answers.filter((a) => a.source === 'quote-unsupported').length;
  const fromIdeas = answers.filter((a) => a.source === 'misconception').length;
  if (blanks) notes.push(`${blanks} answer(s) were left blank because the class was never taught those ideas clearly.`);
  if (readAloud) notes.push(`${readAloud} answer(s) came from words read straight off the slide, so they did not count as teaching.`);
  if (unsupported) notes.push(`${unsupported} answer(s) had a real quote that did not actually teach the answer, so they were left blank.`);
  if (fromIdeas) notes.push(`${fromIdeas} answer(s) came from a wrong idea the class was still holding because it was never corrected.`);
  if (readAloudSlides.length) notes.push(`Slide ${readAloudSlides.join(', ')} was mostly read out loud, so reading it did not count as teaching.`);
  return notes;
}

export async function gradeClassQuiz(payload, ctx) {
  return aiOrDemo(
    { ...ctx, payload },
    TASK_LABELS.gradeClassQuiz,
    realGradeClassQuiz,
    () => {
      const graded = demoGradeClassQuiz({
        lesson: payload.lesson,
        questions: arr(payload.questions),
        transcript: payload.transcript,
        ownTranscript: payload.ownTranscript,
        readAloudSlides: arr(payload.readAloudSlides).map(Number),
        misconceptions: arr(payload.misconceptions),
      });
      return { ...graded, source: 'demo' };
    },
  );
}

// ---------------------------------------------------------------------------
// 5. selfQuiz — the student's own check for understanding
// ---------------------------------------------------------------------------

async function realSelfQuiz(provider, ctx) {
  const p = ctx.payload;
  const material = presentedSlides(p.lesson, arr(p.presented));
  if (!material.length) throw new TaskError('No slides were presented.');
  const system = `You write a short multiple-choice quiz for a student who just taught this lesson, to check their own understanding.
Rules:
- One question per slide where possible, at most ${MAX_QUESTIONS}.
- 4 options, one clearly correct, the others plausible.
- Test understanding, not memory of the slide's wording. Prefer "why" and "which statement is correct".
- "concept" is a short label; "explanation" is one or two sentences on why the answer is right.
- Stay strictly inside the lesson material.
${SAFETY}

Return JSON only:
{"questions":[{"slide":1,"concept":"","question":"","options":["","","",""],"answer":0,"explanation":""}]}`;
  const prompt = `LESSON MATERIAL:
${formatMaterial(material, 16000)}`;
  const text = await complete(provider, { system, prompt, temperature: 0.5, maxTokens: 2500, signal: ctx.signal });
  const out = parseJson(text);
  const questions = arr(out.questions)
    .slice(0, MAX_QUESTIONS)
    .map((q, i) => {
      const options = arr(q.options).slice(0, 4).map((o) => str(o, 300));
      if (options.length < 3) return null;
      return {
        id: `s${i + 1}`,
        slide: int(q.slide, 1),
        concept: str(q.concept, 80) || `Slide ${int(q.slide, 1)}`,
        question: str(q.question, 400),
        options,
        answer: Math.max(0, Math.min(options.length - 1, int(q.answer, 0))),
        explanation: str(q.explanation, 500),
      };
    })
    .filter(Boolean);
  if (!questions.length) throw new AiError('The quiz could not be written.', 502, 'error');
  return { questions, source: 'ai' };
}

export async function selfQuiz(payload, ctx) {
  return aiOrDemo(
    { ...ctx, payload },
    TASK_LABELS.selfQuiz,
    realSelfQuiz,
    () => ({ questions: demoSelfQuiz(payload.lesson, arr(payload.presented).map(Number)), source: 'demo' }),
  );
}

// ---------------------------------------------------------------------------
// 6. judgeWhy — reads the student's reasoning before revealing the answer
// ---------------------------------------------------------------------------

async function realJudgeWhy(provider, ctx) {
  const p = ctx.payload;
  const system = `A student got a quiz question wrong and must explain, in their own words, why the correct answer is right. Judge the quality of their reasoning as a supportive tutor.
- "verdict": "strong" (a real reason, correctly stated), "partial" (on the right track but incomplete or vague), "weak" (restates the answer, or gives no reason).
- "feedback": one or two sentences, kind and specific, telling them what to add. Never scold.
${SAFETY}

Return JSON only: {"verdict":"strong|partial|weak","feedback":""}`;
  const prompt = `QUESTION: ${str(p.question, 400)}
OPTIONS:
${arr(p.options).map((o, i) => `   ${i}) ${str(o, 300)}`).join('\n')}
CORRECT ANSWER: ${int(p.answer, 0)}) ${str(arr(p.options)[int(p.answer, 0)], 300)}
WHY IT IS CORRECT (for your reference only): ${str(p.explanation, 500)}

THE STUDENT WROTE:
${str(p.why, 1000) || '(nothing)'}`;
  const text = await complete(provider, { system, prompt, temperature: 0.2, maxTokens: 400, signal: ctx.signal });
  const out = parseJson(text);
  const verdict = ['strong', 'partial', 'weak'].includes(out.verdict) ? out.verdict : 'partial';
  return { verdict, feedback: str(out.feedback, 400), source: 'ai' };
}

export async function judgeWhy(payload, ctx) {
  return aiOrDemo(
    { ...ctx, payload },
    TASK_LABELS.judgeWhy,
    realJudgeWhy,
    () => ({ ...demoJudgeWhy(payload, payload.why), source: 'demo' }),
  );
}

// ---------------------------------------------------------------------------
// 7. report — the learning report
// ---------------------------------------------------------------------------

const WHY_MARKERS = /\b(because|since|so that|which means|the reason|as a result|therefore)\b/i;

async function realReport(provider, ctx) {
  const p = ctx.payload;
  const history = arr(p.history);
  const readAloudSlides = history.filter((h) => h.readAloud).map((h) => int(h.n)).filter(Boolean);
  const classMisconceptions = history
    .flatMap((h) => arr(h.misconceptions).map((m) => ({ slide: int(h.n), student: m?.student, belief: str(m?.belief, 200), corrected: Boolean(m?.corrected) })))
    .filter((m) => CLASSMATES[m.student] && m.belief)
    .slice(0, 8);

  const system = `You are a supportive, honest tutor. A student just learned a topic by presenting it to AI classmates. Write their learning report.
The goal is for the STUDENT to learn the topic. Compare what they said with the material and point out exactly what to fix.
- "wrong": things they explained incorrectly. "youSaid" must copy their words EXACTLY from the class, then "correct" gives the correct version from the material. Never put words in their mouth: if you cannot quote it exactly, leave "youSaid" empty.
- "missed": important ideas in the material they never explained.
- "struggled": classmate questions they answered weakly or left unanswered, with what a strong answer would include. Include the slide number the question came from. Leave out "why"/"how" questions; those go in "why".
- "why": places where they stated a fact but could not explain WHY or HOW it works. "question" is the why-question, "strongAnswer" is the reasoning they were missing.
- "slideFixes": gaps in the slides themselves (missing definitions, unsupported claims, missing steps) with a concrete fix.
- "strengths": what they did well in their OWN words. Never praise a slide they read out loud. Leave empty if nothing was explained in their own words.
- "nextSteps": 3 to 5 concrete actions, most important first.
- "headline": one encouraging but honest sentence.
Keep every item short (one or two sentences). Use empty lists when nothing applies; do not invent problems.
${SAFETY}

Return JSON only:
{"headline":"","wrong":[{"slide":1,"youSaid":"","correct":""}],"missed":[{"slide":1,"concept":"","why":""}],"struggled":[{"slide":1,"question":"","strongAnswer":""}],"why":[{"slide":1,"question":"","strongAnswer":""}],"slideFixes":[{"slide":1,"fix":""}],"strengths":[""],"nextSteps":[""]}`;

  const prompt = `LESSON MATERIAL:
${formatMaterial(presentedSlides(p.lesson, arr(p.presented)), 16000)}

WHAT HAPPENED IN CLASS:
${history
  .map(
    (h) =>
      `[Slide ${int(h.n)}] Presenter explained: ${str(h.said, 1500) || '(nothing)'}${
        h.readAloud ? ' (they mostly READ the slide out loud)' : ''
      }${h.fromMemory ? ' (explained from memory with the slide hidden)' : ''}${
        arr(h.openQuestions).length
          ? `\n  Left unanswered: ${arr(h.openQuestions).map((q) => `${classmateName(q.student)}: ${str(q.text, 200)}`).join('; ')}`
          : ''
      }`,
  )
  .join('\n\n') || '(nothing was presented)'}

CLASS QUIZ RESULTS (blank means it was never taught clearly):
${str(JSON.stringify(arr(p.classResult?.answers).slice(0, 30)), 9000)}

THE STUDENT'S OWN QUIZ RESULTS:
${p.selfResults ? str(JSON.stringify(arr(p.selfResults).slice(0, 10)), 5000) : '(they did not take their own quiz)'}

SLIDES READ OUT LOUD (reading is not teaching):
${readAloudSlides.length ? readAloudSlides.join(', ') : '(none)'}

MISCONCEPTIONS IN CLASS:
${classMisconceptions.map((m) => `Slide ${m.slide}, ${classmateName(m.student)} believed: "${m.belief}". ${m.corrected ? 'Corrected.' : 'NOT corrected.'}`).join('\n') || '(none)'}`;

  const text = await complete(provider, { system, prompt, temperature: 0.4, maxTokens: 4000, signal: ctx.signal });
  const out = parseJson(text);
  const words = normalizeWords(presenterText(history));

  const list = (v, map, n = 8) => arr(v).slice(0, n).map(map).filter(Boolean);
  const wrong = list(out.wrong, (x) => {
    if (!x || !x.correct) return null;
    const quote = str(x.youSaid, 500).replace(/^["\u201c']|["\u201d']$/g, '').trim();
    const real = quoteFound(quote, words);
    return { slide: int(x.slide), youSaid: real ? quote : '', quoteVerified: real, correct: str(x.correct, 500) };
  });
  const missed = list(out.missed, (x) => x && { slide: int(x.slide), concept: str(x.concept, 200), why: str(x.why, 500) });
  const struggled = list(out.struggled, (x) => x && x.question && { slide: int(x.slide), question: str(x.question, 500), strongAnswer: str(x.strongAnswer, 600) });
  const why = list(out.why, (x) => x && x.question && { slide: int(x.slide), question: str(x.question, 500), strongAnswer: str(x.strongAnswer, 600) }, 6);

  const misconceptions = classMisconceptions.map((m, i) => ({
    ...m,
    name: classmateName(m.student),
    correct: str(arr(out.misconceptions)[i]?.correct, 500) || 'State clearly why the idea is wrong.',
  }));

  const report = {
    headline: str(out.headline, 400) || 'Here is what to work on next.',
    wrong,
    missed,
    struggled,
    why,
    misconceptions,
    slideFixes: list(out.slideFixes, (x) => x && { slide: int(x.slide), fix: str(x.fix, 500) }),
    strengths: list(out.strengths, (x) => (typeof x === 'string' && x.trim() ? str(x, 400) : null), 5),
    nextSteps: list(out.nextSteps, (x) => (typeof x === 'string' && x.trim() ? str(x, 400) : null), 5),
    weakConcepts: [],
    source: 'ai',
  };
  report.weakConcepts = deriveWeakConcepts(report);
  return report;
}

/** Turns the report's own findings into concepts a student can take to a peer room. */
function deriveWeakConcepts(report) {
  const out = [];
  for (const m of arr(report.missed)) {
    out.push({
      id: `wc-${m.slide}-${out.length}`,
      slide: m.slide,
      concept: m.concept,
      detail: m.why,
      shareLevel: 'concept-only',
    });
  }
  for (const w of arr(report.wrong)) {
    out.push({
      id: `wc-${w.slide}-${out.length}`,
      slide: w.slide,
      concept: `Explaining slide ${w.slide} in my own words`,
      detail: 'I read this slide out loud instead of explaining it, so I am not sure I really understand it yet.',
      shareLevel: 'concept-only',
    });
  }
  for (const s of arr(report.struggled).slice(0, 2)) {
    out.push({
      id: `wc-q-${out.length}`,
      slide: 0,
      concept: str(s.question, 90),
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
  return out.slice(0, 6);
}

export async function report(payload, ctx) {
  return aiOrDemo(
    { ...ctx, payload },
    TASK_LABELS.report,
    realReport,
    () =>
      demoReport({
        lesson: payload.lesson,
        history: payload.history,
        classResult: payload.classResult,
        selfResults: payload.selfResults,
        misconceptions: payload.misconceptions,
        presentedNumbers: arr(payload.presented).map(Number),
      }),
  );
}

// ---------------------------------------------------------------------------
// 8. peerSuggestions — optional AI help inside a peer room
// ---------------------------------------------------------------------------

async function realPeerSuggestions(provider, ctx) {
  const p = ctx.payload;
  const room = p.room || {};
  const contributions = arr(room.contributions).filter((c) => !c.parentId);
  if (!contributions.length) throw new TaskError('There are no contributions to summarise yet.');
  const system = `You help a student make sense of explanations other students wrote about a concept they find confusing.
You are an AI assistant, never pretend to be a human peer or a teacher who knows the topic better than the room.
- "summary": one or two sentences on what the contributions have in common.
- "commonIdeas": up to 3 short bullets naming ideas that appear in more than one contribution.
- "simplerExplanation": the simplest version of the concept that is faithful to what the contributors wrote. Do not add outside facts.
- "suggestedQuestion": one clear follow-up question the student could ask to move forward.
Be encouraging and concrete. Do not reveal or guess anyone's identity or scores.
${SAFETY}

Return JSON only: {"summary":"","commonIdeas":[""],"simplerExplanation":"","suggestedQuestion":""}`;
  const prompt = `CONCEPT BEING DISCUSSED: ${str(room.concept, 200)}
WHAT THE STUDENT FINDS CONFUSING: ${str(room.detail, 500)}
${room.question ? `THEIR QUESTION: ${str(room.question, 300)}` : ''}

PEER CONTRIBUTIONS (${contributions.length}):
${contributions
  .slice(0, 20)
  .map((c, i) => `${i + 1}. [${c.kind}] ${str(c.text, 700)}`)
  .join('\n\n')}`;
  const text = await complete(provider, { system, prompt, temperature: 0.4, maxTokens: 800, signal: ctx.signal });
  const out = parseJson(text);
  return {
    summary: str(out.summary, 500),
    commonIdeas: arr(out.commonIdeas).slice(0, 3).map((s) => str(s, 300)).filter(Boolean),
    simplerExplanation: str(out.simplerExplanation, 700),
    suggestedQuestion: str(out.suggestedQuestion, 400),
    source: 'ai',
  };
}

export async function peerSuggestions(payload, ctx) {
  return aiOrDemo(
    { ...ctx, payload },
    TASK_LABELS.peerSuggestions,
    realPeerSuggestions,
    () => demoPeerSuggestions(payload.room),
  );
}

// ---------------------------------------------------------------------------

const TASKS = { classTurn, studyCard, classQuiz, gradeClassQuiz, selfQuiz, judgeWhy, report, peerSuggestions };

export async function runTask(task, payload, ctx) {
  const fn = Object.hasOwn(TASKS, task) ? TASKS[task] : undefined;
  if (!fn) throw new TaskError(`Unknown task "${task}".`);
  if (!payload || typeof payload !== 'object') throw new TaskError('Missing task data.');
  console.log(`[classrelay] ${TASK_LABELS[task] || task}${ctx.provider ? '' : ' (demo mode)'}\u2026`);
  return fn(payload, ctx);
}

export { WHY_MARKERS };
