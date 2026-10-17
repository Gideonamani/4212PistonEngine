"""Loopback-only review server. Serves the private candidate, never publishes it."""
from functools import partial
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from pathlib import Path
import argparse
import mimetypes
import subprocess

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'build/gtsio520-animation-review'
THREE=ROOT.parent/'4212PistonEngine/node_modules/three'
WEB=ROOT/'cad_pipeline/review-web'


class Handler(SimpleHTTPRequestHandler):
    def do_POST(self):
        name=self.path.removeprefix('/capture/')
        if name not in ['exploded-layout.webm','collapse-layout.webm','core-cycle.webm']:
            self.send_error(404);return
        length=int(self.headers.get('Content-Length','0'))
        if not 0<length<100_000_000:self.send_error(413);return
        file=OUT/name
        file.write_bytes(self.rfile.read(length))
        result=subprocess.run(['ffmpeg','-y','-i',str(file),'-c:v','libx264','-crf','20','-preset','fast','-pix_fmt','yuv420p','-r','30','-fps_mode','cfr','-movflags','+faststart',str(file.with_suffix('.mp4'))],
            capture_output=True,creationflags=subprocess.CREATE_NO_WINDOW,timeout=120)
        self.send_response(200 if result.returncode==0 else 500);self.end_headers();self.wfile.write(b'Saved locally')

    def do_GET(self):
        path=self.path.split('?',1)[0]
        if path=='/review.glb':
            file=OUT/'gtsio520-r10-animated-review.glb.gz'
            if not file.is_file():self.send_error(503,'The animation is still baking');return
            self.send_response(200);self.send_header('Content-Type','model/gltf-binary');self.send_header('Content-Encoding','gzip')
            self.send_header('Content-Length',str(file.stat().st_size));self.end_headers()
            with file.open('rb') as stream:self.copyfile(stream,self.wfile)
            return
        if path=='/review-contract.json':file=OUT/'review-contract.json'
        elif path.startswith('/vendor/three/'):
            file=(THREE/path.removeprefix('/vendor/three/')).resolve()
            if not file.is_relative_to(THREE.resolve()):self.send_error(403);return
        else:
            file=(WEB/(path.lstrip('/') or 'index.html')).resolve()
            if not file.is_relative_to(WEB.resolve()):self.send_error(403);return
        if not file.is_file():self.send_error(404);return
        self.send_response(200);self.send_header('Content-Type',mimetypes.guess_type(file.name)[0] or 'application/octet-stream')
        self.send_header('Content-Length',str(file.stat().st_size));self.end_headers()
        with file.open('rb') as stream:self.copyfile(stream,self.wfile)


if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--port',type=int,default=8766);a=p.parse_args()
    print(f'Private R10 review: http://127.0.0.1:{a.port}',flush=True)
    ThreadingHTTPServer(('127.0.0.1',a.port),Handler).serve_forever()
