import * as THREE from 'three';
import {illustrativeCycle,valveTrainPose} from './valve-kinematics.mjs';
const point=a=>new THREE.Vector3(a[0],a[2],-a[1]).multiplyScalar(.001);
const axis=a=>new THREE.Vector3(a[0],a[2],-a[1]).normalize();

// Rigid world-space deltas from the closed CAD geometry, before parent conversion.
export function valveMatrices(degrees,profile){
  const cycle=illustrativeCycle(degrees,profile.cycle.maximum_lift_mm),matrices={};
  for(const [name,train] of Object.entries(profile.trains)){
    const label=name[0].toUpperCase()+name.slice(1);
    const pose=valveTrainPose(cycle[name+'Lift'],train);
    const translation=new THREE.Matrix4().makeTranslation(...point(pose.valveTranslation));
    for(const suffix of ['Valve','SpringRetainer','ValveKeeper'])matrices[label+suffix]=translation;
    const pivot=point(train.rocker_pivot_mm);
    const rotation=new THREE.Matrix4().makeRotationAxis(axis(train.rocker_axis),pose.rockerAngle*Math.PI/180);
    rotation.setPosition(pivot.clone().sub(pivot.clone().applyMatrix4(rotation)));
    matrices[label+'RockerArm']=rotation;
    const lower=point(train.pushrod_lower_mm),upper=point(train.pushrod_socket_mm);
    const follower=point(pose.follower),socket=point(pose.socket);
    const quaternion=new THREE.Quaternion().setFromUnitVectors(upper.clone().sub(lower).normalize(),socket.clone().sub(follower).normalize());
    const rod=new THREE.Matrix4().makeRotationFromQuaternion(quaternion);
    rod.setPosition(follower.clone().sub(lower.clone().applyMatrix4(rod)));
    matrices[label+'Pushrod']=rod;
  }
  return {cycle,matrices};
}
