"""Append linked features to an unchanged, unplaced native history prefix."""
from cad_pipeline.extend_saved_native import expression_names
from cad_pipeline.generate import basic_feature, rich_feature, identify_part, single_valid_solid


def eligible(before, after, changed_parameters, has_instances=False):
    if has_instances or any(before.get(k) or after.get(k) for k in ('placement', 'dressups', 'geometry_instance_of')):
        return False
    old = before['features']
    if len(after['features']) <= len(old) or after['features'][:len(old)] != old:
        return False
    if expression_names(old) & set(changed_parameters):
        return False
    ignored = {'features', 'label', 'evidence', 'source_callouts'}
    return {k:v for k,v in before.items() if k not in ignored} == {k:v for k,v in after.items() if k not in ignored}


def append(doc, before, after, parameters):
    group = doc.getObject(before['id'])
    tips = [o for o in doc.Objects if getattr(o, 'StablePartID', None) == before['id']]
    if group is None or len(tips) != 1 or not single_valid_solid(tips[0].Shape):
        raise ValueError('Unique valid original native tip required')
    original = current = tips[0]
    for index in range(len(before['features']), len(after['features'])):
        feature = after['features'][index]
        name = after['id']+'_F'+str(index+1)
        if doc.getObject(name) is not None:
            raise ValueError('Appended feature name already exists: '+name)
        builder = rich_feature if feature['primitive'] in ('prism','loft','revolve','helix','polar_pattern') else basic_feature
        tool = builder(doc, group, name, feature, parameters)
        result = doc.addObject('Part::Fuse' if feature['operation']=='add' else 'Part::Cut', name+'_Result')
        group.addObject(result)
        result.Base, result.Tool, result.Refine = current, tool, after.get('boolean_refine', True)
        current.Visibility = tool.Visibility = False
        current = result
        doc.recompute()
        if not single_valid_solid(current.Shape):
            raise ValueError('Invalid appended native feature: '+name)
        print('APPENDED_NATIVE_FEATURE', name, flush=True)
    # The complete geometry was evaluated above. Removing an identity property
    # from the old tip otherwise marks its entire Boolean history for execution
    # again, although no dimension, expression, topology or placement changed.
    owned={};pending=[group]
    while pending:
        obj=pending.pop()
        if obj.Name in owned:continue
        owned[obj.Name]=obj;pending.extend(getattr(obj,'Group',[]))
    if any('Touched' in obj.State for obj in owned.values() if hasattr(obj,'Shape')):
        raise ValueError('Geometry must be fully evaluated before moving identity metadata')
    for key in ('StablePartID','Evidence','MaterialCategory','ComponentGroup'):
        original.removeProperty(key)
    identify_part(current, after)
    group.Label = after['label']
    for obj in owned.values():obj.purgeTouched()
    doc.recompute()
    if not single_valid_solid(current.Shape):
        raise ValueError('Appended native tip failed final recompute')
    return current
