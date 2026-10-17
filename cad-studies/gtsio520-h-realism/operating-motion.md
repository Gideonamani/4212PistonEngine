# Core datum, motion research and packaging

7 October 2026. Student purpose for the eventual model: see the crank rotate and cause all six rods/pistons to move, then see the reduction/quill and valve train transmit that same input. **This first core exports no operating clip.**

| Quantity | Driver/value | Evidence/status |
|---|---|---|
| Stroke / throw | 101.6 / 50.8 mm | H C-3-2 PDF152 documented / derived |
| Rod centers | 168.275 mm, chosen range midpoint | Table 6 PDF103 documented range |
| Firing order / event spacing | 1-4-5-2-3-6 / 120 degrees | H C-3-3 PDF153 documented / derived |
| Physical crankpin phase | bank direction minus firing-event phase | Derived in `gtsio_layout.py`; teaching zero is cylinder 1 firing TDC |
| Opposed-cylinder numbering | odd +X, even -X; aft-to-forward 1 through 6 | A-11-3 PDF75 supports order/sides; model datum orientation chosen |
| Slider position | r cos(theta) + sqrt(L squared - r squared sin(theta)) along its bank | Derived geometric closure, not forces/dynamics |
| Propeller speed | 0.667 crank speed | H C-3-2 PDF152; deferred gear system |
| Cam speed/lift/phases | no core clip; a full follower law is unresolved | Valve module research pending |
| Third-order damper oscillation | six dampers on cheeks 2,5,8 | A-11-3 PDF75 / Table 11 PDF117; shapes, phase and oscillation deferred |

Z is the shaft axis, positive toward the propeller; X is the opposed cylinder direction and Y is vertical. The rear main journal begins at Z=0. Axial journal/pin/cheek widths are estimated at 44/30/14 mm, producing 146 mm bay pitch and 44 mm left-bank advance. There are four main journals and nine cheeks around three opposed pairs, following the B-2 longitudinal section (PDF97). These estimates define a coherent candidate, not surveyed crankcase datums.

Every rod's frame has local Y from crankpin to wrist and local Z along the shaft. Each piston frame has Y outboard and Z along its pin. Housing/cylinder transforms must later be derived from these datums, and cannot be inherited from V5 by visual alignment. The stored candidate is the theta=0 pose. The math closes over 720 degrees; only the stored CAD pose has an intersection audit. A smooth future clip requires an exhaustive moving envelope check and a baked between-key audit before a student sees it.

| Interface | Packaging / clearance |
|---|---|
| Crankpin / lined shells / rod and cap | 30 mm estimated axial pin; rod width derives as pin width minus the documented selected .008 in (0.2032 mm) side clearance; shells are 0.4 mm narrower than rod; selected 0.055 mm diametral running gap |
| Pin / bushing / piston | Source-backed pin, piston bore and bush bore midpoints; rod center section leaves separate integral piston bosses outboard |
| Permanent pin plugs | Tube and plugs meet at butt planes; one permanently assembled physical pin, represented as separate material solids |
| Rod bolt / cap / nut | Smooth shaft in a larger through hole; nut thread is an illustrative clearance bore; cotters deferred |
| Rings / grooves | Four independent, gapped solids; 0.1 mm chosen axial groove allowance and 0.1 mm radial root clearance; gap positions alternate per A-11-3 |
| Main journals / crankcase | Case and main shells deferred; bearing support is not complete |
| Crank cheeks / skirt / dampers | Static skirt relief included; no damper envelope or complete moving clearance claim |

Rigid units and actual counterweight motion are not declared until those mechanisms are built. The native forging is one rigid solid; presentation-only inspection cameras do not represent engine operation.
