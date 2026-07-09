import { Button } from '@/components/ui/button';
import { QRCodeCanvas } from 'qrcode.react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { PlayerAvatar } from '@/components/PlayerAvatar';
import { AvatarCreator } from '@/components/AvatarCreator';
import FullscreenButton from '@/components/FullscreenButton';

interface Player {
  id: string;
  name: string;
  score: number;
  avatar_url?: string | null;
}

interface LobbyProps {
  roomCode: string;
  roomId: string;
  players: Player[];
  isHost: boolean;
  currentPlayerId?: string;
  onStartGame: () => void;
  onRemovePlayer?: (playerId: string) => void;
  onAvatarUpdated?: (playerId: string, url: string) => void;
  gameMode: 'judge' | 'voting' | 'forgery' | 'duel';
}

const MODE_COPY: Record<LobbyProps['gameMode'], { name: string; blurb: string }> = {
  judge: { name: 'JUDGE MODE', blurb: 'One critic judges each round and crowns a winner. 3+ artists.' },
  forgery: { name: 'FORGERY MODE', blurb: 'One artist gets a secret prompt. Spot the forger. 3+ artists.' },
  duel: { name: 'PROMPT DUEL', blurb: 'Head-to-head matchups, 3 rounds, funnier answer wins. 3+ artists.' },
  voting: { name: 'VOTING MODE', blurb: 'Everyone bids on the images. Most bids wins. 3+ artists.' },
};

export default function Lobby({ roomCode, roomId, players, isHost, currentPlayerId, onStartGame, onRemovePlayer, onAvatarUpdated, gameMode }: LobbyProps) {
  const [origin, setOrigin] = useState<string>('');
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Avoid SSR window access
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setOrigin(window.location.origin);
    }
  }, []);

  const joinUrl = useMemo(() => {
    if (!origin) return '';
    return `${origin}/join?code=${roomCode}`;
  }, [origin, roomCode]);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(joinUrl);
    } catch {}
  };

  const shareLink = async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: 'Join my game',
          text: 'Scan or tap to join the game:',
          url: joinUrl,
        });
      } else {
        await copyLink();
      }
    } catch {}
  };

  const downloadQrPng = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = `join-${roomCode}.png`;
    a.click();
  };

  const shareQrImage = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    try {
      const dataUrl = canvas.toDataURL('image/png');
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      const file = new File([blob], `join-${roomCode}.png`, { type: 'image/png' });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: 'Join my game',
          text: 'Scan this to join!',
          files: [file],
        });
      } else {
        downloadQrPng();
      }
    } catch {
      downloadQrPng();
    }
  };

  const mode = MODE_COPY[gameMode];

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      {isHost && <FullscreenButton />}

      <div className="w-full max-w-3xl space-y-6">
        {/* Marquee */}
        <div className="text-center space-y-4">
          <p className="font-retro text-xl uppercase tracking-widest text-gal-teal">
            ★ Prompted.party presents ★
          </p>
          <h1 className="font-pixel text-xl md:text-3xl leading-relaxed">
            THE EXHIBITION<br />
            <span className="text-gal-gold">OPENS TONIGHT</span>
          </h1>

          {/* Room code on brass plaques */}
          <div className="flex justify-center gap-2 pt-2" aria-label={`Room code ${roomCode}`}>
            {roomCode.split('').map((ch, i) => (
              <span
                key={i}
                className="plaque animate-px-hop-in inline-flex h-14 w-14 items-center justify-center text-xl md:h-18 md:w-16 md:text-2xl"
                style={{ animationDelay: `${i * 90}ms` }}
              >
                {ch}
              </span>
            ))}
          </div>

          <p className="font-retro mx-auto max-w-lg text-xl text-muted-foreground">
            <span className="text-gal-seal">{mode.name}</span> — {mode.blurb}
          </p>
        </div>

        {/* Admission ticket (QR) — host only */}
        {isHost && (
          <div className="flex flex-col items-center gap-3">
            <div className="exhibit-card animate-px-hop-in animation-delay-300 bg-paper p-3">
              <QRCodeCanvas
                value={joinUrl || 'about:blank'}
                size={150}
                includeMargin
                // @ts-ignore
                ref={canvasRef}
              />
              <p className="font-pixel mt-2 text-center text-[9px] text-ink">SCAN FOR ADMISSION</p>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              <Button variant="outline" size="sm" onClick={copyLink} disabled={!joinUrl}>
                Copy Link
              </Button>
              <Button variant="outline" size="sm" onClick={shareLink} disabled={!joinUrl}>
                Share Link
              </Button>
              <Button variant="outline" size="sm" onClick={shareQrImage} disabled={!joinUrl}>
                Share QR
              </Button>
              <Button variant="ghost" size="sm" onClick={downloadQrPng}>
                Save PNG
              </Button>
            </div>
          </div>
        )}

        {/* Open the doors / waiting */}
        {isHost ? (
          <div className="space-y-3 text-center">
            <Button
              onClick={onStartGame}
              disabled={players.length < 3}
              className="h-16 w-full text-sm md:text-base"
            >
              {players.length < 3
                ? `AWAITING ${3 - players.length} MORE ARTIST${3 - players.length === 1 ? '' : 'S'}`
                : 'OPEN THE DOORS'}
            </Button>
            {players.length >= 3 && (
              <p className="font-pixel text-[10px] text-gal-seal animate-px-blink">THE CRITICS ARE READY</p>
            )}
          </div>
        ) : (
          <p className="font-retro text-center text-2xl text-muted-foreground">
            Waiting for the curator to open the doors<span className="animate-px-blink">_</span>
          </p>
        )}

        <div className="velvet-rule" role="separator" />

        {/* Guest list */}
        <div className="exhibit-card p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-pixel text-xs md:text-sm">TONIGHT'S ARTISTS</h2>
            <span className="plaque px-2.5 py-1.5 text-[9px]">{players.length}/12</span>
          </div>
          <div className="max-h-56 space-y-1.5 overflow-y-auto">
            {players.map((player, i) => (
              <div
                key={player.id}
                className="animate-px-hop-in flex items-center justify-between gap-2 border-b border-ink/10 px-1 py-1.5"
                style={{ animationDelay: `${i * 70}ms` }}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className="font-pixel text-[10px] text-gal-gold">▸</span>
                  <PlayerAvatar name={player.name} avatarUrl={player.avatar_url} size="sm" />
                  <span className="font-retro truncate text-2xl">{player.name}</span>
                  <span className="font-retro hidden text-lg text-muted-foreground sm:inline">
                    has entered the gallery
                  </span>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {currentPlayerId === player.id && !isHost && onAvatarUpdated && (
                    <AvatarCreator
                      playerId={player.id}
                      roomId={roomId}
                      onAvatarSaved={(url) => onAvatarUpdated(player.id, url)}
                    />
                  )}
                  {isHost && onRemovePlayer && (
                    <button
                      onClick={() => onRemovePlayer(player.id)}
                      className="font-retro text-xl text-muted-foreground hover:text-destructive"
                      aria-label={`Remove ${player.name}`}
                    >
                      [escort out]
                    </button>
                  )}
                </div>
              </div>
            ))}
            {players.length === 0 && (
              <p className="font-retro text-xl text-muted-foreground">
                The gallery is empty. Scan the ticket<span className="animate-px-blink">_</span>
              </p>
            )}
          </div>
        </div>

        <p className="font-retro text-center text-lg text-muted-foreground">
          FINE ART, POORLY UNDERSTOOD — EST. MMXXVI
        </p>
      </div>
    </div>
  );
}
