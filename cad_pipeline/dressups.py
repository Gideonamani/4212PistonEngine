"""Geometric selection for native/direct fillets; indices are transient handles."""
import math
import FreeCAD as App
import Part
from cad_pipeline.spec import evaluate


def circle_edges(shape, selectors, parameters):
    indices, records = [], []
    for selector in selectors:
        center = App.Vector(*[evaluate(v, parameters) for v in selector['center']])
        radius = evaluate(selector['radius'], parameters)
        axis = App.Vector(*selector.get('axis', [0, 0, 1]))
        axis.normalize()
        selected = [(i, e) for i, e in enumerate(shape.Edges, 1)
                    if isinstance(e.Curve, Part.Circle)
                    and abs(e.Curve.Radius - radius) < 1e-6
                    and (e.Curve.Center - center).Length < 1e-6
                    and abs(abs(e.Curve.Axis.dot(axis)) - 1) < 1e-7]
        fraction = sum(e.Length for _, e in selected) / (2 * math.pi * radius)
        expected = selector.get('arc_fraction', 1.)
        if not selected or abs(fraction - expected) > 1e-5:
            raise ValueError(f'Ambiguous/incomplete fillet circle at {list(center)}: {fraction}, expected {expected}')
        indices.extend(i for i, _ in selected)
        records.append(dict(center_mm=list(center), radius_mm=radius, arc_fraction=fraction,
                            edge_indices=[i for i, _ in selected]))
    if len(set(indices)) != len(indices):
        raise ValueError('Fillet selectors overlap')
    return indices, records


def apply_direct(shape, dressups, parameters):
    for feature in dressups:
        indices, _ = circle_edges(shape, feature['selectors'], parameters)
        shape = shape.makeFillet(evaluate(feature['radius'], parameters), [shape.Edges[i - 1] for i in indices])
        if not shape.isValid() or len(shape.Solids) != 1:
            raise ValueError('Invalid direct fillet: ' + feature.get('label', ''))
    return shape
