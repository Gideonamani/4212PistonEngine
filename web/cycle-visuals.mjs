import * as THREE from 'three';
import {cycleCueState} from './cycle-cues.mjs';
const point=a=>new THREE.Vector3(a[0],a[2],-a[1]).multiplyScalar(.001);
export function createCycleVisuals(scene,landmarks){
 const group=new THREE.Group();group.name='Illustrative cycle cues';scene.add(group);
 const count=180,positions=new Float32Array(count*3),geometry=new THREE.BufferGeometry();
 geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));
 // The chamber cue sits inside opaque CAD solids; draw it through them (depthTest off, high renderOrder)
 // so it stays legible without requiring the student to align Section view with the camera first.
 const material=new THREE.PointsMaterial({color:0x43d9e4,size:6,sizeAttenuation:false,transparent:true,opacity:.8,depthWrite:false,depthTest:false});
 const cloud=new THREE.Points(geometry,material);cloud.frustumCulled=false;cloud.renderOrder=999;group.add(cloud);
 const arrows={};
 for(const name of ['intake','exhaust']){
  const port=landmarks.ports[name],outward=point(port.outward_axis).normalize(),mouth=point(port.outer_endpoint_mm);
  const direction=outward.clone().multiplyScalar(name==='intake'?-1:1);
  const origin=mouth.clone().addScaledVector(outward,name==='intake'?.024:0);
  const arrow=new THREE.ArrowHelper(direction,origin,.024,name==='intake'?0x43d9e4:0xb7b3bd,.007,.004);
  arrow.renderOrder=999;arrow.line.material.depthTest=false;arrow.cone.material.depthTest=false;
  const flowPositions=new Float32Array(9*3),flowGeometry=new THREE.BufferGeometry();
  flowGeometry.setAttribute('position',new THREE.BufferAttribute(flowPositions,3));
  const dots=new THREE.Points(flowGeometry,new THREE.PointsMaterial({color:name==='intake'?0x43d9e4:0xb7b3bd,size:5,sizeAttenuation:false,depthWrite:false,depthTest:false}));
  dots.frustumCulled=false;dots.renderOrder=999;group.add(arrow,dots);arrows[name]={arrow,dots,mouth,outward,flowPositions};
 }
 group.visible=false;
 return {
  setVisible(value){group.visible=value;},
  update(degrees,pistonPinMm){
   const state=cycleCueState(degrees),c=landmarks.chamber,start=pistonPinMm+c.piston_front_offset_mm+c.piston_margin_mm;
   for(let i=0;i<count;i++){
    const theta=i*2.399963229728653,r=c.radius_mm*.95*Math.sqrt((i+.5)/count);
    const axial=((i*73)%count+.5)/count;
    positions[i*3]=(start+(c.front_x_mm-start)*axial)/1000;
    positions[i*3+1]=r*Math.sin(theta)/1000;
    positions[i*3+2]=-r*Math.cos(theta)/1000;
   }
   geometry.attributes.position.needsUpdate=true;material.color.setHex(state.colour);
   material.opacity=.55+.3*state.reactionGlow;
   for(const name of ['intake','exhaust']){
    const entry=arrows[name],visible=state[name+'Visible'];entry.arrow.visible=visible;entry.dots.visible=visible;
    for(let i=0;i<9;i++){
     const fraction=((i/9+state.angle/45)%1+1)%1;
     const distance=.024*(name==='intake'?1-fraction:fraction);
     const position=entry.mouth.clone().addScaledVector(entry.outward,distance);
     position.toArray(entry.flowPositions,i*3);
    }
    entry.dots.geometry.attributes.position.needsUpdate=true;
   }
   return state;
  },
  dispose(){scene.remove(group);group.traverse(o=>{o.geometry?.dispose();if(o.material)o.material.dispose();});}
 };
}
