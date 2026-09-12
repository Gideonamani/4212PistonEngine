import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';

const $=id=>document.getElementById(id), view=$('view');
const scene=new THREE.Scene();scene.background=new THREE.Color('#101923');
const camera=new THREE.PerspectiveCamera(38,1,.01,100);camera.position.set(1.45,1.05,1.8);
const renderer=new THREE.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.toneMapping=THREE.ACESFilmicToneMapping;view.append(renderer.domElement);
const controls=new OrbitControls(camera,renderer.domElement);controls.target.set(0,0,0);controls.enableDamping=true;
scene.add(new THREE.HemisphereLight(0xdceeff,0x34475b,2.8));for(const p of [[2,3,4],[-3,1,2]]){const l=new THREE.DirectionalLight(0xffffff,2.4);l.position.set(...p);scene.add(l)}
let mixer,action,clip,angle=0,playing=false,last=0;
function render(){controls.update();renderer.render(scene,camera)}
function setAngle(degrees){angle=(degrees%720+720)%720;if(mixer&&clip)mixer.setTime(clip.duration*angle/720);$('angle').value=String(angle);$('angle-value').textContent=`${angle.toFixed(0)}°`;const stroke=angle<180?'Power':angle<360?'Exhaust':angle<540?'Intake':'Compression';$('motion-state').textContent=`${stroke} stroke · native action sampled at ${angle.toFixed(0)}°.`;render()}
function tick(now){if(playing){setAngle(angle+Math.max(0,Math.min(.1,(now-last)/1000))*Number($('speed').value));last=now}requestAnimationFrame(tick)}
new ResizeObserver(()=>{const r=view.getBoundingClientRect();renderer.setSize(r.width,r.height,false);camera.aspect=r.width/r.height;camera.updateProjectionMatrix();render()}).observe(view);
$('play').onclick=()=>{playing=!playing;$('play').textContent=playing?'Pause':'Play';last=performance.now()};$('reset').onclick=()=>{playing=false;$('play').textContent='Play';setAngle(0)};$('angle').oninput=()=>{playing=false;$('play').textContent='Play';setAngle(Number($('angle').value))};
new GLTFLoader().load('./engine.glb',gltf=>{scene.add(gltf.scene);const box=new THREE.Box3().setFromObject(gltf.scene), sphere=box.getBoundingSphere(new THREE.Sphere());controls.target.copy(sphere.center);camera.position.copy(sphere.center).add(new THREE.Vector3(sphere.radius*1.35,sphere.radius*.8,sphere.radius*1.55));controls.update();const tracks=gltf.animations.flatMap(a=>a.tracks);if(!tracks.length)throw Error('Export contains no animation tracks');clip=new THREE.AnimationClip('720-degree engine motion',-1,tracks);mixer=new THREE.AnimationMixer(gltf.scene);action=mixer.clipAction(clip);action.paused=true;action.play();setAngle(0);for(const id of ['play','reset','angle','speed'])$(id).disabled=false;$('status').textContent=`Loaded ${gltf.scene.children.length} exported root nodes and a ${clip.tracks.length}-track baked operating action.`;requestAnimationFrame(tick)},undefined,error=>{$('status').textContent='Could not load the exported engine: '+error.message;console.error(error)});
