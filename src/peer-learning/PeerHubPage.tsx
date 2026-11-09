import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, MessageSquare, Plus, ShieldCheck, Sparkles, Users, X } from 'lucide-react';
import { listRooms } from '@/services/peer';
import { useSession } from '@/hooks/useSession';
import { ErrorNote, InfoNote, SectionHeading, Spinner } from '@/components/ui';
import type { PeerRoomSummary } from '@/types';
import { cn, formatRelative, wordCount } from '@/lib/utils';
import { createRoom } from '@/services/peer';

/**
 * The PeerRelay hub.
 *
 * A list of concept-scoped rooms. This is deliberately not a social feed: every room is
 * about one concept, rooms are created by choice, and no score, transcript or identity is
 * ever attached to one.
 */
export function PeerHubPage() {
  const navigate = useNavigate();
  const session = useSession();
  const [rooms, setRooms] = useState<PeerRoomSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRooms(await listRooms());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The peer rooms could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const startOwnRoom = useCallback(() => {
    if (session.report) {
      navigate('/report');
      return;
    }
    setCreating(true);
  }, [session.report, navigate]);

  return (
    <div className="min-h-[calc(100vh-4rem)]">
      <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <SectionHeading
            eyebrow="PeerRelay"
            title="A room for every concept somebody found hard"
            description="Students choose one concept and ask for help. Others explain it their way — a simpler version, an example, an analogy, or how they personally got it. Keep it focused and kind."
          />
          <button type="button" className="btn-primary shrink-0" onClick={startOwnRoom}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Ask for help
          </button>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          {[
            { icon: ShieldCheck, text: 'Only the concept is shared. Never a score or transcript.' },
            { icon: Users, text: 'Anyone can add an explanation, an example or a question.' },
            { icon: MessageSquare, text: 'The original student marks what helped and re-teaches it.' },
          ].map((item) => (
            <div key={item.text} className="surface flex items-start gap-3 p-4">
              <item.icon className="mt-0.5 h-4 w-4 shrink-0 text-pencil-deep" aria-hidden="true" />
              <p className="text-sm leading-relaxed text-muted">{item.text}</p>
            </div>
          ))}
        </div>

        {error && <ErrorNote className="mt-6" onRetry={() => void load()}>{error}</ErrorNote>}

        {loading && (
          <div className="surface mt-8 flex items-center justify-center gap-3 p-10">
            <Spinner label="Loading peer rooms…" />
          </div>
        )}

        {!loading && rooms.length === 0 && (
          <div className="surface mt-8 p-10 text-center">
            <p className="display text-lg text-ink">No peer rooms yet</p>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted">
              Finish a lesson and share a concept from your report, or start a room about any concept you find confusing.
            </p>
            <button type="button" className="btn-primary mt-5" onClick={() => setCreating(true)}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              Start the first room
            </button>
          </div>
        )}

        {!loading && rooms.length > 0 && (
          <ul className="mt-8 grid gap-4 sm:grid-cols-2">
            {rooms.map((room, i) => (
              <motion.li
                key={room.id}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: Math.min(i * 0.05, 0.3) }}
              >
                <Link
                  to={`/peers/${room.id}`}
                  className="group flex h-full flex-col rounded-2xl border border-line/12 bg-paper/70 p-5 transition hover:border-pencil/45 hover:bg-paper/70"
                >
                  <div className="flex items-center justify-between gap-2">
                    {room.subject && <span className="chip">{room.subject}</span>}
                    <span className={cn('chip', room.open ? 'chip-moss' : 'chip')}>{room.open ? 'Open' : 'Closed'}</span>
                  </div>
                  <h3 className="display mt-3 text-lg leading-snug text-ink">{room.title}</h3>
                  <p className="mt-1.5 flex-1 text-sm leading-relaxed text-muted">Concept: {room.concept}</p>
                  <div className="mt-4 flex items-center justify-between text-2xs uppercase tracking-[0.1em] text-muted">
                    <span className="flex items-center gap-1.5">
                      <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />
                      {room.contributionCount} contribution{room.contributionCount === 1 ? '' : 's'}
                    </span>
                    <span>{formatRelative(room.createdAt)}</span>
                  </div>
                  <span className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-pencil-deep">
                    Open the room
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                  </span>
                </Link>
              </motion.li>
            ))}
          </ul>
        )}

        <InfoNote className="mt-8">
          <span className="font-semibold text-ink">A note on privacy. </span>
          Rooms are held in the server&rsquo;s memory for this demo and are lost on restart. Students are not identified by name
          and no learning data is attached to a room.
        </InfoNote>
      </div>

      {creating && <NewRoomDialog onClose={() => setCreating(false)} onCreated={(id) => navigate(`/peers/${id}`)} />}
    </div>
  );
}

/** A general-purpose room creator for students who are not coming from a report. */
function NewRoomDialog({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const [concept, setConcept] = useState('');
  const [detail, setDetail] = useState('');
  const [question, setQuestion] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = useCallback(async () => {
    if (concept.trim().length < 3) {
      setError('Give the concept a name first.');
      return;
    }
    if (wordCount(detail) < 4) {
      setError('Describe what is confusing in at least a few words.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const room = await createRoom({
        concept: concept.trim(),
        title: concept.trim(),
        detail: detail.trim(),
        question: question.trim() || undefined,
        shareLevel: 'concept-only',
      });
      onCreated(room.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The room could not be created.');
    } finally {
      setSubmitting(false);
    }
  }, [concept, detail, question, onCreated]);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-paper/85 px-4 py-10 backdrop-blur-sm" role="dialog" aria-modal="true">
      <div className="surface-raised w-full max-w-lg p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="eyebrow">Ask for help</p>
            <h2 className="display mt-1 text-xl text-ink">Start a peer-learning room</h2>
          </div>
          <button type="button" onClick={onClose} className="text-muted transition hover:text-ink" aria-label="Close">
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <p className="mt-3 text-sm leading-relaxed text-muted">
          Only what you write here is shared. Nothing from your classroom session, quiz or report is attached.
        </p>

        {error && <ErrorNote className="mt-4">{error}</ErrorNote>}

        <div className="mt-5 space-y-4">
          <div>
            <label className="label" htmlFor="new-concept">Concept</label>
            <input
              id="new-concept"
              className="field"
              value={concept}
              onChange={(e) => setConcept(e.target.value)}
              placeholder="e.g. Why do leaves look green?"
              maxLength={120}
            />
          </div>
          <div>
            <label className="label" htmlFor="new-detail">What is confusing?</label>
            <textarea
              id="new-detail"
              className="field min-h-[6rem] resize-y leading-relaxed"
              value={detail}
              onChange={(e) => setDetail(e.target.value)}
              placeholder="I can repeat the words but I do not really understand why…"
              maxLength={800}
              rows={3}
            />
          </div>
          <div>
            <label className="label" htmlFor="new-question">Optional question</label>
            <input
              id="new-question"
              className="field"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="e.g. Can someone explain it with an everyday example?"
              maxLength={300}
            />
          </div>
        </div>

        <InfoNote className="mt-5">
          <Sparkles className="mr-1 inline h-3.5 w-3.5 text-pencil-deep" aria-hidden="true" />
          Keep it about the concept, and be kind — someone is asking because they want to understand.
        </InfoNote>

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn-primary" onClick={() => void submit()} disabled={submitting}>
            {submitting ? <Spinner label="Opening…" /> : 'Open the room'}
          </button>
        </div>
      </div>
    </div>
  );
}
