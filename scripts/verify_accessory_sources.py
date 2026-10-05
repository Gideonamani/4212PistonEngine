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
    assert pump.isInside(A.Vector(-43,-90,52),.001,True)
    assert not doc.getObject('StarterAdapter').Shape.isInside(A.Vector(60,0,66),.001,True)
    assert not doc.getObject('StarterAdapter').Shape.isInside(A.Vector(60,-26,77),.001,True)
    assert all(o.ShapeStatus for o in objects)
    joints=[]
    for pair in geometry['interfaces']:
        gap=doc.getObject(pair['a']).Shape.distToShape(doc.getObject(pair['b']).Shape)[0]
        joints.append(dict(pair,distance_mm=gap))
        assert gap<=pair['max_gap_mm']+.005, f"Open assembled joint {pair['a']} / {pair['b']}: {gap} mm"
    # Every pair whose bounds meet is intersected, not a hand-picked list: a short list is how the gear meshes went unchecked.
    # Pairs in the interference ledger are recorded, not asserted; the ledger may only shrink.
    import itertools
    sys.path.append(str(R/'scripts'));import accessory_gears as T
    policy=json.loads((F/'interference-policy.json').read_text(encoding='utf8'))
    ledger={frozenset((e['a'],e['b'])):e for e in policy['known_defects']}
    shapes={o.Name:o.Shape for o in objects}
    clearances=[];known_overlaps=[]
    for a,b in itertools.combinations(sorted(shapes),2):
        if not shapes[a].BoundBox.intersect(shapes[b].BoundBox):continue
        overlap=shapes[a].common(shapes[b]).Volume
        entry=ledger.get(frozenset((a,b)))
        if entry:
            known_overlaps.append(dict(a=a,b=b,overlap_mm3=overlap,ledger_status=entry['status']));continue
        clearances.append(dict(a=a,b=b,overlap_mm3=overlap))
        assert overlap<1e-4, f"Solid interference {a} / {b}: {overlap} mm3"
    # Declared gear meshes keep positive clearance at the assembled pose. The swept check through every baked
    # motion is scripts/audit_assembly_interference.py on the exported GLB.
    gear_mesh_checks=[]
    for a,b in T.MESHES:
        gap=shapes[a].distToShape(shapes[b])[0]
        gear_mesh_checks.append(dict(driver=a,driven=b,min_gap_mm=gap))
        assert gap>=.02, f"Gear mesh {a} / {b} has {gap} mm clearance; teeth must touch within backlash and never overlap"
    step=Part.read(str(F/'accessory-drives.step'))
    assert len(step.Solids)==len(objects), 'Neutral export must not duplicate assembly groups'
    native_volume=sum(o.Shape.Volume for o in objects)
    # STEP round-trip changes curved-surface integration slightly. Bound BOTH
    # total relative error and every individual solid's relative error.
    relative_error=abs(step.Volume-native_volume)/native_volume
    assert relative_error<1e-6
    assert all(s.isValid() and abs(s.Volume-o.Shape.Volume)/o.Shape.Volume<1e-5 for o,s in zip(objects,step.Solids))
    file=F/'cad-verification.json';report=json.loads(file.read_text());report.update(native_reopened=True,step_solids=len(objects),pump_pocket_empty=True,starter_chamber_empty=True,assembled_interfaces=joints,interference_checks=clearances,known_overlaps=known_overlaps,gear_mesh_checks=gear_mesh_checks,step_volume_relative_error=relative_error,step_volume_difference_mm3=step.Volume-native_volume,freecad_version=A.Version()[:3])
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
