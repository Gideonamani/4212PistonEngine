# Straight bevel method fixture

The 55/34 trial passed on FreeCAD 1.1.1 / OCCT 7.8.1. This count ratio would give 0.8088235 crank speed when driven by the half-speed camshaft, consistent with the rounded H governor ratio of 0.809. These are calculated candidate counts, not manufacturer tooth counts. Engine packaging and retention are not yet implemented or accepted.

Software-method references: [FCGear spherical involute implementation](https://raw.githubusercontent.com/looooo/freecad.gears/master/pygears/bevel_tooth.py) and [FCGear native bevel loft construction](https://raw.githubusercontent.com/looooo/freecad.gears/master/freecad/gears/bevelgear.py). These informed method selection, not engine dimensions. No external workbench proxy or copied implementation is required by the saved model.

The independent construction unwinds geodesics from a base cone, projects the rays to two axial planes, and lofts corresponding native polygon sections. Cone angles sum to 90 degrees. Module and face-width expressions remain editable in the saved document; changing tooth count requires regenerating topology. Root form, tooth count, module, pressure angle and backlash remain estimated.

The isolated pair was checked at 24 positions across one tooth pitch. Maximum intersection volume was zero; minimum measured clearance was 0.044430965 mm. Changing module from 1.0 to 1.1 and face width from 7 to 6 mm produced native/direct relative volume differences below 4e-15. The saved/reopened pair and its two-solid STEP export passed, with relative STEP volume error about 1.01e-12.

This demonstrates a sampled geometrically compatible straight-bevel pair. It does not establish continuous meshing, loaded tooth contact, strength, tooling accuracy, an OEM tooth form or a valid engine installation. A face gear requires a separate method; this bevel fixture must not be substituted for the alternator face gear.

Reproduce with `cad_pipeline/probe_gtsio_bevel.py --output <fixture-folder> --steps 24` using the installed FreeCAD Python. The local editable fixture is retained under `build/gtsio520-bevel-fixture-r1/`; its numeric checks are copied beside this note.
