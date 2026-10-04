"""Fit a circle/cylinder cross-section to a reviewed mesh ROI.
An algebraic least-squares fit reports residuals; it is not semantic recognition.
"""
import argparse, json
from pathlib import Path
import numpy as np

def fit_circle(points):
    points=np.asarray(points,dtype=float)
    if len(points)<12: raise ValueError('Too few points for circle fit')
    x,y=points.T; center=np.mean(points,axis=0); x=x-center[0];y=y-center[1]
    m=np.column_stack((2*x,2*y,np.ones(len(x))))
    coefficients,_,rank,_=np.linalg.lstsq(m,x*x+y*y,rcond=None)
    if rank<3:raise ValueError('Degenerate circle ROI')
    c=coefficients[:2]+center;radius=float(np.sqrt(coefficients[2]+np.sum(coefficients[:2]**2)))
    residual=np.linalg.norm(points-c,axis=1)-radius
    return dict(center=c.tolist(),radius=radius,rms=float(np.sqrt(np.mean(residual**2))),p95_absolute_residual=float(np.percentile(abs(residual),95)),points=len(points))

def main():
    p=argparse.ArgumentParser();p.add_argument('--points',type=Path,required=True);p.add_argument('--roi',type=Path,required=True);p.add_argument('--output',type=Path,required=True)
    a=p.parse_args();points=np.load(a.points)['points'];roi=json.loads(a.roi.read_text());reports=[]
    for r in roi['regions']:
        lo=np.array(r['bounds'][0]);hi=np.array(r['bounds'][1]);selection=points[np.all((points>=lo)&(points<=hi),axis=1)]
        selection=np.unique(np.round(selection,6),axis=0)
        if 'radial_filter' in r:
            rf=r['radial_filter'];distance=np.linalg.norm(selection[:,r['projection_axes']]-np.array(rf['center']),axis=1)
            selection=selection[(distance>=rf['minimum'])&(distance<=rf['maximum'])]
        result=fit_circle(selection[:,r['projection_axes']]); reports.append(dict(id=r['id'],roi=r,fit=result))
    a.output.parent.mkdir(parents=True,exist_ok=True);a.output.write_text(json.dumps(dict(units='raw imported mesh units',method='Reviewed ROI; deduplicated vertex-weighted algebraic least-squares circle',regions=reports),indent=2)+'\n')
if __name__=='__main__':main()
