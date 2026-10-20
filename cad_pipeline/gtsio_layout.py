"""One datum and dimensional skeleton for the GTSIO-520-H core candidate.

Z runs aft to forward; odd cylinders extend +X, even cylinders -X.
Dimensional manufacturing data: X-30045A Table 6, PDF103; H: PDF152-153.
Axial spacing and rest-pose registration are reconstruction choices.

Handedness. That is the frame of the frozen CAD build ("CAD frame"). In a right-handed frame with +Z forward and +Y up, right is -X, so the CAD frame has
the odd cylinders on the LEFT looking forward from the accessory end, where X-30045A section 1-7 and Fig A-4-1 put Nos. 1, 3 and 5 on the right (the user
saw the same on the real engine: the alternator is on the left from the front in the model and on the right on the engine). The R10 review export is therefore
the reflection x -> -x of this frame (`EXPORT_MIRROR_X`): the viewer, the contract, the audits and the closure checks all work in that export frame, and the
recipes, specs and gear declarations of the CAD build stay as built. See docs/r10-handedness.md.
"""
import math

# The one handedness parameter of the R10 review export. True: the export is the reflection x -> -x of the CAD frame above (odd cylinders on the right, the
# crank turning counterclockwise looking forward, the propeller clockwise). Set it to False only after the CAD build itself has been regenerated with the
# real handedness (then the declarations are already in the export frame). The contract records it (`procedural.mirror_x`) so the viewer reads the same value.
EXPORT_MIRROR_X = True

INCH = 25.4
BORE = 5.250 * INCH
FITTED_BORE = 5.252 * INCH
STROKE = 4 * INCH
THROW = STROKE / 2
ROD_LENGTH = 6.625 * INCH
MAIN_DIAMETER = 2.6245 * INCH
CRANKPIN_DIAMETER = 2.2495 * INCH
PIN_DIAMETER = 1.1244 * INCH
PIN_BORE = 1.1248 * INCH
BUSH_BORE = 1.1268 * INCH
PIN_LENGTH = 5.2125 * INCH
FIRING_ORDER = (1, 4, 5, 2, 3, 6)
FIRING_PHASE = {n: k * 120 for k, n in enumerate(FIRING_ORDER)}
MAIN_WIDTH, CHEEK_WIDTH, PIN_WIDTH = 44., 14., 30.
BAY_PITCH = 3 * CHEEK_WIDTH + 2 * PIN_WIDTH + MAIN_WIDTH
RING_DATA=(('CompressionRingA',23.,2.,1),('CompressionRingB',17.,2.,-1),('OilRing',-25.,3.5,1),('ScraperRing',-38.,2.5,-1))


def station(n):
    bay, index = divmod(n - 1, 2)
    return MAIN_WIDTH + bay * BAY_PITCH + CHEEK_WIDTH + PIN_WIDTH / 2 + index * (PIN_WIDTH + CHEEK_WIDTH)


def pose(n, theta=0):
    sign = 1 if n % 2 else -1
    angle = math.radians(theta - FIRING_PHASE[n] + (0 if sign == 1 else 180))
    pin = (THROW * math.cos(angle), THROW * math.sin(angle), station(n))
    wrist = (sign * (math.sqrt(ROD_LENGTH ** 2 - pin[1] ** 2) + sign * pin[0]), 0, station(n))
    dx, dy = wrist[0] - pin[0], wrist[1] - pin[1]
    # local Y points from big-end to wrist; local Z is parallel to the shaft.
    return dict(pin=pin, wrist=wrist, rod_roll=math.degrees(math.atan2(-dx, dy)),
                piston_roll=-90 if sign == 1 else 90, sign=sign)


def slider(n, theta):
    return pose(n, theta)['wrist'][0]


class StaticEngineLayout:
    """Recalibrated axial estimates from damper/head packaging; R4 remains unchanged."""
    MAIN_WIDTH=44.
    CHEEK_WIDTH=26.
    PIN_WIDTH=30.
    BAY_PITCH=3*CHEEK_WIDTH+2*PIN_WIDTH+MAIN_WIDTH

    def __init__(self,complete_cylinders=False):
        self.RING_DATA=(('CompressionRingA',23.,2.,1),('CompressionRingB',17.,2.,-1),('OilRing',-17.5,3.5,1),('ScraperRing',-21.5,2.5,-1)) if complete_cylinders else RING_DATA

    def __getattr__(self,name):return globals()[name]

    def station(self,n):
        bay,index=divmod(n-1,2)
        return self.MAIN_WIDTH+bay*self.BAY_PITCH+self.CHEEK_WIDTH+self.PIN_WIDTH/2+index*(self.PIN_WIDTH+self.CHEEK_WIDTH)

    def pose(self,n,theta=0):
        sign=1 if n%2 else -1
        angle=math.radians(theta-FIRING_PHASE[n]+(0 if sign==1 else 180))
        pin=(THROW*math.cos(angle),THROW*math.sin(angle),self.station(n))
        wrist=(sign*(math.sqrt(ROD_LENGTH**2-pin[1]**2)+sign*pin[0]),0,self.station(n))
        dx,dy=wrist[0]-pin[0],wrist[1]-pin[1]
        return dict(pin=pin,wrist=wrist,rod_roll=math.degrees(math.atan2(-dx,dy)),piston_roll=-90 if sign==1 else 90,sign=sign)
