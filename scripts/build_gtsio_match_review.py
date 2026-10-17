"""Human-facing original/before/after plate and CAD operation findings."""
import hashlib
import html
import json
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont


def main():
    root=Path(__file__).resolve().parents[1];folder=root/'build/gtsio520-image-match';study=root/'cad-studies/gtsio520-h-realism'
    rebuilt=(folder/'rebuilt/comparison/comparison.json').exists()
    phases=('reasoned','rebuilt') if rebuilt else ('after','reasoned')
    before=json.loads((folder/phases[0]/'comparison/comparison.json').read_text());after=json.loads((folder/phases[1]/'comparison/comparison.json').read_text())
    assert before['reference']['sha256']==after['reference']['sha256']
    assert before['transform_candidate_crop_to_reference_crop']==after['transform_candidate_crop_to_reference_crop']
    raw=Image.open(after['reference']['path']).convert('RGB');reference=raw.crop(after['reference']['crop'])
    images=[reference]+[Image.open(folder/phase/'comparison/registered-candidate.png').convert('RGB') for phase in phases]
    board=Image.new('RGB',(reference.width*3,reference.height+65),'white');draw=ImageDraw.Draw(board)
    font=ImageFont.truetype('C:/Windows/Fonts/segoeui.ttf',24)
    titles=['ORIGINAL DRAWING / PART 41','REVISION 3 / BEFORE REBUILD','REVISION 4 / CALCULATED ESTIMATES'] if rebuilt else ['ORIGINAL DRAWING / PART 41','REVISION 2 / OUTLINE AND FEATURES','REVISION 3 / DESIGN REASONING']
    for k,(title,im) in enumerate(zip(titles,images)):
        board.paste(im,(k*reference.width,65));draw.text((k*reference.width+15,17),title,fill='#26384a',font=font)
    plate='calculated-rebuild-before-after.png' if rebuilt else 'design-reasoning-before-after.png'
    board.save(folder/plate)
    package='gtsio520-realism-r4' if rebuilt else 'gtsio520-realism-r3'
    calculation_note='crankshaft-estimation.md' if rebuilt else 'design-learning.md'
    summary=('Revision 4 rebuilds the forging with eighteen native root blends, twelve estimated blind pin-end recesses, calculated blade/bore envelopes and taper wholly inside the cheek stations. Main/pin root radii are about 1.50/1.71 mm; blades are 8.4 mm in 14 mm cheeks. The twelve split liners receive matching edge relief. These are calculated teaching estimates. Exact axial calibration, damper fork fit, quill splines and hidden drilling remain unresolved.' if rebuilt else
             'Revision 3 reasons from the counterweight fork and machined interfaces: thinner centred blades, inclined native webs and retained lands. Dimensions remain estimated; further fidelity work remains.')
    findings=json.loads((study/'crankshaft-match-findings.json').read_text());e=html.escape
    rows=''.join(f'<tr><td><strong>{e(f["id"]+" / "+f["feature"])}</strong><br>{e(f["observation"])}</td><td>{e(f["operation"])}</td><td>{e(f["dimension_provenance"])}</td><td>{e(f["disposition"])}</td></tr>' for f in findings['findings'])
    page=f'''<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Crankshaft source comparison</title>
<style>body{{margin:0;background:#f4f6f8;color:#223343;font:17px/1.55 system-ui}}main{{max-width:1400px;margin:auto;padding:35px 22px}}img{{width:100%}}h1{{font-size:36px;line-height:1.15}}a{{color:#165e87}}.note{{padding:18px;background:#e2ecf2;border-left:4px solid #37627d}}.scroll{{overflow:auto}}table{{width:100%;border-collapse:collapse;font-size:14px}}td,th{{border:1px solid #becbd5;padding:12px;text-align:left;vertical-align:top}}</style>
<main><p>IMAGE MATCHER / FIRST GTSIO-520-H APPLICATION</p><h1>Crankshaft resemblance review</h1>
<p class="note">{summary}</p>
<a href="{plate}"><img src="{plate}" alt="Original drawing and two CAD revisions in a locked view"></a>
<p>The same orthographic approximation, pose, crop and uniform registration are retained. Two main-journal centres set the alignment; two other centres are held out. Their maximum residual is {after['metrics']['held_out_max_error_px']:.1f} px in both candidates: the added features improve visible construction, not that datum fit. The reference centres have about 8 px interpretation uncertainty and the illustration projection is unknown. No silhouette percentage or machining accuracy is claimed.</p>
<p>The counterweight fork straddles the blade with clearance. The blade stays thinner than the cheek; machined lands retain their stations. The saved geometry is checked independently of the image, alongside static assembly and exported-file checks. <a href="../{package}/study/{calculation_note}">Read the calculations and limits.</a> · <a href="../{package}/study/design-learning.md">Design learning</a></p>
<div class="scroll"><table><tr><th>Observed difference</th><th>Native modelling operation</th><th>Evidence / dimensions</th><th>Current disposition</th></tr>{rows}</table></div>
<p><a href="../{package}/review.html">Rebuilt core, editable CAD and checked exports</a> · <a href="{phases[0]}/comparison/overlay.png">Before overlay</a> · <a href="{phases[1]}/comparison/overlay.png">After overlay</a> · <a href="design-reasoning-before-after.png">Earlier design-reasoning comparison</a></p></main></html>'''
    (folder/'review.html').write_text(page,encoding='utf-8')
    result=dict(status=findings['status'],reference_sha256=after['reference']['sha256'],before_cad=before['cad'],after_cad=after['cad'],
        locked_camera=True,locked_registration=True,metrics=after['metrics'],manufacturing_fidelity_verified=False,
        diagnostic_plate=dict(path=str(folder/plate),sha256=hashlib.sha256((folder/plate).read_bytes()).hexdigest()))
    (study/'crankshaft-image-match.json').write_text(json.dumps(result,indent=2)+'\n')
    print(json.dumps(dict(review=str(folder/'review.html'),source_resemblance_status=findings['status']),indent=2))


if __name__=='__main__':main()
