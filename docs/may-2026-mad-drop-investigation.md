# The "Drop of Death" — May 2026 MAD dip investigation

| | |
| --- | --- |
| **Date:** | 2026-06-09 (investigation completed earlier; this is the writeup) |
| **Verdict:** | ✅ Not an exodus. The drop is the **mechanical 28-day roll-off of a late-April bounty surge** (Drips Wave 4, Apr 22–29 2026) aging out of the window. |

> **TL;DR:** Stellar's headline MAD fell **1,676 → 1,075** (developerreport.com,
> May 19 → May 26 2026), which reads like a collapse. It isn't. MAD counts
> developers active in a **28-day rolling window**; a one-week activity surge
> inflates it for 28 days and then drops off the back of the window all at once.
> The surge was **Drips Wave 4**, a Stellar bounty sprint. Stellar's real,
> sticky base is **≈1,000–1,100 devs** — roughly where MAD settled. Nothing
> left.

## Executive summary

In late May 2026, Stellar's "Monthly Active Developers" (MAD) metric — the
headline number on developerreport.com — fell sharply, from **1,676 on May 19 to
1,075 on May 26**. On its face that looks like a third of the developer base
disappearing in a week, and it was the founding question this project was built
to answer.

It was not an exodus. It was a **measurement artifact of how MAD is defined.**
MAD = developers with ≥1 commit in a **28-day rolling window**. Any concentrated
burst of activity — a hackathon, a bootcamp, or in this case a bounty program —
pulls a large number of one-off contributors into the window, inflates MAD for
the next four weeks, and then, ~28 days later, those contributors fall off the
_back_ of the window simultaneously. The result is a cliff in the metric that
corresponds to **no change whatsoever in the underlying, ongoing developer
base.** A surge sets up a matching drop ~28 days later — though, as the next
section shows, that drop only becomes _visible_ when it isn't masked by an even
larger surge arriving in the meantime (which is exactly why the three earlier
Drips Waves left no mark, and this one did).

The surge in question was **Drips Wave 4**, the Stellar Wave "Fix, Merge, Earn"
bounty sprint that ran **April 22–29, 2026**
(https://www.drips.network/wave/stellar). Drips Wave is a recurring
~one-week-per-month bounty cycle launched with SDF in January 2026. We confirmed
it was a grant/bounty program — **not** a hackathon and **not** a bootcamp —
from the activity's fingerprint: 40–63 developers per repo making only ~2–7
commits each, many of them touching 3–33 different repos in a single week (a
bounty-farming pattern), across dozens of freshly-created project repos that all
went silent on April 29.

We established the roll-off explanation four independent ways (daily-activity
shape, day-by-day windowed decay, cohort exit schedule, and repo attribution —
detailed below), so the conclusion does not rest on any single line of evidence.

The number that actually matters for tracking Stellar's health is the **retained
base of ≈1,000–1,100 developers** (the 28-day-windowed "retained devs" series),
which the dip essentially returned to. Programs like Drips Wave transiently push
MAD _above_ that base; the subsequent roll-off is the metric relaxing back
toward it, not a loss. The practical upshot: **read MAD against the
daily-activity bars and the retained-devs line, and expect a roll-off echo ~28
days after every program band on the chart** — those drops are scheduled by the
window, not signals of churn.

## Why a drop was always going to happen

MAD's 28-day rolling window is the whole mechanism. When a burst of activity
happens on April 22–29, every participating developer counts toward MAD for the
following 28 days — then exits the window all at once ~4 weeks later. The line
drops even though the real, ongoing base is unchanged. This is a property of the
metric, not an event in the ecosystem. **But the drop only becomes _visible_ if
a larger surge doesn't arrive to replace the departing one** — see "Why _this_
wave and not the earlier ones?" below for why W4 was the first roll-off that
showed.

## Why _this_ wave and not the earlier ones?

There had already been three Drips Waves before this one (Jan, Feb, Mar), each a
comparable ~one-week bounty sprint with a large daily-activity spike — yet
**none produced a visible MAD drop.** In fact, the six largest week-over-week
declines in the entire Jan–Jun series are _all_ clustered in late May 2026;
nothing elsewhere comes close. So the roll-off mechanism above is necessary but
not sufficient — the real question is why W4's roll-off was the first one that
showed.

The answer: **Waves 1–4 rolled off too, but each roll-off was over-written by a
_larger_ wave arriving inside the 28-day window, so the windowed MAD only ever
stepped _up_ — an escalator.** The drop appears the first time that escalator
stalls, and two things made W4→W5 the first stall.

### 1. The waves grew monotonically through W4, then stopped

Peak daily-active developers per wave, and the windowed-MAD plateau each one
lifted the line to:

| Wave | Dates | Peak daily devs | Windowed-MAD plateau |
| --- | --- | ---: | ---: |
| W1 | Jan 21–31 | 423 | ~1,116 |
| W2 | Feb 19–26 | 549 | ~1,261 |
| W3 | Mar 23–30 | 652 | ~1,531 |
| W4 | Apr 22–29 | **700** | **~1,707** |
| W5 | May 26–Jun 2 | 696 | (unseen — at data horizon) |

Each new wave exceeded its predecessor, so every handoff stepped the line
higher. W5 was the **first wave that didn't exceed the one before it** (696 ≈
700), so for the first time the outgoing wave wasn't over-replaced — the line
fell back instead of stepping up.

