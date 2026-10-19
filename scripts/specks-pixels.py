"""Pixel check for v0.2.3.1 specks: for each frame, before a branch reaches its end point, the area around that end
point (the part position) must be plain plate colour; and before branch 1 starts the whole part row must be clean.
Usage: python3 scripts/specks-pixels.py shots/<tag>-specks.json"""
import json, sys
from PIL import Image
DPR, TB = 2, [100, 340]   # teach.ts: branches start growing at +0.10 / +0.34 s after the answer is at the top (each 240 ms, W -> P)
GROW = 100                 # a growing branch's tip is still >60 px from its end point 100 ms into its growth, so a box at P stays a speck test
rows = json.load(open(sys.argv[1])); base = sys.argv[1].rsplit('/', 1)[0] + '/'
bad = 0; report = []
for r in rows:
    im = Image.open(base + r['file']).convert('RGB'); px = im.load()
    fx, w, h = r['fx'], r['fx']['w'], r['fx']['h']
    rel = r['at'] - r['top']                      # ms after the answer reached the top (negative = still rising)
    P = [(fx['x'] + w / 2 - 88, fx['y'] + h * 0.63), (fx['x'] + w / 2 + 88, fx['y'] + h * 0.63)]
    ref = px[int((fx['x'] + 8) * DPR), int((fx['y'] + h * 0.63) * DPR)]   # plate colour at the row's left edge
    def dirty(x0, y0, x1, y1):
        n = 0
        for y in range(int(y0 * DPR), int(y1 * DPR)):
            for x in range(int(x0 * DPR), int(x1 * DPR)):
                c = px[x, y]
                if max(abs(c[k] - ref[k]) for k in range(3)) > 6: n += 1
        return n
    found = []
    for side in (0, 1):
        if rel < TB[side] + GROW:  # this branch has not started, or its tip is still far from the end point
            n = dirty(P[side][0] - 12, P[side][1] - 12, P[side][0] + 12, P[side][1] + 12)
            if n: found.append(f'side{side}:{n}px')
    if 0 <= rel < TB[0]:           # answer at the top, no branch yet: the whole part row must be clean (while rising, the answer itself crosses it)
        n = dirty(fx['x'] + 20, P[0][1] - 14, fx['x'] + w - 20, P[0][1] + 14)
        if n: found.append(f'row:{n}px')
    bad += bool(found)
    report.append(f"{r['sum']:>6} {r['off']} (at {r['at']}, {rel:+d} ms vs top) {'SPECKS ' + ' '.join(found) if found else 'clean'}")
print('\n'.join(report))
print(f'{len(rows)} frames, {bad} with specks ->', 'PASS' if not bad else 'FAIL')
sys.exit(1 if bad else 0)
