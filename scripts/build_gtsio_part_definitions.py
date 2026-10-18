import json
import re
from pathlib import Path

# Load RULES from verify_100_coverage
from verify_100_coverage import RULES

contract_path = Path(r"d:\KEON\AE Departmental\_Teaching Modules\Piston Engine\20262025 Sem 1 - AMT GCAME Piston\4212PistonEngine\web\gtsio520-r10-contract.json")
with open(contract_path, "r", encoding="utf-8") as f:
    contract = json.load(f)

parts = contract.get("parts", [])

def format_part_instance(pid, label, rule):
    # Extract cylinder or throw number if present
    # Examples: ConnectingRod1 -> Cyl 1; IntakeValve3 -> Cyl 3; Throw 2, etc.
    cyl_match = re.search(r"(?:Cylinder|Cyl|Piston|Rod|Pin|Deck|Plug|Valve|Rocker|Spring|Seat|Guide|Cover|Shroud|Housing|Ring)(\d)", pid + " " + label, re.IGNORECASE)
    cyl_num = cyl_match.group(1) if cyl_match else None
    
    # Check for throw or throw number
    throw_match = re.search(r"(?:Throw|Cheek|Journal)(\d)", pid + " " + label, re.IGNORECASE)
    throw_num = throw_match.group(1) if throw_match else None

    # Check for Left / Right
    lr = ""
    if re.search(r"\bLeft\b|Left(?=[A-Z])", pid, re.IGNORECASE):
        lr = " (Left)"
    elif re.search(r"\bRight\b|Right(?=[A-Z])", pid, re.IGNORECASE):
        lr = " (Right)"

    base_name = rule["name"]

    if cyl_num:
        display_label = f"{base_name} (Cyl {cyl_num}){lr}"
    elif throw_num:
        display_label = f"{base_name} (Throw {throw_num}){lr}"
    elif lr:
        display_label = f"{base_name}{lr}"
    else:
        # Check if ID has a simple trailing number
        num_match = re.search(r"(\d+)$", pid)
        if num_match:
            display_label = f"{base_name} #{num_match.group(1)}"
        else:
            display_label = f"{base_name}"

    return display_label

# Build definitions dictionary keyed by archetype
definitions = {}
for r in RULES:
    slug = re.sub(r"[^a-z0-9]+", "-", r["name"].lower()).strip("-")
    definitions[slug] = {
        "slug": slug,
        "name": r["name"],
        "partNumber": r["partNumber"],
        "system": r["system"],
        "material": r["material"],
        "function": r["function"],
        "operatingConditions": r["operatingConditions"],
        "source": r["source"]
    }

print(f"Total curated archetypes: {len(definitions)}")

# Save canonical definition database
out_defs = Path(r"d:\KEON\AE Departmental\_Teaching Modules\Piston Engine\20262025 Sem 1 - AMT GCAME Piston\4212PistonEngine\data\gtsio520-component-definitions.json")
with open(out_defs, "w", encoding="utf-8") as f:
    json.dump({"schema": "4212.component-definitions/v1", "engine": "Continental GTSIO-520-H", "definitions": definitions}, f, indent=2)
print("Saved data/gtsio520-component-definitions.json")

# Enrich contract parts
enriched_count = 0
for p in parts:
    pid = p["id"]
    for r in RULES:
        if re.search(r["pattern"], pid, re.IGNORECASE):
            p["display_label"] = format_part_instance(pid, p.get("label", ""), r)
            p["description"] = r["function"]
            p["part_number"] = r["partNumber"]
            p["material_spec"] = r["material"]
            p["operating_conditions"] = r["operatingConditions"]
            p["source_locator"] = r["source"]
            enriched_count += 1
            break

print(f"Enriched {enriched_count} / {len(parts)} contract parts!")

# Save enriched contract
with open(contract_path, "w", encoding="utf-8") as f:
    json.dump(contract, f, indent=2)

print(f"Successfully updated {contract_path}")
