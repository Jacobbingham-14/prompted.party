import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { PlayerAvatar } from '@/components/PlayerAvatar';

interface Player {
  id: string;
  name: string;
  avatar_url?: string | null;
}

interface ForgeryVote {
  voter_id: string;
  accused_player_id: string;
}

interface ForgeryRevealProps {
  players: Player[];
  forgerIds: string[];
  votes: ForgeryVote[];
  mainPrompt: string;
  forgerPrompt: string;
  scoreChanges: Record<string, number>;
  isHost: boolean;
  onContinue: () => void;
}

export default function ForgeryReveal({
  players,
  forgerIds,
  votes,
  mainPrompt,
  forgerPrompt,
  scoreChanges,
  isHost,
  onContinue,
}: ForgeryRevealProps) {
  const [step, setStep] = useState(1);

  const getPlayer = (id: string) => players.find((p) => p.id === id);

  // Tally votes per accused player
  const voteCounts: Record<string, number> = {};
  for (const vote of votes) {
    voteCounts[vote.accused_player_id] = (voteCounts[vote.accused_player_id] || 0) + 1;
  }

  // Determine if forger escaped (majority didn't vote for any single forger)
  const totalVotes = votes.length;
  const forgerEscaped = forgerIds.every((fid) => {
    const forgerVotes = voteCounts[fid] || 0;
    return forgerVotes <= totalVotes / 2;
  });

  const sortedPlayers = [...players].sort(
    (a, b) => (voteCounts[b.id] || 0) - (voteCounts[a.id] || 0)
  );

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-lg space-y-6">

        {/* Step 1: The Prompts */}
        {step === 1 && (
          <div className="space-y-6 text-center animate-in fade-in duration-500">
            <div className="text-5xl">📜</div>
            <h1 className="text-3xl font-bold text-foreground">The Prompts Were…</h1>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="rounded-xl border-2 border-green-500 bg-green-500/10 p-5 space-y-2">
                <p className="text-xs font-semibold uppercase tracking-widest text-green-600 dark:text-green-400">
                  Artists' Prompt
                </p>
                <p className="text-lg font-bold text-foreground">{mainPrompt}</p>
              </div>
              <div className="rounded-xl border-2 border-red-500 bg-red-500/10 p-5 space-y-2">
                <p className="text-xs font-semibold uppercase tracking-widest text-red-600 dark:text-red-400">
                  Forger's Prompt
                </p>
                <p className="text-lg font-bold text-foreground">{forgerPrompt}</p>
              </div>
            </div>
            <Button onClick={() => setStep(2)} size="lg" className="w-full">
              Reveal the Forger →
            </Button>
          </div>
        )}

        {/* Step 2: Forger Identity + Vote Breakdown */}
        {step === 2 && (
          <div className="space-y-6 animate-in fade-in duration-500">
            <div className="text-center space-y-2">
              <div className="text-5xl">🕵️</div>
              <h1 className="text-3xl font-bold text-foreground">
                {forgerEscaped ? 'The Forger Escaped!' : 'Forger Caught!'}
              </h1>
            </div>

            {/* Forger reveal */}
            <div className="space-y-2">
              {forgerIds.map((fid) => {
                const forger = getPlayer(fid);
                if (!forger) return null;
                return (
                  <div
                    key={fid}
                    className="flex items-center gap-3 rounded-xl border-2 border-red-500 bg-red-500/10 p-4"
                  >
                    <PlayerAvatar name={forger.name} avatarUrl={forger.avatar_url} size="md" />
                    <div>
                      <p className="font-bold text-lg text-foreground">{forger.name}</p>
                      <p className="text-sm text-red-600 dark:text-red-400">The Forger 🕵️</p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Vote breakdown */}
            <div className="space-y-2">
              <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Vote Breakdown
              </p>
              {sortedPlayers.map((player) => {
                const count = voteCounts[player.id] || 0;
                const pct = totalVotes > 0 ? (count / totalVotes) * 100 : 0;
                const isForger = forgerIds.includes(player.id);
                return (
                  <div key={player.id} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <PlayerAvatar name={player.name} avatarUrl={player.avatar_url} size="sm" />
                        <span className="font-medium text-sm">{player.name}</span>
                        {isForger && (
                          <span className="text-xs text-red-500 font-semibold">🕵️ Forger</span>
                        )}
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {count} vote{count !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all duration-700 ${
                          isForger ? 'bg-red-500' : 'bg-primary'
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            <Button onClick={() => setStep(3)} size="lg" className="w-full">
              See Score Changes →
            </Button>
          </div>
        )}

        {/* Step 3: Score Changes */}
        {step === 3 && (
          <div className="space-y-6 animate-in fade-in duration-500">
            <div className="text-center space-y-2">
              <div className="text-5xl">{forgerEscaped ? '😈' : '🎉'}</div>
              <h1 className="text-3xl font-bold text-foreground">Score Update</h1>
              <p className="text-muted-foreground">
                {forgerEscaped
                  ? 'The forger blended in — they earn bonus points!'
                  : 'The crowd found the forger — voters earn points!'}
              </p>
            </div>

            <div className="space-y-2">
              {players
                .filter((p) => (scoreChanges[p.id] || 0) !== 0)
                .sort((a, b) => (scoreChanges[b.id] || 0) - (scoreChanges[a.id] || 0))
                .map((player) => {
                  const delta = scoreChanges[player.id] || 0;
                  const isForger = forgerIds.includes(player.id);
                  return (
                    <div
                      key={player.id}
                      className={`flex items-center justify-between rounded-xl border-2 p-4 ${
                        delta > 0
                          ? 'border-green-500 bg-green-500/10'
                          : 'border-muted bg-muted/30'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <PlayerAvatar name={player.name} avatarUrl={player.avatar_url} size="sm" />
                        <div>
                          <p className="font-semibold text-sm">{player.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {isForger
                              ? forgerEscaped
                                ? 'Escaped undetected'
                                : 'Caught by the crowd'
                              : delta > 0
                                ? 'Correctly identified the forger'
                                : 'Voted for the wrong person'}
                          </p>
                        </div>
                      </div>
                      <span
                        className={`text-xl font-bold ${
                          delta > 0 ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'
                        }`}
                      >
                        {delta > 0 ? `+${delta}` : delta === 0 ? '±0' : delta}
                      </span>
                    </div>
                  );
                })}

              {players
                .filter((p) => (scoreChanges[p.id] || 0) === 0)
                .map((player) => (
                  <div
                    key={player.id}
                    className="flex items-center justify-between rounded-xl border-2 border-muted bg-muted/20 p-4 opacity-60"
                  >
                    <div className="flex items-center gap-3">
                      <PlayerAvatar name={player.name} avatarUrl={player.avatar_url} size="sm" />
                      <p className="font-semibold text-sm">{player.name}</p>
                    </div>
                    <span className="text-xl font-bold text-muted-foreground">±0</span>
                  </div>
                ))}
            </div>

            {isHost ? (
              <Button onClick={onContinue} size="lg" className="w-full">
                Continue to Scoreboard
              </Button>
            ) : (
              <p className="text-center text-sm text-muted-foreground">
                Waiting for the host to continue…
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
