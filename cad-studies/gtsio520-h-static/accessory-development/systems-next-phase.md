# Integration, H accessory route, alternator and lubrication

The 1,320-part governor/tach integration preserves accepted R4 and both local
studies. It adds 41 parts and revises six. Three revisions have unchanged live
native prefixes: case 277 features plus five, cam 20 plus one, oil shaft 4 plus
two. The append fixture passed native reopening, a linked bore edit, direct
agreement and STEP. This avoids reconstructing those prefixes; it does not
waive complete saved/direct, interface, pair or export checks.

## H accessory construction: newly resolved topology

Primary evidence inspected 2026-10-15: [Continental MSB94-4G](https://continental.aero/wp-content/uploads/2025/07/MSB94-4G.pdf),
31 October 2005, applies to all GTSIO-520 models (printed 2). Printed 14,
Part 5 steps 19–21 separately installs accessory gears 632799 in the idler train,
then inserts the magneto gears into those accessory gears on needle bearings.
This establishes independent coaxial gears rather than one rigid output.
The 1981 overhaul manual A-4-11/PDF 28 shows the nested 20/21/22/23 arrangement;
the C-specific C-1-4/PDF 130 shows only 16/19. This explains why using the C-like
single shaft throughout was insufficient. The bulletin establishes topology;
it does not provide counts, module, journal size or a modern configuration
approval for this historical teaching reconstruction.

The H specification C-3-3/PDF153 and [EASA IM.E.248, issue01, printed8](https://www.easa.europa.eu/sites/default/files/dfu/tcds_im_e248_gtsio520_20221108.pdf)
give the optional drive1.14:1, CCW viewing its pad. Keep both branches distinct
from1.5-speed magneto drive. With the already estimated30/42 input and32-tooth
secondary idler, an estimated20-tooth accessory wheel gives8/7=1.142857,
which rounds to1.14. That is a calculated teaching estimate, not an OEM count.
For coaxial outputs, the secondary module must be 2d/(32+20), where d is the
existing idler-to-magneto centre distance. Reusing the main module would fail
that centre distance. The small side-by-side axial gap, bearing envelope,
needle sizes and rear closure remain estimates. Preserve the outer running
journal's existing documented fit; put its support on the accessory gear and
put the magneto journal inside the independent needle bearing.

An axial packaging calculation exposed another constraint: putting the second
wheel behind the original magneto wheel at the old pad depth would put it
inside the stationary bush. The H candidate therefore moves the rear case pad
and its adapter, bush, seal and fasteners rearward by an estimated 11 mm. The
source 1.454–1.458 inch adapter-relative projection and selected 0.5176 mm
flange gap are retained. The outer accessory shaft extends to the shifted pad;
the independent magneto wheel, needle chamber and both idler tooth planes stay
aligned. This is a calculated development casting depth, not an established
OEM H dimension. Native stock, support and neighbor checks must decide whether
the candidate is geometrically viable; source matching remains necessary.

Required checks: both centre distances/modules and ratios, independent native
parts, bearing/race/roller clearance, sleeve engagement, retained running fit,
all current development neighbors and saved/STEP/export gates. Mathematical
shaft-rate signs and source pad-view labels require an explicit installed
view calibration before accepting an operating animation.

### Whole-engine direction reference remains open

H C-3-2/PDF 152 says propeller rotation is clockwise looking forward; C-3-3
defines the accessory labels as facing the engine drive pad. With model +Z
toward the propeller and one external reduction mesh, that suggests physical
crank rotation opposite the currently arbitrary positive crank phase. Under
that candidate convention the independent magneto/front-pad and accessory/
rear-pad directions are consistent, but the earlier isolated governor/tach
pad-direction labels reverse. This is a whole-engine sign-calibration issue,
not evidence that a declared mathematical rate alone authenticates operation.

Confirm the installed source views and all axis conventions before changing
bevel orientation or authoring motion. The static saved solids, fitted gaps
and intersection checks remain distinct from this unresolved operating claim.
The new full-engine review must describe governor/tach direction as provisional.

## Alternator: construction and method trial

A-4-20/PDF38 and A-11-10f/PDF75 attach face gear23 to propeller drive gear19,
using four screws21 and two tab locks22. A-4-33/PDF46 is the installed section.
The selected physical host is ReductionPinion. A-4-13/PDF30 and A-11-12/PDF76
show a separate driven gear, bushing, clutch spring, keyed
hub, special thrust washer, slotted nut and cotter pin. A solid pinion fixed
directly to the alternator rotor would hide that torsional coupling.

A-12-10/PDF80–81 specifies four mounting nuts and one spring assembly wound
opposite to the direct-drive engine's spring. It does not specify two springs
of opposite hand. The special thrust washer has its copper face toward the
alternator/gear assembly. The shipping spacer is removed for installation;
including it would cause face-gear interference. The drawing's spring hand
still needs calibration against the model's axis convention.

The seven-slot method window has now passed independent direct geometry,
saved native reopening, a module edit, STEP and 24 pitch samples. Its minimum
measured native contact-region gap is 0.038252 mm; the deliberately incorrect
half-tooth phase produces 117.197 mm³ overlap. This establishes the tested
local contact window, while a complete 60-slot ring and installed coupling
remain unfinished.

[Continental SID97-8](https://continental.aero/wp-content/uploads/2025/07/SID97-8.pdf),
28 May1997, printed2, identifies the mount on the right case half and documents
possible through-bolt/end-housing contact. This is a packaging check for the
listed later alternators, not proof that the1979 selected alternator shares
their external contour. The H drive magnitude is3:1. Axial side, normal and
shaft-rate sign must agree with the installed section and pad view.

The new tooth method must be tested independently before engine adoption.
[NASA/TM-2001-210614](https://ntrs.nasa.gov/api/citations/20010037595/downloads/20010037595.pdf)
explains generation by a rolling involute shaper and the need to check inner
undercutting and outer tooth pointing. An independently constructed sampled
cutter envelope is a candidate method, with its sampling and backlash stated.
An uncut crown preview or arbitrary radial trapezoids cannot establish a
compatible pair. The existing FCGear crown implementation is a method lead;
no addon or source code has been incorporated.

## Oil: topology before drilling

A-3-2/3 PDF17-18 and A-4-9/PDF26 describe suction, pressure, relief-to-inlet,
external filter, cooler/temperature valve, longitudinal galleries, bearing/
lifter feeds and turbo scavenge. H C-3-5/PDF155 explicitly specifies pump-to-
filter and filter-to-cooler external test lines. Use this external full-flow
arrangement; do not silently replace it with an internal filter cavity.
A-4-16/PDF33 and A-11-5/PDF73-74 separately identify relief10-17, bypass18-21
and strainer43/44. Their exact applicability and plumbing relative to the
external filter must remain explicit in the inventory.

First model the separate plunger, spring, guide, adjuster, cap and seal parts,
with real chamber/seat connections in the pump body. The13/16in exposed relief
adjuster is a source anchor; spring rate, preload, bore and stroke are unknown.
A plausible coil is not a calibrated valve. Check a closed seat and an open
flow path, service withdrawal and wall stock. For each gallery, record which
body owns it, manufacturing access/closure, inlet/outlet faces, bore estimate,
minimum wall and intended connection. Bearing-shell holes must align with case
feeds. An open cavity or a colored line does not establish oil continuity.

The final oil-network review must distinguish actual cut passages, separate
fluid-volume diagnostics, inferred routing and unmodelled hoses/components.
Relief, filter bypass, thermal bypass and turbo scavenge are different paths;
they cannot all be represented by a single unrestricted return.

A closer A-4-16 source review shows a narrow inner adjusting-screw stem through
the spring guide. The relief candidate therefore includes that separate stem
region and a blind recess in the plunger, retaining 2.5 mm estimated pressure-
face stock. Its declared open displacement also clears the stationary stem.
Stem dimensions, travel and guide fit are estimates. The flow diagnostic does
not establish spring force or a mechanically simulated compressed coil.

The enlarged source also shows the plunger as a cup. The updated candidate
seats the spring inside a 3.3 mm estimated recess, with a 0.7 mm radial wall
and the same 2.5 mm closed pressure face. The adjuster stem remains clear of
that blind end at the selected open displacement. These relationships are
mechanical deductions; exact bore, coil and cup dimensions are not measured
from the exploded drawing.

## Front camshaft oil transfer: focused passage study

Observed: A-3-1h/PDF 17 describes a circumferential groove at the front cam
journal connecting the right and left crankcase cross passages. A-3-3/PDF 18
describes the gallery and bearing feeds. The current front journal occupies
546.2–589.8 mm in the model; its middle is 568 mm. The nearest left lifter
guide is at 522 mm, so a short transverse passage at 568 mm is clear of that
guide's declared envelope.

Deduction: a circumferential channel makes the connection independent of cam
angle while retaining bearing lands on both sides. Each case half can be
cross-drilled from its open parting face into a future longitudinal gallery.
The transverse drilling does not need a fabricated external plug if it stops
inside the casting and later joins that longitudinal gallery.

The seed camshaft already has an estimated 1.4 mm groove at 567.3–568.7 mm,
with 15.25 mm root radius. The revision widens it to join the case passages;
it does not claim to discover a previously absent camshaft feature.

Selected study estimates: groove width 3 mm, depth 0.65 mm; cross-bore radius
1.5 mm; blind endpoints at X = ±60 mm, Y = −126 mm, Z = 568 mm. These are
local connection stubs, not established complete gallery coordinates. Keep the
longitudinal network, cooler connection and manufacturing closure decisions
explicitly incomplete. The front journal radius is source anchored; the new
groove and drilling dimensions are estimates.

Use sections of the hash-bound accepted case and camshaft stock for a small
native passage study. Link the new cuts parametrically, reopen, edit the groove
depth, re-read STEP, check actual material intersections and wall stock, then
construct the connecting fluid volume. Close only the model's artificial case
parting gap in that diagnostic, with an explicit virtual joint-seal mask; do
not mistake the visual split gap for a real open oil leak. The full master
specification receives the same new operations, while the section study remains
separate from complete native engine integration.

### Bearing-web defect exposed by the passage check

The accepted geometric checkpoint's actual front cam case surface measured
31 mm radius, while the intended journal seat is 15.88135 mm. Inspection traced
this to `gtsio_static_drive.py`: replaying the old bulk crank/cam cavities after
adding the front extension erased the four original bearing webs. Those bulk
cuts are excluded from future extension replay. A small native/direct regression
fixture verifies that the journal support survives while the fitted bore stays
open.

The migration appends the original four integral web profiles, re-cuts only
deduplicated guest bores whose actual tool bounds reach them, and restores the
core parting plane only through the repaired region. This retains the existing
native prefix and avoids changing the later front casting datum. Source seat
diameters are retained; the source model's web contours remain estimates.
Native annular support-stock checks at all four main/cam stations are mandatory
for the revised complete engine. The earlier collision-free checkpoint is not
accepted as a mechanically supported engine.

### Longitudinal galleries and bearing feeds: revised calculated candidate

Observed: A-3-3/PDF18 sends cooler discharge to the left gallery. That gallery
feeds mains and cam bearings; the right gallery feeds the right lifters. The
front cam groove joins the case cross passages. The existing reconstructed
lifter feed grooves and radial ports are centred at X=±44.5 mm, Y=−126 mm.
Those coordinates are model packaging anchors, not measured OEM gallery data.

The first trunk proposal at X=±44.5,Y=−126 was rejected: it passed through
successive moving lifter barrels. Local connected clearance around one barrel
does not make a longitudinal pressure gallery. The revised 5 mm trunks are at
X=±54,Y=−108, outside both the precision guide bores and the bulk crank cavity.
Short 3.6 mm oblique feeds reach the guide at the middle of the declared 6 mm
follower travel. The actual groove opening is tested through that full travel.
These coordinates are calculated packaging estimates, not OEM measurements.

The trunks join through the front transfer and feed each main from the left
gallery through its integral web. A straight oblique drilling from the open
main seat toward the gallery is accessible before assembly.
The left bearing insert needs a matching hole. The old illustrative symmetric
insert holes should be replaced by this source-consistent left-feed topology.
Short transverse left-gallery branches feed the four cam seats.

Selected estimates: 5 mm gallery diameter, 3 mm main/cam feed diameter;
rear drill start Z=−14 mm, blind forward end570 mm; source/modeled bearing
stations22,204,386,568 mm. Two recessed rear closures stay ahead of the timing
gear face. The front Y connections are drilled from the accessible lower case
face atY=−158 and closed with two more headless plugs. Their thread forms and
exact OEM identity/count/location remain unresolved. The blind internal bridge
proposal was replaced so the model includes manufacturing access.

The old broad return-bay cut also opened the lower circumference of the lifter
guides into the sump. A representative 12 mm axial guide slice lacked
904.6335437 mm³ of the selected 3 mm annular wall. The R2 candidate adds twelve
integral guide bosses, preserving the original guide diameters. In the focused
native study, actual barrel/plunger subtraction, all25 positions across0–6 mm,
an edited gallery radius and the restored guide wall passed. The minimum
direct groove opening was0.4052633206 mm³; selected gallery and guide wall
deficits were zero. This is one junction, not acceptance of all installed guides.

The local study's raw STEP mass shortcut was an outlier. Actual native/STEP
solid matching by measured bounds and original-solid material differences gave
zero material loss/addition for all three solids. The raw mass discrepancy is
retained; neither the1e−5 mm³ material limit nor the geometry was relaxed.

The new face-ring base exposed a separate148.20787175 mm³ interference with
the old estimated governor pressure cross-pipe atZ598. R2 lowers that pipe to
Z586 and extends the lower receiver toZ580. The upper receiver remainsZ620
and its O-ring gland remainsZ616–618.5. The reopened three-part study passed
its receiving-bore edit, STEP, fluid connection, selected1.5 mm lower wall and
4.5 mm clearance to the uncut ring blank. Whole-case seating and all installed
neighbors remain separate checks.

Check complete trunk stock, all twelve lifter junctions, matching left insert
holes, actual occupied oil space, closures and all installed neighbors before
promotion. A connected geometric circuit does not establish flow capacity,
leakage, oil pressure, complete external plumbing or crankshaft oiling.
