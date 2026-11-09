/**
 * PeerRelay store.
 *
 * A small in-memory store for peer-learning rooms. It is deliberately simple: rooms are
 * scoped to the concept being discussed, and the store never holds a student's transcript,
 * score or learning report. The owner chooses what is shared when the room is created.
 *
 * Rooms are seeded with a few contributions so "Explore Peer Learning" is useful on a
 * fresh install. Everything is lost on restart, which is the right default for a demo:
 * nothing about a student's learning is persisted anywhere.
 */

import { randomUUID } from 'node:crypto';
import { arr, str } from './text.js';

const MAX_ROOMS = 200;
const MAX_CONTRIBUTIONS = 60;
const MAX_TEXT = 2000;

const rooms = new Map();

const now = () => Date.now();

const clean = (value, max = MAX_TEXT) =>
  str(String(value ?? '').replace(/\s+\n/g, '\n').trim(), max);

/** Rejects links and obviously abusive content. Keeps the room safe and on-topic. */
const BLOCKED = [
  /\b(?:https?:\/\/|www\.)\S+/i,
  /\b(?:fuck|shit|bitch|bastard|asshole|slut|retard)\w*/i,
];

export function validateText(text, { min = 8, max = MAX_TEXT } = {}) {
  const value = clean(text, max);
  if (value.length < min) return { ok: false, error: `Please write at least ${min} characters.` };
  const blocked = BLOCKED.find((re) => re.test(value));
  if (blocked) return { ok: false, error: 'Please keep contributions kind and free of links.' };
  if (value.length > max) return { ok: false, error: `Please keep it under ${max} characters.` };
  return { ok: true, value };
}

/** True when any of the supplied free-text values contains a link or abusive language. */
export function hasBlockedContent(...values) {
  return values.some((v) => v && BLOCKED.some((re) => re.test(String(v))));
}

const SUMMARY = (room) => ({
  id: room.id,
  title: room.title,
  concept: room.concept,
  subject: room.subject,
  createdAt: room.createdAt,
  contributionCount: room.contributions.length,
  open: room.status === 'open',
  ownerLabel: room.ownerLabel,
});

export function listRooms({ subject } = {}) {
  return [...rooms.values()]
    .filter((r) => r.status !== 'closed' || r.contributions.length > 0)
    .filter((r) => (subject ? r.subject === subject : true))
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, MAX_ROOMS)
    .map(SUMMARY);
}

export function getRoom(id) {
  const room = rooms.get(String(id));
  return room ? { ...room, contributions: room.contributions.map((c) => ({ ...c })) } : null;
}

export function createRoom(input) {
  const concept = clean(input?.concept, 200);
  const detail = clean(input?.detail, 800);
  if (concept.length < 3) return { error: 'Give the concept a name of at least 3 characters.' };
  if (detail.length < 10) return { error: 'Describe what is confusing in a sentence or two.' };

  const title = clean(input?.title, 120) || concept;
  const question = clean(input?.question, 400);
  if (hasBlockedContent(concept, detail, title, question)) {
    return { error: 'Please keep this about the concept and free of links or unkind language.' };
  }

  const shareLevel = ['concept-only', 'with-example', 'with-explanation'].includes(input?.shareLevel)
    ? input.shareLevel
    : 'concept-only';
  const sharedExcerpt = shareLevel === 'concept-only' ? '' : clean(input?.sharedExcerpt, 600);
  if (hasBlockedContent(sharedExcerpt)) {
    return { error: 'Please keep this about the concept and free of links or unkind language.' };
  }

  const room = {
    id: randomUUID().slice(0, 8),
    title,
    concept,
    detail,
    question: question || undefined,
    shareLevel,
    sharedExcerpt: sharedExcerpt || undefined,
    subject: clean(input?.subject, 80) || undefined,
    ownerLabel: clean(input?.ownerLabel, 40) || 'A student',
    createdAt: now(),
    updatedAt: now(),
    status: 'open',
    contributions: [],
    understanding: '',
  };

  // A seeded room carries its starter contributions so the demo has something to read.
  for (const seed of arr(input?.seed)) {
    const text = validateText(seed?.text, { min: 4 });
    if (!text.ok) continue;
    room.contributions.push(makeContribution(room, {
      kind: seed.kind,
      author: seed.author,
      text: text.value,
      aiGenerated: Boolean(seed.aiGenerated),
    }));
  }

  rooms.set(room.id, room);
  return { room: getRoom(room.id) };
}

function makeContribution(room, { kind, author, text, aiGenerated = false, parentId, byOwner = false }) {
  return {
    id: randomUUID().slice(0, 8),
    roomId: room.id,
    kind: ['explanation', 'example', 'analogy', 'question', 'how-i-learned-it'].includes(kind) ? kind : 'explanation',
    author: clean(author, 40) || 'A student',
    text,
    at: now(),
    helpful: 0,
    markedByOwner: false,
    aiGenerated,
    parentId: parentId || undefined,
    byOwner,
  };
}

