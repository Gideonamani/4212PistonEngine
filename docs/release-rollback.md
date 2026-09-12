# Release snapshots and rollback

`scripts/release_snapshot.py` captures the current website, catalogue, motion profile, audio and matching engine GLB into a fresh local directory. It records per-file sizes and SHA-256 hashes, verifies that the model matches the motion profile, and writes the release manifest last. It does not upload to Drive, publish Pages, or overwrite a working directory.

```powershell
python scripts/release_snapshot.py capture --id explorer-baseline-20260911 --output build/releases/explorer-baseline-20260911 --model .local/GTSIO520_Cylinder_Drive_Test.glb
python scripts/release_snapshot.py restore --source build/releases/explorer-baseline-20260911 --output build/releases/rollback-rehearsal-20260911
```

These particular directories already exist after the successful rehearsal; use fresh names for another run. Restore verifies the entire source before copying and verifies the restored files afterward. Unsafe manifest paths and hash mismatches are rejected. The captured browser configuration retains the existing restricted public Drive key; diagnostics and the evidence report contain hashes rather than the key.

Completed local evidence is in `data/rollback-rehearsal.json`: 14 files restored with matching hashes; a deliberately corrupted motion-profile hash was rejected. A localhost control copy of the saved model was added only to the rehearsal's web folder for the browser check. The restored viewer rendered all 60 components, played to approximately 79 degrees, paused, and reset to its 36-degree bind pose. The temporary local control file is not part of the snapshot manifest or a production fallback.

This is a working local rollback foundation, not a completed deployment rollback. Before releasing the operating-cylinder candidate: retain this snapshot, finish candidate browser and teaching checks, create a versioned model in the existing synced Drive folder, verify the resulting Drive file ID and anonymous browser delivery, bind its asset hash to its profile, then publish that complete web/profile/configuration revision. Preserve the previous Drive model. If rollback is needed, restore the corresponding web/profile/configuration revision together and verify the previous Drive model still loads; do not mix a new model URL with the old motion profile.

M3 remains open until versioned publication and the production rollback procedure have been exercised. No device or instructor gate is implied by this local rehearsal.

## Operating-cylinder candidate package

`scripts/assemble_operating_release.py` now creates a fresh, self-contained candidate bundle from the verified spring-seat package. It substitutes the candidate's exact `motion.json`, adds the decoded GLB and gzip transfer file, retains geometry/spring/transport verification records, and writes a hash manifest. Its web configuration intentionally contains no Drive ID or browser key, so it cannot silently publish or point to the old model. `scripts/test_operating_release.py` proves the manifest and binding checks in a temporary directory.

For browser-only local review, the candidate configuration also supplies `../assets/engine.glb.gz` and the decoded `../assets/engine.glb` as `?control=local` targets. Those fields are used only by localhost control mode; `drive_share_url` remains empty.

```powershell
python scripts/assemble_operating_release.py create --package build/pipeline-spring-seat --output build/releases/operating-cylinder-20260912 --id operating-cylinder-20260912
python scripts/assemble_operating_release.py verify --release build/releases/operating-cylinder-20260912
```

The planned identifier and exact asset hashes are in `releases/operating-cylinder-20260912.json`. The remaining promotion actions are intentionally external: upload a new versioned Drive model, verify anonymous API loading, write its ID to a promoted manifest, then publish the matching Pages configuration while retaining the previous Drive file and web revision. This package is release-ready evidence, not release promotion.
