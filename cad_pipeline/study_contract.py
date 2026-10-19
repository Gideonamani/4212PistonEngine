"""One web-contract builder for every animated study (Langley, Wright, GTSIO-520-H R10, and the next engine).

The viewer's animated-study adapter reads a contract beside the GLB: the parts (each with a description, evidence and system), the system -> assembly or
component tree, the motions it can play, the scope note that is shown with every motion, and the gear meshes. Before this module each engine had its own
builder (`langley_contract.py`, `wright_contract.py`, and `gtsio_review_motion.build_review_contract`) that repeated the same skeleton. This module owns the
skeleton; each engine supplies a small `StudyConfig`:

* `scope`, `reference`, `viewpoint`: the texts the card shows;
* `systems`: the ordered top-level groups (id, title, optional question), either a fixed list or computed from the build context;
* `grouping`: how a part is placed in the tree. `AssemblyRules` (first matching pattern decides the system and the assembly, Langley), `ComponentTree` (the part's own
  group is the system and the research inventory's components are the second level, Wright) or `FlatGroups` (the part's own group, no second level, R10);
* `part_fields`: which of the standard part fields the contract carries, in order, and `part_extras` for fields only one engine has (R10's body and explosion);
* `motions`: the motion descriptors, including the clip stage names;
* `extra_fields`: top-level fields only one engine has (R10's `display`, `procedural`, `pending`);
* `key_order`: the order of the top-level keys, so a rebuild is byte-identical to the file it replaces.

Standard library only. `build()` never reads the geometry: it takes the parts (id, label, group, evidence, material) and the exported asset's decoded hash, so the
same call serves a CAD package's geometry.json, a committed part-spec.json or a manifest.
"""
import json, re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Callable, Optional

REPO = Path(__file__).resolve().parents[1]

# The standard fields of one contract part. A config lists the ones its engine carries; the order here is only the default.
STANDARD_PART_FIELDS = ('id', 'label', 'group', 'groups', 'component', 'description', 'evidence', 'material', 'disposition', 'shape_status')


class AssemblyRules:
    """Langley: seven systems, each made of a few assemblies. The first rule whose pattern matches a part id decides both, so every part sits in exactly one of each.

    `rules` is a list of (assembly id, system id, assembly title, pattern over part ids)."""

    def __init__(self, rules):
        self.rules = rules
        self._compiled = [(aid, sid, re.compile(pattern)) for aid, sid, _, pattern in rules]

    def assembly_of(self, part_id):
        """(system id, assembly id) of a part, or raises: every part must be placed."""
        for aid, sid, pattern in self._compiled:
            if pattern.match(part_id):
                return sid, aid
        raise ValueError('Part is in no assembly: ' + part_id)

    def place(self, part, components):
        system, assembly = self.assembly_of(part['id'])
        return system, [f'assembly:{assembly}']

    def tree(self, systems, parts, placements, inventory):
        used = {g[len('assembly:'):] for p in parts for g in p['groups']}
        tree = []
        for system, title, question in systems:
            tree.append(_node(system, title, 0, question))
            for aid, sid, atitle, _ in self.rules:
                if sid == system and aid in used:
                    tree.append(dict(id=f'assembly:{aid}', label=atitle, depth=1))
        return tree


class ComponentTree:
    """Wright: a part's own group is its system; the inventory's components are the second level, under the group of the first part that names them."""

    def place(self, part, components):
        return part['group'], [f"component:{c['id']}" for c in components]

    def tree(self, systems, parts, placements, inventory):
        group_of_component = {}
        for p in parts:
            for c in placements[p['id']]['components']:
                group_of_component.setdefault(c['id'], p['group'])
        unknown = {p['group'] for p in parts} - {s[0] for s in systems}
        if unknown:
            raise ValueError('Parts are in groups with no system title: ' + ', '.join(sorted(unknown)))
        tree = []
        for system, title, question in systems:
            if not any(p['group'] == system for p in parts):
                continue
            tree.append(_node(system, title, 0, question))
            for c in sorted((c for c in inventory['components'] if group_of_component.get(c['id']) == system), key=lambda c: (len(str(c['id'])), str(c['id']))):
                if any(f"component:{c['id']}" in p['groups'] for p in parts):
                    tree.append(dict(id=f"component:{c['id']}", label=c['name'], depth=1))
        return tree


class FlatGroups:
    """R10: the part's own group, one level, no inventory components. The groups come from the build context (the handoff lists them)."""

    def place(self, part, components):
        return part['group'], []

    def tree(self, systems, parts, placements, inventory):
        return [_node(system, title, 0, question) for system, title, question in systems]


def _node(node_id, title, depth, question=None):
    row = dict(id=node_id, label=title, depth=depth)
    if question:
        row['question'] = question
    return row


