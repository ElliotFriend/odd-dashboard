# Why multi-chain devs jumped across major ecosystems in spring 2026

Oct 5, 2026 · @Elliot Voris

## Summary

The spring 2026 jump in total and multi-chain developers is almost entirely one AI repo: [NousResearch/hermes-agent](https://github.com/NousResearch/hermes-agent). In the Sep 23 window, about 7,000 developers whose only activity is hermes-agent are counted in each of Ethereum, Solana, Polygon, Arbitrum, Base, Optimism, Avalanche, BNB Chain, and zkSync, plus the SVM Stack through Solana.

- **Mechanism:** 17 forks and copies of hermes-agent are mapped to chains, 9 of them to all nine (and since Sep 28 the upstream itself is too). ODD treats each copy as the same repository as the upstream, so the upstream's entire history, including today's commits, counts toward every chain the copy is listed under. It doesn't matter that the copies are stale, deleted, or not GitHub forks at all.
- **Size:** without hermes-only devs, Arbitrum's Sep 23 MAD falls from 8,032 to 1,025, zkSync's from 7,269 to 255, and Ethereum's from 14,336 to 7,410.
- **Single-chain decline is a separate, real trend.** It is not reclassification. Most February single-chain devs are simply no longer active.
- **Stellar is unaffected:** zero hermes-agent attribution, and a recount from repo mappings matches `eco_mads` exactly.

Confidence is high on the hermes-agent finding: the recount reconciles exactly to `eco_mads` at every two-week horizon from January to September. It is lower on *why* the forks were mapped, because only one of those mappings appears in the public taxonomy migrations. The Oct 5 update below names a likely trigger.

## Update: Oct 5 snapshot

The upstream repo is now mapped to all nine chains itself, and its built-in blockchain skills are the likely reason. Data: snapshot `20261005T130551`, through Sep 27.

- **Upstream now mapped directly.** On Sep 28, `NousResearch/hermes-agent` was added to all nine chains in one automated batch (every row stamped 20:08:14). A new copy, `willl376/hermes-agent-patched`, came in the same batch.
- **Size is about the same.** Copies already passed through the upstream's full history, so little changes: 6,927 to 7,021 hermes-only devs per chain in the restated Sep 23 window, and 6,504 to 6,593 at Sep 27. Without them, Ethereum's Sep 27 MAD drops from 13,905 to 7,401. Stellar still has zero.
- **Likely trigger: the repo's blockchain skills.** Its [EVM skill](https://github.com/NousResearch/hermes-agent/blob/main/optional-skills/blockchain/evm/SKILL.md), added May 13, covers exactly 8 chains: Ethereum, BNB Chain, Base, Arbitrum, Polygon, Optimism, Avalanche, and zkSync. Add the Solana skill (Mar 9) and you get exactly the nine. Copies mapped May 19 got only Base, Solana, or Arbitrum. Full nine-chain sets start in July, after the EVM skill landed.
- **Same fingerprint on other repos.** 61 repos were mapped to all nine chains in Jul–Sep 2026, up from 1 to 9 a month before. Most have 0 stars, and 24 have "hermes" in the name. That fits a classifier tagging repos by the chains their code mentions (inferred, not confirmed).
- **Still not public.** open-dev-data has had no bulk "Export" commit since Jul 6, so none of the nine-chain mappings appear in its migrations yet. The repo also ships a Hyperliquid skill, but Hyperliquid isn't mapped so far.

## What we saw

The same roughly 7,000-dev block sits on top of every named chain. That's why seven EVM chains with very different histories now all land between 7,300 and 8,100 MAD.

&#91;embedded content: ODD snapshot 20261001T130407 · eco\_developer\_activities recount, reconciles to eco\_mads.all\_devs\]

The block builds from March onward, tracking hermes-agent's own contributor growth. It shows up in history months before the forks were mapped because ODD recomputes past windows on every snapshot.

&#91;embedded content: ODD snapshot 20261001T130407 · biweekly 28-day windows, recount matches eco\_mads exactly\]

Single-chain devs did fall over the same period, but for a different reason. Of Base's 739 single-chain devs in the Feb 4 window, only 68 are active in September, and only 10 of those turned multi-chain. Ethereum's 5,867 kept 1,693 and Solana's 2,708 kept 458. Daily single-chain activity has drifted down since October 2025, steepest in Mar–Apr (Base 170 → 35 a day, Solana 621 → 244, Ethereum 1,722 → 880).

## Root cause: hermes-agent forks mapped to nine chains

Until Sep 28, the upstream repo (ODD repo id 25298863) was *not* mapped to any chain. It belonged only to the Nous Research ecosystem and AI (Category); the Nous Research entry was added in [migration 2026-05-19T121006](https://github.com/electric-capital/open-dev-data/blob/master/migrations/2026-05-19T121006_mutations). Until then, its chain attribution came entirely from forks. Since Sep 28 it is also mapped directly to all nine chains (see the Oct 5 update).

The forks contribute no commits of their own. None of the 10 forks checked has any activity row under its own repo id. All 213,262 hermes-agent activity rows sit under the upstream id 25298863, and `eco_developer_activities` credits them to each chain even though `ecosystems_repos_recursive` has no chain row for the upstream.

These are copies, not GitHub forks: none of them shows "forked from NousResearch/hermes-agent" on GitHub, many now 404, and the rest stopped committing months ago. The link is one ODD makes on its own, at the level of the whole repo:

- **Credit covers all upstream activity.** In every month from Sep 2025 to Sep 2026, zkSync is credited with 100% of the upstream's developer-days, including September, after the copies stopped. Commit-by-commit matching would thin out once the copies stopped. This doesn't.
- **Credit predates the copies.** zkSync is credited with 4,705 hermes-agent devs before May 22, 2026, when the earliest of these copies was created.

So a copy listed under a chain behaves exactly as if `NousResearch/hermes-agent` itself were listed there. The likely trigger is shared commit history, such as the same root commit, but that's an inference. This differs from winget-pkgs, a real GitHub fork whose phantom activity was recorded under its own repo id.

The upstream and its forks and copies mapped *directly* to chains, from the ODD `ecosystems_repos` table (the first two rows are new in the Oct 5 snapshot):

| Repo | Chains mapped | Added to ODD | In public migrations? |
| --- | --- | --- | --- |
| [NousResearch/hermes-agent](https://github.com/NousResearch/hermes-agent) (upstream) | all 9 | 2026-09-28 | No |
| [willl376/hermes-agent-patched](https://github.com/willl376/hermes-agent-patched) | all 9 | 2026-09-28 | No |
| [CarlosDimare/hermes-agent](https://github.com/CarlosDimare/hermes-agent) | all 9 | 2026-08-29 | No |
| [xmonader/hermes-agent-mirror](https://github.com/xmonader/hermes-agent-mirror) | all 9 | 2026-08-30 | No |
| [jason-allen-oneal/hermes-agent-benchmark-mirror](https://github.com/jason-allen-oneal/hermes-agent-benchmark-mirror) | all 9 | 2026-08-29 | No |
| [olitun/hermes-agent-kana](https://github.com/olitun/hermes-agent-kana) | all 9 | 2026-08-30 | No |
| [Raidan-Ai/hermes-agent](https://github.com/Raidan-Ai/hermes-agent) | all 9 | 2026-07-22 | No |
| [phaneron23/hermes-agent](https://github.com/phaneron23/hermes-agent) | all 9 | 2026-07-22 | No |
| [sparrowml/harbor-hermes-agent](https://github.com/sparrowml/harbor-hermes-agent) | all 9 | 2026-07-22 | No |
| [Iwakishirokoshu/Hermes-agent-Unlocked.2026.6.19](https://github.com/Iwakishirokoshu/Hermes-agent-Unlocked.2026.6.19) | all 9 | 2026-07-22 | No |
| [zeronx798/demo-hermes-agent](https://github.com/zeronx798/demo-hermes-agent) | 8 (not Solana) | 2026-07-22 | No |
| [shawnpetros/hermes-agent-detached-archive](https://github.com/shawnpetros/hermes-agent-detached-archive) | 8 (not Solana) | 2026-07-22 | No |
| [etherman-os/hermes-agent](https://github.com/etherman-os/hermes-agent) | Ethereum, Solana, Base | 2026-09-08 | No |
| [baladithyab/hermes-agent-mirror](https://github.com/baladithyab/hermes-agent-mirror) | Solana, Base | 2026-05-19 | Yes (2026-07-06) |

The copies are probably missing from the public migrations because of a delay, not because they're hidden. EC's taxonomy lives internally and reaches the public repo in occasional bulk "Export" commits by EC staff. Both public hermes lines arrived that way, weeks after ODD had them: the upstream's Nous Research entry was mapped on Apr 21 and published on May 26, and `baladithyab/hermes-agent-mirror` was mapped on May 19 and published on Jul 6. There has been no bulk export since Jul 6, and every copy tagged to the nine chains was mapped on Jul 22 or later. As of Oct 2 there still hasn't been one, so expect them in the next export. Who or what added them internally is unconfirmed. ODD's "\[Current and Candidates\] Classifier" ecosystem and the repo's chain-specific skills (see the Oct 5 update) both point to an automated classifier.

Two details matter:

- **The mappings landed in Jul–Sep, but the chart moves from March.** ODD recomputes history on every snapshot, so a fork mapped on Jul 22 back-fills the upstream's whole contributor history. That's why the jump appears in spring.
- **Upstream activity itself exploded.** hermes-agent went from about 4 committers a month (Jul 2025 to Jan 2026) to 491 in March, 2,549 in April, and roughly 6,500 a month by August. 17,108 distinct contributors have been credited to each chain all-time.

Only 4 to 58 real chain developers per chain also commit to hermes-agent. So hermes adds roughly 7,000 phantom devs per chain, but it barely moves anyone from single-chain to multi-chain.

## Stellar

Stellar is unaffected. No hermes-agent fork is mapped to it, zero hermes devs are credited to it, and a recount from repo mappings gives 3,348 for the Sep 23 window, exactly matching `eco_mads`.

- **History is stable.** Compared with the Aug 12 snapshot (`stellar_extract.duckdb.bak`), Mar–Jul horizons were restated up by only 15 to 33 devs, which is normal late-commit backfill. Early-August horizons rose by about 115, as expected for horizons that were brand new at the time.
- **Stellar's spring growth is its own.** Single-chain devs rose from 924 (Mar 1) to 2,351 (Sep 1), in step with the bounty and builder programs in our events.json (not re-checked for this note). Multi-chain devs stayed around 1,100 to 1,300. That's the opposite of the EVM chains, which is why Stellar looked like it "kept its trajectory".
- **Backups, for the record:** `../stellar_extract.backup.duckdb` is snapshot 2026-08-07, *before* the winget-pkgs fix (it still holds 10,383 winget rows). `stellar_extract.duckdb.bak` is snapshot 2026-08-12, after the fix.
- **Oct 5: a big Stellar taxonomy import, not yet checked.** 2,712 repos were added to Stellar on Oct 2 (likely the SCF and Rise In imports), and Stellar's Sep 27 MAD is now 3,642 (Sep 23: 3,399, up from 3,348). How much history that restates hasn't been checked. Still zero hermes devs.

## Method and caveats

- **Data:** ODD snapshot `20261001T130407` (data through 2026-09-23). Tables used: `eco_mads`, `eco_developer_activities` (filtered to the 10 ecosystems), `developer_activities`, `ecosystems_repos`, `ecosystems_repos_recursive`, `repos`, `ecosystems`. Taxonomy: local clone of open-dev-data at `1cf269fed`.
- **Reconciliation:** recounting distinct devs per 28-day window from `eco_developer_activities` matches `eco_mads.all_devs` exactly at every two-week horizon, Jan 7 to Sep 16, for Arbitrum, Ethereum, and Solana. "Hermes-only" means a dev whose only activity in the window is repo 25298863.
- **Single-chain cohort:** single-chain means `is_exclusive` on every active day in the window. This is close to, but not identical to, `eco_mads.exclusive_devs`.
- **Fork search was by name.** I found forks by searching repo names for `hermes-agent`. Renamed forks would be missed, though the recount shows nothing else of size.
- **Fork credit is inferred.** The whole-repo link is measured (100% coverage, zero rows under the copies' ids), but how ODD decides two repos are the same is inferred. I didn't confirm it in EC's pipeline code.
- **Recent horizons:** the freshest 3 to 4 horizons in any snapshot are undercounts and drift up for 2 to 3 weeks.
- **Not checked:** Polkadot and other "Stack" rollups, and whether hermes reaches chains beyond these ten. That needs a full scan of `eco_developer_activities` (3.3 GB).

## Open questions and next steps

- [ ] Ask Electric Capital where the chain mappings for the hermes-agent forks come from. 16 of 17 aren't in the public migrations, which suggests an internal classifier or candidate pipeline. Oct 5: the upstream is now mapped too, and the EVM and Solana skills are the likely trigger; ask EC to confirm.
- [ ] Report the forks upstream (as with winget-pkgs), proposing removal of the fork mappings, or a rule that forks of non-crypto repos don't inherit upstream contributors.
- [ ] Before citing any of these nine chains' 2026 MAD, subtract hermes-only devs. The "real" Sep 23 levels are about 1,000 for Arbitrum, 7,400 for Ethereum, and 2,400 for Solana.
- [ ] Investigate the genuine single-chain decline on the EVM chains and Solana (steepest Mar–Apr 2026): AI-assisted coding shifting where devs commit, a GitHub ingestion change, or real attrition.
- [ ] Optionally scan the full `eco_developer_activities` to see which other ecosystems hermes-agent reaches.
- [ ] Watch for Hyperliquid: hermes-agent also ships a Hyperliquid skill, so it could be the next chain mapped. Re-run Q4 and Q9 in `queries/hermes_agent_attribution.sql` on each new snapshot.
