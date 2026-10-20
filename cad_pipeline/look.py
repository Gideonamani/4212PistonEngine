"""Shared material table, role-aware metallic finishes, per-part tone variation, and angle-based smoothing for Blender CAD stages.

Used by present.py, review_gtsio_r10.py and rig_animated_study.py (the one rig behind rig_wright.py, rig_langley.py and rig_gtsio_review.py) so every stage shares
one canonical material table instead of duplicating COLORS dictionaries or silently falling back to steel.
"""
import math
from pathlib import Path
import re
import zlib

MATERIALS = {
    'steel': dict(base_color=(0.58, 0.63, 0.68, 1.0), metallic=0.92, roughness=0.18),
    'aluminium': dict(base_color=(0.75, 0.78, 0.81, 1.0), metallic=0.80, roughness=0.33),
    'cast_iron': dict(base_color=(0.22, 0.24, 0.27, 1.0), metallic=0.72, roughness=0.40),
    'bronze': dict(base_color=(0.78, 0.49, 0.18, 1.0), metallic=0.92, roughness=0.20),
    'brass': dict(base_color=(0.82, 0.66, 0.24, 1.0), metallic=0.92, roughness=0.20),
    'babbitt': dict(base_color=(0.79, 0.80, 0.75, 1.0), metallic=0.90, roughness=0.18),
    'copper': dict(base_color=(0.86, 0.43, 0.22, 1.0), metallic=0.95, roughness=0.16),
    'platinum': dict(base_color=(0.86, 0.88, 0.91, 1.0), metallic=0.96, roughness=0.14),
    'gasket': dict(base_color=(0.36, 0.26, 0.16, 1.0), metallic=0.0, roughness=0.78),
    'rubber': dict(base_color=(0.055, 0.065, 0.075, 1.0), metallic=0.0, roughness=0.55),
    'insulator': dict(base_color=(0.90, 0.88, 0.78, 1.0), metallic=0.0, roughness=0.20),
    'porcelain': dict(base_color=(0.88, 0.86, 0.78, 1.0), metallic=0.0, roughness=0.20),
    'wood': dict(base_color=(0.28, 0.15, 0.06, 1.0), metallic=0.0, roughness=0.65),
}

ROLE_SUBFINISHES = {
    'steel_barrel': dict(base_color=(0.17, 0.19, 0.22, 1.0), metallic=0.78, roughness=0.36),
    'steel_cover_gold': dict(base_color=(0.72, 0.58, 0.30, 1.0), metallic=0.85, roughness=0.24),
    'steel_polished': dict(base_color=(0.80, 0.83, 0.87, 1.0), metallic=0.96, roughness=0.12),
    'steel_forged': dict(base_color=(0.34, 0.38, 0.43, 1.0), metallic=0.88, roughness=0.25),
    'steel_hardware': dict(base_color=(0.64, 0.67, 0.71, 1.0), metallic=0.92, roughness=0.18),
    'aluminium_forged': dict(base_color=(0.80, 0.82, 0.85, 1.0), metallic=0.88, roughness=0.22),
}

ALIASES = {
    'aluminum': 'aluminium',
    'cast iron': 'cast_iron',
}

COLORS = {name: spec['base_color'] for name, spec in MATERIALS.items()}
DEFAULT_SMOOTH_ANGLE_DEG = 30.0
HIGH_PART_COUNT_THRESHOLD = 500
DEFAULT_VARIATION = 0.08
DEFAULT_TONE_BUCKETS = 9


def canonical_material(name):
    """Return the canonical material key or raise ValueError on unknown material names."""
    if not isinstance(name, str) or not name.strip():
        raise ValueError(f'Unknown CAD material: {name!r}')
    key = name.strip().lower()
    key = ALIASES.get(key, key.replace(' ', '_'))
    key = ALIASES.get(key, key)
    if key not in MATERIALS:
        raise ValueError(f'Unknown CAD material: {name!r}')
    return key


def material_spec(name):
    """Return a copy of the canonical material finish dict (base_color, metallic, roughness)."""
    return dict(MATERIALS[canonical_material(name)])


def role_subfinish(canon, part_id):
    """Return (subfinish_key, spec) when a high-part-count assembly part matches a machined/nitrided/forged role."""
    if not part_id:
        return canon, MATERIALS[canon]
    pid = str(part_id)
    if canon == 'steel':
        if pid.startswith('CylinderBarrel'):
            return 'steel_barrel', ROLE_SUBFINISHES['steel_barrel']
        if pid.startswith(('IntakeRockerCover', 'ExhaustRockerCover')):
            return 'steel_cover_gold', ROLE_SUBFINISHES['steel_cover_gold']
        if re.search(r'(Pin|Valve\d|Pushrod|RockerShaft|PropellerShaft|Plunger|Sleeve|Needle|Roller)', pid):
            return 'steel_polished', ROLE_SUBFINISHES['steel_polished']
        if re.search(r'(ConnectingRod|RodCap|Camshaft|Gear|Pinion|Idler|Counterweight|Damper|Carrier|Hub)', pid):
            return 'steel_forged', ROLE_SUBFINISHES['steel_forged']
        if re.search(r'(Bolt|Nut|Screw|Stud|Washer|Plug|Cotter|Key|Lock|Retainer)', pid):
            return 'steel_hardware', ROLE_SUBFINISHES['steel_hardware']
    elif canon == 'aluminium' and pid.startswith('Piston'):
        return 'aluminium_forged', ROLE_SUBFINISHES['aluminium_forged']
    return canon, MATERIALS[canon]


