"""Reopen the delivered native CAD or Blender sources, independently of the builders."""
from pathlib import Path
import sys,json,math
R=Path(__file__).resolve().parents[1];F=R/'cad-studies/accessory-drives'
mode=sys.argv[sys.argv.index('--')+1] if '--' in sys.argv else 'cad'
if mode=='cad':
    sys.path.append(r'C:/Program Files/FreeCAD 1.1/bin')
    import FreeCAD as A,Part
    doc=A.openDocument(str(F/'accessory-drives.FCStd'));objects=[o for o in doc.Objects if o.TypeId=='PartDesign::Feature']
    geometry=json.loads((F/'geometry.json').read_text(encoding='utf8'))
    assert {o.Name for o in objects}=={p['id'] for p in geometry['parts']}
    assert all(o.Shape.isValid() and len(o.Shape.Solids)==1 and o.DimensionStatus for o in objects)
    pump=doc.getObject('OilHousing').Shape
    assert not pump.isInside(A.Vector(0,-90,60),.001,True)
    assert pump.isInside(A.Vector(-17,-90,60),.001,True)
    assert not doc.getObject('StarterAdapter').Shape.isInside(A.Vector(60,0,30),.001,True)
    assert all(o.ShapeStatus for o in objects)
    step=Part.read(str(F/'accessory-drives.step'))
    assert len(step.Solids)==len(objects), 'Neutral export must not duplicate assembly groups'
    native_volume=sum(o.Shape.Volume for o in objects)
    # STEP round-trip changes curved-surface integration slightly. Bound BOTH
    # total relative error and every individual solid's relative error.
    relative_error=abs(step.Volume-native_volume)/native_volume
    assert relative_error<1e-6
    assert all(s.isValid() and abs(s.Volume-o.Shape.Volume)/o.Shape.Volume<1e-5 for o,s in zip(objects,step.Solids))
    file=F/'cad-verification.json';report=json.loads(file.read_text());report.update(native_reopened=True,step_solids=len(objects),pump_pocket_empty=True,starter_chamber_empty=True,step_volume_relative_error=relative_error,step_volume_difference_mm3=step.Volume-native_volume,freecad_version=A.Version()[:3])
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
    assert abs(cover.location.x-.220)<1e-6, 'The right crankcase half must move aside'
    file=F/'blender-verification.json';report=json.loads(file.read_text());report.update(native_reopened=True,all_motion_slots_match_components=True,right_case_half_moves_aside=True,blender_version=bpy.app.version_string)
file.write_text(json.dumps(report,indent=2)+'\n')
print('ACCESSORY_NATIVE_VERIFIED',mode)
