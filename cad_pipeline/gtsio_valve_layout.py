"""One estimated valve/rocker skeleton for CAD, packaging and later motion.

Manufacturing stem/guide/valve lengths remain source-backed parameters. These
lever/platform/follower datums are reconstruction choices, not manufacturer data.
The local source geometry is built once, reflected in Z to correct longitudinal
clocking, then properly rotated about gravity Y for the opposite bank.
"""
import math

PIVOT_T=132.
PIVOT_U=-44.
CUP_T=115.
CUP_U=-72.
SPRING_TOP=110.
SPRING_INSTALLED=45.
ILLUSTRATIVE_VALVE_LIFT_ENVELOPE=14.


def raw_frame(name,parameters):
    def value(key):return parameters[key]['value']
    side=-1 if name=='Intake' else 1
    angle=math.radians(side*value(name.lower()+'_angle'))
    d=(math.cos(angle),0,math.sin(angle));v=(-d[2],0,d[0])
    return (value('head_seat'),0,side*value('valve_offset')),d,v


def raw_point(name,t,u,w,parameters):
    base,d,v=raw_frame(name,parameters)
    return tuple(base[i]+d[i]*t+(u if i==1 else 0)+v[i]*w for i in range(3))


def world_point(name,n,t,u,w,parameters,layout):
    x,y,z=raw_point(name,t,u,w,parameters);z=-z
    if n%2==0:x,z=-x,-z
    return x,y,z+layout.station(n)


def pushrod_cup(name,n,parameters,layout):
    return world_point(name,n,CUP_T,CUP_U,0,parameters,layout)


def follower_station(name,n,layout):
    if name=='Intake':
        odd=n if n%2 else n-1
        return (layout.station(odd)+layout.station(odd+1))/2
    return layout.station(n)+(-17 if n%2 else 17)


def follower_socket(name,n,parameters,layout):
    sign=1 if n%2 else -1
    return sign*48.,parameters['case_cam_y']['value'],follower_station(name,n,layout)


def pushrod_line(name,n,parameters,layout):
    return follower_socket(name,n,parameters,layout),pushrod_cup(name,n,parameters,layout)


def segment_distance(a,b,c,d):
    """Shortest 3D separation of two line segments (numeric packaging check)."""
    def sub(a,b):return tuple(x-y for x,y in zip(a,b))
    def dot(a,b):return sum(x*y for x,y in zip(a,b))
    u,v,w=sub(b,a),sub(d,c),sub(a,c);aa,bb,cc,dd,ee=dot(u,u),dot(u,v),dot(v,v),dot(u,w),dot(v,w)
    den=aa*cc-bb*bb;s=(bb*ee-cc*dd)/den if den>1e-12 else 0.;s=max(0.,min(1.,s));t=max(0.,min(1.,(bb*s+ee)/cc))
    s=max(0.,min(1.,(bb*t-dd)/aa))
    return math.dist(tuple(a[i]+s*u[i] for i in range(3)),tuple(c[i]+t*v[i] for i in range(3)))
