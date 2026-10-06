"""Render the charts in docs/hermes-agent-multichain-jump.md as static SVGs.

The data is hardcoded from ODD snapshot 20261001T130407 (see the doc's Data
tables). Colors switch with prefers-color-scheme. Writes next to this script
unless an output directory is given:

    uv run python docs/img/hermes_charts.py [OUT_DIR]
"""
import sys
from datetime import date
from pathlib import Path

OUT = sys.argv[1] if len(sys.argv) > 1 else str(Path(__file__).parent)

STYLE = """<style>
  svg { font-family: system-ui, -apple-system, "Segoe UI", sans-serif; }
  .bg { fill: #fcfcfb; }
  .t1 { fill: #0b0b0b; } .t2 { fill: #52514e; }
  .real { fill: #c3c2b7; } .hermes { fill: #2a78d6; }
  .grid { stroke: #e1e0d9; } .axis { stroke: #c3c2b7; } .ref { stroke: #898781; }
  .gap { stroke: #fcfcfb; }
  @media (prefers-color-scheme: dark) {
    .bg { fill: #1a1a19; }
    .t1 { fill: #ffffff; } .t2 { fill: #c3c2b7; }
    .real { fill: #55544f; } .hermes { fill: #3987e5; }
    .grid { stroke: #2c2c2a; } .axis { stroke: #383835; } .ref { stroke: #898781; }
    .gap { stroke: #1a1a19; }
  }
</style>"""


def fmt(n):
    return f"{n:,}"


def legend(x, y):
    return (
        f'<rect x="{x}" y="{y - 10}" width="12" height="12" rx="2" class="real"/>'
        f'<text x="{x + 18}" y="{y}" class="t2">Devs with other activity in the ecosystem</text>'
        f'<rect x="{x + 290}" y="{y - 10}" width="12" height="12" rx="2" class="hermes"/>'
        f'<text x="{x + 308}" y="{y}" class="t2">hermes-agent-only devs</text>'
    )


def share_by_chain():
    rows = [
        ("zkSync", 7269, 7014), ("Avalanche", 7456, 7019), ("BNB Chain", 7662, 7017),
        ("Optimism", 7621, 7005), ("Polygon", 7959, 6996), ("Arbitrum", 8032, 7007),
        ("Base", 8102, 6965), ("Solana", 9389, 6974), ("Ethereum", 14336, 6927),
        ("Stellar", 3348, 0),
    ]
    rows.sort(key=lambda r: r[2] / r[1], reverse=True)
    mx = max(r[1] for r in rows)
    x0, W, y0, rh, bh = 110, 500, 112, 30, 20
    sx = lambda v: v / mx * W
    h = y0 + len(rows) * rh + 20
    out = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 780 {h}" width="780" height="{h}" font-size="12" role="img" '
           'aria-label="Sep 23 MAD by chain: about 7,000 devs in each of nine chains come only from hermes-agent; Stellar has none">',
           STYLE, f'<rect class="bg" width="780" height="{h}"/>',
           '<text x="20" y="30" font-size="16" font-weight="600" class="t1">About 7,000 devs in each of nine chains come only from hermes-agent</text>',
           '<text x="20" y="52" class="t2">MAD, 28-day window ending 2026-09-23 (ODD snapshot 20261001T130407).</text>',
           legend(20, 80),
           f'<text x="760" y="{y0 - 10}" text-anchor="end" class="t2">total MAD · hermes share</text>']
    for i, (eco, total, hermes) in enumerate(rows):
        y = y0 + i * rh
        real = total - hermes
        pct = round(hermes / total * 100)
        out.append(f'<text x="{x0 - 10}" y="{y + 15}" text-anchor="end" class="t1">{eco}</text>')
        out.append(f'<rect x="{x0}" y="{y}" width="{sx(real):.1f}" height="{bh}" class="real"/>')
        if hermes:
            out.append(f'<rect x="{x0 + sx(real) + 2:.1f}" y="{y}" width="{sx(hermes) - 2:.1f}" height="{bh}" class="hermes"/>')
        out.append(f'<text x="{x0 + sx(total) + 8:.1f}" y="{y + 15}" class="t1">{fmt(total)} · {pct}%</text>')
    out.append(f'<line x1="{x0}" x2="{x0}" y1="{y0 - 6}" y2="{y0 + len(rows) * rh - 4}" class="axis"/>')
    out.append('</svg>')
    return "\n".join(out)


