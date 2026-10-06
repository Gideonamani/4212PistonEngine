"""Look closely at overlaps in an exported model, using the audit's own posing of the baked clips.

scripts/audit_assembly_interference.py samples a clip at a fixed set of poses and reports pairs. When it names a pair, or when a clip
must be checked at poses the audit does not use, this tool answers the follow-up questions in seconds: where in the clip does one
pair overlap and by how much, and which pairs overlap at chosen poses or anywhere along a clip. It poses the baked keys with linear
interpolation exactly as a viewer does, so it sees what interpolation between keys does to a part.

    # one or more pairs through a clip, every 0.25 frame (A:B)
    python scripts/scan_assembly_pairs.py web/model.glb.gz --clip "Operating mechanism (illustrative)" --step 0.25 Flywheel:MagnetoDriveWheel IgnitionCam1:TripLever1
    # every pair at three fractions of a clip (held poses)
    python scripts/scan_assembly_pairs.py web/model.glb.gz --clip "Systems exploded view" --fractions 0.3333 0.6667 1
    # every pair that overlaps at any of N evenly spaced poses of a clip (transit)
    python scripts/scan_assembly_pairs.py web/model.glb.gz --clip "Systems exploded view" --union 36

Thresholds are the audit's: volume above 0.001 mm3 and thickness above 0.05 mm. Needs numpy, trimesh and manifold3d
(scripts/requirements-audit.txt).
"""
import argparse, gzip, importlib.util, sys, tempfile
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('audit_assembly_interference', HERE / 'audit_assembly_interference.py')
audit = importlib.util.module_from_spec(spec)
spec.loader.exec_module(audit)
VOLUME_MM3, THICKNESS_MM = 1e-3, 0.05


def open_model(path):
    path = Path(path)
    if path.suffix == '.gz':
        raw = path.read_bytes()
        path = Path(tempfile.mkdtemp()) / 'model.glb'
        path.write_bytes(gzip.decompress(raw))
    return audit.Glb(str(path))


def violating(result):
    return {pair: (v, t) for pair, (v, t) in result.items() if v > VOLUME_MM3 and t > THICKNESS_MM}


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('glb')
    parser.add_argument('--clip', help='clip name (default: the first clip)')
    parser.add_argument('--step', type=float, default=0.25, help='pair mode: frames between poses (the clip is keyed once per frame)')
    parser.add_argument('--fractions', type=float, nargs='+', help='list every overlapping pair at these fractions of the clip')
    parser.add_argument('--union', type=int, help='list every pair that overlaps at any of this many evenly spaced poses')
    parser.add_argument('pairs', nargs='*', help='A:B part ids to scan through the clip')
    args = parser.parse_args()

    glb = open_model(args.glb)
    clips = glb.clips()
    clip = clips[args.clip] if args.clip else next(iter(clips.values()))
    tracks = glb.clip_tracks(clip)
    start, end = audit.clip_span(tracks)
    signatures = audit.track_signatures(glb, tracks)
    unchanged = lambda a, b: signatures.get(a) == signatures.get(b)
    pairs = [tuple(p.split(':')) for p in args.pairs]
    wanted = {i for pair in pairs for i in pair}
    parts = [audit.Part(glb, i) for i in glb.mesh_nodes() if not pairs or glb.part_id(i) in wanted]

    if pairs:
        frames = max(1, round((end - start) / (1 / 24)))
        poses = np.arange(0, frames + 1e-9, args.step) / frames
        for a, b in pairs:
            pair_parts = [p for p in parts if p.id in (a, b)]
            worst, bad = (0.0, 0.0, None), 0
            for f in poses:
                result = audit.overlaps(pair_parts, glb, audit.pose_at(glb, tracks, start + (end - start) * f))
                v, t = result.get((a, b), result.get((b, a), (0.0, 0.0)))
                bad += v > VOLUME_MM3 and t > THICKNESS_MM
                if v > worst[0]:
                    worst = (v, t, f)
            where = f'{worst[2]:.4f} of the clip' if worst[2] is not None else 'nowhere'
            print(f'{a} / {b}: {bad} violating poses of {len(poses)}; worst {worst[0]:.3f} mm3, {worst[1]:.3f} mm thick at {where}', flush=True)
        return

    def listing(fractions):
        found = {}
        for f in fractions:
            result = violating(audit.overlaps(parts, glb, audit.pose_at(glb, tracks, start + (end - start) * f), unchanged=unchanged))
            print(f'fraction {f:.4f}: {len(result)} overlapping pairs', flush=True)
            for (a, b), (v, t) in sorted(result.items(), key=lambda kv: -kv[1][0]):
                entry = found.setdefault((a, b), dict(first=f, last=f, volume=0.0))
                entry['last'], entry['volume'] = f, max(entry['volume'], v)
        return found

    if args.fractions:
        for (a, b), e in sorted(listing(args.fractions).items(), key=lambda kv: -kv[1]['volume'])[:40]:
            print(f"  {a} / {b}: {e['volume']:.1f} mm3")
    elif args.union:
        found = listing([k / args.union for k in range(1, args.union + 1)])
        print(len(found), 'distinct overlapping pairs')
        for (a, b), e in sorted(found.items(), key=lambda kv: kv[1]['first']):
            print(f"  {a} / {b}: from {e['first']:.3f} to {e['last']:.3f}, max {e['volume']:.1f} mm3")
    else:
        parser.error('give pairs, --fractions or --union')


if __name__ == '__main__':
    main()