@dataclass(frozen=True)
class StudyConfig:
    """The per-engine settings of `build()`; see the module docstring."""
    scope: str
    reference: str
    grouping: object
    systems: object = ()                                  # a list of (id, title, question) or a callable(context) returning one
    viewpoint: Optional[str] = None
    part_fields: tuple = STANDARD_PART_FIELDS
    description: str = 'inventory'                        # 'inventory' (the component's text) or 'label'
    shape_status: str = ''
    part_extras: Optional[Callable] = None                # callable(part, context) -> dict, appended to each part
    motions: Optional[Callable] = None                    # callable(parts, context) -> list of motion dicts; None takes the `motions` argument of build()
    extra_fields: Optional[Callable] = None               # callable(parts, asset_sha256, context) -> dict of extra top-level fields
    gear_meshes: Optional[Callable] = None                # callable() -> list of mesh dicts; None leaves the field out
    remote_displays: bool = True                          # write `remoteDisplays: []`
    study: Optional[Path] = None                          # folder holding inventory.json
    key_order: tuple = ()


def _describe(component, label):
    return (f"{component['name']}. {component['function']}. Interfaces: {component['interfaces']}. {component['decision'].rstrip('.')}. Source: {component['locator']}.",
            component.get('disposition', 'simplified'))


def build(config, parts, asset_sha256, *, inventory=None, motions=None, context=None):
    """The contract dict for `parts` (id, label, group, evidence, material, in the CAD frame) and the exported asset's decoded hash."""
    context = context or {}
    if inventory is None and config.description == 'inventory':
        inventory = json.loads((config.study / 'inventory.json').read_text(encoding='utf-8'))
    inventory = inventory or {'components': []}
    systems = config.systems(context) if callable(config.systems) else list(config.systems)
    by_part = {}
    for component in inventory['components']:
        for part_id in component.get('part_ids', []):
            by_part.setdefault(part_id, []).append(component)
    placements, contract_parts = {}, []
    for p in parts:
        components = by_part.get(p['id'], []) if config.description == 'inventory' else []
        system, groups = config.grouping.place(p, components)
        placements[p['id']] = dict(components=components, system=system)
        if components:
            description, disposition = _describe(components[0], p['label'])
        elif config.description == 'inventory':
            description, disposition = p['label'] + '.', 'simplified'
        else:
            description, disposition = p['label'], None
        values = dict(id=p['id'], label=p['label'], group=system, groups=groups, component=components[0]['id'] if components else None,
                      description=description, evidence=p['evidence'], material=p.get('material'), disposition=disposition,
                      shape_status=config.shape_status)
        row = {name: values[name] for name in config.part_fields}
        if config.part_extras:
            row.update(config.part_extras(p, context))
        contract_parts.append(row)
    tree = config.grouping.tree(systems, contract_parts, placements, inventory)
    fields = dict(asset_sha256=asset_sha256, parts=contract_parts, groups=tree, reference=config.reference, scope=config.scope)
    motion_list = config.motions(parts, context) if config.motions else (motions or [])
    fields['motions'] = motion_list
    if config.viewpoint:
        fields['viewpoint'] = config.viewpoint
    if config.remote_displays:
        fields['remoteDisplays'] = []
    if config.gear_meshes:
        fields['gearMeshes'] = config.gear_meshes()
    if config.extra_fields:
        fields.update(config.extra_fields(contract_parts, asset_sha256, context))
    ordered = {key: fields[key] for key in config.key_order if key in fields}
    ordered.update({key: value for key, value in fields.items() if key not in ordered})
    return ordered


def dumps(contract):
    """The text a contract file holds (two-space indent, final newline), so a rebuild can be compared byte for byte."""
    return json.dumps(contract, indent=2) + '\n'


def rebuild_released(config, path, geometry, motions=None):
    """Rebuild the tree and part list of a released contract from a spec, keeping its asset hash and motions."""
    path = Path(path)
    old = json.loads(path.read_text(encoding='utf-8'))
    new = build(config, geometry['parts'], old['asset_sha256'], motions=motions if motions is not None else old['motions'])
    path.write_text(dumps(new), encoding='utf-8')
    return new


def diff(a, b, path=''):
    """Field-by-field differences between two contracts: a list of (path, kind, value in a, value in b). Key order is not a difference."""
    out = []
    numbers = (int, float)
    if type(a) is not type(b) and not (isinstance(a, numbers) and isinstance(b, numbers) and not isinstance(a, bool) and not isinstance(b, bool)):
        return [(path or '/', 'type', _short(a), _short(b))]
    if isinstance(a, dict):
        for key in a.keys() | b.keys():
            sub = f'{path}/{key}'
            if key not in b:
                out.append((sub, 'only in first', _short(a[key]), None))
            elif key not in a:
                out.append((sub, 'only in second', None, _short(b[key])))
            else:
                out += diff(a[key], b[key], sub)
    elif isinstance(a, list):
        if len(a) != len(b):
            out.append((path or '/', 'length', len(a), len(b)))
        for i, (x, y) in enumerate(zip(a, b)):
            out += diff(x, y, f'{path}[{i}]')
    elif a != b:
        out.append((path or '/', 'value', _short(a), _short(b)))
    return sorted(out, key=lambda row: row[0])


def _short(value, limit=120):
    text = json.dumps(value) if not isinstance(value, str) else value
    return text if len(text) <= limit else text[:limit - 1] + '…'
