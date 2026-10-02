"""Reopen the delivered native CAD or Blender sources, independently of the builders."""
from pathlib import Path
import sys,json,math
R=Path(__file__).resolve().parents[1];F=R/'cad-studies/accessory-drives'
mode=sys.argv[sys.argv.index('--')+1] if '--' in sys.argv else 'cad'
if mode=='cad':
    sys.path.append(r'C:/Program Files/FreeCAD 1.1/bin')
    import FreeCAD as A,Part
    doc=A.openDocument(str(F/'accessory-drives.FCStd'));objects=[o for o in doc.Objects if o.TypeId=='PartDesign::Feature']
    assert len(objects)==47
    assert all(o.Shape.isValid() and len(o.Shape.Solids)==1 and o.DimensionStatus for o in objects)
    pump=doc.getObject('OilHousing').Shape
    assert not pump.isInside(A.Vector(0,-90,60),.001,True)
    assert pump.isInside(A.Vector(-18,-108,60),.001,True)
    step=Part.read(str(F/'accessory-drives.step'))
    assert len(step.Solids)==47, 'Neutral export must not duplicate assembly groups'
    assert abs(step.Volume-sum(o.Shape.Volume for o in objects))<.1
    file=F/'cad-verification.json';report=json.loads(file.read_text());report.update(native_reopened=True,step_solids=47,pump_pocket_empty=True,step_volume_matches_native=True,freecad_version=A.Version()[:3])
else:
    import bpy
    bpy.ops.wm.open_mainfile(filepath=str(F/'accessory-drives.blend'))
    contract=json.loads((R/'web/accessory-drives-contract.json').read_text())
    objects=[o for o in bpy.data.objects if o.type=='MESH']
    assert {o.get('cad_part_id') for o in objects}=={p['id'] for p in contract['parts']}
    for motion in contract['motions']:
        action=bpy.data.actions[motion['id']]
        assert {s.name_display for s in action.slots}=={o.name for o in objects}
    cover=bpy.data.objects['HousingCover'];a=bpy.data.actions['Exploded overview'];cover.animation_data.action=a;cover.animation_data.action_slot=next(s for s in a.slots if s.name_display==cover.name);bpy.context.scene.frame_set(601)
    assert abs(cover.location.x+.240)<1e-6, 'The exploded teaching cover must move aside'
    file=F/'blender-verification.json';report=json.loads(file.read_text());report.update(native_reopened=True,all_motion_slots_match_components=True,exploded_cover_moves_aside=True,blender_version=bpy.app.version_string)
file.write_text(json.dumps(report,indent=2)+'\n')
print('ACCESSORY_NATIVE_VERIFIED',mode)
