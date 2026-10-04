"""Publish a local research/coverage review beside the CAD presentation.

Run with a Python environment providing Python-Markdown. Native CAD remains
the geometry authority; this page exposes the dossier and bounded checks.
"""
import argparse,html,json,shutil
from pathlib import Path
import markdown

def main():
    p=argparse.ArgumentParser();p.add_argument('--study',type=Path,required=True);p.add_argument('--package',type=Path,required=True);a=p.parse_args();study=a.study;folder=a.package
    def read(path):return json.loads(path.read_text())
    inv=read(study/'inventory.json');cad=read(folder/'cad/cad-validation.json');checks=read(folder/'cad/engineering-checks.json');reopen=read(folder/'cad/reopen-validation.json');blend=read(folder/'presentation/blender-validation.json')
    if not all((cad['geometric_validation_passed'],checks['passed'],reopen['passed'],blend['passed'])):raise ValueError('Incomplete validation; review candidate cannot claim ready')
    export=folder/'study';export.mkdir(exist_ok=True)
    for file in study.iterdir():
        if file.suffix in ('.md','.json'):shutil.copy2(file,export/file.name)
    escape=html.escape
    rows=''.join('<tr><td>'+escape(c['id'])+'</td><td><strong>'+escape(c['name'])+'</strong><br>'+escape(c['function'])+'</td><td>'+escape(c['interfaces'])+'</td><td>'+escape(c['disposition'])+'<br>'+escape(c['decision'])+'</td><td>'+escape(c['locator'])+'<br>'+escape(', '.join(c['part_ids']))+'</td></tr>' for c in inv['components'])
    testrows=''.join('<tr><td>'+escape(c['check'])+'</td><td>'+('Passed' if c['passed'] else 'Failed')+'</td></tr>' for c in checks['checks'])
    residuals=''.join('<tr><td>'+str(r['cylinder'])+'</td><td>'+format(r['center_deviation_mm'],'.2f')+'</td><td>'+format(r['radius_deviation_mm'],'.2f')+'</td><td>'+format(r['mesh_fit_rms_mm'],'.2f')+'</td></tr>' for r in checks['source_alignment']['regions'])
    unresolved=''.join('<li><strong>'+escape(n['topic'])+'</strong> — '+escape(n['reason'])+'</li>' for n in checks['unresolved'])
    dossier=markdown.markdown((study/'research.md').read_text(),extensions=['tables','fenced_code'])
    page='''<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Wright engine research revision 2</title><style>body{margin:0;background:#f4f5f7;color:#182332;font:17px/1.55 system-ui}main{max-width:1200px;margin:auto;padding:40px 24px}a{color:#145995}h1{font-size:36px}h2{margin-top:45px}table{border-collapse:collapse;width:100%;font-size:14px;display:block;overflow:auto}td,th{padding:10px;text-align:left;border:1px solid #ccd3dc;vertical-align:top}th{background:#dfe9f2}tr:nth-child(even){background:#eaf0f5}code{overflow-wrap:anywhere}summary{font-size:22px;cursor:pointer;padding:12px;background:#dfe9f2}img{max-width:100%}.notice{padding:18px;background:#e1edf7;border-left:5px solid #33628c}nav{display:flex;gap:18px;flex-wrap:wrap}</style><main><h1>Wright engine — research revision 2</h1><nav><a href="presentation/index.html">Component gallery and tour</a><a href="study/research.md">Research dossier</a><a href="study/inventory.json">Source inventory</a><a href="cad/engineering-checks.json">Measured checks</a><a href="cad/reopen-validation.json">CAD/STEP round trip</a><a href="presentation/blender-validation.json">Blender/GLB round trip</a></nav>'''
    page+='<p class="notice">'+str(cad['part_count'])+' editable engineering parts; '+str(cad['feature_count'])+' native feature operations; '+str(len(blend['tour']))+' named inspection views. Target: surviving rebuilt horizontal engine, Science Museum construction lineage. Manufacturing dimensions include estimates. The oil-pump drive is deferred; chain operation and dynamic timing remain unverified.</p>'
    page+='<h2>Research-led design</h2><p>All 47 keyed Figure 5 callouts and 11 supplemental items have an explicit disposition. Fifty-five are simplified, one drive is deferred, and two service-equipment items are outside the cropped assembly. A coverage pass accounts for source items; it does not certify authentic geometry.</p><img src="presentation/cylinder-section.png" alt="Native CAD-derived first-cylinder section"><p>Section copies are derived from native CAD and excluded from engineering STEP/GLB part counts. Compare <a href="research/img010.jpg">Hobbs Figure 6</a> and <a href="research/img009.jpg">Figure 5</a>.</p>'
    page+='<details open><summary>Detailed source interpretation and decisions</summary>'+dossier+'</details><h2>Complete source-to-CAD inventory</h2><table><tr><th>Key</th><th>Component / role</th><th>Interfaces</th><th>Disposition / decision</th><th>Locator / CAD identities</th></tr>'+rows+'</table>'
    page+='<h2>Bounded saved-geometry checks</h2><p>'+str(len(checks['checks']))+' static checks passed. Reopened FCStd and STEP contain '+str(reopen['parts'])+' engineering solids. STEP aggregate relative volume error: '+format(reopen['relative_volume_error'],'.3g')+'. Blender/GLB bounds difference: '+format(blend['bounds_roundtrip_error_m'],'.3g')+' m.</p><details><summary>Measured check list</summary><table>'+testrows+'</table></details>'
    if reopen.get('step_boundary_exception'):
        exception=reopen['step_boundary_exception']
        page+='<p class="notice">The original 0.01% per-solid STEP volume check failed for four ported valve boxes (maximum approximately 0.019%). They were accepted under an explicit exception bound to these saved files: identical optimal bounds and face/vertex counts; bidirectional sampled boundary discrepancy '+format(exception['measured_maximum_sampled_boundary_error_mm'],'.3g')+' mm. Numerical mass integration is the working explanation. Sampling does not prove continuous boundary equivalence. See <a href="study/validation-history.md">validation history</a>, <a href="cad/step-differences.json">original volume failure</a> and <a href="cad/step-boundary-checks.json">boundary evidence</a>.</p>'
    page+='<h2>Limited mesh correspondence</h2><p>Four exterior valve-box regions at an inferred scale. Center offsets below remain visible; no whole-mesh fit or recovered hidden geometry is claimed.</p><table><tr><th>Cylinder</th><th>Center offset mm</th><th>Radius offset mm</th><th>Mesh fit RMS mm</th></tr>'+residuals+'</table><h2>Unresolved engineering questions</h2><ul>'+unresolved+'</ul></main></html>'
    (folder/'review.html').write_text(page,encoding='utf-8');print('REVIEW_COMPLETE')
if __name__=='__main__':main()
