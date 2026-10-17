"""Conservative exact-intersection reuse for one recomputed static CAD pose.

Hashes identify serialized BREP boundaries, tolerances and assembled placements;
they are not approximate geometric equivalence tests. False misses are safe.
Triangulation is removed from a COPY used only for hashing, never the audited solid.
"""
import hashlib
import json
from pathlib import Path

SCHEMA = 1
POLICY = dict(method='saved-static-common-volume-v1', tolerance_mm3=1e-5,
              broadphase='FreeCAD BoundBox.intersect', units='mm',
              pair_order='saved document object order; common(a,b)', pose='recomputed static')


def digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(',', ':'),
                                    allow_nan=False).encode()).hexdigest()


def file_hash(path):
    h = hashlib.sha256()
    with Path(path).open('rb') as stream:
        for block in iter(lambda: stream.read(1024*1024), b''):
            h.update(block)
    return h.hexdigest()


def engine_identity():
    import FreeCAD
    import Part
    return dict(freecad=FreeCAD.Version(), occ=Part.OCC_VERSION,
                fingerprint='copied-cleaned-BREP-plus-placement-hex-v1')


def fingerprint(shape):
    boundary = shape.copy().cleaned().exportBrepToString()
    matrix = shape.Placement.toMatrix()
    placement = [float(getattr(matrix, 'A'+str(i)+str(j))).hex()
                 for i in range(1, 5) for j in range(1, 5)]
    return digest(dict(brep_sha256=hashlib.sha256(boundary.encode()).hexdigest(),
                       placement=placement))


def candidates(shapes):
    values = list(shapes)
    boxes = {key: shape.BoundBox for key, shape in shapes.items()}
    return [(a, b) for i, a in enumerate(values) for b in values[i+1:]
            if boxes[a].intersect(boxes[b])]


def provenance_file(path):
    return dict(path=str(Path(path).resolve()), sha256=file_hash(path))


def seal_cache(fingerprints, outcomes, source):
    cache = dict(schema=SCHEMA, policy=POLICY.copy(), engine=engine_identity(),
                 fingerprints=fingerprints, outcomes=outcomes, source=source)
    cache['content_sha256'] = digest(cache)
    return cache


def validate_cache(cache):
    unsigned = {key: value for key, value in cache.items() if key != 'content_sha256'}
    if cache.get('content_sha256') != digest(unsigned):
        raise ValueError('Pair cache content changed')
    if cache.get('schema') != SCHEMA or cache.get('policy') != POLICY:
        raise ValueError('Pair cache policy/method mismatch')
    if cache.get('engine') != engine_identity():
        raise ValueError('Pair cache software/fingerprint mismatch')
    if not {'native', 'spec'} <= set(cache.get('source', {})):
        raise ValueError('Pair cache lacks native/spec provenance')
    for name, record in cache['source'].items():
        if file_hash(record['path']) != record['sha256']:
            raise ValueError('Pair cache source changed: '+name)
    seen = set()
    for item in cache['outcomes']:
        key = (item['a'], item['b'])
        if key in seen or key[0] == key[1] or any(k not in cache['fingerprints'] for k in key):
            raise ValueError('Pair cache duplicate or unknown identities')
        seen.add(key)
        volume = item['overlap_mm3']
        # A legacy pass establishes only <= threshold, not exact zero volume.
        if volume is None and not item.get('legacy_below_threshold'):
            raise ValueError('Pair cache lacks measured or completed-pass outcome')
        if volume is not None and (not isinstance(volume, (int, float)) or
                                   not 0 <= volume < float('inf')):
            raise ValueError('Invalid cached intersection volume')
    return {(item['a'], item['b']): item for item in cache['outcomes']}


def intersect_pairs(shapes, previous=None, progress=None, checkpoint=None, max_new_pairs=None):
    old = validate_cache(previous) if previous else {}
    # Always measure the actual operands here; caller-provided snapshots could
    # become stale after a placement or shape mutation between audit stages.
    fingerprints = {key: fingerprint(shape) for key, shape in shapes.items()}
    outcomes = []; overlaps = []; tested = 0; reused = 0
    pairs = candidates(shapes)  # EVERY current neighbouring pair, even on a warm run.
    for index, (a, b) in enumerate(pairs):
        prior = old.get((a, b))
        if prior and all(fingerprints[k] == previous['fingerprints'].get(k) for k in (a, b)):
            item = dict(prior); reused += 1
        else:
            if max_new_pairs is not None and tested >= max_new_pairs:
                raise ValueError('New exact pairs exceed the requested compute budget')
            item = dict(a=a, b=b, overlap_mm3=shapes[a].common(shapes[b]).Volume)
            tested += 1
        outcomes.append(item)
        if item['overlap_mm3'] is not None and item['overlap_mm3'] > POLICY['tolerance_mm3']:
            overlaps.append(dict(a=a, b=b, overlap_mm3=item['overlap_mm3']))
        if progress and (index % 100 == 0 or index == len(pairs)-1):
            progress(index+1, len(pairs), tested, reused)
        if checkpoint and ((index+1) % 100 == 0 or index == len(pairs)-1):
            checkpoint(fingerprints, outcomes)
    return dict(fingerprints=fingerprints, outcomes=outcomes, overlaps=overlaps,
                pairs=len(pairs), pairs_tested=tested, pairs_reused=reused)


def bootstrap(shapes, report, source):
    """Index a completed legacy audit; do not manufacture exact zero measurements."""
    if not report.get('passed') or report.get('overlaps') != [] or report.get('agreement_issues') != []:
        raise ValueError('Legacy audit must be complete and passed without issues')
    if report.get('parts') != len(shapes) or report.get('overlap_tolerance_mm3') != POLICY['tolerance_mm3']:
        raise ValueError('Legacy audit part count or tolerance mismatch')
    if report['native_sha256'] != source['native']['sha256'] or report['spec_sha256'] != source['spec']['sha256']:
        raise ValueError('Legacy audit source mismatch')
    pairs = candidates(shapes)
    if len(pairs) != report['pairs']:
        raise ValueError('Legacy audit neighbouring-pair coverage mismatch')
    return seal_cache({key: fingerprint(shape) for key, shape in shapes.items()},
                      [dict(a=a, b=b, overlap_mm3=None, legacy_below_threshold=True)
                       for a, b in pairs], source)
