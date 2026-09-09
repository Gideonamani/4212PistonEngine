export function mechanismPose(degrees,radius,length){
  if(!(radius>0&&length>radius))throw Error('Invalid slider-crank dimensions');
  const angle=degrees*Math.PI/180,cx=radius*Math.cos(angle),cy=radius*Math.sin(angle);
  const reach=Math.sqrt(length*length-cy*cy);
  return {piston:[cx+reach,0,0],rod:[cx,cy,0],rodAngle:-Math.atan2(cy,reach),crankAngle:angle};
}
