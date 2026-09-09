// Timeout only when no progress is made; a slow active download may take longer.
export function createTransfer(idleMs=120000){
  const controller=new AbortController();let timer,reason='';
  const touch=()=>{clearTimeout(timer);if(!controller.signal.aborted)timer=setTimeout(()=>{reason='stalled';controller.abort();},idleMs);};
  touch();
  return {signal:controller.signal,touch,get reason(){return reason;},
    cancel(){reason='cancelled';clearTimeout(timer);controller.abort();},
    finish(){clearTimeout(timer);}};
}
