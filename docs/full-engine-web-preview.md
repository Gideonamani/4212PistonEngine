# Six-cylinder operating-engine web preview

This GitHub Pages preview reuses `../EngineSimulation/v5/GTSIO-520-H_V5_Crankcase_and_Function_Tour.blend`, scene `07 | Six cylinders - dissolve to operating internals`. It includes the existing six-cylinder drivetrain study and V5 crankcase, not six hand-copied browser cylinders.

`scripts/export_full_engine_web.py` opens the Blender file without saving it, limits the export to native frames 1–241 (one 720-degree cycle at three crank degrees per frame), bakes evaluated Blender drivers in memory, and exports a GLB. The React application loads the result through `src/viewer/adapters/fullEngineAdapter.ts`; local preview uses Vite rather than a separately packaged HTML shell.

The web viewer combines the exported object actions into one `AnimationMixer` clip. Its crank-angle range maps 0–720° directly over that clip, so play, pause, reset and scrubbing use the same action for the six pistons, connecting rods, crankshaft, camshaft, reduction propeller shaft and magneto branch.

The inherited V4 verification records six full 101.6 mm piston strokes and rod-to-piston-pin continuity. Its documented firing order is 1–4–5–2–3–6. The V5 case check confirms the two hollow case shells, 36 cylinder studs, eight half-webs and six through-bolts. The model remains a teaching reconstruction: cylinder stations, casting contours, valve timing and gear details have recorded approximations.

Run:

```powershell
& 'C:\Program Files\Blender Foundation\Blender 5.0\blender.exe' -b ..\EngineSimulation\v5\GTSIO-520-H_V5_Crankcase_and_Function_Tour.blend --python scripts\export_full_engine_web.py
python scripts\test_full_engine_export.py
python scripts\prepare_full_engine_preview.py
Set-Location build\full-engine-web\preview
npm run dev
```

For GitHub Pages, the engine contract names the 4.0 MB gzip delivery asset and compatible raw fallback hosted through Drive. The contract validator checks the gzip round trip before release. Select “Full six-cylinder engine” in the React Explore gallery to load the full-engine adapter.
