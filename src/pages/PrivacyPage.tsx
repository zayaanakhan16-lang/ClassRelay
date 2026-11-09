import { Link } from 'react-router-dom';
import { Eye, FileX2, Handshake, Scale, ShieldCheck, Trash2, UserX } from 'lucide-react';
import { SectionHeading } from '@/components/ui';

const RULES = [
  {
    icon: UserX,
    title: 'No account needed for the demo',
    body: 'You can complete the whole journey — classroom, quizzes, report and peer room — without signing up. Nothing about your session is saved to a database, and it disappears when the tab closes.',
  },
  {
    icon: Scale,
    title: 'No public scores, no rankings',
    body: 'Your class results and your personal quiz are for you. ClassRelay never publishes a score, never compares you with another student, and never shows a leaderboard.',
  },
  {
    icon: Eye,
    title: 'Your transcript is not shared automatically',
    body: 'Only the concept you explicitly choose is sent to a peer room, along with what you write there. Your transcript, quiz results and learning report never leave your session.',
  },
  {
    icon: Handshake,
    title: 'Explicit consent before anything is shared',
    body: 'You pick the concept, write the description in your own words, and choose how much of your explanation to include. Sharing is always an action you take, never a default.',
  },
  {
    icon: Trash2,
    title: 'You can delete your session and your rooms',
    body: 'The classroom and the report each have a delete action. The owner of a peer room can close it or delete it, which removes every contribution in it.',
  },
  {
    icon: ShieldCheck,
    title: 'AI content is always labelled',
    body: 'Anything produced by an AI model — classmate replies, study cards, quizzes, report sections, peer summaries — carries an "AI generated" label. Simulated demo output is labelled "Simulated" instead.',
  },
  {
    icon: FileX2,
    title: 'Honest about anonymity',
    body: 'ClassRelay does not claim to be fully anonymous. Peer rooms use a general label rather than your name, but if a room is hosted by a third party, that host could still see network information. We say this rather than promise anonymity we cannot provide.',
  },
];

export function PrivacyPage() {
  return (
    <div className="min-h-[calc(100vh-4rem)]">
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <SectionHeading
          eyebrow="Privacy & safety"
          title="Learning is easier when you are not being watched"
          description="ClassRelay is built so a student can find a gap in their understanding and ask for help without being embarrassed. That shapes every privacy decision here."
        />

        <ul className="mt-10 space-y-4">
          {RULES.map((rule) => (
            <li key={rule.title} className="surface flex items-start gap-4 p-5">
              <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-pencil/30 bg-pencil/10">
                <rule.icon className="h-4 w-4 text-pencil-deep" aria-hidden="true" />
              </span>
              <div>
                <h2 className="display text-base text-ink">{rule.title}</h2>
                <p className="mt-1.5 text-sm leading-relaxed text-muted">{rule.body}</p>
              </div>
            </li>
          ))}
        </ul>

        <div className="surface mt-8 p-6">
          <h2 className="display text-lg text-ink">What leaves your device</h2>
          <ul className="mt-3 space-y-2.5 text-sm leading-relaxed text-muted">
            <li>
              <strong className="text-ink">Your PDF</strong> is read entirely in your browser with pdf.js. The file is
              never uploaded.
            </li>
            <li>
              <strong className="text-ink">Extracted slide text</strong> and the words you speak or type are sent to the
              ClassRelay server so the classmates can respond. If a live AI key is configured, that text is forwarded to the
              model provider for that request.
            </li>
            <li>
              <strong className="text-ink">Voice audio</strong> is handled by your browser&rsquo;s own speech
              recognition. ClassRelay never records or stores audio.
            </li>
            <li>
              <strong className="text-ink">Peer rooms</strong> hold only the concept, your description and the
              contributions. In this demo they live in the server&rsquo;s memory and are cleared on restart.
            </li>
          </ul>
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link to="/start" className="btn-primary">
            Start teaching
          </Link>
          <Link to="/peers" className="btn-secondary">
            Explore peer learning
          </Link>
        </div>
      </div>
    </div>
  );
}
