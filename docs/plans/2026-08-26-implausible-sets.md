# Doubting a logged set

**Status:** built. This records what was researched, what was decided, and what was deliberately left out.

**The problem:** six reps at ten kilos on Tuesday, six reps at a hundred on Thursday. Nothing about the second entry is a training decision, and everything the app derives afterwards is downstream of it: a personal record is awarded, the strength index recalibrates around it, and the progression puts a weight on the bar next week that nobody can lift. Today the app believes every number it is given.

---

## What the research found

A deep sweep of the platforms that do this, the sports science behind what a plausible lift is, and the statistics of detecting an outlier in a five-point series. The load-bearing results:

**No consumer gym app runs any plausibility check at all.** Hevy's documented personal-record logic is a pure max-over-own-history comparison across at least four independent badge surfaces (heaviest weight, best estimated 1RM, best set volume, best session volume). One fabricated set becomes a record instantly, with a banner. The one thing Hevy does do is a semantics carve-out: assisted exercises get rep-based records only, because the number entered is resistance taken away rather than load lifted.

**The prior art is from endurance and competition platforms, and what transfers is the shape, not the mechanism.** Strava runs a classifier over segment efforts, backfills it across history to re-clean leaderboards, and says in its own words that the design priority is "to minimize false positives so athletes aren't penalized for legitimate (and extraordinary) performances". Zwift's ruleset separates the body that analyses from the body that decides, holds results provisional until verification completes, and tiers sanctions by intent: "unable to verify performance" costs the result and nothing else, while fabricating data runs to a lifetime ban. Both systems govern sensor-measured data in competitive contexts. A gym log is self-reported with no ground truth at all, so only the organisational pattern carries over.

**A genuine beginner moves fast enough to set the floor.** 103 untrained-to-lightly-trained college women put 28.2% ± 20.9% on a bench press one-rep max over twelve weeks (Mayhew, Johnson, LaMonte, Lauber & Kemmler, *J Strength Cond Res* 22(5):1570-1577, 2008). That is roughly 2.3% a week on average, with about one in six exceeding 49% over the block. Any threshold tuned below that envelope flags real beginners. Note the scope: it is a twelve-week cumulative envelope, not a session-to-session ceiling, and a tenfold jump is nowhere near it.

**Per-user statistical thresholds do not work at this sample size.** Split conformal prediction guarantees its coverage only in expectation over calibration draws, and below n = 1/alpha − 1 (nineteen sets at alpha = 0.05) it cannot return a finite threshold at all. Most people have logged an exercise three times. Hierarchical partial pooling gives a usable baseline for a sparse user, but shrinks toward the population mean, which is the opposite of what a detector wants, and a fabricated entry feeds the very hyperparameters it would be judged against.

**Bodyweight and sex normalisation, if it is ever needed, should be IPF GoodLift or DOTS rather than Wilks.** In the IPF's own 2020 evaluation (lower is better) the combined scores were GL 23, DOTS 44, Wilks-2 50, Wilks 57. Not used here; recorded for whenever a leaderboard exists.

Things the research explicitly failed to establish, and which no threshold here rests on: a verified error band for estimated one-rep max, a trained-lifter progression ceiling, and any evidence at all either way on whether "does this look right?" prompts improve data quality or merely annoy people.

## What was built

Three checks over one set, in `packages/api/src/plausibility.ts`, reusing the machinery the app already has rather than adding a model.

1. **Ceiling.** The logged one-rep max, divided by the exercise's load coefficient, restated as its movement pattern's reference lift, against roughly what the strongest human alive has done in that pattern. Needs nothing but the set. Squat comes out at 480 kg against a real 490-ish, bench at 320 against 355.
2. **Profile.** The same figure against `predictedOneRepMax`, which already reads bodyweight, sex, age, body composition and training experience against published standards. Three times the prediction, chosen to sit outside the 2.5 clamp `estimateLoad` already applies on the grounds that past it the model is wrong about the person rather than the person being that strong. Skipped entirely when the profile carries nothing to say it with.
3. **Jump.** Against the best estimated one-rep max they have themselves logged on that exercise, allowed at 1.5× and growing 5% per week since they last trained it, capped at 3×. The floor comes from the novice envelope above: half of a fast beginner's twelve-week gain, in one session. The growth covers layoffs and muscle memory. Five per cent a week is above the measured mean and above one standard deviation of it, deliberately.

**The two mistakes are named, not just caught.** When a set fails, the same predicate is re-run against the number read as pounds and against the number with the decimal point moved one place. If either would have passed, the question names it: "Did you mean 100 lb, which is 45 kg?" This is why the worked example comes back as a decimal slip rather than as a generic jump.

**Never asked about:** bodyweight and assisted movements (the number is not load), warm-ups (they earn no record and move no estimate), blank boxes, and exercises nothing can resolve.

## What happens to a doubted set

Nothing is blocked and nobody is accused. Every message is a question.

- The logging screen runs the check the instant a set is ticked, before the record toast, and offers one button: **It's right**. Tapping it writes `flag: "confirmed"` onto the set. Ignoring it is a valid answer.
- `finish` re-runs the identical function server-side over what was actually saved, and stamps `flag: "suspect"` on anything unanswered. Everything the browser sends is a value somebody could have typed, so this is the only place the answer becomes a fact. A `confirmed` from the client is honoured rather than re-derived: it is a person saying "I did that", which the server has no way of producing on its own, and forging one buys nothing that tapping the visible button would not.
- A `suspect` set stays in the log, stays on screen, and stays in the session's volume. What it loses is the right to set a record (`recordSetIndex`, `bestSetKg`), the right to move the strength estimate (`training`), and the right to decide next week's weight (`progressExercise`). Those are the three places one wrong number does lasting damage.
- The finished session marks the row "Not counted toward records" with an **It's right** button beside it. That button is the whole appeal process: the app made a guess about a number and the only human who knows the answer is looking at it.

## Deliberately not built

- **No leaderboard-grade volume.** `workout.volume_kg` still counts doubted sets, because a session total that disagrees with the sets printed under it is worse than one carrying a typo. Marked `ponytail:` in `workout-shape.ts`; recompute over trusted sets on the day there is a leaderboard.
- **No account-level scoring or sanctions.** Zwift's tiering by intent is the right pattern, and it needs a second offence, an adjudicator and an appeal route to mean anything. There is no leaderboard yet, so there is nothing to sanction anybody for.
- **No retroactive pass over old sessions.** Strava backfills; that matters because its leaderboards are shared. Here a doubted set from March harms only its owner's own estimate, and re-flagging history nobody asked about would be the app arguing with people about training they finished months ago. The pass reads only sets being written now.
- **No model, no per-user threshold, no new dependency.** See the sample-size result above.
- **No reps check.** A hundred reps at load inflates the estimated one-rep max on its own and is caught by the same three tests.
