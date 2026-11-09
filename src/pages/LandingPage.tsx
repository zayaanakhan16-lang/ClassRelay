import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  ArrowLeftRight,
  MessageCircleQuestion,
  ScanSearch,
  Users,
  RotateCcw,
  ShieldCheck,
  Mic,
  FileText,
  Quote,
  Lightbulb,
  Hand,
  Sparkles,
} from 'lucide-react';
import { CLASSMATE_LIST } from '@/data/classmates';
import { ClassmateAvatar } from '@/components/ClassmateAvatar';
import { Logo } from '@/components/Logo';
import { DemoBanner, SectionHeading } from '@/components/ui';

const LOOP = [
  {
    n: '01',
    title: 'Teach a concept',
    body: 'Upload your slides and explain each one out loud to four AI classmates who behave like real students.',
    icon: Mic,
  },
  {
    n: '02',
    title: 'Discover what is unclear',
    body: 'They ask the questions you did not think of. Your class then takes a quiz using only the words you actually said.',
    icon: ScanSearch,
  },
  {
    n: '03',
    title: 'Learn from another student',
    body: 'Share a concept you found hard. Other students explain it their way — with examples, analogies and their own route in.',
    icon: Users,
  },
  {
    n: '04',
    title: 'Re-teach it with confidence',
    body: 'Go back to the slide with a better explanation and watch the same idea land the second time.',
    icon: RotateCcw,
  },
];

const PROMISES = [
  {
    title: 'The quiz uses only your words',
    body: 'Every classmate answer must quote something you really said. No quote, no point. Reading the slide out loud does not count as teaching.',
    icon: Quote,
  },
  {
    title: 'You choose what you share',
    body: 'Your transcript, your score and your learning report stay yours. Only the concept you pick ever reaches a peer room.',
    icon: ShieldCheck,
  },
  {
    title: 'No account, no ranking',
    body: 'Start straight away with a sample lesson. Nothing is saved, and no student is ever ranked against another.',
    icon: Users,
  },
];

const fadeUp = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0 },
};

