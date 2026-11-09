import type { Lesson, Slide } from '@/types';

/**
 * The built-in photosynthesis lesson. It exists so the whole journey — classroom,
 * class quiz, personal quiz, report and PeerRelay — can be experienced without a
 * PDF and without an API key.
 *
 * The slide text is written the way a real student's slides often are: a summary
 * with the key facts, but plenty of "why" left unsaid. That gives the classmates
 * something honest to ask about.
 */
const slides: Slide[] = [
  {
    n: 1,
    title: 'What Photosynthesis Is',
    text: [
      'What Photosynthesis Is',
      'Photosynthesis is how plants make their own food.',
      'Plants are called producers: they build glucose, a sugar, using light energy.',
      'Almost every food chain on Earth starts with photosynthesis.',
    ].join('\n'),
  },
  {
    n: 2,
    title: 'The Role of Sunlight',
    text: [
      'The Role of Sunlight',
      'Sunlight supplies the energy for photosynthesis.',
      'Light is absorbed by chlorophyll, the green pigment inside chloroplasts.',
      'Chlorophyll absorbs red and blue light and reflects green light.',
      'That reflected green light is why leaves look green to us.',
    ].join('\n'),
  },
  {
    n: 3,
    title: 'Water and Carbon Dioxide',
    text: [
      'Water and Carbon Dioxide',
      'Two raw materials are needed: water and carbon dioxide.',
      'Water is taken in by the roots and carried up the stem.',
      'Carbon dioxide enters the leaf from the air through small openings called stomata.',
      'The overall word equation: carbon dioxide + water + light energy -> glucose + oxygen.',
    ].join('\n'),
  },
  {
    n: 4,
    title: 'Glucose Production',
    text: [
      'Glucose Production',
      'The plant stores the energy from sunlight in the chemical bonds of glucose.',
      'Glucose is used for respiration to release energy for growth.',
      'Extra glucose can be converted into starch for storage, or into cellulose for cell walls.',
      'The balanced equation: 6CO2 + 6H2O + light energy -> C6H12O6 + 6O2.',
    ].join('\n'),
  },
  {
    n: 5,
    title: 'Oxygen Release',
    text: [
      'Oxygen Release',
      'Oxygen is released as a by-product of photosynthesis.',
      'The oxygen comes from the water molecules that are split, not from the carbon dioxide.',
      'This released oxygen is the main source of the oxygen in Earth\u2019s atmosphere.',
      'Photosynthesis and respiration together form a cycle between plants and animals.',
    ].join('\n'),
  },
];

export const SAMPLE_LESSON: Lesson = {
  id: 'sample-photosynthesis',
  title: 'Photosynthesis',
  source: 'sample',
  fileName: 'Built-in sample lesson',
  slides,
  createdAt: 0,
};

/** Concepts the demo report and peer flow can point at. */
export const SAMPLE_CONCEPTS = [
  { slide: 1, concept: 'What producers actually do' },
  { slide: 2, concept: 'Why leaves are green' },
  { slide: 3, concept: 'How carbon dioxide gets in' },
  { slide: 4, concept: 'Why glucose stores energy' },
  { slide: 5, concept: 'Where the released oxygen comes from' },
];
