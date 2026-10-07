"""Archive a released animated reconstruction: the native CAD, the Blender file, the exported GLB and the records that bind them.

The archive is private (AGENTS.md): editable FreeCAD, STEP and Blender sources stay out of Git and out of the public viewer's files. Before
it writes anything it checks that the pieces belong together: the saved CAD is the one the report describes, the specification is the one
that built it, and the exported GLB is the one the contract and the interference audit name. Standard library only.

    python cad_pipeline/package_animated.py --cad build/wright-reconstruction-v2/cad --rig <rig output folder> --name wright-research-revision-2-animated
        --study cad-studies/wright-1903/revision-2 --output <folder> --stem wright-research-revision-2-animated.zip
"""
import argparse, gzip, hashlib, json, zipfile
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
STUDY_FILES = ('part-spec.json', 'seats.json', 'chain-layout.json', 'interference-policy.json', 'interference-audit.json', 'operating-motion.md',
               'research.md', 'inventory.json', 'build-notes.md', 'mass-check.json', 'step-exception-policy.json', 'step-boundary-checks.json', 'source-manifest.json')
sha256 = lambda data: hashlib.sha256(data).hexdigest()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--cad', type=Path, required=True, help='generate.py output folder (FCStd, STEP, geometry.json, cad-validation.json)')
    parser.add_argument('--rig', type=Path, required=True, help='rig_wright.py output folder (.blend, .glb, contract, blender-verification.json)')
    parser.add_argument('--study', type=Path, required=True)
    parser.add_argument('--name', required=True, help='base name the rig used for its files')
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--stem', required=True, help='archive file name, ending in .zip')
    args = parser.parse_args()
    if Path(args.stem).name != args.stem or not args.stem.endswith('.zip'):
        raise ValueError('--stem must be a bare file name ending in .zip')

    report = json.loads((args.cad / 'cad-validation.json').read_text())
    if not report.get('geometric_validation_passed') or report.get('complete_spec') is False:
        raise ValueError('the CAD package is incomplete or failed validation')
    for name, record in report['files'].items():
        if sha256((args.cad / name).read_bytes()) != record['sha256']:
            raise ValueError('saved CAD file changed after validation: ' + name)
    spec_path = args.study / 'part-spec.json'
    if sha256(json.dumps(json.loads(spec_path.read_text()), sort_keys=True).encode()) != report['spec_sha256']:
        raise ValueError('the specification differs from the one that built the saved CAD')
    glb = args.rig / (args.name + '.glb')
    packed = args.rig / (args.name + '.glb.gz')
    contract_path = args.rig / (args.name + '-contract.json')
    if sha256(gzip.decompress(packed.read_bytes())) != sha256(glb.read_bytes()):
        raise ValueError('the .glb.gz is not the .glb')
    contract = json.loads(contract_path.read_text())
    if contract['asset_sha256'] != sha256(glb.read_bytes()):
        raise ValueError('the contract names a different GLB')
    audit_path = args.study / 'interference-audit.json'
    if audit_path.exists() and json.loads(audit_path.read_text())['asset_sha256'] != sha256(glb.read_bytes()):
        raise ValueError('the interference audit describes a different GLB')
    geometry_hash = report['files']['geometry.json']['sha256']

    files = [args.cad / n for n in ('cad-validation.json', report['model_id'] + '.FCStd', report['model_id'] + '.step', 'geometry.json')]
    files += [p for p in (args.cad / 'engineering-checks.json', args.cad / 'reopen-validation.json') if p.exists()]
    files += [args.rig / (args.name + ext) for ext in ('.blend', '.glb', '.glb.gz', '-contract.json')] + [args.rig / 'blender-verification.json']
    files += [args.study / n for n in STUDY_FILES if (args.study / n).exists()]
    entries = []
    args.output.mkdir(parents=True, exist_ok=True)
    archive = args.output / args.stem
    with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED, compresslevel=6) as z:
        for f in files:
            data = f.read_bytes()
            arcname = ('cad/' if f.parent == args.cad else 'rig/' if f.parent == args.rig else 'study/') + f.name
            entries.append(dict(path=arcname, bytes=len(data), sha256=sha256(data)))
            z.writestr(arcname, data)
        manifest = dict(model_id=report['model_id'], parts=report['part_count'], native_features=report['feature_count'], geometry_sha256=geometry_hash,
                        glb_sha256=contract['asset_sha256'], batched_boolean_runs=report.get('batched_boolean_runs', 0),
                        scope=f"Private native sources of the {report['model_id']} animated reconstruction. The public file is the .glb.gz; editable CAD stays here.", files=entries)
        z.writestr('package-manifest.json', json.dumps(manifest, indent=2) + '\n')
    with zipfile.ZipFile(archive) as z:
        bad = z.testzip()
        if bad:
            raise ValueError('archive CRC failure: ' + bad)
    print(json.dumps(dict(path=str(archive), bytes=archive.stat().st_size, sha256=sha256(archive.read_bytes()), files=len(entries) + 1)))


if __name__ == '__main__':
    main()
