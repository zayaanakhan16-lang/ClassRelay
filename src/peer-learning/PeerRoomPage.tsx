import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Check,
  CornerDownRight,
  Heart,
  Lightbulb,
  MessageCircleQuestion,
  MessageSquare,
  RotateCcw,
  Sparkles,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import {
  addContribution,
  closeRoom,
  deleteRoom,
  getRoom,
  markHelpful,
  saveUnderstanding,
} from '@/services/peer';
import { peerSuggestions } from '@/services/ai';
import { useSession } from '@/hooks/useSession';
import { ErrorNote, InfoNote, SourceTag, Spinner } from '@/components/ui';
import type { ContributionKind, PeerContribution, PeerRoom, PeerSuggestion } from '@/types';
import { cn, formatRelative, wordCount } from '@/lib/utils';

/**
 * A peer-learning room.
 *
 * Other students add explanations; the owner can mark what helped, ask a follow-up, write
 * their new understanding, and re-teach the concept. An optional AI assistant summarises
 * the room — always labelled, and it never pretends to be a peer.
 */
const KIND_META: Record<ContributionKind, { label: string; icon: typeof Lightbulb; tone: string }> = {
  explanation: { label: 'Simpler explanation', icon: MessageSquare, tone: 'text-mika' },
  example: { label: 'Example', icon: Lightbulb, tone: 'text-pencil-deep' },
  analogy: { label: 'Analogy', icon: Sparkles, tone: 'text-right' },
  question: { label: 'Helpful question', icon: MessageCircleQuestion, tone: 'text-mika' },
  'how-i-learned-it': { label: 'How I learned it', icon: Users, tone: 'text-pencil-deep' },
};

