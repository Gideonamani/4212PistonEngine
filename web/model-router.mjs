const params=new URLSearchParams(location.search);
const requested=params.get('model')||'cylinder';
const registry=await fetch('./models.json?v=20260912-shared-training-release').then(response=>{if(!response.ok)throw Error('Training model registry unavailable');return response.json()});
const model=registry.models.find(item=>item.id===requested);
if(!model)throw Error(`Unknown training model: ${requested}`);
document.title=`4212 Piston Engine · ${model.label}`;
document.querySelector('.kicker').textContent=model.kicker;
document.querySelector('h1').textContent=model.title;
document.querySelector('.lede').textContent=model.description;
const switchLink=document.querySelectorAll('.lede')[1];
if(switchLink){const other=registry.models.find(item=>item.id!==model.id);switchLink.innerHTML=`<a href="./training.html?model=${other.id}">Switch to ${other.label} →</a>`;}
document.body.dataset.model=model.id;
globalThis.trainingModel=model;
if(model.adapter==='cylinder')await import('./viewer.js?v=20260912-shared-training-release');
else await import('./engine-training-adapter.mjs?v=20260912-shared-training-release');
