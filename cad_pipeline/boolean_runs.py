"""Shared run boundaries for independent native/direct Boolean evaluators."""


def feature_runs(features,batch_runs=0):
    runs=[];i=0
    while i<len(features):
        j=i
        while (batch_runs and j+1<len(features)
               and features[j+1]['operation']==features[i]['operation']
               and features[j+1].get('boolean_group')==features[i].get('boolean_group')):
            j+=1
        if j-i+1<max(batch_runs,2):j=i
        runs.append(list(range(i,j+1)));i=j+1
    return runs
