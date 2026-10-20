"""Bake (or, by default, describe) the explicitly authorised private illustrative R10 review draft.

A thin entry point: the rig is cad_pipeline/rig_animated_study.py, which serves every animated study. This file keeps the command line that docs and
habits use working:

    blender --background --python-exit-code 1 --python cad_pipeline/rig_gtsio_review.py -- [--output <folder>] [--bake-gltf]
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from cad_pipeline.rig_animated_study import main

if __name__ == '__main__':
    main('gtsio')