def arbitrum_timeline():
    rows = [
        ("2026-01-07", 1895, 1), ("2026-01-21", 1935, 3), ("2026-02-04", 2118, 4),
        ("2026-02-18", 2043, 6), ("2026-03-04", 2033, 66), ("2026-03-18", 2050, 250),
        ("2026-04-01", 2195, 501), ("2026-04-15", 2972, 1461), ("2026-04-29", 3783, 2435),
        ("2026-05-13", 4224, 2942), ("2026-05-27", 4646, 3391), ("2026-06-10", 5073, 3872),
        ("2026-06-24", 6283, 5067), ("2026-07-08", 6543, 5350), ("2026-07-22", 6902, 5805),
        ("2026-08-05", 7369, 6313), ("2026-08-19", 7594, 6544), ("2026-09-02", 7707, 6638),
        ("2026-09-16", 7943, 6913),
    ]
    n = len(rows)
    x0, W, base, H, ymax = 70, 520, 380, 250, 8000
    sx = lambda i: x0 + i * W / (n - 1)
    sy = lambda v: base - v / ymax * H
    top = [(sx(i), sy(a)) for i, (_, a, _) in enumerate(rows)]
    mid = [(sx(i), sy(a - hm)) for i, (_, a, hm) in enumerate(rows)]
    pts = lambda ps: " L".join(f"{x:.1f},{y:.1f}" for x, y in ps)
    real_path = f"M{pts(mid)} L{sx(n - 1):.1f},{base} L{sx(0):.1f},{base} Z"
    hermes_path = f"M{pts(top)} L{pts(list(reversed(mid)))} Z"
    iref = [r[0] for r in rows].index("2026-07-22")
    last = rows[-1]
    out = ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 780 430" width="780" height="430" font-size="12" role="img" '
           'aria-label="Arbitrum MAD every two weeks in 2026: the hermes-agent-only layer starts in March, months before any fork was mapped on Jul 22">',
           STYLE, '<rect class="bg" width="780" height="430"/>',
           '<text x="20" y="30" font-size="16" font-weight="600" class="t1">Arbitrum: the hermes-agent layer starts in March, before any fork was mapped</text>',
           '<text x="20" y="52" class="t2">MAD (28-day window) every two weeks, as restated in ODD snapshot 20261001T130407.</text>',
           legend(20, 80)]
    for v in range(0, ymax + 1, 2000):
        out.append(f'<line x1="{x0}" x2="{x0 + W}" y1="{sy(v):.1f}" y2="{sy(v):.1f}" class="grid"/>')
        out.append(f'<text x="{x0 - 8}" y="{sy(v) + 4:.1f}" text-anchor="end" class="t2">{fmt(v)}</text>')
    out.append(f'<path d="{real_path}" class="real"/>')
    out.append(f'<path d="{hermes_path}" class="hermes"/>')
    # 2px surface seam between the two layers
    out.append(f'<path d="M{pts(mid)}" fill="none" stroke-width="2" class="gap"/>')
    out.append(f'<line x1="{x0}" x2="{x0 + W}" y1="{base}" y2="{base}" class="axis"/>')
    for i, (hz, _, _) in enumerate(rows):
        if i % 3 == 0:
            d = date.fromisoformat(hz)
            out.append(f'<text x="{sx(i):.1f}" y="{base + 18}" text-anchor="middle" class="t2">{d:%b} {d.day}</text>')
    rx = sx(iref)
    out.append(f'<line x1="{rx:.1f}" x2="{rx:.1f}" y1="{sy(ymax):.1f}" y2="{base}" stroke-dasharray="4 3" class="ref"/>')
    out.append(f'<text x="{rx - 6:.1f}" y="{sy(ymax) - 8:.1f}" text-anchor="end" class="t2">Jul 22: first forks mapped to all nine chains</text>')
    ex = sx(n - 1) + 8
    out.append(f'<text x="{ex:.1f}" y="{sy(last[1]) + 4:.1f}" class="t1">{fmt(last[1])} reported</text>')
    out.append(f'<text x="{ex:.1f}" y="{sy(last[1] - last[2]) + 4:.1f}" class="t1">{fmt(last[1] - last[2])} without hermes</text>')
    out.append(f'<text x="{x0}" y="{base + 36}" class="t2">2026</text>')
    out.append('</svg>')
    return "\n".join(out)


with open(f"{OUT}/hermes-share-by-chain.svg", "w") as f:
    f.write(share_by_chain() + "\n")
with open(f"{OUT}/hermes-arbitrum-timeline.svg", "w") as f:
    f.write(arbitrum_timeline() + "\n")
