import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Columns2, Info, Maximize2, Minimize2, MousePointerClick, Play, SlidersHorizontal, X } from 'lucide-react';
import { ExploreControls } from './ExploreControls';
import { CycleSplitPane } from './controls/CycleSplitPane';
import { CompactMotionPlayer } from './controls/MotionPlayers';
import { useViewerControls } from './controls/useViewerControls';
import { HotspotChips, HotspotNote, ModelCanvas, ToolbarButton, UnknownModel, ViewerHeader } from './ViewerParts';
import { useModelViewer } from './useModelViewer';
import { PartCard } from './PartCard';
import { useDrawerHeight, useFloatingPosition } from './useFloatingPanel';
import { cycleMeta, cycleState } from './engineering/cycle-model.mjs';

const PLAYER_PREFERENCE = '4212-explore-show-player';
const SHOW_PART_CARD_PREFERENCE = '4212-explore-show-part-card';
/** Where the learner moved the part card and floating motion player to, and how tall they dragged the controls drawer. */
const PART_CARD_POSITION = '4212-explore-part-card-position';
const MOTION_PLAYER_POSITION = '4212-explore-motion-player-position';
const CONTROLS_HEIGHT = '4212-explore-controls-height';

// Preference stores that survive private windows and blocked site data: they just forget.
const readPlayerPreference = () => { try { return localStorage.getItem(PLAYER_PREFERENCE) !== 'false'; } catch { return true; } };
const writePlayerPreference = (value: boolean) => { try { localStorage.setItem(PLAYER_PREFERENCE, String(value)); } catch { /* not remembered */ } };

const readShowPartCardPreference = () => { try { return localStorage.getItem(SHOW_PART_CARD_PREFERENCE) !== 'false'; } catch { return true; } };
const writeShowPartCardPreference = (value: boolean) => { try { localStorage.setItem(SHOW_PART_CARD_PREFERENCE, String(value)); } catch { /* not remembered */ } };

type ExploreViewerProps = {
  modelId: string;
  isFullPage?: boolean;
  isFullscreen?: boolean;
  onToggleFullPage?: () => void;
  onToggleFullscreen?: () => void;
};

/**
 * The Explore screen's viewer: the canvas with its round tool buttons, hotspots and the motion player, and the controls panel (the model's
 * description and how to move it, then the Parts / Motion / Spotlight / Section / Look tabs). No text sits over the model itself.
 */
