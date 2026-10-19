"""Does the shared Blender rig still build the Langley and Wright cards the way the per-engine rigs did? Needs Blender, so CI does not run it.

For one study it takes the CAD package of a released card (a package .zip from the private archive, or a folder holding geometry.json and cad-validation.json) and

1. runs the BASELINE rig (the per-engine rig of an earlier commit, checked out in its own folder) and the CURRENT rig on that package, one after the other;
2. compares the two exports: the GLB structurally (scripts/compare_glb_structure.py) and the contract, the verification record and the .glb.gz byte for byte;
3. if the package holds the released export, compares the CURRENT export with it too, so that drift between the released file and today's code is visible.

    python scripts/check_rig_equivalence.py --study langley --package <package.zip> --baseline <checkout of the base commit> --work <scratch folder>

Exit status 0 only when the baseline and the current export are structurally equivalent and their contracts and verification records are identical. The comparison with the
released export is reported but does not decide the status: the look module changed after those files were exported (the materials differ), which is a fact about the
released files, not about the rig. See docs/animated-study-rig.md for what this does and does not prove. Standard library only; one Blender run at a time.
"""
import argparse, hashlib, json, subprocess, sys, time, zipfile
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(Path(__file__).resolve().parent))
from compare_glb_structure import compare

BLENDER = Path('C:/Program Files/Blender Foundation/Blender 5.0/blender.exe')
STUDIES = {'langley': dict(rig='rig_langley.py', name='langley-manly-balzer-1903-animated'), 'wright': dict(rig='rig_wright.py', name='wright-research-revision-2-animated')}
sha256 = lambda path: hashlib.sha256(Path(path).read_bytes()).hexdigest()


def unpack(package, work, name):
    """The CAD folder (and the released export, when there is one) of a package .zip or folder, under `work`."""
    cad, released = work / 'cad', None
    if package.is_dir():
        return package, None
    with zipfile.ZipFile(package) as z:
        for member in ('cad/geometry.json', 'cad/cad-validation.json'):
            target = work / member
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(z.read(member))
        if f'rig/{name}.glb' in z.namelist():
            released = work / 'released'
            released.mkdir(exist_ok=True)
            for suffix in ('.glb', '-contract.json'):
                (released / (name + suffix)).write_bytes(z.read(f'rig/{name}{suffix}'))
    return cad, released


def run(blender, script, study, package, output, log):
    """One Blender run of a rig script; `study` is added for the shared rig only."""
    output.mkdir(parents=True, exist_ok=True)
    command = [str(blender), '--background', '--python-exit-code', '1', '--python', str(script), '--'] + (['--study', study] if script.name == 'rig_animated_study.py' else [])
    command += ['--package', str(package), '--output', str(output)]
    started = time.time()
    with log.open('w') as f:
        code = subprocess.run(command, stdout=f, stderr=subprocess.STDOUT).returncode
    if code:
        raise RuntimeError(f'Blender failed ({code}); see {log}')
    return round(time.time() - started, 1)


def same_bytes(a, b):
    return a.exists() and b.exists() and a.read_bytes() == b.read_bytes()


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--study', choices=sorted(STUDIES), required=True)
    parser.add_argument('--package', type=Path, required=True)
    parser.add_argument('--baseline', type=Path, help='a checkout of the commit before the shared rig (holds cad_pipeline/rig_langley.py or rig_wright.py as they were)')
    parser.add_argument('--work', type=Path, required=True)
    parser.add_argument('--blender', type=Path, default=BLENDER)
    parser.add_argument('--tolerance', type=float, default=0.0, help='largest allowed difference of positions, transforms, colours and animation values (default: exact)')
    parser.add_argument('--reuse', action='store_true', help='compare what is already in the work folder instead of running Blender')
    args = parser.parse_args()
    study = STUDIES[args.study]
    work = (args.work / args.study).resolve()
    work.mkdir(parents=True, exist_ok=True)
    package, released = unpack(args.package, work, study['name'])
    current, baseline = work / 'current', work / 'baseline'
    report = dict(study=args.study, package=str(args.package), tolerance=args.tolerance, geometry_sha256=sha256(package / 'geometry.json'),
                  current_rig=sha256(REPO / 'cad_pipeline/rig_animated_study.py'), seconds={})
    if not args.reuse:
        if args.baseline:
            report['seconds']['baseline'] = run(args.blender, args.baseline / 'cad_pipeline' / study['rig'], args.study, package, baseline, work / 'baseline.log')
        report['seconds']['current'] = run(args.blender, REPO / 'cad_pipeline/rig_animated_study.py', args.study, package, current, work / 'current.log')
    glb = study['name'] + '.glb'
    if args.baseline or args.reuse and (baseline / glb).exists():
        base = compare(baseline / glb, current / glb, args.tolerance)
        names = [glb + '.gz', study['name'] + '-contract.json', 'blender-verification.json']
        report['baseline_vs_current'] = dict(glb=base, byte_identical_files={n: same_bytes(baseline / n, current / n) for n in names})
        ok = base['equivalent'] and all(report['baseline_vs_current']['byte_identical_files'].values())
    else:
        ok = None
    if released and (released / glb).exists():
        ref = compare(released / glb, current / glb, args.tolerance)
        old, new = json.loads((released / (study['name'] + '-contract.json')).read_text()), json.loads((current / (study['name'] + '-contract.json')).read_text())
        old_asset, new_asset = old.pop('asset_sha256'), new.pop('asset_sha256')
        report['released_vs_current'] = dict(glb=ref, contract_identical_but_for_asset_hash=old == new, released_asset_sha256=old_asset, current_asset_sha256=new_asset,
                                             sections_that_differ=sorted(n for n, s in ref['sections'].items() if s['mismatches']))
    (work / 'report.json').write_text(json.dumps(report, indent=2) + '\n')
    print(f"{args.study}: baseline vs current: " + ('not run' if ok is None else 'EQUIVALENT, files identical' if ok else 'DIFFERENT'))
    if 'baseline_vs_current' in report:
        b = report['baseline_vs_current']
        print(f"  GLB byte identical: {b['glb']['byte_identical']}; structurally equivalent: {b['glb']['equivalent']}; identical files: {b['byte_identical_files']}")
    if 'released_vs_current' in report:
        r = report['released_vs_current']
        print(f"  released vs current: GLB equivalent {r['glb']['equivalent']}; sections that differ: {r['sections_that_differ'] or 'none'}; contract identical but for the asset hash: {r['contract_identical_but_for_asset_hash']}")
    print('  report:', work / 'report.json')
    return 0 if ok is not False else 1


if __name__ == '__main__':
    sys.exit(main())
