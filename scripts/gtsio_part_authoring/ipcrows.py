"""Parse OCR'd IO-520 IPC page text (psm 6) into rows: page, figure, index, part number, description, qty, code, raw line.

Run once, from the OCR text pages (p06.txt ... p101.txt) of the Continental IO-520 parts catalogue, which live outside the repository:

    python scripts/gtsio_part_authoring/ipcrows.py <folder with the p*.txt pages> [words to list]

It writes data/gtsio_part_authoring/ipc_rows.json, the snapshot the assembler reads.
"""
import re, json, os, sys
from lib import INPUTS

DEFAULT_FIG = {6: 1, 7: 2, 8: 2, 9: 3, 10: 3, 11: 4, 12: 5, 13: 5, 14: 6, 15: 7, 16: 8, 17: 9, 18: 10, 19: 11, 20: 13,
               21: 13, 22: 14, 23: 15, 24: 15, 26: 16, 28: 17, 29: 18, 30: 19, 31: 20, 32: 21, 35: 24, 36: 25, 37: 26,
               51: 34, 53: 35, 55: 36}

PN = r"(No Number|[A-Z]{0,4}\d[\w\-]*(?:[ ,.]\s?\d+)?)"
JUNK_LEAD = r"[\s.+$¥¢*«»~'\"`‘’,_|;:°!?\-]*"


def load_pages(folder):
    pages = {}
    for n in range(6, 102):
        f = os.path.join(folder, f"p{n:02d}.txt")
        if os.path.exists(f):
            pages[n] = open(f, encoding='utf-8', errors='replace').read().splitlines()
    return pages


def clean_desc(s):
    s = re.sub(r"^" + JUNK_LEAD, "", s)
    s = re.sub(r"^(?:[a-z¥¢]{1,2}\s+)?(?:\.\s*)+", "", s)   # leading level dots
    s = re.sub(r"^[.\s«»]+", "", s)
    # cut at leader-dot noise
    m = re.search(r"\s(?:\.\s?){1,3}\s*\d|\s\.\s|\.{2,}|\s(?:[a-z]{2}\s){2,}|\s{3,}", s)
    if m:
        s = s[:m.start()]
    s = re.sub(r"\s+\d+\s*[A-Z]{0,7}\s*$", "", s)
    return s.strip(" .,~-_")


def rows(folder):
    pages = load_pages(folder)
    out = []
    for n, lines in sorted(pages.items()):
        fig = DEFAULT_FIG.get(n)
        for ln in lines:
            m = re.match(r"^\s*[a-z|;:\-_~]{0,3}\s*(\d{1,2})\s*-\s{1,6}(?!\d)", ln)   # "13-    539742" figure marker
            if m:
                fig = int(m.group(1))
            m2 = re.match(r"^\s*[^A-Za-z0-9]{0,6}\s*(?:(\d{1,2})\s*-\s*)?[-~—]?\s*(\d{1,2})?\s+" + PN + r"\s+(.*)$", ln)
            if not m2:
                continue
            idx = m2.group(2)
            pn = m2.group(3).strip()
            rest = m2.group(4)
            out.append({'page': n, 'figure': fig, 'index': idx, 'pn': pn, 'desc': clean_desc(rest), 'raw': ln.strip()})
    return out


if __name__ == '__main__':
    r = rows(sys.argv[1])
    json.dump(r, open(INPUTS / 'ipc_rows.json', 'w', encoding='utf-8'), indent=0, ensure_ascii=False)
    print(len(r), 'rows')
    q = [a.lower() for a in sys.argv[2:]]
    for x in r:
        if q and not any(t in (x['desc'] + ' ' + x['pn']).lower() for t in q):
            continue
        print(f"p{x['page']:02d} fig{x['figure']} -{x['index']} | {x['pn']:14s} | {x['desc'][:60]}")
