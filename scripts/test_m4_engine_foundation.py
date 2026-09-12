"""Validate M4 topology/evidence rules without promoting unsupported geometry claims."""
import json
from pathlib import Path

root = Path(__file__).resolve().parents[1]
contract = json.loads((root / "data/engine-contracts/gtsio520-h-v5.json").read_text())
m4 = contract["m4_foundation"]

assert m4["coordinate_system"]["id"] == "gtsio520h-engine-datum/v1"
assert m4["cylinder_template"]["id"] == "gtsio520h:cylinder-module:v1"
instances = m4["cylinder_instances"]
assert len(instances) == 6
assert {item["id"] for item in instances} == {f"cylinder-{number}" for number in range(1, 7)}
assert {item["station"] for item in instances} == {
    "left-forward", "right-forward", "left-middle", "right-middle", "left-aft", "right-aft"
}
assert {item["orientation"] for item in instances} == {"outboard from crankcase"}

# The declared firing order and instance event phases describe exactly one 720°
# teaching cycle, with one evenly spaced firing event per cylinder.
order = contract["operation"]["firing_order"]
phase = {int(item["id"].split("-")[1]): item["firing_phase_deg"] for item in instances}
assert order == [1, 4, 5, 2, 3, 6]
assert [phase[number] for number in order] == [0, 120, 240, 360, 480, 600]
assert sorted(phase.values()) == [0, 120, 240, 360, 480, 600]

modules = {item["id"]: item for item in contract["modules"]}
assert set(modules) >= {"crankcase-v5", "cylinder-module", "primary-drive"}
assert modules["cylinder-module"]["instances"] == [item["id"] for item in instances]
assert all(item["stable_binding"]["engine_id"] == contract["id"] for item in modules.values())
groups = {item["id"]: item for item in contract["inspection_groups"]}
assert groups["cylinders"]["stable_binding"]["module_id"] == "cylinder-module"
for number in range(1, 7):
    assert groups[f"cylinder-{number}"]["stable_binding"]["instance_id"] == f"cylinder-{number}"
interfaces = {item["id"]: item for item in m4["interfaces"]}
assert set(interfaces) == {"crankcase-to-cylinder-station", "crankshaft-to-cylinder-rods", "crankshaft-to-primary-drive"}
ratios = m4["primary_drivetrain"]["documented_ratios_to_crankshaft"]
assert ratios == {"propeller_drive": .667, "magneto_drive": 1.5, "tachometer_drive": .5,
                  "starter_drive": 32, "alternator_drive": 3, "vacuum_pump_drive": 1.14,
                  "propeller_governor_drive": .809}
assert "journal-to-bearing mapping" in " ".join(m4["evidence_register"]["unknowns"])
assert m4["export_binding"]["current_mode"] == "legacy-hierarchy-selector"
assert m4["export_binding"]["required_future_glb_extras"] == ["engine_id", "module_id", "instance_id", "teaching_ids"]
print(json.dumps({"passed": True, "instances": len(instances), "firing_order": order, "open_evidence": len(m4["evidence_register"]["unknowns"])}, indent=2))
