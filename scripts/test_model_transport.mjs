import test from 'node:test';
import assert from 'node:assert/strict';
import {gzipSync} from 'node:zlib';
import {decodeModel} from '../web/model-transport.mjs';
const arrayBuffer=b=>b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength);
function model(length=64){const b=new ArrayBuffer(length),v=new DataView(b);v.setUint32(0,0x46546c67,true);v.setUint32(4,2,true);v.setUint32(8,length,true);return b;}
test('plain and gzip transfer preserve exactly the same GLB bytes',async()=>{
 const original=model();
 assert.equal(await decodeModel(original),original);
 assert.deepEqual(await decodeModel(arrayBuffer(gzipSync(new Uint8Array(original)))),original);
});
test('invalid, incomplete, corrupted and oversized downloads fail before GLTF loading',async()=>{
 await assert.rejects(decodeModel(new TextEncoder().encode('<html>Login required</html>').buffer),/not a GLB/);
 await assert.rejects(decodeModel(model().slice(0,40)),/complete GLB/);
 const packed=gzipSync(new Uint8Array(model()));packed[packed.length-5]^=255;
 await assert.rejects(decodeModel(arrayBuffer(packed)));
 await assert.rejects(decodeModel(arrayBuffer(gzipSync(new Uint8Array(model(1024)))),{maxBytes:128}),/exceeds/);
});
test('cancellation before and during decompression stops the load',async()=>{
 const before=new AbortController();before.abort();
 await assert.rejects(decodeModel(model(),{signal:before.signal}),{name:'AbortError'});
 const active=new AbortController();
 await assert.rejects(decodeModel(arrayBuffer(gzipSync(new Uint8Array(model(1024*1024)))),{
  signal:active.signal,onProgress:()=>active.abort()
 }),{name:'AbortError'});
});
