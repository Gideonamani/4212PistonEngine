"""Package a checked local core review without publishing or rebinding the viewer."""
import argparse
import hashlib
import html
import json
import shutil
from pathlib import Path
import markdown


def main():
    parser=argparse.ArgumentParser();parser.add_argument('--package',type=Path,default=Path('build/gtsio520-realism-r4'))
    parser.add_argument('--study',type=Path,default=Path('cad-studies/gtsio520-h-realism'))
    a=parser.parse_args();read=lambda p:json.loads(p.read_text())
    cad=read(a.package/'cad/cad-validation.json');saved=read(a.package/'cad/reopen-validation.json')
    engineering=read(a.package/'cad/engineering-checks.json');blend=read(a.package/'presentation/blender-validation.json')
    interference=read(a.study/'interference-audit.json');sp=read(a.study/'part-spec.json')
    assert cad['geometric_validation_passed'] and saved['passed'] and engineering['passed'] and blend['passed'] and interference['clean']
    asset=a.package/'presentation'/f"{cad['model_id']}.glb"
    assert hashlib.sha256(asset.read_bytes()).hexdigest()==interference['asset_sha256']
    assert engineering['native_sha256']==cad['files'][cad['model_id']+'.FCStd']['sha256']
    assert cad['spec_sha256']==hashlib.sha256(json.dumps(sp,sort_keys=True).encode()).hexdigest()
    readiness=read(a.study/'research-readiness.json');assert readiness['coverage_checked']
    resemblance=read(a.study/'crankshaft-match-findings.json') if (a.study/'crankshaft-match-findings.json').exists() else None
    visible=read(a.package/'cad/visible-feature-checks.json') if (a.package/'cad/visible-feature-checks.json').exists() else None
    if visible:assert visible['passed'] and visible['native_sha256']==engineering['native_sha256']
    crank=read(a.package/'cad/crankshaft-checks.json') if (a.package/'cad/crankshaft-checks.json').exists() else None
    if crank:assert crank['passed'] and crank['native_sha256']==engineering['native_sha256']
    result=dict(date='2026-10-08',model_id=cad['model_id'],parts=cad['part_count'],features=cad['feature_count'],
                static_candidate_accepted=True,whole_engine_complete=False,operating_motion_validated=False,
                source_resemblance_review=resemblance,visible_feature_checks=visible,crankshaft_rebuild_checks=crank,
                sources=read(a.study/'source-manifest.json'),validation={'native':cad,'roundtrip':saved,'engineering':engineering,'blender':blend,'interference':interference},
                files={str(p.relative_to(a.package)).replace('\\','/'):dict(bytes=p.stat().st_size,sha256=hashlib.sha256(p.read_bytes()).hexdigest())
                       for p in a.package.rglob('*') if p.is_file() and p.suffix in ('.FCStd','.step','.blend','.glb','.png') and 'dev' not in p.parts})
    (a.study/'acceptance.json').write_text(json.dumps(result,indent=2)+'\n')
    for name,source in [('cad-validation.json',a.package/'cad/cad-validation.json'),('reopen-validation.json',a.package/'cad/reopen-validation.json'),
                        ('engineering-checks.json',a.package/'cad/engineering-checks.json'),('blender-validation.json',a.package/'presentation/blender-validation.json')]:
        shutil.copy2(source,a.study/name)
    if visible:shutil.copy2(a.package/'cad/visible-feature-checks.json',a.study/'visible-feature-checks.json')
    if crank:shutil.copy2(a.package/'cad/crankshaft-checks.json',a.study/'crankshaft-checks.json')
    # Research summaries only: no redistributed source manuals.
    (a.package/'study').mkdir(exist_ok=True)
    for source in a.study.iterdir():
        if source.suffix in ('.md','.json'):shutil.copy2(source,a.package/'study'/source.name)
    inv=read(a.study/'inventory.json');escape=html.escape
    rows=''.join(f'<tr><td>{escape(c["id"])}</td><td>{escape(c["name"])}</td><td>{escape(c["disposition"])}</td><td>{escape(", ".join(c["part_ids"]))}</td></tr>' for c in inv['components'])
    dossier=markdown.markdown((a.study/'research.md').read_text(),extensions=['tables'])
    page=f'''<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>GTSIO-520-H realism core review</title><style>body{{margin:0;background:#12212c;color:#e1eaf0;font:16px/1.6 system-ui}}main{{max-width:1100px;margin:auto;padding:30px 22px}}h1{{font-size:36px;line-height:1.15}}a{{color:#94d1e8}}img{{width:100%;background:#1c2a36;border-radius:12px}}.note{{border-left:4px solid #7dc4bc;padding:12px 20px;background:#1a303a}}.grid{{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:20px}}table{{border-collapse:collapse;width:100%;font-size:14px}}td,th{{border:1px solid #455767;padding:8px;text-align:left;vertical-align:top}}details{{margin:22px 0}}summary{{cursor:pointer;font-size:20px}}code{{overflow-wrap:anywhere}}.scroll{{overflow:auto}}</style>
<main><p>REALISM REVISION {cad['model_id'].rsplit('-v',1)[-1]} / 8 OCTOBER 2026</p><h1>Continental GTSIO-520-H<br>The rebuilt crankshaft and rotating core</h1>
<p class="note">{cad['part_count']} editable CAD solids / {cad['feature_count']} native feature operations. Static interfaces, saved dimensions, STEP and GLB checks passed. Estimated contours and axial spacing remain explicit. This is the first module of the engine rebuild; no operating clip or complete-engine fidelity claim.</p>
<p class="note">Calculated estimates now drive eighteen native root blends, thinner blades and paired host bores, inclined webs contained inside the cheek stations, and twelve closed pin-end recesses. Split bearing liners receive matching edge relief. Exact contours, axial calibration, damper fork fit, quill splines and hidden drilling remain uncertain. <a href="study/crankshaft-estimation.md">Calculations and limits</a> · <a href="../gtsio520-image-match/review.html">Source / before / rebuilt comparison</a></p>
<p><a href="cad/{cad['model_id']}.FCStd">Editable FreeCAD assembly</a> · <a href="cad/{cad['model_id']}.step">STEP</a> · <a href="presentation/{cad['model_id']}.blend">Blender inspection scene</a> · <a href="study/acceptance.json">Acceptance record</a></p>
<img src="presentation/overview.png" alt="Six-cylinder rotating core overview"><div class="grid">
<div><h2>Forging and crankpins</h2><img src="presentation/crankshaft.png" alt="Six-throw forging"></div>
<div><h2>Rod and bearing structure</h2><img src="presentation/structure.png" alt="Rods and bearing interfaces"></div></div>
<h2>What is next</h2><p>Refine axial calibration, shaft ends/quill and counterweight hardware; then build the split crankcase, main-bearing support and reduction interfaces around this datum. Integrate the reviewed cylinder module and full valve train; follow with H-specific induction, turbo, ignition, fuel and oil systems. Each stage requires source comparison and its own static and motion audits.</p>
<details><summary>Research and accuracy boundaries</summary>{dossier}</details>
<details><summary>All 93 source callouts</summary><div class="scroll"><table><tr><th>Figure item</th><th>Identity</th><th>Disposition</th><th>Generated solids</th></tr>{rows}</table></div></details></main></html>'''
    (a.package/'review.html').write_text(page,encoding='utf-8')
    print(json.dumps(dict(review=str(a.package/'review.html'),accepted=True,parts=cad['part_count'],features=cad['feature_count']),indent=2))


if __name__=='__main__':main()