def tone_bucket(part_id, buckets=DEFAULT_TONE_BUCKETS):
    """Deterministic tone bucket index in [0, buckets - 1] for a stable part_id."""
    if buckets <= 1 or not part_id:
        return 0
    return zlib.crc32(str(part_id).encode('utf-8')) % buckets


def tone_factor(part_id, max_variation=DEFAULT_VARIATION, buckets=DEFAULT_TONE_BUCKETS):
    """Deterministic brightness multiplier in [1 - max_variation, 1 + max_variation]."""
    if buckets <= 1 or not part_id or max_variation == 0:
        return 1.0
    idx = tone_bucket(part_id, buckets=buckets)
    step = (2.0 * float(max_variation)) / (buckets - 1)
    return 1.0 - float(max_variation) + idx * step


def varied_color(base_color, factor):
    """Scale RGB channels by factor (clamped to [0, 1]) while keeping alpha unchanged."""
    r, g, b, a = base_color
    return (
        min(1.0, max(0.0, round(r * factor, 4))),
        min(1.0, max(0.0, round(g * factor, 4))),
        min(1.0, max(0.0, round(b * factor, 4))),
        a,
    )


def part_finish(material_name, part_id=None, vary=False, max_variation=DEFAULT_VARIATION, buckets=DEFAULT_TONE_BUCKETS):
    """Resolve (material_key, base_color, metallic, roughness) for a part, optionally with role-aware sub-finishes and tone variation."""
    canon = canonical_material(material_name)
    if vary and part_id:
        subkey, spec = role_subfinish(canon, part_id)
        bucket = tone_bucket(part_id, buckets=buckets)
        factor = tone_factor(part_id, max_variation=max_variation, buckets=buckets)
        color = varied_color(spec['base_color'], factor)
        key = f'{subkey}_t{bucket}'
    else:
        spec = MATERIALS[canon]
        color = spec['base_color']
        key = canon
    return key, color, spec['metallic'], spec['roughness']


def blender_material(material_name, part_id=None, vary=False, cache=None, max_variation=DEFAULT_VARIATION, buckets=DEFAULT_TONE_BUCKETS):
    """Get or create a Blender Principled BSDF material for a part; raises ValueError on unknown material."""
    import bpy
    key, color, metallic, roughness = part_finish(
        material_name, part_id=part_id, vary=vary, max_variation=max_variation, buckets=buckets
    )
    if cache is not None and key in cache:
        return cache[key]
    mat = bpy.data.materials.get(key) or bpy.data.materials.new(key)
    mat.diffuse_color = color
    mat.use_nodes = True
    shader = mat.node_tree.nodes.get('Principled BSDF')
    if shader is not None:
        shader.inputs['Base Color'].default_value = color
        shader.inputs['Metallic'].default_value = metallic
        shader.inputs['Roughness'].default_value = roughness
    if cache is not None:
        cache[key] = mat
    return mat


def apply_studio_world(scene, background_color=(0.055, 0.075, 0.11, 1.0), env_strength=1.15):
    """Configure Blender's built-in studio.exr HDRI for metallic reflections while keeping a dark camera background."""
    import bpy
    world = bpy.data.worlds.new('Workshop')
    world.color = background_color[:3]
    world.use_nodes = True
    nodes = world.node_tree.nodes
    links = world.node_tree.links
    studio_exr = Path(bpy.utils.resource_path('LOCAL')) / 'datafiles/studiolights/world/studio.exr'
    if studio_exr.exists():
        nodes.clear()
        tex_env = nodes.new('ShaderNodeTexEnvironment')
        tex_env.image = bpy.data.images.load(str(studio_exr))
        bg_env = nodes.new('ShaderNodeBackground')
        bg_env.inputs['Strength'].default_value = env_strength
        bg_cam = nodes.new('ShaderNodeBackground')
        bg_cam.inputs['Color'].default_value = background_color
        bg_cam.inputs['Strength'].default_value = 1.0
        light_path = nodes.new('ShaderNodeLightPath')
        mix = nodes.new('ShaderNodeMixShader')
        out_node = nodes.new('ShaderNodeOutputWorld')
        links.new(tex_env.outputs['Color'], bg_env.inputs['Color'])
        links.new(light_path.outputs['Is Camera Ray'], mix.inputs['Fac'])
        links.new(bg_env.outputs['Background'], mix.inputs[1])
        links.new(bg_cam.outputs['Background'], mix.inputs[2])
        links.new(mix.outputs['Shader'], out_node.inputs['Surface'])
    else:
        nodes['Background'].inputs[0].default_value = background_color
        nodes['Background'].inputs[1].default_value = 0.45
    scene.world = world
    return world


def apply_smooth_by_angle(mesh, angle_deg=DEFAULT_SMOOTH_ANGLE_DEG):
    """Apply smooth shading with sharp edges above angle_deg on a Blender mesh."""
    angle = float(angle_deg)
    if not 0.0 < angle < 180.0:
        raise ValueError('Surface shading angle must be between 0 and 180 degrees')
    poly_count = len(mesh.polygons)
    if poly_count:
        mesh.polygons.foreach_set('use_smooth', [True] * poly_count)
    mesh.set_sharp_from_angle(angle=math.radians(angle))
    mesh.update()