export default function ExploreViewer({ modelId, isFullscreen = false, onToggleFullscreen }: ExploreViewerProps) {
  const viewer = useModelViewer(modelId, 'explore');
  const [controlsOpen, setControlsOpen] = useState(true);
  const [cycleSplit, setCycleSplit] = useState(false);
  const [splitPartCardOpen, setSplitPartCardOpen] = useState(false);
  const [showPlayerOnViewer, setShowPlayerOnViewer] = useState(readPlayerPreference);
  const [showPartCard, setShowPartCard] = useState(readShowPartCardPreference);

  useEffect(() => { setCycleSplit(false); setSplitPartCardOpen(false); }, [modelId]);

  const setPlayerPreference = (value: boolean) => { setShowPlayerOnViewer(value); writePlayerPreference(value); };
  const toggleShowPartCard = () => {
    setShowPartCard((prev) => {
      const next = !prev;
      writeShowPartCardPreference(next);
      return next;
    });
  };

  const controls = useViewerControls(viewer, { host: 'explore', player: { show: showPlayerOnViewer, onChange: setPlayerPreference } });
  const { definition, features, snapshot } = viewer;
  // In Explore, open non-engine mechanical studies (hydraulic tappet, oil pump, accessories)
  // in cutaway flow mode automatically so their internal mechanisms and oil/torque paths are immediately visible.
  const autoFlowModelRef = useRef('');
  useEffect(() => {
    if (features?.mechanismFlow && autoFlowModelRef.current !== modelId) {
      autoFlowModelRef.current = modelId;
      features.mechanismFlow.setEnabled(true);
    }
  }, [features?.mechanismFlow, modelId]);
  const sectionRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const drawerRef = useRef<HTMLElement>(null);
  const drawer = useDrawerHeight(CONTROLS_HEIGHT, sectionRef, drawerRef);

  // Automatically open Cycle Split (Option A) the moment the learner switches Air–fuel flow ON.
  // Exiting split leaves flow active without re-forcing split until toggled off and back on.
  const prevCycleEnabledRef = useRef(Boolean(snapshot.cycleEnabled));
  useEffect(() => {
    const enabled = Boolean(snapshot.cycleEnabled);
    if (enabled && !prevCycleEnabledRef.current) setCycleSplit(true);
    else if (!enabled && prevCycleEnabledRef.current) setCycleSplit(false);
    prevCycleEnabledRef.current = enabled;
  }, [snapshot.cycleEnabled]);
  useEffect(() => { if (!snapshot.selectedId) setSplitPartCardOpen(false); }, [snapshot.selectedId]);

  if (!definition) return <UnknownModel modelId={modelId} />;

  // The panel appears once the model has loaded, and carries the description even for a model with no tabs (a scan with only a guided tour).
  const hasPanel = Boolean(features);
  const canCycleSplit = Boolean(
    features?.motion
    && features?.cycleCues
    && snapshot.cycleEnabled
    && (snapshot.cycleAvailable ?? (!snapshot.savedMotionId || snapshot.savedMotionId === 'operating')),
  );
  const cycleSplitActive = cycleSplit && canCycleSplit;
  const panelOpen = controlsOpen && hasPanel && !cycleSplitActive;

  return <section ref={sectionRef} className={`relative isolate flex h-full min-h-[22rem] flex-col overflow-hidden bg-stage text-slate-100 shadow-inner ${cycleSplitActive ? 'landscape:flex-row lg:flex-row' : 'lg:flex-row'}`} aria-label={`Interactive 3D model of the ${definition.label}`}>
    {/* A drawer the learner has sized leaves the model at least 8 rem (useDrawerHeight keeps 128 px for it). */}
    <div ref={stageRef} className={`relative min-h-0 min-w-0 overflow-hidden ${cycleSplitActive ? 'flex-[52] landscape:flex-[54] lg:flex-[56]' : `flex-1 ${panelOpen ? (drawer.height === undefined ? 'min-h-[18rem]' : 'min-h-32 lg:min-h-[18rem]') : ''}`}`}>
      <ModelCanvas viewer={viewer} />
      <ViewerHeader viewer={viewer}>
        {features?.motion && !controlsOpen && !cycleSplitActive && !showPlayerOnViewer && (
          <ToolbarButton
            label="Show floating motion player"
            title="Show floating motion player"
            onClick={() => setPlayerPreference(true)}
          >
            <Play className="h-4 w-4" />
          </ToolbarButton>
        )}
        {canCycleSplit && (
          <ToolbarButton
            label={cycleSplitActive ? 'Exit Cycle Split view' : 'Open Cycle Split view'}
            title={cycleSplitActive ? 'Exit Cycle Split view' : 'Open Cycle Split view (3D + P–V / T–s)'}
            active={cycleSplitActive}
            onClick={() => setCycleSplit((open) => !open)}
          >
            <Columns2 className="h-4 w-4" />
          </ToolbarButton>
        )}
        <ToolbarButton
          label={showPartCard ? 'Disable part details on click' : 'Enable part details on click'}
          title={showPartCard ? 'Inspect parts on click: ON (click to disable)' : 'Inspect parts on click: OFF (click to enable)'}
          active={showPartCard}
          onClick={toggleShowPartCard}
        >
          <MousePointerClick className="h-4 w-4" />
        </ToolbarButton>
        {onToggleFullscreen && <ToolbarButton label={isFullscreen ? 'Exit browser fullscreen' : 'Open browser fullscreen'} title={isFullscreen ? 'Exit browser fullscreen' : 'Open browser fullscreen'} active={isFullscreen} onClick={onToggleFullscreen}>{isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}</ToolbarButton>}
        {hasPanel && !cycleSplitActive && <ToolbarButton label={controlsOpen ? 'Hide Explore controls' : 'Show Explore controls'} title={controlsOpen ? 'Hide Explore controls' : 'Show Explore controls'} active={controlsOpen} onClick={() => setControlsOpen((open) => !open)}><SlidersHorizontal className="h-4 w-4" /></ToolbarButton>}
      </ViewerHeader>

      {features?.hotspots && <div className="absolute inset-x-3 bottom-3 z-20 rounded-xl border border-slate-700/80 bg-panel/94 p-2 shadow-xl backdrop-blur sm:inset-x-auto sm:left-3 sm:max-w-[calc(100%-1.5rem)]">
        <HotspotChips viewer={viewer} />
        <HotspotNote viewer={viewer} className="px-1 pt-1.5" />
      </div>}

      {showPartCard && snapshot.selectedId && (!cycleSplitActive || splitPartCardOpen) && (
        <FloatingPartCard stage={stageRef}>{(move) => (
          <PartCard
            move={move}
            partId={snapshot.selectedId ?? ''}
            learner={snapshot.selectedDetails}
            defaultLabel={snapshot.selectedLabel}
            defaultFunction={snapshot.selectedDescription}
            onClose={() => { setSplitPartCardOpen(false); controls.parts.selectSinglePart(''); }}
            onIsolatePart={controls.spotlight.isolatePart}
            isIsolated={
              snapshot.focusActive && snapshot.focusMode === 'isolate' &&
              snapshot.focusIds?.length === 1 && snapshot.focusIds[0] === snapshot.selectedId
            }
            onUnisolate={controls.parts.clearSelected}
            className="w-full"
          />
        )}</FloatingPartCard>
      )}

      {cycleSplitActive && snapshot.selectedId && !splitPartCardOpen && (
        <CyclePartPill
          partId={snapshot.selectedId}
          label={snapshot.selectedDetails?.label ?? snapshot.selectedLabel ?? snapshot.selectedId}
          angle={snapshot.angle ?? 0}
          mode={snapshot.cycleMode ?? 'ideal'}
          cycleType={snapshot.cycleType ?? 'otto'}
          fuelSystem={snapshot.cycleFuelSystem ?? 'injected'}
          onExpand={() => setSplitPartCardOpen(true)}
          onClose={() => controls.parts.selectSinglePart('')}
        />
      )}

      {features?.motion && !controlsOpen && !cycleSplitActive && showPlayerOnViewer && (
        <FloatingMotionPlayer stage={stageRef}>{(move) => (
          <CompactMotionPlayer
            features={features}
            snapshot={snapshot}
            move={move}
            onClose={() => setPlayerPreference(false)}
          />
        )}</FloatingMotionPlayer>
      )}
    </div>

    {cycleSplitActive && features && (
      <CycleSplitPane
        features={features}
        snapshot={snapshot}
        onExit={() => setCycleSplit(false)}
      />
    )}

    {panelOpen && (
      <ExploreControls
        viewer={viewer}
        controls={controls}
        onClose={() => setControlsOpen(false)}
        showPartCard={showPartCard}
        onToggleShowPartCard={toggleShowPartCard}
        onOpenCycleSplit={canCycleSplit ? () => setCycleSplit(true) : undefined}
        drawerRef={drawerRef}
        drawer={drawer}
      />
    )}
  </section>;
}

