import React, { useState } from 'react';
import { VisualIllustration } from './VisualIllustrations';

type IllustrationType = React.ComponentProps<typeof VisualIllustration>['type'];

/**
 * A course, lesson, check or Explore card image. It fills its parent, shows the pack's thumbnail when there is one, and falls back to the
 * drawn illustration if the file is missing or fails to load.
 */
export const CardThumbnail: React.FC<{ src?: string; fallbackType: IllustrationType; className?: string }> = ({ src, fallbackType, className = '' }) => {
  const [failedSrc, setFailedSrc] = useState<string>();
  if (!src || failedSrc === src) return <VisualIllustration type={fallbackType} className={`h-full w-full ${className}`} />;
  return <img src={src} alt="" loading="lazy" decoding="async" draggable={false} onError={() => setFailedSrc(src)} className={`h-full w-full object-cover ${className}`} />;
};
