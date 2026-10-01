# Saved motions and internal-mechanism CAD studies

Editable native FreeCAD solids, STEP assemblies and Blender animation scenes accompany the web models. `source-manifest.json` records their hashes. Build scripts are in `scripts/`.

- `cylinder/Cylinder_Saved_Motions.blend`: 61 components imported from the unchanged reviewed cylinder asset, with named **Exploded overview** and **Reassembly overview** actions. The operating cycle still uses the existing verified cylinder kinematics and original operating Blender source recorded in `releases/cylinder-reviewed-20261001.json`. `native-motion-samples.json` is sampled from the new Blender-exported GLB and compared against browser motion poses in tests. The permanent head/barrel and pressed guide/seat relationships stay together.
- `hydraulic-tappet/hydraulic-tappet.FCStd` and `.blend`: eight internal parts identified in GTSIO-520 Figure A-4-10, printed page A-4-7. Includes named operating, exploded and reassembly motions; illustrative plunger/check-plate travel and return-spring compression.
- `oil-pump/oil-pump.FCStd` and `.blend`: simplified IO-520 **permold** pump and relief mechanism, based on overhaul Figure 4-19 / section 7-7. Includes operating gears, exploded/reassembly motions and relief-plunger opening with spring compression. Filter, tachometer drive and complete oil-circuit plumbing are omitted. Gear teeth are schematic; no manufacturing tooth form or hydraulic performance is claimed.

Dimensions, clearances, gear tooth count, operating travel and explosion distances in the two new mechanism studies are illustrative. They are not dimensional reproductions of manufacturer parts. The models explain manual relationships and mechanisms; they are not maintenance instructions. The two engine variants remain separately identified.

Rebuild on this Windows host:

```powershell
& 'C:\Program Files\FreeCAD 1.1\bin\python.exe' scripts/build_component_studies.py
& 'C:\Program Files\Blender Foundation\Blender 5.0\blender.exe' --background --python scripts/animate_component_studies.py
& 'C:\Program Files\Blender Foundation\Blender 5.0\blender.exe' --background --python scripts/author_cylinder_saved_motions.py
```

Generated tessellations and uncompressed GLBs are omitted from Git. Native source files, compressed web assets and checked contracts are retained. CAD validation checks valid single solids and positive volumes for all 22 new parts. It does not certify complete assembly interference freedom or manufacturing suitability. Blender previews are visual checks of the authored scenes; browser GPU/phone appearance still needs review.