export function PeerRoomPage() {
  const { roomId = '' } = useParams();
  const navigate = useNavigate();
  const session = useSession();

  const [room, setRoom] = useState<PeerRoom | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [suggestion, setSuggestion] = useState<PeerSuggestion | null>(null);
  const [suggesting, setSuggesting] = useState(false);
  const [suggestionError, setSuggestionError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const isOwner = session.sharedRoomId === roomId;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRoom(await getRoom(roomId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That room could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [roomId]);

  useEffect(() => {
    void load();
  }, [load]);

  const requestSuggestion = useCallback(async () => {
    if (!room) return;
    setSuggesting(true);
    setSuggestionError(null);
    try {
      setSuggestion(await peerSuggestions(room));
    } catch (err) {
      setSuggestionError(err instanceof Error ? err.message : 'The summary could not be written.');
    } finally {
      setSuggesting(false);
    }
  }, [room]);

  const handleContribution = useCallback(
    async (input: { kind: ContributionKind; text: string; parentId?: string; byOwner?: boolean }) => {
      const contribution = await addContribution(roomId, { ...input, author: input.byOwner ? 'The student who asked' : 'A classmate' });
      setRoom((current) => (current ? { ...current, contributions: [...current.contributions, contribution] } : current));
      return contribution;
    },
    [roomId],
  );

  const handleHelpful = useCallback(
    async (contributionId: string) => {
      const updated = await markHelpful(roomId, contributionId);
      setRoom((current) =>
        current
          ? { ...current, contributions: current.contributions.map((c) => (c.id === contributionId ? updated : c)) }
          : current,
      );
    },
    [roomId],
  );

  const handleUnderstanding = useCallback(
    async (understanding: string) => {
      const updated = await saveUnderstanding(roomId, understanding);
      setRoom(updated);
    },
    [roomId],
  );

  const handleClose = useCallback(async () => {
    const updated = await closeRoom(roomId);
    setRoom(updated);
  }, [roomId]);

  const handleDelete = useCallback(async () => {
    await deleteRoom(roomId);
    if (session.sharedRoomId === roomId) session.setSharedRoomId(null);
    navigate('/peers', { replace: true });
  }, [roomId, session, navigate]);

  const roots = useMemo(() => room?.contributions.filter((c) => !c.parentId) ?? [], [room]);
  const repliesFor = useCallback(
    (id: string) => room?.contributions.filter((c) => c.parentId === id) ?? [],
    [room],
  );

  if (loading) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center">
        <Spinner label="Loading the peer room…" className="text-base" />
      </div>
    );
  }

  if (error || !room) {
    return (
      <div className="min-h-[calc(100vh-4rem)]">
        <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
          <ErrorNote onRetry={() => void load()}>{error ?? 'That room no longer exists.'}</ErrorNote>
          <button type="button" className="btn-secondary mt-5" onClick={() => navigate('/peers')}>
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back to peer rooms
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-4rem)]">
      <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
        <button type="button" className="btn-ghost btn-sm mb-5" onClick={() => navigate('/peers')}>
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          All peer rooms
        </button>

        {/* Room header */}
        <div className="surface-ivory p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="chip-amber">Shared by choice</span>
              {room.subject && <span className="chip border-ink-strong/15 bg-paper/[0.06] text-ink-strong/70">{room.subject}</span>}
              <span className={cn('chip', room.status === 'open' ? 'chip-moss' : 'chip')}>
                {room.status === 'open' ? 'Open' : room.status === 'reteaching' ? 'Re-teaching' : 'Closed'}
              </span>
            </div>
            <span className="text-2xs uppercase tracking-[0.12em] text-ink-strong/50">{formatRelative(room.createdAt)}</span>
          </div>

          <h1 className="display mt-4 text-2xl text-ink-strong">{room.title}</h1>
          <p className="mt-1 text-sm font-medium text-ink-strong/60">Concept: {room.concept}</p>

          <p className="mt-4 text-[0.95rem] leading-relaxed text-ink-strong/80">{room.detail}</p>

          {room.question && (
            <p className="mt-3 flex items-start gap-2 rounded-xl border border-pencil-deep/25 bg-pencil/[0.12] px-3.5 py-2.5 text-sm text-ink-strong">
              <MessageCircleQuestion className="mt-0.5 h-4 w-4 shrink-0 text-pencil-deep" aria-hidden="true" />
              {room.question}
            </p>
          )}

          {room.sharedExcerpt && (
            <p className="mt-3 rounded-xl border border-ink-strong/10 bg-white/60 px-3.5 py-2.5 text-sm italic leading-relaxed text-ink-strong/70">
              &ldquo;{room.sharedExcerpt}&rdquo;
            </p>
          )}

          <div className="mt-5 flex flex-wrap items-center gap-2">
            <span className="text-2xs uppercase tracking-[0.1em] text-ink-strong/50">
              {room.contributions.length} contribution{room.contributions.length === 1 ? '' : 's'}
            </span>
            {isOwner && (
              <>
                <span className="chip-moss">
                  <Check className="h-3 w-3" aria-hidden="true" />
                  You opened this room
                </span>
                {room.status !== 'closed' && (
                  <button type="button" className="btn-ghost btn-sm text-ink-strong/60" onClick={() => void handleClose()}>
                    Close room
                  </button>
                )}
                <button type="button" className="btn-ghost btn-sm text-wrong-deep" onClick={() => setConfirmDelete(true)}>
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  Delete room
                </button>
              </>
            )}
          </div>
        </div>

        {/* AI assistant */}
        <div className="surface mt-6 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="display flex items-center gap-2 text-base text-ink">
                <Sparkles className="h-4 w-4 text-pencil-deep" aria-hidden="true" />
                AI peer-support summary
              </h2>
              <p className="mt-1 text-sm text-muted">
                An AI assistant can read the room and point out the ideas that repeat. It is not a peer and it is not a
                teacher — it just helps you find the useful parts.
              </p>
            </div>
            <button type="button" className="btn-secondary btn-sm shrink-0" onClick={() => void requestSuggestion()} disabled={suggesting || room.contributions.length === 0}>
              {suggesting ? <Spinner label="Reading the room…" /> : 'Summarise the room'}
            </button>
          </div>

          {suggestionError && <ErrorNote className="mt-4" onRetry={() => void requestSuggestion()}>{suggestionError}</ErrorNote>}

          {suggestion && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-4 rounded-2xl border border-line/12 bg-paper/45 p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="text-2xs font-bold uppercase tracking-[0.14em] text-muted">AI-generated summary</span>
                <SourceTag source={suggestion.source} />
              </div>
              <p className="mt-3 text-sm leading-relaxed text-ink-soft">{suggestion.summary}</p>
              {suggestion.commonIdeas.length > 0 && (
                <ul className="mt-3 space-y-2">
                  {suggestion.commonIdeas.map((idea) => (
                    <li key={idea} className="flex items-start gap-2 text-sm leading-relaxed text-muted">
                      <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-pencil-deep" aria-hidden="true" />
                      {idea}
                    </li>
                  ))}
                </ul>
              )}
              {suggestion.simplerExplanation && (
                <div className="mt-3 rounded-xl border border-line/10 bg-paper/50 px-3.5 py-3">
                  <p className="text-2xs font-bold uppercase tracking-[0.12em] text-pencil-deep">A simpler version</p>
                  <p className="mt-1 text-sm leading-relaxed text-ink-soft">{suggestion.simplerExplanation}</p>
                </div>
              )}
              {suggestion.suggestedQuestion && (
                <p className="mt-3 flex items-start gap-2 text-sm italic leading-relaxed text-muted">
                  <MessageCircleQuestion className="mt-0.5 h-3.5 w-3.5 shrink-0 text-mika" aria-hidden="true" />
                  {suggestion.suggestedQuestion}
                </p>
              )}
            </motion.div>
          )}
        </div>

        {/* Contributions */}
        <div className="mt-6 space-y-4">
          {roots.length === 0 ? (
            <div className="surface p-10 text-center">
              <Users className="mx-auto h-7 w-7 text-muted" aria-hidden="true" />
              <p className="display mt-3 text-lg text-ink">Be the first to help</p>
              <p className="mx-auto mt-2 max-w-md text-sm text-muted">
                Add a simpler explanation, an example, an analogy, or how you personally understood this concept.
              </p>
            </div>
          ) : (
            roots.map((contribution, i) => (
              <ContributionCard
                key={contribution.id}
                contribution={contribution}
                replies={repliesFor(contribution.id)}
                isOwner={isOwner}
                onHelpful={() => void handleHelpful(contribution.id)}
                onReply={(text) => handleContribution({ kind: 'question', text, parentId: contribution.id, byOwner: isOwner })}
                index={i}
              />
            ))
          )}
        </div>

        {/* Add a contribution */}
        <AddContributionForm onSubmit={(input) => handleContribution(input)} />

        {/* Owner: understanding + re-teach */}
        {isOwner && (
          <div className="mt-6 rounded-2xl border border-right/35 bg-right/[0.08] p-5">
            <h2 className="display flex items-center gap-2 text-base text-ink">
              <RotateCcw className="h-4 w-4 text-right" aria-hidden="true" />
              Your updated understanding
            </h2>
            <p className="mt-1 text-sm text-muted">
              Once the explanations here make sense, write your new version of the concept. Then re-teach that slide in the
              classroom with the slide hidden.
            </p>
            <UnderstandingForm value={room.understanding ?? ''} onSave={handleUnderstanding} />
            <button type="button" className="btn-secondary mt-3" onClick={() => navigate('/reteach')}>
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              Go and re-teach it
            </button>
          </div>
        )}

        <InfoNote className="mt-6">
          <span className="font-semibold text-ink">Keep it kind. </span>
          Contributions are checked for links and abusive language, and the room owner can delete the room at any time.
        </InfoNote>
      </div>

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-paper/85 px-4 backdrop-blur-sm" role="dialog" aria-modal="true">
          <div className="surface-raised w-full max-w-md p-6">
            <h2 className="display text-lg text-ink">Delete this peer room?</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              This removes the room and every contribution in it. It cannot be undone.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" className="btn-ghost" onClick={() => setConfirmDelete(false)}>
                Keep it
              </button>
              <button type="button" className="btn-danger" onClick={() => void handleDelete()}>
                <Trash2 className="h-4 w-4" aria-hidden="true" />
                Delete room
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ContributionCard({
  contribution,
  replies,
  isOwner,
  onHelpful,
  onReply,
  index,
}: {
  contribution: PeerContribution;
  replies: PeerContribution[];
  isOwner: boolean;
  onHelpful: () => void;
  onReply: (text: string) => Promise<unknown>;
  index: number;
}) {
  const meta = KIND_META[contribution.kind];
  const Icon = meta.icon;
  const [replying, setReplying] = useState(false);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);

  const submitReply = async () => {
    if (wordCount(reply) < 3) return;
    setSending(true);
    try {
      await onReply(reply.trim());
      setReply('');
      setReplying(false);
    } finally {
      setSending(false);
    }
  };

  return (
    <motion.article
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: Math.min(index * 0.05, 0.25) }}
      className="surface p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className={cn('chip', 'border-line/15 bg-surface/[0.06]', meta.tone)}>
          <Icon className="h-3 w-3" aria-hidden="true" />
          {meta.label}
        </span>
        <span className="flex items-center gap-2 text-2xs uppercase tracking-[0.1em] text-muted">
          {contribution.aiGenerated ? <SourceTag source="ai" /> : contribution.author}
          <span aria-hidden="true">·</span>
          {formatRelative(contribution.at)}
        </span>
      </div>

      <p className="mt-3 whitespace-pre-line text-[0.95rem] leading-relaxed text-ink-soft">{contribution.text}</p>

      <div className="mt-3.5 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onHelpful}
          disabled={contribution.markedByOwner}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition',
            contribution.markedByOwner
              ? 'border-wrong/45 bg-wrong/12 text-wrong'
              : 'border-line/15 bg-surface/[0.05] text-muted hover:border-wrong/45 hover:text-wrong',
          )}
        >
          <Heart className={cn('h-3.5 w-3.5', contribution.markedByOwner && 'fill-current')} aria-hidden="true" />
          {contribution.markedByOwner ? 'Marked helpful' : 'This helped me'}
          {contribution.helpful > 0 && <span className="text-2xs opacity-70">{contribution.helpful}</span>}
        </button>
        <button type="button" className="btn-ghost btn-sm" onClick={() => setReplying((v) => !v)}>
          <CornerDownRight className="h-3.5 w-3.5" aria-hidden="true" />
          Reply
        </button>
      </div>

      {replying && (
        <div className="mt-3">
          <label className="sr-only" htmlFor={`reply-${contribution.id}`}>Your reply</label>
          <textarea
            id={`reply-${contribution.id}`}
            className="field min-h-[4.5rem] resize-y leading-relaxed"
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            placeholder={isOwner ? 'Ask a follow-up question…' : 'Add a thought…'}
            rows={2}
          />
          <div className="mt-2 flex justify-end gap-2">
            <button type="button" className="btn-ghost btn-sm" onClick={() => setReplying(false)}>
              <X className="h-3.5 w-3.5" aria-hidden="true" />
              Cancel
            </button>
            <button type="button" className="btn-primary btn-sm" onClick={() => void submitReply()} disabled={wordCount(reply) < 3 || sending}>
              {sending ? <Spinner label="Sending…" /> : 'Post reply'}
            </button>
          </div>
        </div>
      )}

      {replies.length > 0 && (
        <ul className="mt-4 space-y-2.5 border-l-2 border-line/10 pl-4">
          {replies.map((child) => (
            <li key={child.id} className="rounded-xl border border-line/10 bg-paper/40 px-3.5 py-2.5">
              <p className="text-2xs font-semibold uppercase tracking-[0.1em] text-muted">
                {child.byOwner ? 'The student who asked' : child.author} · {formatRelative(child.at)}
              </p>
              <p className="mt-1 text-sm leading-relaxed text-ink-soft">{child.text}</p>
            </li>
          ))}
        </ul>
      )}
    </motion.article>
  );
}

