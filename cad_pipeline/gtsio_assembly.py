"""Shared static-engine assembly helpers and source-to-part bookkeeping."""
import copy
import math
from cad_pipeline.spec import evaluate
from cad_pipeline.gtsio_core import cylinder,tube,box,prism


class Assembly:
    def __init__(self,spec):
        self.spec=spec;self.parameters=spec['parameters'];self.mapping={}

    def parameter(self,name,value,reason,specified=False,expression=None):
        p=dict(value=value,unit='mm',status='specified' if specified else 'inferred',source_ids=['manual'],rationale=reason)
        if expression:p['expression']=expression;p['value']=evaluate(expression,self.parameters)
        self.parameters[name]=p
        return p['value']

    def value(self,name):return self.parameters[name]['value']

    def refresh(self):
        # Rules are checked for cycles by validate_spec; repeated passes resolve
        # existing dependencies after an explicitly reviewed estimate changes.
        for _ in range(len(self.parameters)):
            changed=False
            for p in self.parameters.values():
                if p.get('expression'):
                    value=evaluate(p['expression'],self.parameters)
                    if abs(value-p['value'])>1e-10:p['value']=value;changed=True
            if not changed:return
        raise ValueError('Unstable parameter dependencies')

    def add(self,id,label,group,features,callouts,material='steel',refine=True):
        part=dict(id=id,label=label,group=group,material=material,features=features,
                  evidence='X-30045A '+', '.join(callouts)+'; documented anchors and explicit calculated contour/packaging estimates. See static-engine research.',
                  source_callouts=callouts,boolean_refine=refine)
        self.spec['parts'].append(part)
        for locator in callouts:self.mapping.setdefault(locator,[]).append(id)
        return part

    def bolt(self,id,center,axis,length,radius,callout,group='fasteners'):
        head=[center[i]-axis[i]*radius*.8 if isinstance(center[i],(int,float)) else f'({center[i]})-{axis[i]*radius*.8}' for i in range(3)]
        return self.add(id,id,group,[cylinder(radius,length,center,axis),
            cylinder(radius*1.65,radius*.8,head,axis)], [callout])

    def washer(self,id,center,axis,ri,ro,thick,callout,group='fasteners'):
        return self.add(id,id,group,[tube(ro,ri,thick,center,axis)],[callout])

    def nut(self,id,center,axis,radius,depth,bore,callout,group='fasteners'):
        points=[[radius*math.cos(j*math.pi/3),radius*math.sin(j*math.pi/3)] for j in range(6)]
        hole=[center[i]-axis[i] if isinstance(center[i],(int,float)) else f'({center[i]})-{axis[i]}' for i in range(3)]
        return self.add(id,id,group,[prism(points,depth,center,axis),cylinder(bore,depth+2,hole,axis,op='cut')],[callout])


def rotate_z(feature,angle,center=(0,0,0)):
    """Expression-safe rigid placement about shaft Z."""
    f=copy.deepcopy(feature);c,s=math.cos(angle),math.sin(angle)
    x,y,z=f.get('origin',[0,0,0]);term=lambda v:f'({v})'
    f['origin']=[f'{center[0]}+{c}*{term(x)}-{s}*{term(y)}',f'{center[1]}+{s}*{term(x)}+{c}*{term(y)}',f'{center[2]}+{term(z)}']
    axis=f.get('axis',[0,0,1]);f['axis']=[c*axis[0]-s*axis[1],s*axis[0]+c*axis[1],axis[2]]
    f['roll']=f.get('roll',0)+math.degrees(angle)
    return f
