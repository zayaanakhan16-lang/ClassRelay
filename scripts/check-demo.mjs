/**
 * End-to-end check of the demo engine. Run with: node scripts/check-demo.mjs
 *
 * It drives the same task sequence the browser drives, without a server, so a broken
 * demo path is caught before it reaches the classroom.
 */
import assert from 'node:assert/strict';
import { classTurn, classQuiz, gradeClassQuiz, selfQuiz, judgeWhy, report, studyCard, peerSuggestions } from '../server/lib/tasks.js';
import { readAloudShare, quoteIsReal, normalizeWords } from '../server/lib/text.js';

const lesson = {
  id: 'sample-photosynthesis',
  title: 'Photosynthesis',
  source: 'sample',
  slides: [
    { n: 1, title: 'What Photosynthesis Is', text: 'What Photosynthesis Is\nPhotosynthesis is how plants make their own food.\nPlants are producers: they build glucose using light energy.' },
    { n: 2, title: 'The Role of Sunlight', text: 'The Role of Sunlight\nSunlight supplies the energy.\nChlorophyll absorbs red and blue light and reflects green light.' },
    { n: 3, title: 'Water and Carbon Dioxide', text: 'Water and Carbon Dioxide\nWater is taken in by the roots.\nCarbon dioxide enters through stomata.\nThe equation: carbon dioxide + water + light energy -> glucose + oxygen.' },
    { n: 4, title: 'Glucose Production', text: 'Glucose Production\nThe energy is stored in the chemical bonds of glucose.\nExtra glucose becomes starch or cellulose.' },
    { n: 5, title: 'Oxygen Release', text: 'Oxygen Release\nOxygen is released as a by-product.\nThe oxygen comes from the water molecules that are split.' },
  ],
};

const ctx = { provider: null, signal: undefined };
const presented = [1, 2, 3, 4, 5];

console.log('1. studyCard');
const card = await studyCard({ lesson, slideIndex: 0 }, ctx);
assert.equal(card.source, 'demo');
assert.ok(card.meaning.length > 40, 'study card should have a meaning');
console.log('   ok:', card.meaning.slice(0, 70) + '...');

console.log('2. classTurn — reading the slide out loud should be noticed');
const readSaid = lesson.slides[1].text;
assert.ok(readAloudShare(readSaid, lesson.slides[1].text) >= 0.6, 'slide text should score as read aloud');
const readTurn = await classTurn(
  { lesson, slideIndex: 1, round: 0, said: readSaid, slideText: lesson.slides[1].text, open: [], held: [], history: [], askedQuestions: [] },
  ctx,
);
assert.equal(readTurn.source, 'demo');
assert.equal(readTurn.readAloud, true, 'reading should be detected');
assert.ok(readTurn.line.length > 10, 'a classmate should speak');
console.log('   ok: readAloud =', readTurn.readAloud, '| speaker:', readTurn.speaker, '|', readTurn.line.slice(0, 70) + '...');

console.log('3. classTurn — a real explanation gets questions');
const history = [];
const misconceptions = [];
const asked = [];
for (const slide of lesson.slides) {
  const said =
    slide.n === 1
      ? 'Photosynthesis is how a plant makes its own food. The plant builds sugar called glucose using energy from light, which is why we call it a producer.'
      : slide.n === 2
        ? 'Light gives the energy. The chlorophyll inside the leaf takes in red and blue light, and bounces the green light back, and that is why we see green.'
        : slide.n === 3
          ? 'Two things go in: water from the roots and carbon dioxide from the air through little openings called stomata. Together with light they make glucose and oxygen.'
          : slide.n === 4
            ? 'The light energy ends up locked inside the chemical bonds of glucose, so the plant can spend that energy later when it needs to grow. Some becomes starch.'
            : 'Oxygen leaves the leaf as a by-product. It comes from splitting the water molecules, not from the carbon dioxide, and that is what fills the atmosphere.';
  const turn = await classTurn(
    {
      lesson,
      slideIndex: slide.n - 1,
      round: 0,
      said,
      slideText: slide.text,
      open: [],
      held: misconceptions,
      history,
      askedQuestions: asked,
      recalled: false,
    },
    ctx,
  );
  assert.equal(turn.readAloud, false, `slide ${slide.n} explanation should not read as copied`);
  if (turn.misconception) {
    misconceptions.push({ student: turn.misconception.student, belief: turn.misconception.belief, slide: slide.n, corrected: false });
  }
  if (turn.line) asked.push(turn.line);
  history.push({
    n: slide.n,
    said,
    fromMemory: false,
    readAloud: false,
    conversation: turn.line ? [{ id: 'm', who: turn.speaker, text: turn.line, kind: 'question', slide: slide.n, at: Date.now() }] : [],
    openQuestions: turn.hands.map((h) => ({ student: h.student, text: h.question })),
    misconceptions: misconceptions.filter((m) => m.slide === slide.n),
  });
  console.log(`   slide ${slide.n}: speaker=${turn.speaker} hands=${turn.hands.length} misconception=${turn.misconception ? turn.misconception.belief : 'none'}`);
}
assert.ok(history.some((h) => h.openQuestions.length), 'at least one slide should leave a question open');
assert.ok(misconceptions.length >= 1, 'at least one misconception should be raised');