function AddContributionForm({ onSubmit }: { onSubmit: (input: { kind: ContributionKind; text: string }) => Promise<unknown> }) {
  const [kind, setKind] = useState<ContributionKind>('explanation');
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const submit = async () => {
    if (wordCount(text) < 4) {
      setError('Write at least a sentence so it is useful to the person asking.');
      return;
    }
    setSending(true);
    setError(null);
    try {
      await onSubmit({ kind, text: text.trim() });
      setText('');
      setDone(true);
      window.setTimeout(() => setDone(false), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Your contribution could not be posted.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="surface mt-6 p-5">
      <h2 className="display text-base text-ink">Add something that helps</h2>
      <p className="mt-1 text-sm text-muted">
        Choose the kind of help, then write it in your own words. Be specific and stay on the concept.
      </p>

      {error && <ErrorNote className="mt-4" onRetry={() => setError(null)}>{error}</ErrorNote>}

      <div className="mt-4 flex flex-wrap gap-2">
        {(Object.keys(KIND_META) as ContributionKind[]).map((key) => {
          const meta = KIND_META[key];
          const Icon = meta.icon;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setKind(key)}
              aria-pressed={kind === key}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition',
                kind === key
                  ? 'border-pencil/55 bg-pencil/[0.12] text-pencil-deep'
                  : 'border-line/15 bg-surface/[0.05] text-muted hover:border-line/30 hover:text-ink',
              )}
            >
              <Icon className="h-3.5 w-3.5" aria-hidden="true" />
              {meta.label}
            </button>
          );
        })}
      </div>

      <label className="sr-only" htmlFor="contribution-text">Your contribution</label>
      <textarea
        id="contribution-text"
        className="field mt-4 min-h-[6rem] resize-y leading-relaxed"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={
          kind === 'analogy'
            ? 'This is like…'
            : kind === 'example'
              ? 'For example, think about…'
              : kind === 'question'
                ? 'Have you tried thinking about it as…?'
                : kind === 'how-i-learned-it'
                  ? 'What finally worked for me was…'
                  : 'In simpler words, this means…'
        }
        maxLength={2000}
        rows={4}
      />

      <div className="mt-3 flex items-center justify-between gap-2">
        <span className="text-xs text-muted">{wordCount(text)} words</span>
        <button type="button" className="btn-primary" onClick={() => void submit()} disabled={sending || wordCount(text) < 4}>
          {sending ? <Spinner label="Posting…" /> : done ? (
            <>
              <Check className="h-4 w-4" aria-hidden="true" />
              Posted
            </>
          ) : (
            'Post contribution'
          )}
        </button>
      </div>
    </div>
  );
}

function UnderstandingForm({ value, onSave }: { value: string; onSave: (text: string) => Promise<unknown> }) {
  const [text, setText] = useState(value);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => setText(value), [value]);

  const save = async () => {
    setSaving(true);
    try {
      await onSave(text.trim());
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2500);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-3">
      <label className="sr-only" htmlFor="understanding-input">Your updated understanding</label>
      <textarea
        id="understanding-input"
        className="field min-h-[6rem] resize-y leading-relaxed"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Now I would explain it like this…"
        maxLength={1200}
        rows={4}
      />
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="text-xs text-muted">{wordCount(text)} words</span>
        <button type="button" className="btn-secondary btn-sm" onClick={() => void save()} disabled={saving || text.trim().length === 0}>
          {saving ? <Spinner label="Saving…" /> : saved ? (
            <>
              <Check className="h-3.5 w-3.5" aria-hidden="true" />
              Saved
            </>
          ) : (
            'Save my understanding'
          )}
        </button>
      </div>
    </div>
  );
}