export function addContribution(roomId, input) {
  const room = rooms.get(String(roomId));
  if (!room) return { error: 'That peer room no longer exists.' };
  if (room.status === 'closed') return { error: 'This room has been closed.' };
  if (room.contributions.length >= MAX_CONTRIBUTIONS) return { error: 'This room is full. Start a new one for a different concept.' };

  const text = validateText(input?.text);
  if (!text.ok) return { error: text.error };

  const parentId = input?.parentId ? String(input.parentId) : undefined;
  if (parentId && !room.contributions.some((c) => c.id === parentId)) {
    return { error: 'The contribution you replied to no longer exists.' };
  }

  const contribution = makeContribution(room, {
    kind: input?.kind,
    author: input?.author,
    text: text.value,
    aiGenerated: Boolean(input?.aiGenerated),
    parentId,
    byOwner: Boolean(input?.byOwner),
  });
  room.contributions.push(contribution);
  room.updatedAt = now();
  return { contribution: { ...contribution } };
}

export function markHelpful(roomId, contributionId) {
  const room = rooms.get(String(roomId));
  if (!room) return { error: 'That peer room no longer exists.' };
  const contribution = room.contributions.find((c) => c.id === String(contributionId));
  if (!contribution) return { error: 'That contribution no longer exists.' };
  if (!contribution.markedByOwner) {
    contribution.markedByOwner = true;
    contribution.helpful += 1;
  }
  room.updatedAt = now();
  return { contribution: { ...contribution } };
}

export function setUnderstanding(roomId, text) {
  const room = rooms.get(String(roomId));
  if (!room) return { error: 'That peer room no longer exists.' };
  room.understanding = clean(text, 1200);
  room.status = room.understanding ? 'reteaching' : room.status;
  room.updatedAt = now();
  return { room: getRoom(room.id) };
}

export function closeRoom(roomId) {
  const room = rooms.get(String(roomId));
  if (!room) return { error: 'That peer room no longer exists.' };
  room.status = 'closed';
  room.updatedAt = now();
  return { room: getRoom(room.id) };
}

export function deleteRoom(roomId) {
  const existed = rooms.delete(String(roomId));
  return { deleted: existed };
}

// ---------------------------------------------------------------------------
// Seed rooms — clearly marked as sample contributions written by the ClassRelay team
// ---------------------------------------------------------------------------

const SEED_AUTHOR = 'Sample contributor';

function seed() {
  createRoom({
    title: 'Why do leaves look green?',
    concept: 'Why leaves are green',
    detail: 'I can repeat "chlorophyll reflects green light" but I do not really feel like I understand why that makes the leaf look green.',
    question: 'Can someone explain it without using the word "reflect"?',
    shareLevel: 'with-example',
    sharedExcerpt: 'Chlorophyll absorbs red and blue light and reflects green light. That is why leaves look green.',
    subject: 'Photosynthesis',
    ownerLabel: 'A student (sample)',
    seed: [
      {
        kind: 'analogy',
        author: SEED_AUTHOR,
        text: 'Think of the leaf as a filter that keeps the colours it can use. It takes the red and blue, and the green is the one it hands back to your eye. The colour you see is the colour it did not want.',
      },
      {
        kind: 'example',
        author: SEED_AUTHOR,
        text: 'It is like a shop that only buys two flavours and sends the third back. The third one is the one you notice on the shelf — that is the green.',
      },
      {
        kind: 'how-i-learned-it',
        author: SEED_AUTHOR,
        text: 'What finally worked for me was thinking about a black shirt in summer: it absorbs light and gets hot. A leaf does the opposite of what you would expect — it lets green bounce away instead of soaking it up.',
      },
      {
        kind: 'question',
        author: SEED_AUTHOR,
        text: 'Does this mean a plant under only green light would struggle to make food? That would be a good check on whether the idea is right.',
      },
    ],
  });

  createRoom({
    title: 'Where does the oxygen actually come from?',
    concept: 'Where the released oxygen comes from',
    detail: 'I said the oxygen comes from carbon dioxide and I am not sure that is right. I would like to understand which part of the reaction produces it.',
    question: 'If the oxygen comes from water, what happens to the hydrogen?',
    shareLevel: 'with-explanation',
    sharedExcerpt: 'Oxygen is released as a by-product. The oxygen comes from the water molecules that are split, not from the carbon dioxide.',
    subject: 'Photosynthesis',
    ownerLabel: 'A student (sample)',
    seed: [
      {
        kind: 'explanation',
        author: SEED_AUTHOR,
        text: 'The water molecule gets taken apart during the reaction. One of the pieces it leaves behind is oxygen, and that is what leaves the leaf. The carbon dioxide is used to build the sugar instead, so it is not the source of the oxygen gas.',
      },
      {
        kind: 'example',
        author: SEED_AUTHOR,
        text: 'Picture taking apart a sandwich to reuse the bread. The filling you set aside is not the same thing as the bread you kept — the oxygen set aside comes from the water, and the carbon from carbon dioxide goes into the sugar.',
      },
      {
        kind: 'question',
        author: SEED_AUTHOR,
        text: 'Could you draw the water being split as one arrow and the sugar being built as another? Seeing them as two separate jobs might make it clearer.',
      },
    ],
  });
}

let seeded = false;
export function ensureSeeded() {
  if (seeded) return;
  seeded = true;
  try {
    seed();
  } catch (err) {
    console.warn('[classrelay] could not seed peer rooms:', err?.message);
  }
}