export function LandingPage({ demo }: { demo: boolean }) {
  return (
    <div className="relative overflow-hidden">
      {/* Hero */}
      <section className="relative bg-board text-chalk">
        <div className="pointer-events-none absolute inset-0 card-grid-lines opacity-[0.5]" aria-hidden="true" />
        <div className="relative mx-auto grid max-w-6xl gap-14 px-4 pb-20 pt-16 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:items-center lg:pb-28 lg:pt-24">
          <motion.div initial="hidden" animate="show" transition={{ staggerChildren: 0.09 }}>
            <motion.div variants={fadeUp} className="mb-6">
              <Logo withWordmark size={44} tone="light" className="items-center" />
            </motion.div>
            <motion.p variants={fadeUp} className="eyebrow mb-4 text-pencil">
              CSC Winter Sparkathon 2026
            </motion.p>
            <motion.h1 variants={fadeUp} className="display text-[2.6rem] leading-[1.02] text-chalk sm:text-6xl lg:text-[4.1rem]">
              Learn it. <span className="scribble-underline">Teach it.</span>
              <br />
              Pass it on.
            </motion.h1>
            <motion.p variants={fadeUp} className="mt-6 max-w-xl text-lg leading-relaxed text-chalk/80 text-pretty">
              Practice teaching with AI classmates. Discover what you still need to learn. Connect with real students who can
              help you understand.
            </motion.p>

            <motion.div variants={fadeUp} className="mt-9 flex flex-wrap items-center gap-3">
              <Link to="/start" className="btn-primary px-6 py-3 text-base">
                Start teaching
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <Link to="/peers" className="btn border-2 border-chalk/25 bg-transparent px-6 py-3 text-base text-chalk hover:border-chalk/50 hover:bg-chalk/10">
                Explore peer learning
              </Link>
            </motion.div>

            <motion.p variants={fadeUp} className="mt-5 flex items-center gap-2 text-sm text-chalk/70">
              <Sparkles className="h-4 w-4 text-pencil" aria-hidden="true" />
              No account needed. The sample lesson works with no setup at all.
            </motion.p>
          </motion.div>

          {/* Classroom preview */}
          <motion.div
            initial={{ opacity: 0, y: 26 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.15 }}
            className="relative"
          >
            <ClassroomPreview />
          </motion.div>
        </div>
      </section>

      {demo && (
        <div className="mx-auto max-w-6xl px-4 pt-8 sm:px-6">
          <DemoBanner />
        </div>
      )}

      {/* The learning loop */}
      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <SectionHeading
          eyebrow="The collaborative learning loop"
          title="A lesson only really lands when you pass it on"
          description="ClassRelay is built around one loop. AI helps you find the gap. Another student helps you close it. Then you teach it again."
        />
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {LOOP.map((step, i) => (
            <motion.article
              key={step.n}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.4 }}
              transition={{ duration: 0.5, delay: i * 0.08 }}
              className="surface relative flex flex-col p-6"
            >
              <span className="font-mono text-xs tracking-[0.2em] text-pencil-deep/80">{step.n}</span>
              <step.icon className="mt-4 h-6 w-6 text-pencil-deep" aria-hidden="true" />
              <h3 className="display mt-4 text-lg text-ink">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{step.body}</p>
              {i < LOOP.length - 1 && (
                <ArrowRight className="absolute -right-3 top-1/2 hidden h-5 w-5 -translate-y-1/2 text-ink/20 lg:block" aria-hidden="true" />
              )}
            </motion.article>
          ))}
        </div>
      </section>

      {/* Classmates */}
      <section className="border-y border-line/10 bg-paper/40">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <SectionHeading
            eyebrow="Your four AI classmates"
            title="They ask questions. They never hand you the answer."
            description="Each classmate has a different way of pushing on your explanation. One gets lost easily, one wants evidence, one asks what-if, one connects ideas. Between them they find the parts you skipped."
          />
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {CLASSMATE_LIST.map((mate, i) => (
              <motion.article
                key={mate.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.4 }}
                transition={{ duration: 0.5, delay: i * 0.08 }}
                className="surface-raised group flex flex-col overflow-hidden"
              >
                <div
                  className="relative flex h-40 items-end justify-center pt-6"
                  style={{ background: `linear-gradient(160deg, ${mate.accentHex}22, transparent 70%)` }}
                >
                  <ClassmateAvatar id={mate.id} mood="neutral" className="h-[8.5rem] w-[8.5rem] transition-transform duration-500 group-hover:-translate-y-1" />
                </div>
                <div className="flex flex-1 flex-col p-5">
                  <div className="flex items-baseline justify-between gap-2">
                    <h3 className="display text-lg text-ink">{mate.name}</h3>
                    <span className="text-2xs uppercase tracking-[0.12em] text-muted">{mate.tagline}</span>
                  </div>
                  <p className="mt-1 text-xs font-semibold uppercase tracking-[0.1em]" style={{ color: mate.accentHex }}>
                    {mate.role}
                  </p>
                  <p className="mt-3 flex-1 text-sm leading-relaxed text-muted">{mate.style}</p>
                  <p className="mt-4 flex items-start gap-2 rounded-xl border border-line/10 bg-paper/40 px-3 py-2.5 text-sm italic text-ink-soft">
                    <MessageCircleQuestion className="mt-0.5 h-4 w-4 shrink-0 text-pencil-deep" aria-hidden="true" />
                    &ldquo;{mate.example}&rdquo;
                  </p>
                </div>
              </motion.article>
            ))}
          </div>
        </div>
      </section>

      {/* PeerRelay */}
      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
          <div>
            <p className="eyebrow mb-3">PeerRelay · the human part</p>
            <h2 className="display text-3xl text-ink sm:text-4xl text-balance">
              AI helps you find the gap. A real student helps you close it.
            </h2>
            <p className="mt-5 text-[0.98rem] leading-relaxed text-muted">
              When your report shows a concept you could not explain clearly, you can ask for help without explaining why.
              ClassRelay turns it into a small, focused peer-learning card and opens a room around that single concept.
            </p>
            <ul className="mt-7 space-y-4">
              {[
                { icon: Hand, text: 'You pick the concept. Nothing is shared automatically, not even your score.' },
                { icon: Lightbulb, text: 'Other students add a simpler explanation, an example, an analogy, or how they learned it.' },
                { icon: ArrowLeftRight, text: 'You mark what helped, ask a follow-up, then re-teach the concept in class.' },
              ].map((row) => (
                <li key={row.text} className="flex items-start gap-3.5">
                  <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-pencil/30 bg-pencil/10">
                    <row.icon className="h-4 w-4 text-pencil-deep" aria-hidden="true" />
                  </span>
                  <span className="text-[0.95rem] leading-relaxed text-ink-soft">{row.text}</span>
                </li>
              ))}
            </ul>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/peers" className="btn-primary">
                Explore peer learning
              </Link>
              <Link to="/privacy" className="btn-ghost">
                How privacy works
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
          </div>

          <PeerCardPreview />
        </div>
      </section>

      {/* Promises */}
      <section className="border-t border-line/10 bg-paper/40">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <SectionHeading
            eyebrow="How the scoring stays honest"
            title="Teaching is the test, so the test has to be fair"
            align="center"
          />
          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {PROMISES.map((item) => (
              <article key={item.title} className="surface p-6">
                <item.icon className="h-6 w-6 text-pencil-deep" aria-hidden="true" />
                <h3 className="display mt-4 text-lg text-ink">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{item.body}</p>
              </article>
            ))}
          </div>
          <p className="mx-auto mt-8 max-w-2xl text-center text-sm text-muted">
            ClassRelay does not claim perfect scoring. Every classmate answer shows the quote it used and the reason it was
            accepted or rejected, so you can judge it yourself.
          </p>
        </div>
      </section>

      {/* Final CTA */}
      <section className="relative bg-board text-chalk">
        <div className="relative mx-auto max-w-4xl px-4 py-20 text-center sm:px-6">
          <h2 className="display text-3xl text-chalk sm:text-4xl text-balance">
            Every student has something to teach, and every student has something to learn.
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-[0.98rem] leading-relaxed text-chalk/80">
            Start with the built-in photosynthesis lesson. Present to Mika, Rafa, Iya and Dev, see what your class really
            understood, then take one weak concept to a room full of other students.
          </p>
          <div className="mt-9 flex flex-wrap justify-center gap-3">
            <Link to="/start" className="btn-primary px-7 py-3 text-base">
              Start teaching
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <Link to="/peers" className="btn border-2 border-chalk/25 bg-transparent px-7 py-3 text-base text-chalk hover:border-chalk/50 hover:bg-chalk/10">
              Explore peer learning
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

