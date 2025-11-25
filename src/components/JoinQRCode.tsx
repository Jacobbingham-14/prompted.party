import { QRCodeCanvas } from 'qrcode.react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Copy, Check } from 'lucide-react';

interface JoinQRCodeProps {
  roomCode: string;
}

export default function JoinQRCode({ roomCode }: JoinQRCodeProps) {
  const [origin, setOrigin] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setOrigin(window.location.origin);
    }
  }, []);

  const joinUrl = useMemo(() => {
    if (!origin) return '';
    return `${origin}/join?code=${roomCode}`;
  }, [origin, roomCode]);

  const handleCopy = () => {
    navigator.clipboard.writeText(joinUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!joinUrl) return null;

  return (
    <div className="fixed top-20 left-4 bg-card border-2 border-border rounded-lg p-2 shadow-lg z-50">
      <div className="text-center space-y-1">
        <p className="text-xs font-semibold text-foreground">Scan to Join</p>
        <QRCodeCanvas
          value={joinUrl}
          size={80}
          level="H"
          ref={canvasRef}
        />
        <p className="text-xs text-muted-foreground font-mono">{roomCode}</p>
      </div>
    </div>
  );
}