console.log('4. classQuiz');
const quiz = await classQuiz({ lesson, presented }, ctx);
assert.equal(quiz.source, 'demo');
assert.ok(quiz.questions.length >= 4, 'quiz should have questions');
console.log('   ok:', quiz.questions.length, 'questions; first:', quiz.questions[0].question);

console.log('5. gradeClassQuiz — quotes must be real, reading must not count');
const transcript = history.map((h) => h.said).join('\n\n');
const graded = await gradeClassQuiz(
  { lesson, presented, questions: quiz.questions, transcript, ownTranscript: transcript, readAloudSlides: [], misconceptions },
  ctx,
);
assert.equal(graded.source, 'demo');
for (const a of graded.answers) {
  if (a.choice !== null && a.source === 'taught') {
    assert.ok(quoteIsReal(a.quote, normalizeWords(transcript)), `quote must be real: ${a.quote}`);
  }
  if (a.choice === null) assert.equal(a.quote, '', 'blank answers must not carry a quote');
}
const taught = graded.answers.filter((a) => a.source === 'taught').length;
const blank = graded.answers.filter((a) => a.choice === null).length;
console.log('   ok:', taught, 'taught answers,', blank, 'blank/misconception answers');

console.log('6. selfQuiz + judgeWhy');
const self = await selfQuiz({ lesson, presented }, ctx);
assert.ok(self.questions.length >= 4);
const q0 = self.questions[0];
const strong = await judgeWhy(
  { question: q0.question, options: q0.options, answer: q0.answer, explanation: q0.explanation, why: 'Because the plant makes its own food from light energy, which is what producer means.' },
  ctx,
);
const weak = await judgeWhy({ question: q0.question, options: q0.options, answer: q0.answer, explanation: q0.explanation, why: 'yes' }, ctx);
assert.equal(strong.verdict, 'strong');
assert.equal(weak.verdict, 'weak');
console.log('   ok: strong =', strong.verdict, '| weak =', weak.verdict);

console.log('7. report');
const rep = await report(
  { lesson, presented, history, classResult: graded, selfResults: [{ id: q0.id, choice: 0, why: 'yes', correct: false, whyVerdict: 'weak' }], misconceptions },
  ctx,
);
assert.equal(rep.source, 'demo');
assert.ok(rep.headline.length > 10, 'report needs a headline');
assert.ok(rep.weakConcepts.length >= 1, 'report must offer weak concepts to share');
console.log('   ok: headline =', rep.headline);
console.log('   weak concepts:', rep.weakConcepts.map((c) => c.concept).join(' | '));
console.log('   next steps:', rep.nextSteps.length, '| strengths:', rep.strengths.length, '| missed:', rep.missed.length);

console.log('8. peerSuggestions');
const sugg = await peerSuggestions(
  {
    room: {
      concept: 'Why leaves are green',
      detail: 'I do not get it',
      contributions: [
        { kind: 'analogy', text: 'a filter' },
        { kind: 'example', text: 'a shop' },
        { kind: 'how-i-learned-it', text: 'a black shirt' },
      ],
    },
  },
  ctx,
);
assert.equal(sugg.source, 'demo');
assert.ok(sugg.summary.length > 10);
console.log('   ok:', sugg.summary.slice(0, 80) + '...');

console.log('\nAll demo engine checks passed.');