/** A visual preview of the classroom: the slide plus the four classmates watching. */
function ClassroomPreview() {
  return (
    <div className="surface-raised overflow-hidden">
      <div className="flex items-center justify-between border-b border-line/10 px-4 py-2.5">
        <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted">
          <FileText className="h-3.5 w-3.5" aria-hidden="true" />
          Photosynthesis · Slide 2 of 5
        </span>
        <span className="flex items-center gap-1.5 text-2xs uppercase tracking-[0.1em] text-muted">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-wrong" aria-hidden="true" />
          Live
        </span>
      </div>

      <div className="bg-surface p-5 text-ink-strong">
        <p className="font-display text-lg font-semibold">The Role of Sunlight</p>
        <ul className="mt-3 space-y-1.5 text-sm leading-relaxed text-ink-strong/80">
          <li>Sunlight supplies the energy for photosynthesis.</li>
          <li>Chlorophyll absorbs red and blue light.</li>
          <li>Green light is reflected, so leaves look green.</li>
        </ul>
      </div>

      <div className="border-t border-line/10 p-4">
        <div className="flex items-start gap-3">
          <ClassmateAvatar id="rafa" mood="skeptical" className="h-11 w-11 shrink-0 rounded-full bg-paper/70" />
          <div className="rounded-2xl rounded-tl-sm border border-line/10 bg-paper/70 px-3.5 py-2.5">
            <p className="text-xs font-semibold text-pencil-deep">Rafa · Evidence Checker</p>
            <p className="mt-1 text-sm leading-snug text-ink">
              You said chlorophyll absorbs red and blue. What supports that — how do we know it is not the green?
            </p>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-2">
          {CLASSMATE_LIST.map((mate) => (
            <span
              key={mate.id}
              className="flex items-center gap-2 rounded-full border border-line/10 bg-paper/50 px-2.5 py-1.5"
              title={`${mate.name} — ${mate.role}`}
            >
              <ClassmateAvatar id={mate.id} mood={mate.id === 'rafa' ? 'skeptical' : 'neutral'} className="h-6 w-6 rounded-full" />
              <span className="text-2xs font-semibold text-muted">{mate.name}</span>
            </span>
          ))}
          <span className="ml-auto text-2xs uppercase tracking-[0.1em] text-muted">4 classmates</span>
        </div>
      </div>
    </div>
  );
}

/** A preview of a peer-learning card with a contribution. */
function PeerCardPreview() {
  return (
    <div className="surface-ivory p-6">
      <div className="flex items-center justify-between gap-3">
        <span className="chip-amber">Shared by choice</span>
        <span className="text-2xs uppercase tracking-[0.12em] text-ink-strong/50">Peer room · Photosynthesis</span>
      </div>
      <h3 className="display mt-4 text-xl text-ink-strong">Why do leaves look green?</h3>
      <p className="mt-2 text-sm leading-relaxed text-ink-strong/70">
        &ldquo;I can repeat that chlorophyll reflects green light, but I do not really feel like I understand why that makes
        the leaf look green.&rdquo;
      </p>

      <div className="mt-5 space-y-3">
        <div className="rounded-xl border border-ink-strong/10 bg-white/70 p-4">
          <p className="flex items-center gap-2 text-2xs font-semibold uppercase tracking-[0.1em] text-right">
            <Lightbulb className="h-3.5 w-3.5" aria-hidden="true" />
            Analogy · another student
          </p>
          <p className="mt-1.5 text-sm leading-relaxed text-ink-strong/85">
            Think of the leaf as a filter that keeps the colours it can use. It takes the red and blue, and the green is the
            one it hands back to your eye.
          </p>
        </div>
        <div className="rounded-xl border border-ink-strong/10 bg-white/70 p-4">
          <p className="flex items-center gap-2 text-2xs font-semibold uppercase tracking-[0.1em] text-mika">
            <Users className="h-3.5 w-3.5" aria-hidden="true" />
            How I learned it · another student
          </p>
          <p className="mt-1.5 text-sm leading-relaxed text-ink-strong/85">
            A black shirt in summer absorbs light and gets hot. A leaf does the opposite — it lets the green bounce away
            instead of soaking it up.
          </p>
        </div>
      </div>

      <div className="mt-5 flex items-center gap-2 text-2xs uppercase tracking-[0.12em] text-ink-strong/50">
        <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
        No transcript, no score, no name required
      </div>
    </div>
  );
}
