"""Avoid execution of unchanged evaluated histories after controller metadata edits.

FreeCAD's documented purgeTouched clears execution flags, not expressions or
geometry. Eligibility is recomputed here; caller-provided part lists are not
trusted. New/changed geometry is excluded. Final saved/direct and pair gates
remain mandatory on actual recomputed saved solids.
"""
from cad_pipeline.extend_saved_native import rebuild_plan
from cad_pipeline.append_native_history import eligible
from cad_pipeline.generate import single_valid_solid


def preserve(doc, old, new, retirement=None):
    plan=rebuild_plan(old,new,retirement);before={p['id']:p for p in old['parts']}
    retained=set(plan['reused'])
    for part in new['parts']:
        id=part['id']
        if id in before and eligible(before[id],part,plan['changed_parameters'],
                any(p.get('geometry_instance_of')==id for p in new['parts'])):
            retained.add(id)
    # Controller values are already assigned from the validated specification.
    # Expressions remain linked for subsequent edits; no Python proxy executes.
    for name,p in new['parameters'].items():
        if p['value'] is not None and abs(float(getattr(doc.Parameters,name))-p['value'])>1e-10*max(1,abs(p['value'])):
            raise ValueError('Controller value is not the validated baseline: '+name)
    if getattr(doc.Parameters,'Proxy',None) is not None:
        raise ValueError('A custom controller proxy cannot be retained this way')
    kept=[];objects=set()
    for id in sorted(retained):
        group=doc.getObject(id)
        if group is None:continue # replaced histories have already been removed
        tips=[o for o in group.Group if getattr(o,'StablePartID',None)==id]
        if not tips:
            tips=[o for o in doc.Objects if getattr(o,'StablePartID',None)==id]
        if len(tips)!=1 or not single_valid_solid(tips[0].Shape):
            raise ValueError('Retained history needs a valid unique evaluated tip: '+id)
        pending=[group]
        while pending:
            obj=pending.pop()
            if obj.Name in objects:continue
            objects.add(obj.Name);pending.extend(getattr(obj,'Group',[]))
        kept.append(id)
    for name in objects:doc.getObject(name).purgeTouched()
    doc.Parameters.purgeTouched()
    # Controller changes can defer expression propagation until recompute.
    # Clearing its metadata flag must never suppress a real changed part.
    # Explicitly reactivate every owned node of those existing histories.
    # Appended, dependency-verified unchanged prefixes remain in retained.
    reactivated=[];reactivated_objects=set()
    for part in new['parts']:
        id=part['id']
        if id in retained:continue
        group=doc.getObject(id)
        if group is None:continue
        pending=list(getattr(group,'Group',[]));visited=set()
        while pending:
            obj=pending.pop()
            if obj.Name in visited:continue
            visited.add(obj.Name);pending.extend(getattr(obj,'Group',[]))
            if hasattr(obj,'Shape'):obj.touch();reactivated_objects.add(obj.Name)
        reactivated.append(id)
    return dict(retained_part_ids=kept,retained_object_count=len(objects),
        reactivated_part_ids=reactivated,reactivated_object_count=len(reactivated_objects),
        method='Validated controller values; dependency-derived unchanged recipes/prefixes only; clear execution flags while retaining geometry and live expressions')