/**
 * The part card over the model. It starts in a corner clear of the round tool buttons (top-left on a phone, bottom-right from `sm` up);
 * once the learner drags it by its title row, it stays where they put it (its top-left corner, kept on this device) until moved again.
 */
function FloatingPartCard({ stage, children }: { stage: React.RefObject<HTMLDivElement | null>; children: (move: { grip: React.HTMLAttributes<HTMLElement>; dragArea: React.HTMLAttributes<HTMLElement> }) => React.ReactNode }) {
  const panelRef = useRef<HTMLDivElement>(null);
  const floating = useFloatingPosition(PART_CARD_POSITION, stage, panelRef);
  const placed = floating.position;
  return <div
    ref={panelRef}
    data-testid="part-card-float"
    style={placed ? { left: placed.x, top: placed.y } : undefined}
    className={`absolute z-20 pointer-events-auto w-auto max-w-[50%] max-h-[50vh] overflow-y-auto sm:max-w-xs sm:w-80 ${placed ? '' : 'top-3 left-3 sm:top-auto sm:left-auto sm:bottom-3 sm:right-3'}`}
  >
    {children({ grip: floating.grip, dragArea: floating.dragArea })}
  </div>;
}

/**
 * Draggable wrapper for the floating motion player. Starts along the bottom-left edge; once dragged by its header row, stays wherever
 * the learner placed it and clamps cleanly inside the canvas on resize/rotation.
 */
function FloatingMotionPlayer({ stage, children }: { stage: React.RefObject<HTMLDivElement | null>; children: (move: { grip: React.HTMLAttributes<HTMLElement>; dragArea: React.HTMLAttributes<HTMLElement> }) => React.ReactNode }) {
  const panelRef = useRef<HTMLDivElement>(null);
  const floating = useFloatingPosition(MOTION_PLAYER_POSITION, stage, panelRef);
  const placed = floating.position;
  return <div
    ref={panelRef}
    data-testid="motion-player-float"
    style={placed ? { left: placed.x, top: placed.y } : undefined}
    className={`absolute z-20 pointer-events-auto ${placed ? 'w-[min(22.5rem,calc(100%-1.5rem))]' : 'inset-x-3 bottom-3 sm:left-3 sm:right-auto sm:w-[22.5rem] sm:max-w-[calc(100%-1.5rem)]'}`}
  >
    {children({ grip: floating.grip, dragArea: floating.dragArea })}
  </div>;
}

