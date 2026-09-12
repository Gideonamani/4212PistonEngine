// Deterministic teaching trajectories in CAD millimetres, not a flow solver.
const tau=Math.PI*2;
export const particleRadiusMm=.9;
const wrap=value=>((value%1)+1)%1;
const add=(a,b,s=1)=>a.map((v,i)=>v+s*b[i]);
const mix=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t);
export function chamberParticle(index,count,degrees,pistonPinMm,chamber){
 const phase=wrap(degrees/720),orbit=tau*phase;
 const lower=pistonPinMm+chamber.piston_front_offset_mm+Math.max(chamber.piston_margin_mm,particleRadiusMm+1);
 const upper=chamber.front_x_mm-particleRadiusMm-1;
 if(lower>=upper)throw Error('No particle clearance above piston');
 const seed=(index+.5)/count;
 const theta=index*2.399963229728653+orbit+Math.sin(orbit+index)*.25;
 const radius=(chamber.radius_mm-particleRadiusMm-1)*Math.sqrt(seed)*(.8+.12*Math.sin(orbit+index*1.7));
 const axial=.5+.46*Math.sin(tau*wrap(index*.61803398875)+orbit*2);
 return [lower+(upper-lower)*axial,radius*Math.cos(theta),radius*Math.sin(theta)];
}
export function portPath(name,lift,pistonPinMm,landmarks){
 const port=landmarks.ports[name],valve=port.valve;
 if(!valve)throw Error('CAD valve frame required for port cues');
 const axis=valve.axis,origin=valve.origin_mm;
 // A ring-side waypoint represents the opening around the valve head, not its centre.
 const towards=[0,-Math.sign(origin[1]),0],projection=towards.reduce((sum,v,i)=>sum+v*axis[i],0);
 const radial=towards.map((v,i)=>v-projection*axis[i]);
 const length=Math.hypot(...radial);for(let i=0;i<3;i++)radial[i]/=length;
 const chamber=landmarks.chamber;
 const floor=pistonPinMm+chamber.piston_front_offset_mm+particleRadiusMm+1;
 const endpoint=[Math.max(floor+1,chamber.front_x_mm-4),Math.sign(origin[1])*chamber.radius_mm*.35,0];
 const gap=add(add(origin,axis,-lift*.5),radial,valve.head_radius_mm-1);
 const pastHead=add(add(origin,axis,-lift-5),radial,valve.head_radius_mm*.65);
 const points=[add(port.outer_endpoint_mm,port.outward_axis,24),port.outer_endpoint_mm,port.inner_origin_mm,
  add(add(origin,axis,10),radial,valve.head_radius_mm*.5),gap,pastHead,endpoint];
 // The moving crown is an exclusion plane for the entire schematic stream too.
 for(let i=0;i<points.length;i++)points[i]=[Math.max(floor,points[i][0]),points[i][1],points[i][2]];
 return name==='intake'?points:points.reverse();
}
export function pathParticle(path,fraction){
 const distances=path.slice(1).map((p,i)=>Math.hypot(...p.map((v,j)=>v-path[i][j])));
 let remaining=Math.max(0,Math.min(1,fraction))*distances.reduce((a,b)=>a+b,0);
 for(let i=0;i<distances.length;i++){
  if(remaining<=distances[i]||i===distances.length-1)return mix(path[i],path[i+1],distances[i]?remaining/distances[i]:0);
  remaining-=distances[i];
 }
}
export function streamFraction(index,count,degrees){return wrap(index/count+wrap(degrees/720)*12);}
