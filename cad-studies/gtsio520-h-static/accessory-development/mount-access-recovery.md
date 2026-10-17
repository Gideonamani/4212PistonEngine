# Alternator mounting clearance found during whole-engine integration

The 2026-10-16 direct context audit completed all 878 current neighbor pairs for
the 52 changed/new parts. Eight overlaps stopped the queue before native engine
integration. They were the stud, washer, lock washer and nut at each of the two
lower alternator mounting positions against CrankcaseRight. The original
failures, including all outcomes and actual source BREP hashes, are retained in
`systems-mount-access-first-context.json`.

A-4-13/PDF30 shows the separate external mounting nut/washer stacks, and
A-4-33/PDF46 shows the installed drive/pad arrangement. Neither drawing provides
these reconstructed pocket dimensions. The current estimated stud runs from
X63 to X90. Its narrow case bore ends at X80; the wider lug clearance previously
ended at X81.1. The lower positions at Z593 cross the existing oversized core
casting envelope. The upper positions at Z645 already clear it.

Four appended cylindrical cuts extend the existing 8.1 mm radius lug clearances
from X75 through X90.1, derived from each actual stud end and an explicit 0.1 mm
estimated end clearance. This retains the pad, all four stud axes, mounting
planes, gears and every other part recipe. Extending all four declarations
consistently does not add material where the upper positions already clear.
The recess is a development clearance, not a claim about OEM casting curvature
or sufficient wrench access. The later contour work may express that free space
with a better evidenced exterior surface.

The saved native fixture uses a crop of actual failed-source case stock and
four linked native Part cuts. It passed reopening, a 0.1 to 0.2 mm controlling
clearance edit, independent direct agreement and a one-solid STEP re-read.
The edit changed actual material; STEP relative volume error was 1.07e-13.
The preliminary fixture left the native cylinders at their default 10 mm height
and the cut results touched/NULL. The accepted setup matches the production
builder: a PropertyFloat controller in the mm convention, explicit initial
dimensions and their live expressions.
No invalid fixture was accepted or substituted for the complete case.

The actual complete repaired direct case is a valid positive-volume single
solid. All 16 mounting hardware/case intersections are zero. At each of four
studs, an 11.9 mm long annular stock probe, radii 4.12 to 7.8 mm, has zero missing
material before and after the repair. The new case has zero material outside
the original; it removes 2,356.918 mm³, approximately 0.0149% of that case's
volume. These checks establish selected clearance and retained stock, not stud
pullout capacity, thread engagement strength or source fidelity.

The migration preserves the previous case's 361-feature direct prefix and
appends four cuts; 1,439 other part recipes remain identical. It archives the
failed specification and reports, binds the old/new actual BREP hashes, and
updates construction preparation only. The accepted complete face-pair files
and pitch evidence are retained. The regular whole-engine direct, current
neighbor, native, bearing/gallery, STEP and export gates still run on the new
specification. Local clearance acceptance does not transfer their results.

Reproduction: the authoritative gallery generator calls
`alternator_mount_access.append_access`. The guarded one-time migration is
`python -m cad_pipeline.repair_alternator_mount_access` under FreeCAD Python
with `scripts` on PYTHONPATH. Its checks and receipt are retained in
`systems-mount-access-checks.json` and `systems-mount-access-recovery.json`.
Never rerun generators over a specification bound to an active build.

Transferable lesson: mounting pockets must cover the complete declared external
stack, including the exposed stud tip. A lug-only clearance can pass a local
component assembly and still intersect the surrounding engine casting. Keep
guest hardware, necessary host support and installation/service space separate,
and check all three in the complete installation.

The restart exposed another computational issue: the development cache key
contains the complete parameter dictionary. Adding the access control therefore
changed keys for unrelated parts even though their controlling inputs and actual
geometry were unchanged. The unnecessary rebuild was stopped before completion.
`rekey_mount_access_cache.py` checks the complete original direct metadata hash,
dependency-derived eligibility, and every source BREP against existing adoption,
prefix or measured-context digests before transporting any of the 1,439 unchanged
records. It preserves original BREPs and rekeys their identical bytes and
tessellation metadata. The repaired case uses its separate checked prefix result.
The restarted complete direct build then loaded all 1,440 parts from cache in
39 seconds, with zero invalid solids. Four guard tests passed, including changed
source material, controlling dimension and metadata rejection. Native, gallery,
neighbor and export acceptance are not supplied by this cache transport.