/** Compact live flow-role pill shown at top-left during Cycle Split when the learner taps a part on the 3D cylinder. */
function CyclePartPill({
  partId,
  label,
  angle,
  mode,
  cycleType = 'otto',
  fuelSystem,
  onExpand,
  onClose,
}: {
  partId: string;
  label: string;
  angle: number;
  mode: 'ideal' | 'practical';
  cycleType?: 'otto' | 'diesel' | 'two-stroke';
  fuelSystem: 'injected' | 'carburetted';
  onExpand: () => void;
  onClose: () => void;
}) {
  const roleNote = useMemo(() => {
    const s = cycleState(angle, mode, cycleType);
    const meta = cycleMeta(cycleType);
    if (cycleType === 'two-stroke') {
      if (/CrankcaseHousing/i.test(partId)) return `Crankcase pump · ${(s.crankcasePressure ?? 1).toFixed(2)}× P₁`;
      if (/Intake/i.test(partId)) return `Intake port · ${(s.intakePortOpen ?? 0) > 0.05 ? 'Open to crankcase' : 'Sealed by skirt'}`;
      if (/Exhaust/i.test(partId)) return `Exhaust port · ${(s.exhaustPortOpen ?? 0) > 0.05 ? 'Blowdown open' : 'Sealed by piston'}`;
      if (/Spark/i.test(partId)) return mode === 'practical' ? `Fires every 360° (${meta.eventLabel})` : 'Fires every 360° at TDC';
      if (/Piston|Ring|Pin/i.test(partId)) return `Port-timing piston · ${s.volume.toFixed(1)}× Vc`;
      if (/CylinderBarrel/i.test(partId)) return `Transfer ${(s.transferPortOpen ?? 0) > 0.05 ? 'OPEN' : 'closed'} · ${s.pressure.toFixed(1)}× P₁`;
    }
    if (/Intake/i.test(partId)) return `Lift ${s.intakeLift.toFixed(1)} mm · ${s.intakeLift > 0.05 ? (cycleType === 'diesel' ? 'Pure air open' : 'Open') : 'Closed'}`;
    if (/Exhaust/i.test(partId)) return `Lift ${s.exhaustLift.toFixed(1)} mm · ${s.exhaustLift > 0.05 ? 'Open' : 'Closed'}`;
    if (/DirectFuelInjector/i.test(partId)) return s.injectionIntensity > 0.04 ? 'Spraying 6 direct fuel jets!' : `Direct injector · ${meta.eventLabel}`;
    if (/GlowPlug/i.test(partId)) return 'Cold-start preheat only (no spark)';
    if (/FuelDischargeNozzle/i.test(partId)) return fuelSystem === 'carburetted' ? 'Bypassed (carburetted comparison)' : 'Continuous port fuel spray';
    if (/SparkPlug|SparkInsulator|SparkTerminal/i.test(partId)) return mode === 'practical' ? `Dual spark at ${meta.eventLabel}` : 'Ideal ignition at TDC';
    if (/Piston|Ring|Pin/i.test(partId)) return cycleType === 'diesel' ? `Omega bowl · ${s.volume.toFixed(1)}× Vc` : `${s.volume.toFixed(1)}× Vc · ${s.stroke}`;
    if (/CylinderBarrel|CylinderHead|CoolingJacket|ValveCover/i.test(partId)) return `Ghost cutaway · ${s.pressure.toFixed(1)}× P₁`;
    return `${s.stroke} · ${Math.round(angle)}°`;
  }, [partId, angle, mode, cycleType, fuelSystem]);

  return <div
    role="status"
    className="absolute left-2.5 top-2.5 z-20 flex max-w-[calc(100%-10rem)] items-center gap-1.5 rounded-full border border-teal-400/40 bg-panel/92 py-1 pl-3 pr-1.5 shadow-xl backdrop-blur-md"
  >
    <div className="min-w-0">
      <div className="truncate text-[11px] font-bold text-white leading-tight">{label}</div>
      <div className="truncate font-mono text-[10px] text-teal-300 leading-tight">{roleNote}</div>
    </div>
    <button
      type="button"
      onClick={onExpand}
      aria-label={`Open full details for ${label}`}
      title="Open full part details"
      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-slate-300 hover:bg-white/10 hover:text-white outline-none focus-visible:ring-2 focus-visible:ring-teal-300"
    >
      <Info className="h-3.5 w-3.5" aria-hidden="true" />
    </button>
    <button
      type="button"
      onClick={onClose}
      aria-label="Clear selected part"
      title="Clear selection"
      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-slate-400 hover:bg-white/10 hover:text-white outline-none focus-visible:ring-2 focus-visible:ring-teal-300"
    >
      <X className="h-3.5 w-3.5" aria-hidden="true" />
    </button>
  </div>;
}
