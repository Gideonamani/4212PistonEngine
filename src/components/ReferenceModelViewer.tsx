import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Box, ExternalLink, Focus, LoaderCircle, RotateCcw, TriangleAlert } from 'lucide-react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { referenceModels, type ReferenceModelHotspot } from '../data/referenceModels';

type ViewerApi = {
  reset: () => void;
  focus: (hotspot: ReferenceModelHotspot) => void;
  nudge: (theta: number, phi: number, zoom: number) => void;
};

interface ReferenceModelViewerProps {
  modelId: string;
  immersive?: boolean;
  mode?: 'lesson' | 'explore';
  focusHotspots?: string[];
  onOpenExplore?: () => void;
}

function disposeMaterial(material: THREE.Material) {
  for (const value of Object.values(material)) {
    if (value instanceof THREE.Texture) value.dispose();
  }
  material.dispose();
}

export default function ReferenceModelViewer({
  modelId,
  immersive = false,
  mode = 'lesson',
  focusHotspots,
  onOpenExplore,
}: ReferenceModelViewerProps) {
  const definition = referenceModels[modelId];
  const mountRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<ViewerApi | undefined>(undefined);
  const [progress, setProgress] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const [activeHotspot, setActiveHotspot] = useState<string>();

  const hotspots = useMemo(() => {
    if (!definition) return [];
    const ids = focusHotspots?.length
      ? focusHotspots
      : mode === 'lesson'
        ? definition.lessonHotspotIds
        : definition.hotspots.map((hotspot) => hotspot.id);
    return ids.map((id) => definition.hotspots.find((hotspot) => hotspot.id === id)).filter(Boolean) as ReferenceModelHotspot[];
  }, [definition, focusHotspots, mode]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount || !definition) return;

    let disposed = false;
    let modelRoot: THREE.Object3D | undefined;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#071418');

    const camera = new THREE.PerspectiveCamera(38, 1, 0.05, 1200);
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.9;
    renderer.domElement.setAttribute('aria-hidden', 'true');
    mount.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enablePan = false;
    controls.enableDamping = false;
    controls.rotateSpeed = 0.72;
    controls.zoomSpeed = 0.9;
    controls.minPolarAngle = 0.12;
    controls.maxPolarAngle = Math.PI - 0.12;

    scene.add(new THREE.HemisphereLight(0xdffcff, 0x26313a, 1.45));
    const key = new THREE.DirectionalLight(0xffffff, 2.1);
    key.position.set(80, 120, 150);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0x4fffe1, 1.1);
    rim.position.set(-120, 20, -90);
    scene.add(rim);

    let homePosition = new THREE.Vector3();
    let homeTarget = new THREE.Vector3();
    let modelRadius = 1;
    const render = () => renderer.render(scene, camera);

    const applyHome = () => {
      camera.position.copy(homePosition);
      controls.target.copy(homeTarget);
      controls.update();
      render();
      setActiveHotspot(undefined);
    };

    const focus = (hotspot: ReferenceModelHotspot) => {
      const target = new THREE.Vector3(...hotspot.position);
      const direction = camera.position.clone().sub(controls.target).normalize();
      controls.target.copy(target);
      camera.position.copy(target).add(direction.multiplyScalar(Math.max(modelRadius * 0.72, 20)));
      controls.update();
      render();
      setActiveHotspot(hotspot.id);
    };

    const nudge = (theta: number, phi: number, zoom: number) => {
      const offset = camera.position.clone().sub(controls.target);
      const spherical = new THREE.Spherical().setFromVector3(offset);
      spherical.theta += theta;
      spherical.phi = THREE.MathUtils.clamp(spherical.phi + phi, 0.14, Math.PI - 0.14);
      spherical.radius = THREE.MathUtils.clamp(spherical.radius * zoom, controls.minDistance, controls.maxDistance);
      camera.position.copy(controls.target).add(new THREE.Vector3().setFromSpherical(spherical));
      camera.lookAt(controls.target);
      controls.update();
      render();
    };

    apiRef.current = { reset: applyHome, focus, nudge };
    controls.addEventListener('change', render);

    const resize = new ResizeObserver(() => {
      const { width, height } = mount.getBoundingClientRect();
      if (!width || !height) return;
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      render();
    });
    resize.observe(mount);

    const loader = new GLTFLoader();
    loader.load(
      definition.assetUrl,
      (gltf) => {
        if (disposed) return;
        modelRoot = gltf.scene;
        modelRoot.traverse((object) => {
          if (!(object instanceof THREE.Mesh)) return;
          object.castShadow = false;
          object.receiveShadow = false;
        });
        scene.add(modelRoot);
        const box = new THREE.Box3().setFromObject(modelRoot);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        modelRadius = Math.max(size.length() * 0.5, 1);
        const verticalFov = THREE.MathUtils.degToRad(camera.fov);
        const fitDistance = Math.max(size.y / (2 * Math.tan(verticalFov / 2)), size.x / (2 * Math.tan(verticalFov / 2) * camera.aspect));
        homeTarget = center.clone();
        homePosition = center.clone().add(new THREE.Vector3(1.15, 0.6, 1.25).normalize().multiplyScalar(fitDistance * 0.92));
        controls.minDistance = modelRadius * 0.42;
        controls.maxDistance = modelRadius * 5;
        applyHome();
        setProgress(100);
        setLoaded(true);
      },
      (event) => {
        if (!event.total) return;
        setProgress(Math.min(99, Math.round((event.loaded / event.total) * 100)));
      },
      (reason) => {
        if (disposed) return;
        console.error(reason);
        setError('The reference model could not be loaded. Check your connection and try again.');
      },
    );

    return () => {
      disposed = true;
      resize.disconnect();
      controls.removeEventListener('change', render);
      controls.dispose();
      modelRoot?.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) return;
        object.geometry.dispose();
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.forEach(disposeMaterial);
      });
      renderer.dispose();
      renderer.domElement.remove();
      apiRef.current = undefined;
    };
  }, [definition]);

  if (!definition) return <div className="flex min-h-52 items-center justify-center rounded-xl border border-rose-400/30 bg-rose-950/20 p-5 text-sm text-rose-200">Unknown reference model: {modelId}</div>;

  const active = hotspots.find((hotspot) => hotspot.id === activeHotspot);
  const viewerHeight = mode === 'explore'
    ? 'h-full min-h-[22rem]'
    : immersive
      ? 'h-[58dvh] min-h-[22rem]'
      : 'h-[20rem] min-h-[18rem] sm:h-[24rem]';

  return <section className={`relative isolate overflow-hidden rounded-xl border border-teal-400/20 bg-[#071418] shadow-inner ${viewerHeight}`} aria-label={`Interactive 3D model of the ${definition.label}`}>
    <div
      ref={mountRef}
      role="application"
      tabIndex={0}
      aria-label={`${definition.label}. Drag to rotate, pinch or scroll to zoom. Use arrow keys to rotate, plus and minus to zoom, and Home to reset.`}
      onKeyDown={(event) => {
        const controls: Record<string, () => void> = {
          ArrowLeft: () => apiRef.current?.nudge(-0.12, 0, 1),
          ArrowRight: () => apiRef.current?.nudge(0.12, 0, 1),
          ArrowUp: () => apiRef.current?.nudge(0, -0.1, 1),
          ArrowDown: () => apiRef.current?.nudge(0, 0.1, 1),
          '+': () => apiRef.current?.nudge(0, 0, 0.84),
          '=': () => apiRef.current?.nudge(0, 0, 0.84),
          '-': () => apiRef.current?.nudge(0, 0, 1.18),
          Home: () => apiRef.current?.reset(),
        };
        if (!controls[event.key]) return;
        event.preventDefault();
        controls[event.key]();
      }}
      className="absolute inset-0 touch-none outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-teal-300"
    />

    {!loaded && !error && <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center bg-[#071418]/95 text-teal-200" role="status" aria-live="polite">
      <LoaderCircle className="h-7 w-7 animate-spin" />
      <span className="mt-2 font-mono text-[10px] font-bold tracking-widest">LOADING 3D REFERENCE · {progress}%</span>
    </div>}
    {error && <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-[#071418] p-6 text-center text-rose-200" role="alert"><TriangleAlert className="h-7 w-7" /><p className="mt-2 max-w-xs text-xs leading-relaxed">{error}</p></div>}

    <div className="pointer-events-none absolute inset-x-0 top-0 z-[2] flex items-start justify-between gap-2 bg-gradient-to-b from-[#061216]/95 via-[#061216]/55 to-transparent p-3 pb-10">
      <div><div className="flex items-center gap-1.5 font-mono text-[9px] font-bold tracking-[0.18em] text-teal-300"><Box className="h-3.5 w-3.5" />INTERACTIVE REFERENCE</div><p className="mt-1 text-[10px] text-slate-300">Drag to rotate · Pinch or scroll to zoom</p></div>
      <button type="button" onClick={() => apiRef.current?.reset()} className="pointer-events-auto flex h-9 w-9 items-center justify-center rounded-full border border-slate-600/70 bg-[#07161b]/90 text-slate-200 shadow-lg hover:border-teal-400 hover:text-teal-300" aria-label="Reset 3D view" title="Reset 3D view"><RotateCcw className="h-4 w-4" /></button>
    </div>

    <div className="absolute inset-x-2 bottom-2 z-[2] rounded-xl border border-slate-700/80 bg-[#07161b]/95 p-2 shadow-xl backdrop-blur-sm sm:inset-x-3 sm:bottom-3">
      <div className="flex gap-1.5 overflow-x-auto pb-1" aria-label="Guided model hotspots">
        {hotspots.map((hotspot) => <button key={hotspot.id} type="button" onClick={() => apiRef.current?.focus(hotspot)} aria-pressed={activeHotspot === hotspot.id} className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[10px] font-semibold transition ${activeHotspot === hotspot.id ? 'border-teal-300 bg-teal-400/20 text-teal-200' : 'border-slate-700 bg-slate-900/80 text-slate-300 hover:border-teal-400/60'}`}><Focus className="h-3 w-3" />{hotspot.label}</button>)}
      </div>
      {active && <p className="px-1 pt-1 text-[10px] leading-relaxed text-slate-300" aria-live="polite"><strong className="text-slate-100">{active.label}:</strong> {active.description}</p>}
      <div className="mt-1.5 flex items-center justify-between gap-2 border-t border-slate-800/80 px-1 pt-1.5">
        <a href={definition.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex min-w-0 items-center gap-1 text-[9px] text-slate-400 hover:text-teal-300"><span className="truncate">{definition.sourceLabel} · {definition.license}</span><ExternalLink className="h-3 w-3 shrink-0" /></a>
        {mode === 'lesson' && onOpenExplore && <button type="button" onClick={onOpenExplore} className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-teal-400 px-2.5 py-1.5 text-[10px] font-bold text-slate-950 hover:bg-teal-300"><Box className="h-3 w-3" />Explore fully</button>}
      </div>
    </div>
  </section>;
}