### 2. The inter-wave gap finally caught up with the 28-day window.

A wave's activity lingers in the window ~27 days past its last day. As long as
the next wave _starts_ before that, the outgoing tail and the incoming wave
overlap inside the window and no hole opens. The end-of-wave → start-of-next
gaps:

| Transition | End → start gap |
| --- | ---: |
| W1 → W2 | 19 days |
| W2 → W3 | 25 days |
| W3 → W4 | 23 days |
| W4 → W5 | **27 days** |

The first three gaps (19–25 days) were comfortably under the 28-day window, so
each outgoing wave's tail overlapped the next wave — seamless handoff, no
trough. W4→W5's **27-day gap ≈ the window length**, collapsing the overlap to ~1
day: around May 26 the window held almost none of W4 (only its Apr 29 tail) and
almost none of W5 (only its May 26 first day). That empty handoff _is_ the
trough.

**3. W4 injected the largest transient cohort.** Its window carried the most
one-time developers of any wave (~265, 16% of the window) — precisely the devs
who don't return, so they roll off cleanly. The one-time share collapsed to 9%
(~103) by May 26 as that cohort left and wasn't replaced.

> **Corroborating signal:** the same mechanism appears in miniature in mid-March
> — a small dip (1,261 → 1,209) when W2's earliest days briefly left the window
> before W3 ramped. It never became a cliff because W2 was small and W3 arrived
> quickly. The May drop is that same effect, scaled up by W4's size and the long
> W4→W5 gap.

> ⚠️ **Horizon caveat (and a testable prediction):** our extract ends June 1, so
> we catch the W4-exit valley _before_ W5's volume accumulates in the 28-day
> window. Because W5 ≈ W4 in size, MAD should **partially refill** toward the
> ~1,700 plateau as W5 matures — we just can't see it yet. So the "drop of
> death" is best read as the first _visible trough_ in a rising program-driven
> series, not a structural decline. A re-pull after ~June 23 (when W5 is fully
> inside the window) would confirm this.

## What caused the surge: Drips Wave 4

- **Program:** Drips Wave 4 — the Stellar Wave "Fix, Merge, Earn" bounty sprint.
- **Dates:** April 22–29, 2026 (lines up exactly with the surge).
- **Context:** Drips Wave is a recurring ~one-week-per-month bounty cycle,
  launched with SDF in January 2026. https://www.drips.network/wave/stellar
- **Classification:** grant/bounty program — **not** a hackathon, **not** a
  bootcamp. Rise In (bootcamps) was ruled out by the per-repo swarm signature
  below.
- Confirmed and seeded into `events.json`, so it renders as the program band on
  the dashboard chart.

> **Platform note:** **Drips Wave** and **GrantFox** are _separate, parallel_
> contributor platforms — both filling the gap OnlyDust left when it exited Web3
> — **not** one built on the other. The April surge was Drips Wave; GrantFox is
> unrelated to it. (An earlier draft conflated the two.)

## The evidence — four independent angles

1. **Daily activity spiked, then vanished.** Daily-active devs jumped from a
   ~120/day baseline to a **peak of ~692/day** during Apr 22–29, and were back
   to baseline by May 1. A sharp box, not a step change.

2. **The windowed line declined day-by-day as surge days left the window.** The
   `all_devs` decay tracked the 28-day-delayed exit of the surge cohort
   precisely — the signature of a roll-off, not a sudden departure.

3. **Cohort exit schedule.** ~**72%** of the developers in the May-19 window
   were last active during the two surge weeks — i.e. bounty participants whose
   window membership was about to expire, not contributors who churned.

4. **Repo attribution + bounty-farming signature.** Dozens of new project repos
   (the `-contracts`/`-frontend`/`-backend` triplets) appeared and ended cleanly
   on Apr 29. Per repo: ~**2–7 commits across 40–63 devs**, with many
   contributors touching **3–33 repos in one week** — the classic bounty-farming
   pattern, not organic project work.

## The number that actually matters

Stellar's **retained base is ≈1,000–1,100 developers** — the 28d-windowed
"retained devs (prior 28d)" line on the chart. That's the sticky population.
Programs transiently inflate MAD _above_ it, then it relaxes back. The dip "to"
1,075 is essentially a return to baseline, not a loss.

> ⚠️ **Don't confuse two scales:** the ~1,000–1,100 _retained_ (28-day-windowed)
> base is **not** the ~130/day "typical daily base" stat card. Different
> metrics, different windows.

## How to read this on the dashboard

- The **bold amber MAD line** is what Developer Report plots; the **faint daily
  bars** behind it are daily-active devs. When the line falls while the bars
  hold steady, you're watching a past surge roll off — not an exodus. That
  overlay exists specifically to make this legible.
- The **program bands** (e.g. Drips Wave) mark the surge windows; expect a
  roll-off echo ~28 days after each band's end.

## Terminology & invariants (for future dips)

- **MAD, not MAU:** we standardize on **MAD** because the metric counts
  _developers_; developerreport.com's live series labels the identical number
  "MAU."
- **Validation invariant:** `all_devs = exclusive_devs + multichain_devs` — a
  quick sanity check when a number looks off.

## Open follow-up

- **New-vs-returning surge labeling (not yet built):** a "first-ever Stellar
  commit during the window?" flag would let us auto-classify a surge as
  new-contributor-driven vs. returning-bounty-hunter-driven, instead of
  investigating by hand each time.
