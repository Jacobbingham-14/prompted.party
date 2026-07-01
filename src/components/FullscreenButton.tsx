import { useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Maximize, Minimize } from 'lucide-react';

/**
 * YouTube-style fullscreen toggle for the host / shared screen.
 *
 * Targets the whole document, so once the host enters fullscreen it persists
 * across React state changes and route-internal navigation for the rest of the
 * game (voting, reveals, scoreboard) until they press Esc or toggle it off.
 *
 * Fixed to the top-right by default so it sits opposite the "End Game" button.
 */
interface FullscreenButtonProps {
  className?: string;
}

// Minimal cross-browser wrappers (Safari still uses the webkit-prefixed API).
const getFullscreenElement = (): Element | null =>
  document.fullscreenElement || (document as any).webkitFullscreenElement || null;

const requestFullscreen = (el: HTMLElement): Promise<void> | void => {
  if (el.requestFullscreen) return el.requestFullscreen();
  const webkit = (el as any).webkitRequestFullscreen;
  if (webkit) return webkit.call(el);
};

const exitFullscreen = (): Promise<void> | void => {
  if (document.exitFullscreen) return document.exitFullscreen();
  const webkit = (document as any).webkitExitFullscreen;
  if (webkit) return webkit.call(document);
};

export default function FullscreenButton({ className }: FullscreenButtonProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [supported, setSupported] = useState(true);

  useEffect(() => {
    const el = document.documentElement;
    setSupported(!!(el.requestFullscreen || (el as any).webkitRequestFullscreen));

    const sync = () => setIsFullscreen(!!getFullscreenElement());
    sync();
    document.addEventListener('fullscreenchange', sync);
    document.addEventListener('webkitfullscreenchange', sync);
    return () => {
      document.removeEventListener('fullscreenchange', sync);
      document.removeEventListener('webkitfullscreenchange', sync);
    };
  }, []);

  const toggle = useCallback(async () => {
    try {
      if (getFullscreenElement()) {
        await exitFullscreen();
      } else {
        await requestFullscreen(document.documentElement);
      }
    } catch {
      // Browsers reject fullscreen if not triggered by a user gesture, or on
      // unsupported devices (e.g. iOS Safari). Silently ignore — the click
      // itself is the gesture, so this only fires on genuinely unsupported UAs.
    }
  }, []);

  if (!supported) return null;

  return (
    <Button
      onClick={toggle}
      variant="secondary"
      size="sm"
      className={className ?? 'fixed top-4 right-4 z-50 shadow-lg gap-2'}
      aria-label={isFullscreen ? 'Exit full screen' : 'Enter full screen'}
      title={isFullscreen ? 'Exit full screen' : 'Full screen'}
    >
      {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
      <span className="hidden sm:inline">{isFullscreen ? 'Exit Full Screen' : 'Full Screen'}</span>
    </Button>
  );
}
