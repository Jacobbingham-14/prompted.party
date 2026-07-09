import { useEffect, useState } from 'react';
import JoinQRCode from './JoinQRCode';

interface HostWaitingViewProps {
  submittedCount: number;
  totalPlayers: number;
  roomCode: string;
}

const CURATOR_LINES = [
  'the artists are mixing their pixels…',
  'someone is arguing with the machine…',
  'adding extra fingers, per tradition…',
  'the machine is taking the prompt very literally…',
  'a masterpiece is being ruined as we speak…',
  'consulting the cursed archives…',
  'restoration team on standby…',
  'the critics are sharpening their monocles…',
];

export default function HostWaitingView({ submittedCount, totalPlayers, roomCode }: HostWaitingViewProps) {
  const [lineIndex, setLineIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setLineIndex((i) => (i + 1) % CURATOR_LINES.length);
    }, 2800);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <JoinQRCode roomCode={roomCode} />

      <div className="w-full max-w-3xl space-y-10 text-center">
        <div className="space-y-3">
          <p className="font-retro text-xl uppercase tracking-widest text-gal-teal">Round in progress</p>
          <h1 className="font-pixel text-2xl md:text-4xl leading-relaxed">
            THE ARTISTS<br />
            <span className="text-gal-gold">ARE PAINTING</span>
          </h1>
        </div>

        {/* Bouncing gilded blocks */}
        <div className="flex items-end justify-center gap-3" aria-hidden>
          <div className="plaque h-8 w-8 animate-px-bounce" />
          <div className="h-8 w-8 animate-px-bounce animation-delay-150 border-[3px] border-ink bg-gal-seal" />
          <div className="h-8 w-8 animate-px-bounce animation-delay-300 border-[3px] border-ink bg-gal-teal" />
          <div className="h-8 w-8 animate-px-bounce animation-delay-450 border-[3px] border-ink bg-gal-velvet" />
        </div>

        {/* Commissions received */}
        <div className="exhibit-card mx-auto max-w-xl p-8 space-y-5">
          <p className="font-pixel text-4xl md:text-6xl text-gal-gold">
            {submittedCount}
            <span className="text-2xl text-muted-foreground">/{totalPlayers}</span>
          </p>
          <div className="flex gap-1" role="progressbar" aria-valuenow={submittedCount} aria-valuemax={totalPlayers}>
            {Array.from({ length: Math.max(totalPlayers, 1) }).map((_, i) => (
              <div
                key={i}
                className={`h-6 flex-1 border-2 border-ink ${i < submittedCount ? 'bg-gal-gold' : 'bg-muted'}`}
              />
            ))}
          </div>
          <p className="font-pixel text-[10px] md:text-xs">COMMISSIONS RECEIVED</p>
        </div>

        <p key={lineIndex} className="font-retro text-2xl text-gal-teal animate-px-hop-in">
          {CURATOR_LINES[lineIndex]}
        </p>
      </div>
    </div>
  );
}
