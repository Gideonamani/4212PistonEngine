// Handle both explicit .glb.gz assets and already-decoded HTTP responses.
export async function decodeModel(bytes,{signal,maxBytes=128*1024*1024,onProgress=()=>{}}={}){
 signal?.throwIfAborted();
 const magic=new Uint8Array(bytes,0,Math.min(bytes.byteLength,2));
 if(magic[0]===0x1f&&magic[1]===0x8b){
  if(typeof DecompressionStream!=='function')throw Error('This browser needs the uncompressed model fallback');
  const reader=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip')).getReader();
  const abort=()=>{void reader.cancel(signal.reason).catch(()=>{});};
  signal?.addEventListener('abort',abort,{once:true});
  try{
   const chunks=[];let received=0;
   while(true){
    signal?.throwIfAborted();const {done,value}=await reader.read();signal?.throwIfAborted();if(done)break;
    received+=value.byteLength;
    if(received>maxBytes)throw Error('Decoded model exceeds the supported size');
    chunks.push(value);onProgress(received);
   }
   const joined=new Uint8Array(received);let offset=0;
   for(const chunk of chunks){joined.set(chunk,offset);offset+=chunk.byteLength;}
   bytes=joined.buffer;
  }finally{signal?.removeEventListener('abort',abort);await reader.cancel().catch(()=>{});reader.releaseLock();}
 }
 signal?.throwIfAborted();
 if(bytes.byteLength>maxBytes)throw Error('Model exceeds the supported size');
 if(bytes.byteLength<20||new DataView(bytes).getUint32(0,true)!==0x46546c67)throw Error('Response is not a GLB model (possibly a preview, login or confirmation page).');
 const header=new DataView(bytes);
 if(header.getUint32(4,true)!==2)throw Error('Unsupported GLB version');
 if(header.getUint32(8,true)!==bytes.byteLength){const error=Error('Download ended before the complete GLB arrived.');error.retryable=true;throw error;}
 return bytes;
}
