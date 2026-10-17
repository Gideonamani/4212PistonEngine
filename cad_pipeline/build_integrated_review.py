"""Hash-bound full-engine views and a local engineering review."""
import argparse
import hashlib
import html
import json
from pathlib import Path
from cad_pipeline.saved_native_stock import file_sha


def read(path):
    return json.loads(path.read_text(encoding='utf-8'))


def write(path,data):
    path.write_text(json.dumps(data,indent=2)+'\n',encoding='utf-8')


def prepare(root):
    spec=read(root/'part-spec.json');parts=spec['parts']
    folder=root/'views';folder.mkdir(exist_ok=True)
    common=dict(width=1200,height=1000,center_mm=[0,-5,270],up=[0,1,0],landmarks_mm={},ortho_scale_mm=1450)
    full=dict(common,part_ids=[p['id'] for p in parts],direction=[-.85,.58,-1])
    write(folder/'full-plan.json',full)
    groups={'crankshaft','camshaft','cam_drive','front_drive','propeller_shaft','reduction_retention',
            'propeller_oil_transfer','rear_idler','magneto_drives','fuel_drive','oil_pump','scavenge_pump',
            'starter_drive','governor_drive','tach_drive','h_accessory_drive','h_accessory_bearings','alternator_drive'}
    hidden={'OilPumpHousing','ScavengePumpBody','ScavengePumpCover','OilPumpMountGasket',
            'LeftMagnetoAdapter','RightMagnetoAdapter','LeftMagnetoAdapterGasket','RightMagnetoAdapterGasket',
            'FuelMountGasket','IdlerSupportGasket','StarterSimplifiedShell','TachOutputSeal'}
    internal=dict(common,part_ids=[p['id'] for p in parts if p['group'] in groups and p['id'] not in hidden],direction=[.85,.58,-1])
    write(folder/'internal-plan.json',internal)
    write(folder/'view-plan-source.json',dict(spec_sha256=file_sha(root/'part-spec.json'),all_parts=len(parts),internal_parts=len(internal['part_ids']),scope='Fixed cameras, actual assembled CAD coordinates; internal view hides stationary housings and cylinders'))
    print('INTEGRATED_VIEWS_PREPARED',len(parts),flush=True)


