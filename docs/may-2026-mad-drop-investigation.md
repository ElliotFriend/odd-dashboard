# The "Drop of Death" — May 2026 MAD dip investigation

**Date:** 2026-06-09 (investigation completed earlier; this is the writeup) ·
**Verdict:** ✅ Not an exodus. The drop is the **mechanical 28-day roll-off of a
late-April bounty surge** (Drips Wave 4, Apr 22–29 2026) aging out of the window.

> **TL;DR:** Stellar's headline MAD fell **1,676 → 1,075** (developerreport.com,
> May 19 → May 26 2026), which reads like a collapse. It isn't. MAD counts
> developers active in a **28-day rolling window**; a one-week activity surge
> inflates it for 28 days and then drops off the back of the window all at once.
> The surge was **Drips Wave 4**, a Stellar bounty sprint. Stellar's real,
> sticky base is **≈1,000–1,100 devs** — roughly where MAD settled. Nothing left.

## Executive summary

In late May 2026, Stellar's "Monthly Active Developers" (MAD) metric — the headline
number on developerreport.com — fell sharply, from **1,676 on May 19 to 1,075 on
May 26**. On its face that looks like a third of the developer base disappearing in a
week, and it was the founding question this project was built to answer.

It was not an exodus. It was a **measurement artifact of how MAD is defined.** MAD =
developers with ≥1 commit in a **28-day rolling window**. Any concentrated burst of
activity — a hackathon, a bootcamp, or in this case a bounty program — pulls a large
number of one-off contributors into the window, inflates MAD for the next four weeks,
and then, ~28 days later, those contributors fall off the *back* of the window
simultaneously. The result is a cliff in the metric that corresponds to **no change
whatsoever in the underlying, ongoing developer base.** A surge mathematically
guarantees a matching drop about 28 days later.

The surge in question was **Drips Wave 4**, the Stellar Wave "Fix, Merge, Earn"
bounty sprint that ran **April 22–29, 2026** (https://www.drips.network/wave/stellar).
Drips Wave is a recurring ~one-week-per-month bounty cycle launched with SDF in
January 2026. We confirmed it was a grant/bounty program — **not** a hackathon and
**not** a bootcamp — from the activity's fingerprint: 40–63 developers per repo
making only ~2–7 commits each, many of them touching 3–33 different repos in a single
week (a bounty-farming pattern), across dozens of freshly-created project repos that
all went silent on April 29.

We established the roll-off explanation four independent ways (daily-activity shape,
day-by-day windowed decay, cohort exit schedule, and repo attribution — detailed
below), so the conclusion does not rest on any single line of evidence.

The number that actually matters for tracking Stellar's health is the **retained
base of ≈1,000–1,100 developers** (the 28-day-windowed "retained devs" series), which
the dip essentially returned to. Programs like Drips Wave transiently push MAD *above*
that base; the subsequent roll-off is the metric relaxing back toward it, not a loss.
The practical upshot: **read MAD against the daily-activity bars and the retained-devs
line, and expect a roll-off echo ~28 days after every program band on the chart** —
those drops are scheduled by the window, not signals of churn.

## Why a drop was always going to happen

MAD's 28-day rolling window is the whole mechanism. When a burst of activity happens
on April 22–29, every participating developer counts toward MAD for the following 28
days — then exits the window all at once ~4 weeks later. The line drops even though
the real, ongoing base is unchanged. **A surge guarantees a matching cliff ~28 days
later.** This is a property of the metric, not an event in the ecosystem.

## What caused the surge: Drips Wave 4

- **Program:** Drips Wave 4 — the Stellar Wave "Fix, Merge, Earn" bounty sprint.
- **Dates:** April 22–29, 2026 (lines up exactly with the surge).
- **Context:** Drips Wave is a recurring ~one-week-per-month bounty cycle, launched
  with SDF in January 2026. https://www.drips.network/wave/stellar
- **Classification:** grant/bounty program — **not** a hackathon, **not** a bootcamp.
  Rise In (bootcamps) was ruled out by the per-repo swarm signature below.
- Confirmed and seeded into `events.json`, so it renders as the program band on the
  dashboard chart.

> **Platform note:** **Drips Wave** and **GrantFox** are *separate, parallel*
> contributor platforms — both filling the gap OnlyDust left when it exited Web3 —
> **not** one built on the other. The April surge was Drips Wave; GrantFox is
> unrelated to it. (An earlier draft conflated the two.)

## The evidence — four independent angles

1. **Daily activity spiked, then vanished.** Daily-active devs jumped from a ~120/day
   baseline to a **peak of ~692/day** during Apr 22–29, and were back to baseline by
   May 1. A sharp box, not a step change.

2. **The windowed line declined day-by-day as surge days left the window.** The
   `all_devs` decay tracked the 28-day-delayed exit of the surge cohort precisely —
   the signature of a roll-off, not a sudden departure.

3. **Cohort exit schedule.** ~**72%** of the developers in the May-19 window were last
   active during the two surge weeks — i.e. bounty participants whose window
   membership was about to expire, not contributors who churned.

4. **Repo attribution + bounty-farming signature.** Dozens of new project repos (the
   `-contracts`/`-frontend`/`-backend` triplets) appeared and ended cleanly on Apr 29.
   Per repo: ~**2–7 commits across 40–63 devs**, with many contributors touching
   **3–33 repos in one week** — the classic bounty-farming pattern, not organic
   project work.

## The number that actually matters

Stellar's **retained base is ≈1,000–1,100 developers** — the 28d-windowed
"retained devs (prior 28d)" line on the chart. That's the sticky population. Programs
transiently inflate MAD *above* it, then it relaxes back. The dip "to" 1,075 is
essentially a return to baseline, not a loss.

> ⚠️ **Don't confuse two scales:** the ~1,000–1,100 *retained* (28-day-windowed) base
> is **not** the ~130/day "typical daily base" stat card. Different metrics, different
> windows.

## How to read this on the dashboard

- The **bold amber MAD line** is what Developer Report plots; the **faint daily bars**
  behind it are daily-active devs. When the line falls while the bars hold steady,
  you're watching a past surge roll off — not an exodus. That overlay exists
  specifically to make this legible.
- The **program bands** (e.g. Drips Wave) mark the surge windows; expect a roll-off
  echo ~28 days after each band's end.

## Terminology & invariants (for future dips)

- **MAD, not MAU:** we standardize on **MAD** because the metric counts *developers*;
  developerreport.com's live series labels the identical number "MAU."
- **Validation invariant:** `all_devs = exclusive_devs + multichain_devs` — a quick
  sanity check when a number looks off.

## Open follow-up

- **New-vs-returning surge labeling (not yet built):** a "first-ever Stellar commit
  during the window?" flag would let us auto-classify a surge as new-contributor-driven
  vs. returning-bounty-hunter-driven, instead of investigating by hand each time.
