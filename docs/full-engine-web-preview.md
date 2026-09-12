# Six-cylinder operating-engine web preview

This GitHub Pages preview reuses `../EngineSimulation/v5/GTSIO-520-H_V5_Crankcase_and_Function_Tour.blend`, scene `07 | Six cylinders - dissolve to operating internals`. It includes the existing six-cylinder drivetrain study and V5 crankcase, not six hand-copied browser cylinders.

`scripts/export_full_engine_web.py` opens the Blender file without saving it, limits the export to native frames 1–241 (one 720-degree cycle at three crank degrees per frame), bakes evaluated Blender drivers in memory, and exports a GLB. `scripts/prepare_full_engine_preview.py` packages that asset with the shared `web/training.html` shell and full-engine adapter for local serving.

The web viewer combines the exported object actions into one `AnimationMixer` clip. Its crank-angle range maps 0–720° directly over that clip, so play, pause, reset and scrubbing use the same action for the six pistons, connecting rods, crankshaft, camshaft, reduction propeller shaft and magneto branch.

The inherited V4 verification records six full 101.6 mm piston strokes and rod-to-piston-pin continuity. Its documented firing order is 1–4–5–2–3–6. The V5 case check confirms the two hollow case shells, 36 cylinder studs, eight half-webs and six through-bolts. The model remains a teaching reconstruction: cylinder stations, casting contours, valve timing and gear details have recorded approximations.

Run:

```powershell
& 'C:\Program Files\Blender Foundation\Blender 5.0\blender.exe' -b ..\EngineSimulation\v5\GTSIO-520-H_V5_Crankcase_and_Function_Tour.blend --python scripts\export_full_engine_web.py
python scripts\prepare_full_engine_preview.py
python scripts\test_full_engine_export.py
python -m http.server 8767 --bind 127.0.0.1 --directory build\full-engine-web\web
```

For GitHub Pages, `web/engine.glb` is the versioned web asset. `engine.html` selects the full-engine entry in the shared training shell.
