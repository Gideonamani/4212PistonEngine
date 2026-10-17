"""One inferred static cam/rod/rocker pose; no manufacturer cam law claim."""
import math,sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
from accessory_gears import gtsio_cam_rate,GTSIO_STATIC_TIMING
from cad_pipeline import gtsio_valve_layout as vl

BASE_RADIUS=19.5
CAM_LIFT=6.
HALF_EVENT=math.radians(70.)
SOCKET_OFFSET=45.
PAD_RADIUS=6.5
LOBE_WIDTH=14.
ROCKER_HUB_WIDTH=14
THRUST_WASHER_WIDTH=.7
RETAINER_INNER_FACE=8.1
RETAINER_WIDTH=9.3

def rocker_endplay():
    return 2*RETAINER_INNER_FACE-ROCKER_HUB_WIDTH-2*THRUST_WASHER_WIDTH

def add(a,b):return tuple(x+y for x,y in zip(a,b))
def sub(a,b):return tuple(x-y for x,y in zip(a,b))
def scale(a,s):return tuple(x*s for x in a)
def dot(a,b):return sum(x*y for x,y in zip(a,b))
def unit(a):return scale(a,1/math.sqrt(dot(a,a)))
def rotate(p,axis,angle):
    c,s=math.cos(angle),math.sin(angle);x,y,z=axis;u,v,w=p
    return (u*c+(y*w-z*v)*s+x*dot(axis,p)*(1-c),v*c+(z*u-x*w)*s+y*dot(axis,p)*(1-c),w*c+(x*v-y*u)*s+z*dot(axis,p)*(1-c))

def lift_law(angle):
    x=(angle+math.pi)%(2*math.pi)-math.pi
    if abs(x)>=HALF_EVENT:return 0.,0.,0.
    k=math.pi/HALF_EVENT
    return CAM_LIFT*(1+math.cos(k*x))/2,-CAM_LIFT*k*math.sin(k*x)/2,-CAM_LIFT*k*k*math.cos(k*x)/2

def lobes(layout):
    data=[]
    for n in range(1,7):
        for name,peak in [('Intake',450.),('Exhaust',270.)]:
            if name=='Intake' and n%2==0:continue
            phase=(0 if n%2 else math.pi)-gtsio_cam_rate()*math.radians(layout.FIRING_PHASE[n]+peak)
            data.append(dict(id=name+str(n),name=name,n=n,station=vl.follower_station(name,n,layout),phase=phase%(2*math.pi),followers=[n,n+1] if name=='Intake' else [n]))
    return data

def profile(phase,theta=0,samples=720):
    rotation=phase+gtsio_cam_rate()*math.radians(theta);points=[]
    for i in range(samples):
        a=2*math.pi*i/samples;h,dh,ddh=lift_law(a-rotation);h+=BASE_RADIUS
        points.append((h*math.cos(a)-dh*math.sin(a),h*math.sin(a)+dh*math.cos(a)))
    return points

def nominal_socket(name,n,parameters,layout):
    sign=1 if n%2 else -1
    return (sign*(BASE_RADIUS+SOCKET_OFFSET),parameters['case_cam_y']['value'],vl.follower_station(name,n,layout))

def pose(name,n,parameters,layout,theta=0):
    lobe=next(x for x in lobes(layout) if x['name']==name and n in x['followers']);sign=1 if n%2 else -1
    gamma=0 if sign>0 else math.pi;rise,contact,_=lift_law(gamma-lobe['phase']-gtsio_cam_rate()*math.radians(theta))
    a0=nominal_socket(name,n,parameters,layout);a=add(a0,(sign*rise,0,0));b0=vl.pushrod_cup(name,n,parameters,layout);length=math.dist(a0,b0)
    base,d,v=vl.raw_frame(name,parameters);pivot=vl.raw_point(name,vl.PIVOT_T,vl.PIVOT_U,0,parameters);cup=vl.raw_point(name,vl.CUP_T,vl.CUP_U,0,parameters)
    def raw_cup(beta):return add(pivot,rotate(sub(cup,pivot),v,beta))
    def world(p):
        x,y,z=p;z=-z
        if sign<0:x,z=-x,-z
        return (x,y,z+layout.station(n))
    lo,hi=0.,.6
    for _ in range(70):
        mid=(lo+hi)/2
        if math.dist(a,world(raw_cup(mid)))<length:lo=mid
        else:hi=mid
    beta=(lo+hi)/2 if rise>1e-12 else 0.
    tip=parameters[name.lower()+'_valve_length']['value']-3
    pad=vl.raw_point(name,tip+PAD_RADIUS,0,0,parameters);pad=add(pivot,rotate(sub(pad,pivot),v,beta))
    centre_t=dot(sub(pad,base),d);valve_lift=tip-(centre_t-PAD_RADIUS)
    return dict(name=name,n=n,lobe=lobe['id'],cam_rise=rise,contact_offset=contact,beta=beta,valve_lift=valve_lift,
                socket=a,closed_socket=a0,cup=world(raw_cup(beta)),closed_cup=b0,rod_length=length,pivot=pivot,raw_axis=v,raw_pad=pad,
                follower_face=sign*(BASE_RADIUS+rise))

def local_rigid_frame(frame,axis,angle,pivot=(0,0,0),translation=(0,0,0)):
    """Compose a raw-local rigid motion through the existing Z mirror/bank frame."""
    t=add(sub(pivot,rotate(pivot,axis,angle)),translation)
    # Reflection reverses an axial vector; -M(axis) is the mirrored axis.
    q=( -axis[0]*math.sin(angle/2),-axis[1]*math.sin(angle/2),axis[2]*math.sin(angle/2),math.cos(angle/2))
    bank=frame['rotation_quaternion'];x,y,z,w=bank;u,v,r,s=q
    product=(w*u+x*s+y*r-z*v,w*v-x*r+y*s+z*u,w*r+x*v-y*u+z*s,w*s-x*u-y*v-z*r)
    x,y,z=t;z=-z
    if bank==[0,1,0,0]:x,z=-x,-z
    return dict(frame,rotation_quaternion=list(product),origin=[frame['origin'][0]+x,frame['origin'][1]+y,frame['origin'][2]+z])
