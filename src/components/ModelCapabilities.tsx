import React from 'react';
import { CirclePlay, Layers, MapPin, MousePointerClick } from 'lucide-react';
import { MODEL_CAPABILITY_KINDS, type ModelCapability, type ModelCapabilityKind } from '../data/modelRegistry';

/**
 * What a model offers, as five icons. The same five appear in the Explore gallery under each tile (with a hover tooltip), in the legend
 * in the info sheet (the only place a touch screen learns what they mean), and, as the matching tabs, in the viewer's controls.
 */

type IconProps = { className?: string };

/** A cube with a plane cut through it: the glyph the section-plane chips already use, drawn at the weight of the other icons. */
const SectionGlyph: React.FC<IconProps> = ({ className }) => (
  <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="2.67" strokeLinejoin="round" aria-hidden="true" className={className}>
    <polygon points="16,3 27.4,9.6 27.4,22.4 16,29 4.6,22.4 4.6,9.6" />
    <polygon points="16,23 27.4,16 16,9 4.6,16" fill="rgba(45,212,191,.32)" />
  </svg>
);

export const CAPABILITIES: Record<ModelCapabilityKind, { name: string; means: string; Icon: React.ComponentType<IconProps> }> = {
  animated: { name: 'Animated', means: 'The mechanism runs. Play, pause or scrub it.', Icon: CirclePlay },
  exploded: { name: 'Exploded view', means: 'The parts spread apart and come back together.', Icon: Layers },
  section: { name: 'Section view', means: 'Cut through the model to see inside.', Icon: SectionGlyph },
  parts: { name: 'Named parts', means: 'Tap a part, or search the list, to see what it is.', Icon: MousePointerClick },
  tour: { name: 'Guided tour', means: 'Tap a hotspot to fly to a key feature.', Icon: MapPin },
};

/** What a screen reader hears for a tile: every icon spelled out, since the icons themselves are decoration. */
export const describeCapabilities = (capabilities: ModelCapability[]) => capabilities.map((item) => `${CAPABILITIES[item.kind].name}: ${item.note}`).join('. ');

/**
 * The icon row under a gallery tile. The tooltip shows on hover only, in the tile's own width so it can never run off the screen; it
 * is positioned against the nearest positioned ancestor, so the tile must be `relative`. Touch learns the meanings from the info sheet.
 */
export function CapabilityIcons({ capabilities }: { capabilities: ModelCapability[] }) {
  return <span aria-hidden="true" className="flex min-h-5 items-center gap-1.5">
    {capabilities.map(({ kind, note }) => {
      const { Icon } = CAPABILITIES[kind];
      return <span key={kind} data-capability={kind} className="group/cap flex h-5 w-5 items-center justify-center text-teal-400">
        <Icon className="h-5 w-5" />
        <span className="pointer-events-none absolute inset-x-2 bottom-12 z-30 hidden rounded-lg border border-teal-400/40 bg-raised px-2.5 py-1.5 text-xs font-semibold leading-snug text-slate-100 shadow-xl group-hover/cap:block sm:inset-x-3">{note}</span>
      </span>;
    })}
  </span>;
}

/** The five icons and what each means, for the info sheet. */
export function CapabilityLegend() {
  return <div className="space-y-3 rounded-xl border border-white/5 bg-slate-900/60 p-3.5">
    <div>
      <h3 className="text-sm font-bold text-white">What the icons mean</h3>
      <p className="mt-0.5 text-xs leading-relaxed text-slate-400">They sit under each model in Explore. Hover one for detail.</p>
    </div>
    <ul className="space-y-2.5">
      {MODEL_CAPABILITY_KINDS.map((kind) => {
        const { name, means, Icon } = CAPABILITIES[kind];
        return <li key={kind} className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/5 bg-slate-900/60 text-teal-400"><Icon className="h-5 w-5" /></span>
          <span className="min-w-0"><strong className="block text-[13px] leading-snug text-white">{name}</strong><span className="block text-xs leading-snug text-slate-300">{means}</span></span>
        </li>;
      })}
    </ul>
  </div>;
}