def finalize(root):
    spec=read(root/'part-spec.json');cad=root/'cad';report=read(cad/'cad-validation.json')
    native=cad/(spec['model_id']+'.FCStd');native_sha=file_sha(native);spec_sha=file_sha(root/'part-spec.json')
    if 'oil_lifter_boss_wall' not in spec['parameters']:
        raise ValueError('Earlier case has known open lifter-guide walls; restore guide bosses and verify installed oil-space stock before mechanical presentation')
    for name,record in report['files'].items():
        if file_sha(cad/name)!=record['sha256']:raise ValueError('Changed native package: '+name)
    reopen=read(cad/'reopen-validation.json');interfaces=read(cad/'interface-checks.json');pairs=read(cad/'saved-shape-checks.json')
    installed=read(cad/'integrated-drive-checks.json')
    galleries=read(cad/'gallery-checks.json')
    if not galleries['passed'] or galleries['source'].get('native_sha256')!=native_sha or galleries['spec_sha256']!=spec_sha:raise ValueError('Current installed twelve-guide and gallery stock/fluid checks required')
    if 'bearing_web_profile_scale' in spec['parameters']:
        support=read(cad/'bearing-support-checks.json')
        if not support['passed'] or support['source']['native_sha256']!=native_sha or support['spec_sha256']!=spec_sha:raise ValueError('Current complete bearing-seat support checks required')
    else:
        raise ValueError('Legacy integration has known erased bearing webs; repair and measure support before presenting mechanical acceptance')
    if not all(r['passed'] for r in [reopen,interfaces,pairs,installed]):raise ValueError('Unresolved native integration gate')
    for r in [interfaces,pairs,installed]:
        if r['native_sha256']!=native_sha or r['spec_sha256']!=spec_sha:raise ValueError('Stale saved checks')
    source=read(root/'views/view-plan-source.json')
    if source['spec_sha256']!=spec_sha or source['all_parts']!=len(spec['parts']):raise ValueError('Stale view plan')
    renders={kind:read(root/'views'/kind/'render.json') for kind in ['full','internal']}
    for kind,r in renders.items():
        if r['geometry_sha256']!=file_sha(cad/'geometry.json') or r['image_sha256']!=file_sha(root/'views'/kind/'candidate.png') or r['plan_sha256']!=file_sha(root/'views'/(kind+'-plan.json')):raise ValueError('Stale integration render')
    exported=root/'views/full/development-diagnostic.glb';mesh=read(root/'views/full/interference-audit.json')
    if not mesh['clean'] or mesh['asset_sha256']!=file_sha(exported) or mesh['parts']!=len(spec['parts']):raise ValueError('Current complete export audit required')
    face=root/'face-pair-r3';face_checks=read(face/'native-checks.json')
    face_spec=read(face/'source-part-spec.json')
    face_native=face/'native'/(face_spec['model_id']+'.FCStd')
    face_step=face/'native'/(face_spec['model_id']+'.step')
    if (not face_checks['passed'] or face_checks['spec_sha256']!=file_sha(face/'source-part-spec.json')
            or face_checks['native_sha256']!=file_sha(face_native)
            or face_checks['step_sha256']!=file_sha(face_step)):
        raise ValueError('Current complete face-pair native, edit, STEP and pitch evidence required')
    adoption=read(root/'development/face-cache-adoption.json')
    face_ids={'AlternatorFaceGear','AlternatorDrivenGear'}
    face_agreements=adoption['scoped_direct_agreements']
    if (adoption['base_native_sha256']!=face_checks['native_sha256']
            or adoption['base_spec_sha256']!=hashlib.sha256(json.dumps(face_spec,sort_keys=True).encode()).hexdigest()
            or adoption['new_spec_sha256']!=hashlib.sha256(json.dumps(spec,sort_keys=True).encode()).hexdigest()
            or len(adoption['adopted'])!=2 or {row['id'] for row in adoption['adopted']}!=face_ids
            or len(face_agreements)!=2 or {row['id'] for row in face_agreements}!=face_ids
            or not all(row['passed'] for row in face_agreements)):
        raise ValueError('Checked face-pair construction must be bound to this engine specification')
    e=html.escape
    page=f'''<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>GTSIO-520-H full-engine integration</title><style>body{{margin:0;background:#edf2f6;color:#192b3b;font:17px/1.55 system-ui}}main{{max-width:1200px;margin:auto;padding:28px}}img{{width:100%}}.gallery{{display:grid;grid-template-columns:repeat(auto-fit,minmax(380px,1fr));gap:18px}}figure,.notice{{margin:0;background:white;padding:18px}}table{{border-collapse:collapse;width:100%}}td,th{{border:1px solid #aabaca;padding:10px;text-align:left;vertical-align:top}}a{{color:#15577d}}</style><main><h1>GTSIO-520-H — integrated static engine</h1><p class="notice">{e(spec['scope'])}</p><p>{len(spec['parts']):,} separate saved native parts. STEP re-read, {len(interfaces['checks'])} fitted interface checks, installed governor/tach checks and {pairs['pairs']:,} actual neighboring native pairs passed. The current complete GLB also passed its {mesh['rest_neighbouring_pairs']:,} neighboring mesh checks. These gates establish the checked geometry, not OEM dimensional authentication or operating-load acceptance.</p><div class="gallery"><figure><a href="views/full/candidate.png"><img src="views/full/candidate.png" alt="Current complete static engine"></a><figcaption>Complete assembled engine. External casting contours and several systems remain development geometry.</figcaption></figure><figure><a href="views/internal/candidate.png"><img src="views/internal/candidate.png" alt="Current internal engine drives"></a><figcaption>Actual assembled drive parts, with cases, cylinders and selected stationary housings hidden.</figcaption></figure></div><h2>Comparison with the original construction</h2><p><a href="../gtsio520-geartrain-review/oem-gear-train-full.png">OEM A-4-8 gear-train diagram</a> · <a href="../gtsio520-governor-r3/review.html">Governor source comparison</a> · <a href="../gtsio520-tach-r1/review.html">Tachometer source comparison</a>. These illustrations and CAD cameras are unregistered; no numerical resemblance score is claimed.</p><table><tr><th>Branch</th><th>Current geometry and remaining source questions</th></tr><tr><td>Governor</td><td>Installed cam key, bevel pair, continuous output journal, shoulder, recessed end and case guide/pad. End profile, retention and oil routing remain estimates or incomplete.</td></tr><tr><td>Tachometer</td><td>Installed oil-shaft extension, equal-ratio bevel pair, supported dowels, output guide/seal and separate cover hardware. The lateral installation and external cover contour need stronger H-specific evidence.</td></tr><tr><td>H accessory route</td><td>Manufacturer MSB94-4G identifies independent coaxial accessory and magneto gears with needle bearings. The installed static model now includes separate shafts, gears, needle rows and pad envelopes. Counts and packaging remain estimates; complete physical operating direction remains unresolved.</td></tr><tr><td>Alternator</td><td>OEM A-4-20/A-4-33 place a separate face gear on the reduction-pinion hub flange. The model includes a complete generated60-slot ring, driven gear, separate bush/spring/keyed hub and a four-lug mount with simplified machine shell. Counts and dimensions are estimates; spring hand, preload and torque engagement remain unresolved.</td></tr><tr><td>Lubrication</td><td>Pressure/scavenge gears, separate relief parts, front cam transfer and calculated case galleries are installed. Twelve lifter guides, trunk wall stock and the declared main/cam feed domain pass the current native checks. External filter/cooler and turbo/accessory branches, full crankshaft drillings, bypass details and hydraulic capacity remain incomplete.</td></tr></table><p>Incremental native audit: {pairs.get('pairs_reused',0):,} exact prior pair results reused; changed geometry and new neighbors are checked again. Unchanged recipes alone do not authorize reuse of intersections.</p><p><a href="cad/{spec['model_id']}.FCStd">Editable FreeCAD engine</a> · <a href="cad/{spec['model_id']}.step">STEP</a> · <a href="views/full/development-diagnostic.glb">Complete static GLB</a> · <a href="cad/saved-shape-checks.json">Native pair evidence</a> · <a href="cad/integrated-drive-checks.json">Installed drive measurements</a> · <a href="views/full/interference-audit.json">Export audit</a></p></main></html>'''
    page=page.replace('</main>','<p><a href="face-pair-r3/native-checks.json">Complete face-pair pitch evidence</a> · <a href="cad/gallery-checks.json">Native gallery and twelve-guide checks</a> · <a href="../gtsio520-alternator-r1/review.html">Alternator source-component comparison</a>. The sampled shaper profile uses a bounded Bezier approximation; tooth counts, module, case support and guide-boss contours remain calculated estimates.</p></main>')
    page=page.replace('</main>','<p>Operating direction remains provisional. The H propeller reference is clockwise looking forward, while accessory labels are viewed facing each pad. Applying one physical crank reference to the complete train needs further governor/tach bevel-orientation review; the earlier isolated positive-phase labels do not establish whole-engine operating direction.</p></main>')
    (root/'review.html').write_text(page,encoding='utf-8')
    # A new session can check every accepted artifact without rebuilding CAD.
    # Workflow status changes after this function returns, so it is checked
    # separately and deliberately excluded from this immutable evidence map.
    paths=[root/'part-spec.json',root/'review.html',root/'development/face-cache-adoption.json',
           face/'source-part-spec.json',face/'direct-checks.json',face/'native-checks.json',face_native,face_step]
    paths.extend(cad/name for name in report['files'])
    paths.extend(cad/name for name in ['cad-validation.json','reopen-validation.json','interface-checks.json',
        'saved-shape-checks.json','bearing-support-checks.json','integrated-drive-checks.json','gallery-checks.json'])
    paths.append(root/'views/view-plan-source.json')
    for kind in ['full','internal']:
        paths.extend(root/'views'/kind/name for name in ['render.json','candidate.png','comparison-view.blend'])
        paths.append(root/'views'/(kind+'-plan.json'))
    paths.extend([exported,root/'views/full/interference-audit.json'])
    evidence={path.relative_to(root).as_posix():dict(bytes=path.stat().st_size,sha256=file_sha(path)) for path in paths}
    write(root/'review-provenance.json',dict(native_sha256=native_sha,spec_sha256=spec_sha,mesh_audit_sha256=file_sha(root/'views/full/interference-audit.json'),native_audit_sha256=file_sha(cad/'saved-shape-checks.json'),review_sha256=file_sha(root/'review.html'),evidence=evidence,scope='Static integration evidence; source resemblance and manufacturing fidelity remain qualified'))
    print('INTEGRATED_REVIEW_COMPLETE',flush=True)


if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--package',type=Path,required=True);parser.add_argument('--prepare',action='store_true');args=parser.parse_args()
    prepare(args.package) if args.prepare else finalize(args.package)
