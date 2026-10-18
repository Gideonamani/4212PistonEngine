"""Authoring helpers: build the definition records for data/gtsio520-part-definitions.json (see docs/gtsio-part-details.md)."""
import json, re, os
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
# Source snapshots the assembler reads (the books and the model are outside Git or too large to read each time).
INPUTS = REPO / "data" / "gtsio_part_authoring"

STAT = {'s': 'specified', 'd': 'derived', 'i': 'inferred', 'x': 'illustrative'}

# student-visible source names
IPC = "IO-520 parts catalogue (a similar engine)"
MAN = "GTSIO-520 overhaul manual"
MOD = "R10 model layout"
ILL = "A prompt for the learner; it claims nothing about the engine."

DEFS = []


def F(text, st, src):
    """A claim: text + status + source (specified/derived) or basis (inferred/illustrative)."""
    key = 'source' if st in ('s', 'd') else 'basis'
    return {'text': text, 'status': STAT[st], key: src}


def W(ids, st, src):
    key = 'source' if st in ('s', 'd') else 'basis'
    return {'ids': list(ids), 'status': STAT[st], key: src}


def LOOK(text):
    return {'text': text, 'status': 'illustrative', 'basis': ILL}


def M(fig, callout):
    return {'_man': (fig, callout)}


def D(id, title, system, fn, sits, works, look, tsrc, made=None, aliases=(), cat=None, terms=None,
      man=(), align=('', ''), locators=(), family=None):
    """cat = (description, basis) basis: 'io520' | 'gtsio' | 'derived'."""
    rec = {
        'id': id,
        'family': family or title,
        'review': 'draft',
        'student': {
            'title': {'text': title, 'status': STAT[tsrc[0]], ('source' if tsrc[0] in 'sd' else 'basis'): tsrc[1]},
            'aliases': list(aliases),
            'system': system,
            'function': fn,
            'madeOf': made,
            'sits': sits,
            'worksWith': works,
            'lookFor': look,
            'catalogue': ({'description': cat[0], 'basis': cat[1]} if cat else None),
        },
        'engineering': {
            'gtsioManual': list(man),
            'contractLocators': list(locators),
            'alignment': {'result': align[0], 'note': align[1]},
        },
        '_terms': terms,
    }
    DEFS.append(rec)
    return rec
