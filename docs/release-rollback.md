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
