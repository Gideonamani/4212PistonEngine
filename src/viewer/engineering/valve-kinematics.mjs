import { cycleValveState } from './otto-cycle.mjs';
const add=(a,b)=>a.map((v,i)=>v+b[i]);
const sub=(a,b)=>a.map((v,i)=>v-b[i]);
const scale=(a,s)=>a.map(v=>v*s||0);
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
export function illustrativeCycle(degrees,maxLift=7,mode='ideal'){
  if(!Number.isFinite(degrees)||!Number.isFinite(maxLift)||maxLift<0)throw Error('Invalid cycle input');
  return cycleValveState(degrees,maxLift,mode);
}
export function valveTrainPose(lift,train){
  const samples=train.contact_samples;
  if(!Number.isFinite(lift)||lift<samples[0].lift_mm||lift>samples.at(-1).lift_mm)throw Error('Lift outside audited envelope');
  let hi=samples.findIndex(p=>p.lift_mm>=lift);
  const b=samples[hi],a=samples[Math.max(0,hi-1)];
  const t=b.lift_mm===a.lift_mm?0:(lift-a.lift_mm)/(b.lift_mm-a.lift_mm);
  const rockerAngle=a.rocker_angle_deg+t*(b.rocker_angle_deg-a.rocker_angle_deg),theta=rockerAngle*Math.PI/180,k=train.rocker_axis;
  const valveTranslation=scale(train.valve_axis,-lift);
  if(!train.pushrod_socket_mm||!train.pushrod_lower_mm){
    return {lift,rockerAngle,valveTranslation};
  }
  const v=sub(train.pushrod_socket_mm,train.rocker_pivot_mm);
  const rotated=add(add(scale(v,Math.cos(theta)),scale(cross(k,v),Math.sin(theta))),scale(k,dot(k,v)*(1-Math.cos(theta))));
  const socket=add(train.rocker_pivot_mm,rotated),lower=train.pushrod_lower_mm;
  const reach2=train.pushrod_length_mm**2-(socket[1]-lower[1])**2-(socket[2]-lower[2])**2;
  if(reach2<=0)throw Error('Pushrod cannot reach follower axis');
  return {lift,rockerAngle,socket,follower:[socket[0]-Math.sqrt(reach2),lower[1],lower[2]],valveTranslation};
}
