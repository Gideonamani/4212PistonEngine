import React, { useState } from 'react';
import { Cog } from 'lucide-react';

/** The neutral frame shown while a card has no picture of its own: a quiet gradient that claims nothing about the subject. */
const ThumbnailPlaceholder: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div aria-hidden="true" className={`flex h-full w-full items-center justify-center bg-gradient-to-br from-[#0b2429] to-[#071317] ${className}`}>
    <Cog className="h-1/3 w-1/3 text-teal-400/25" strokeWidth={1.25} />
  </div>
);

/**
 * A course, lesson, check or Explore card image. Cards are small files near the top of the screen, so they load at once rather than
 * lazily (lazy loading left empty frames on first paint). It fills its parent, shows the pack's thumbnail when there is one, and falls back to the
 * neutral placeholder if there is no file or it fails to load.
 */
export const CardThumbnail: React.FC<{ src?: string; className?: string }> = ({ src, className = '' }) => {
  const [failedSrc, setFailedSrc] = useState<string>();
  if (!src || failedSrc === src) return <ThumbnailPlaceholder className={className} />;
  return <img src={src} alt="" decoding="async" draggable={false} onError={() => setFailedSrc(src)} className={`h-full w-full object-cover ${className}`} />;
};
