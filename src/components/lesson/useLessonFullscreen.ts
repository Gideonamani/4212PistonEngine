import { useEffect, useState, type RefObject } from 'react';
import { useShellChrome } from '../ShellChrome';

/**
 * Full-screen for a lesson. It asks the browser for real fullscreen on the lesson's own element; where that is refused (iPhone Safari)
 * it falls back to covering the page with CSS, which Escape also leaves. Either way the app frame is told, so it hides its header and
 * tab bar. `coversPage` is true only for the CSS fallback, the one case where the element has to position itself.
 */
export function useLessonFullscreen(target: RefObject<HTMLElement | null>) {
  const { setLessonImmersive } = useShellChrome();
  const [isImmersive, setIsImmersive] = useState(false);

  useEffect(() => {
    if (!isImmersive || document.fullscreenElement) return;
    const exitFallback = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsImmersive(false);
        setLessonImmersive(false);
      }
    };
    window.addEventListener('keydown', exitFallback);
    return () => window.removeEventListener('keydown', exitFallback);
  }, [isImmersive, setLessonImmersive]);

  useEffect(() => {
    const syncFullscreen = () => {
      const active = document.fullscreenElement === target.current;
      setIsImmersive(active);
      setLessonImmersive(active);
    };
    document.addEventListener('fullscreenchange', syncFullscreen);
    return () => {
      document.removeEventListener('fullscreenchange', syncFullscreen);
      setLessonImmersive(false);
    };
  }, [setLessonImmersive, target]);

  const toggleImmersive = async () => {
    if (isImmersive) {
      if (document.fullscreenElement) await document.exitFullscreen().catch(() => undefined);
      setIsImmersive(false);
      setLessonImmersive(false);
      return;
    }
    if (target.current?.requestFullscreen && document.fullscreenEnabled) {
      try {
        await target.current.requestFullscreen();
        return;
      } catch {
        // Continue with the CSS immersive fallback.
      }
    }
    setIsImmersive(true);
    setLessonImmersive(true);
  };

  return { isImmersive, coversPage: isImmersive && !document.fullscreenElement, toggleImmersive };
}
