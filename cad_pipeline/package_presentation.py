"""Named Blender plates -> contact sheet, local gallery and chaptered MP4."""
import argparse,hashlib,html,json,re,shutil,subprocess,math
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont

def main():
    p=argparse.ArgumentParser();p.add_argument('--package',type=Path,required=True);p.add_argument('--skip-video',action='store_true');a=p.parse_args();folder=a.package.resolve()
    manifest=json.loads((folder/'presentation-manifest.json').read_text());entries=manifest['tour'];sheet=Image.new('RGB',(2000,150+350*math.ceil(len(entries)/4)),'#121e2c');d=ImageDraw.Draw(sheet)
    fontfile='C:/Windows/Fonts/segoeui.ttf';titlefont=ImageFont.truetype(fontfile,46);font=ImageFont.truetype(fontfile,19)
    d.text((45,25),'Wright engine - components and mechanisms',fill='white',font=titlefont);d.text((45,86),'Source-led static CAD study | Documented construction; manufacturing dimensions include estimates',fill='#aebed0',font=font)
    cards=[]
    for i,entry in enumerate(entries):
        filename=entry['image'];file=(folder/filename).resolve()
        if file.parent!=folder or file.suffix!='.png':raise ValueError('Unsafe image path')
        image=Image.open(file);image.thumbnail((480,320));x=15+(i%4)*500;y=130+(i//4)*350;sheet.paste(image,(x,y));d.text((x+8,y+318),entry['title'],fill='white',font=font)
        labels='<details><summary>'+str(len(entry['parts']))+' named CAD parts</summary><ul>'+''.join('<li>'+html.escape(label)+'</li>' for label in entry.get('labels',entry['parts']))+'</ul></details>'
        cards.append('<article id="'+html.escape(entry['group'])+'"><h2>'+html.escape(entry['title'])+'</h2><a href="'+html.escape(filename)+'"><img src="'+html.escape(filename)+'" alt="'+html.escape(entry['title'])+'"></a>'+labels+'</article>')
    sheet.save(folder/'component-sheet.jpg',quality=94)
    nav=' '.join('<a href="#'+html.escape(e['group'])+'">'+html.escape(e['title'])+'</a>' for e in entries)
    page='''<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Wright engine reconstruction</title><style>body{margin:0;background:#121e2c;color:#e6edf5;font:17px/1.55 system-ui}main{max-width:1200px;margin:auto;padding:36px 24px}h1{font-size:40px}h2{font-size:23px}a{color:#a2cfff}nav{display:flex;flex-wrap:wrap;gap:12px}nav a{padding:8px;background:#24374a;border-radius:6px}section{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:28px}img,video{width:100%;border-radius:10px}article{scroll-margin-top:24px;background:#1c2a3a;padding:18px;border-radius:14px}article p{color:#afc0d1}header{margin-bottom:30px}</style><main><header><h1>Wright engine reconstruction</h1><p>'''+str(manifest['parts'])+''' editable CAD parts, grouped into focused component views. This first teaching candidate combines the museum scan with documented nominal dimensions and clearly recorded estimates.</p><p><a href="../cad/wright-1903-reconstruction.FCStd">FreeCAD model</a> · <a href="../cad/wright-1903-reconstruction.step">STEP</a> · <a href="wright-1903-reconstruction.blend">Blender tour</a> · <a href="component-sheet.jpg">Component sheet</a></p><video controls preload="metadata" poster="overview.png" src="component-tour.mp4"></video></header><nav>'''+nav+'</nav><section>'+''.join(cards)+'</section></main></html>'
    (folder/'index.html').write_text(page,encoding='utf-8')
    # Resolve native links from the actual model ID, including later revisions.
    model=manifest.get('model_id','wright-1903-reconstruction');page=page.replace('wright-1903-reconstruction',model)
    page=page.replace('This first teaching candidate combines the museum scan with documented nominal dimensions and clearly recorded estimates.',html.escape(manifest.get('scope','Teaching reconstruction with estimated dimensions.')))
    if (folder.parent/'research/img009.jpg').exists():
        sources='<article><h2>Source comparison</h2><p><a href="https://www.gutenberg.org/files/38739/38739-h/38739-h.htm">Hobbs monograph</a> · <a href="../review.html">Research, coverage and validation</a></p><p>Compare construction with the source cutaway and section. These illustrations do not certify manufacturing dimensions.</p><a href="../research/img009.jpg"><img src="../research/img009.jpg" alt="Hobbs Figure 5 assembly cutaway"></a><a href="../research/img010.jpg"><img src="../research/img010.jpg" alt="Hobbs Figure 6 cylinder and rocker cross-section"></a></article>'
        page=page.replace('</section>',sources+'</section>')
    (folder/'index.html').write_text(page,encoding='utf-8')
    if not a.skip_video:
        ffmpeg=shutil.which('ffmpeg')
        if not ffmpeg:raise RuntimeError('ffmpeg missing; use --skip-video for gallery only')
        listing=''.join("file '"+e['image']+"'\nduration 3\n" for e in entries)+"file '"+entries[-1]['image']+"'\n"
        (folder/'tour-frames.txt').write_text(listing)
        def escape(s):return re.sub(r'([\\=;#\n])',r'\\\1',s)
        chapters=';FFMETADATA1\ntitle=Wright engine component identification\n'+''.join('[CHAPTER]\nTIMEBASE=1/1000\nSTART='+str(i*3000)+'\nEND='+str((i+1)*3000)+'\ntitle='+escape(e['title'])+'\n' for i,e in enumerate(entries))
        (folder/'tour-chapters.txt').write_text(chapters)
        subprocess.run([ffmpeg,'-hide_banner','-loglevel','error','-y','-f','concat','-safe','0','-i',str(folder/'tour-frames.txt'),'-i',str(folder/'tour-chapters.txt'),'-map','0:v','-map_metadata','1','-map_chapters','1','-vf','scale=1280:-2','-r','24','-t',str(3*len(entries)),'-c:v','libx264','-preset','fast','-crf','22','-pix_fmt','yuv420p','-movflags','+faststart',str(folder/'component-tour.mp4')],check=True)
        subprocess.run([ffmpeg,'-v','error','-i',str(folder/'component-tour.mp4'),'-f','null','-'],check=True)
    files={f.name:dict(bytes=f.stat().st_size,sha256=hashlib.sha256(f.read_bytes()).hexdigest()) for f in folder.iterdir() if f.name in ('index.html','component-sheet.jpg','component-tour.mp4')}
    (folder/'gallery-manifest.json').write_text(json.dumps(dict(files=files,video_seconds=3*len(entries),scope='Static component identification plates; no mechanism simulation'),indent=2)+'\n');print('GALLERY_COMPLETE')
if __name__=='__main__':main()
