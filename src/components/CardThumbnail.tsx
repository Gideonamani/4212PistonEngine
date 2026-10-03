import React, { useState } from 'react';
import { VisualIllustration } from './VisualIllustrations';

type IllustrationType = React.ComponentProps<typeof VisualIllustration>['type'];

/**
 * A course, lesson or check card image. It fills its parent, shows the pack's thumbnail when there is one, and falls back to the
 * drawn illustration if the file is missing or fails to load.
 */
export const CardThumbnail: React.FC<{ src?: string; fallbackType: IllustrationType }> = ({ src, fallbackType }) => {
  const [failedSrc, setFailedSrc] = useState<string>();
  if (!src || failedSrc === src) return <VisualIllustration type={fallbackType} className="h-full w-full" />;
  return <img src={src} alt="" loading="lazy" decoding="async" draggable={false} onError={() => setFailedSrc(src)} className="h-full w-full object-cover" />;
};
