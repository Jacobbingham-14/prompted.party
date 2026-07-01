import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Loader2, Sparkles, Check, RefreshCw, AlertTriangle } from 'lucide-react';
import { useSharedDeadline } from '@/hooks/useSharedDeadline';
import { isValidDuelAnswer } from '@/lib/duelPrompt';

export interface DuelMatchupLite {
  id: string;
  prompt_text: string;
  player_a_id: string;
  player_b_id: string;
}

export interface DuelSubmissionLite {
  matchup_id: string;
  answer_text: string;
  image_url: string | null;
  image_status: string; // pending | generating | ready | failed
}

interface DuelSubmissionProps {
  matchups: DuelMatchupLite[];
  submissions: DuelSubmissionLite[];
  currentPlayerId: string;
  roundNumber: number;
  pointsPerVote: number;
  deadlineAt?: string | null;
  onSubmitAnswer: (matchupId: string, answer: string) => Promise<void>;
}

export default function DuelSubmission({
  matchups,
  submissions,
  currentPlayerId,
  roundNumber,
  pointsPerVote,
  deadlineAt,
  onSubmitAnswer,
}: DuelSubmissionProps) {
  const { timeLeft } = useSharedDeadline(deadlineAt, 180);
  // Local drafts keyed by matchup id; falls back to any saved answer.
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<Record<string, boolean>>({});

  const subFor = (matchupId: string) => submissions.find((s) => s.matchup_id === matchupId);
  const draftFor = (m: DuelMatchupLite) =>
    drafts[m.id] !== undefined ? drafts[m.id] : subFor(m.id)?.answer_text ?? '';

  const readyCount = matchups.filter((m) => subFor(m.id)?.image_status === 'ready').length;
  const allReady = matchups.length > 0 && readyCount === matchups.length;

  const submit = async (m: DuelMatchupLite) => {
    const answer = draftFor(m).trim();
    if (!isValidDuelAnswer(answer)) return;
    setBusy((b) => ({ ...b, [m.id]: true }));
    try {
      await onSubmitAnswer(m.id, answer);
    } finally {
      setBusy((b) => ({ ...b, [m.id]: false }));
    }
  };

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-foreground">Round {roundNumber} — Prompt Duel</h1>
          <p className="text-muted-foreground">
            You have <span className="font-semibold text-foreground">two prompts</span>. Write your funniest
            answer for each — we'll turn it into an image.
          </p>
          <div className="flex items-center justify-center gap-2 pt-1">
            <Badge variant="secondary" className="px-3 py-1">🏆 {pointsPerVote} pts per vote</Badge>
            <Badge variant={timeLeft <= 20 ? 'destructive' : 'secondary'} className="px-3 py-1">⏱️ {timeLeft}s</Badge>
          </div>
        </div>

        {matchups.length === 0 && (
          <div className="text-center text-muted-foreground py-12">
            <Loader2 className="w-6 h-6 animate-spin mx-auto mb-3" />
            Getting your prompts ready…
          </div>
        )}

        {matchups.map((m, idx) => {
          const sub = subFor(m.id);
          const status = sub?.image_status;
          const isBusy = busy[m.id] || status === 'generating';
          const value = draftFor(m);

          return (
            <div key={m.id} className="rounded-xl border-2 border-border bg-card p-5 space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/15 text-primary flex items-center justify-center font-bold flex-shrink-0">
                  {idx + 1}
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Prompt {idx + 1}</p>
                  <p className="text-lg font-semibold text-foreground leading-snug">{m.prompt_text}</p>
                </div>
              </div>

              {status === 'ready' && sub?.image_url ? (
                <div className="space-y-3">
                  <div className="rounded-lg overflow-hidden border-2 border-primary/40">
                    <img src={sub.image_url} alt="Your generated image" className="w-full aspect-square object-cover" />
                  </div>
                  <p className="text-sm text-green-600 dark:text-green-400 font-medium flex items-center gap-1">
                    <Check className="w-4 h-4" /> Submitted: "{sub.answer_text}"
                  </p>
                </div>
              ) : (
                <>
                  <Textarea
                    value={value}
                    onChange={(e) => setDrafts((d) => ({ ...d, [m.id]: e.target.value }))}
                    placeholder="Type your funniest answer…"
                    maxLength={200}
                    disabled={isBusy}
                    className="min-h-[80px] resize-none text-base"
                  />
                  {status === 'failed' && (
                    <p className="text-sm text-destructive flex items-center gap-1">
                      <AlertTriangle className="w-4 h-4" /> Image generation failed. Try again.
                    </p>
                  )}
                </>
              )}

              <div className="flex items-center justify-between gap-3">
                <span className="text-xs text-muted-foreground">{value.length}/200</span>
                <Button
                  onClick={() => submit(m)}
                  disabled={isBusy || !isValidDuelAnswer(value)}
                  className="min-w-[140px]"
                >
                  {isBusy ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generating…</>
                  ) : status === 'ready' ? (
                    <><RefreshCw className="w-4 h-4 mr-2" /> Redo</>
                  ) : status === 'failed' ? (
                    <><RefreshCw className="w-4 h-4 mr-2" /> Retry</>
                  ) : (
                    <><Sparkles className="w-4 h-4 mr-2" /> Submit</>
                  )}
                </Button>
              </div>
            </div>
          );
        })}

        {allReady && (
          <div className="text-center py-4 space-y-1">
            <p className="text-xl font-bold text-foreground">You're all set! 🎉</p>
            <p className="text-muted-foreground">Sit tight — waiting for the host to start the duels.</p>
          </div>
        )}
      </div>
    </div>
  );
}
