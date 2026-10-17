"""Run-boundary regressions require no CAD process."""
import itertools
import unittest
from cad_pipeline.boolean_runs import feature_runs


class BooleanRuns(unittest.TestCase):
    def test_legacy_without_groups(self):
        # Exhaustively compare short operation sequences to the prior policy.
        def legacy(fs,batch):
            result=[];i=0
            while i<len(fs):
                j=i
                while batch and j+1<len(fs) and fs[j+1]['operation']==fs[i]['operation']:j+=1
                if j-i+1<max(batch,2):j=i
                result.append(list(range(i,j+1)));i=j+1
            return result
        for size in range(9):
            for ops in itertools.product(['add','cut'],repeat=size):
                fs=[dict(operation=op) for op in ops]
                for batch in [0,1,2,3,6]:self.assertEqual(feature_runs(fs,batch),legacy(fs,batch))

    def test_explicit_groups_do_not_merge_or_drop_tools(self):
        fs=[dict(operation='cut',boolean_group=group) for group in ['seat']*8+['gallery']*8+['datum']]
        runs=feature_runs(fs,6)
        self.assertEqual(runs,[list(range(8)),list(range(8,16)),[16]])
        self.assertEqual([i for run in runs for i in run],list(range(17)))
        self.assertEqual(feature_runs(fs,0),[[i] for i in range(17)])


if __name__=='__main__':unittest.main()
