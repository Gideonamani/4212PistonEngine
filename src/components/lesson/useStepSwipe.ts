import React, { useEffect, useRef, useState } from 'react';

export type SwipeDirection = 'forward' | 'backward' | null;

interface StepSwipeOptions {
  onSwipeNext: () => void;
  onSwipePrev: () => void;
  canGoNext: boolean;
  canGoPrev: boolean;
  disabled?: boolean;
}

/**
 * Touch swipe left/right for mobile lesson step navigation, with gesture exclusion zones for:
 * - 3D viewers (canvas / role="application")
 * - Interactive controls (buttons, links, inputs, textareas, sliders, dialogs)
 * - Pan/zoom interactive media or elements marked [data-gesture-exclude]
 * - Edge swipe zones (within 24px of screen edge to avoid conflicting with browser gestures)
 * - Vertical scrolling (cancels horizontal swipe if vertical movement dominates)
 */
export function useStepSwipe(
  containerRef: React.RefObject<HTMLElement | null>,
  { onSwipeNext, onSwipePrev, canGoNext, canGoPrev, disabled = false }: StepSwipeOptions
) {
  const [slideDirection, setSlideDirection] = useState<SwipeDirection>(null);
  const touchStateRef = useRef<{
    startX: number;
    startY: number;
    startTime: number;
    canceled: boolean;
  } | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || disabled) return;

    const isExcluded = (target: EventTarget | null): boolean => {
      if (!(target instanceof HTMLElement)) return false;
      return Boolean(
        target.closest(
          'canvas, [role="application"], button, a, input, textarea, select, ' +
          '[role="button"], [role="slider"], [role="dialog"], [role="tab"], ' +
          '[role="combobox"], [data-gesture-exclude], .interactive-media, [data-pan-zoom]'
        )
      );
    };

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) {
        touchStateRef.current = null;
        return;
      }

      const touch = e.touches[0];
      const x = touch.clientX;
      const y = touch.clientY;

      // Exclusion: edge swipe zones (avoid conflict with iOS / Android back/forward gestures)
      if (x < 24 || x > window.innerWidth - 24) {
        touchStateRef.current = null;
        return;
      }

      // Exclusion: interactive elements, 3D canvas, buttons, sliders
      if (isExcluded(e.target)) {
        touchStateRef.current = null;
        return;
      }

      touchStateRef.current = {
        startX: x,
        startY: y,
        startTime: Date.now(),
        canceled: false,
      };
    };

    const handleTouchMove = (e: TouchEvent) => {
      const state = touchStateRef.current;
      if (!state || state.canceled) return;

      const touch = e.touches[0];
      if (!touch) return;

      const deltaX = touch.clientX - state.startX;
      const deltaY = touch.clientY - state.startY;

      // If vertical scroll dominates before horizontal threshold is reached, cancel swipe
      if (Math.abs(deltaY) > Math.abs(deltaX) && Math.abs(deltaY) > 10) {
        state.canceled = true;
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      const state = touchStateRef.current;
      touchStateRef.current = null;
      if (!state || state.canceled) return;

      const touch = e.changedTouches[0];
      if (!touch) return;

      const deltaX = touch.clientX - state.startX;
      const deltaY = touch.clientY - state.startY;
      const duration = Date.now() - state.startTime;

      // Swipes must be relatively quick (< 500ms) and exceed min distance (45px)
      const minDistance = 45;
      const isHorizontal = Math.abs(deltaX) > Math.abs(deltaY) * 1.5;

      if (duration < 500 && Math.abs(deltaX) >= minDistance && isHorizontal) {
        if (deltaX < 0 && canGoNext) {
          // Swiped left (finger moved left) -> Next Step
          setSlideDirection('forward');
          onSwipeNext();
        } else if (deltaX > 0 && canGoPrev) {
          // Swiped right (finger moved right) -> Previous Step
          setSlideDirection('backward');
          onSwipePrev();
        }
      }
    };

    el.addEventListener('touchstart', handleTouchStart, { passive: true });
    el.addEventListener('touchmove', handleTouchMove, { passive: true });
    el.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      el.removeEventListener('touchstart', handleTouchStart);
      el.removeEventListener('touchmove', handleTouchMove);
      el.removeEventListener('touchend', handleTouchEnd);
    };
  }, [containerRef, onSwipeNext, onSwipePrev, canGoNext, canGoPrev, disabled]);

  return { slideDirection, setSlideDirection };
}
