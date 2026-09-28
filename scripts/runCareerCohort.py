"""Run a balanced 60-career integration cohort and export inspectable results.

Usage: python3 scripts/runCareerCohort.py OUTPUT_DIRECTORY
The careers use the real store/calendar/scouting/contract flows, with fast
synthetic match outcomes. Results are diagnostics, not player success odds.
"""

import csv
from collections import Counter, defaultdict
from concurrent.futures import ThreadPoolExecutor, as_completed
import json
import os
from pathlib import Path
import subprocess
import sys


ROOT = Path(__file__).resolve().parents[1]
OUT = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else ROOT / "cohort-results"
OUT.mkdir(parents=True, exist_ok=True)
NATIONS = ["rsa", "eng", "bra", "arg", "fra", "ger", "esp", "nga", "jpn", "usa", "por", "ita", "ned", "bel", "gha", "sen", "mar", "mex", "kor", "aus", "sco", "aut", "sui", "tur"]
POSITIONS = ["GK", "CB", "FB", "CM", "WM", "WG", "ST"]
QUALITIES = [0.82, 0.91, 1.0, 1.09, 1.18]
COUNT = int(os.getenv("COHORT_COUNT", "60"))
SCHOOL_ONLY = os.getenv("COHORT_SCHOOL_ONLY") == "1"


def run(index):
    nationality = NATIONS[index % len(NATIONS)]
    position = POSITIONS[index % len(POSITIONS)]
    route = "school" if SCHOOL_ONLY or index % 2 == 0 else "grassroots"
    quality = QUALITIES[(index * 7 + index // 10) % len(QUALITIES)]
    starting_attr = [7, 9, 11, 13][(index // 7) % 4]
    seed = 2001 + index * 53
    env = {**os.environ, "SIM_POSITION": position, "SIM_NATION": nationality, "SIM_START_ATTR": str(starting_attr),
           "SIM_QUALITY": str(quality), "SIM_JSON": "1", "AUTO_ACADEMY": "1", "AUTO_PRO": "1"}
    if route == "grassroots":
        env["FORCE_SUNDAY"] = "1"
    else:
        env.pop("FORCE_SUNDAY", None)
    process = subprocess.run(["node", "--import", "tsx", "scripts/careerSim.ts", "6", str(seed)],
                             cwd=ROOT, env=env, capture_output=True, text=True, timeout=150)
    raw = process.stdout + process.stderr
    line = next((line.removeprefix("COHORT_JSON:") for line in raw.splitlines()
                 if line.startswith("COHORT_JSON:")), None)
    result = json.loads(line) if line else {"seed": seed, "position": position, "nationality": nationality,
                                             "startingRoute": route, "quality": quality, "error": raw[-1800:]}
    result["runId"] = index + 1
    result["startingAttribute"] = starting_attr
    result["exitCode"] = process.returncode
    if process.returncode and "error" not in result:
        result["error"] = "\n".join(row for row in raw.splitlines() if "FAIL:" in row)[-1800:]
    return result


results = []
with ThreadPoolExecutor(max_workers=6) as pool:
    futures = {pool.submit(run, i): i for i in range(COUNT)}
    for future in as_completed(futures):
        index = futures[future]
        try:
            result = future.result()
        except Exception as exc:
            result = {"runId": index + 1, "seed": 2001 + index * 53, "exitCode": -1, "error": str(exc)}
        results.append(result)
        print(f"{len(results):02d}/{COUNT} · #{index + 1:02d} {result.get('position', '?')} {result.get('nationality', '?')} → {result.get('outcome', 'ERROR')}", flush=True)
results.sort(key=lambda row: row["runId"])

raw_path = OUT / f"kickoff-{COUNT}-careers.json"
raw_path.write_text(json.dumps(results, indent=2, ensure_ascii=False) + "\n")


def compact(value):
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"))


careers = []
seasons = []
for row in results:
    if "error" in row and "stats" not in row:
        continue
    stats = row.get("stats") or {}
    academy = row.get("academyEntry") or {}
    pro = row.get("proSigning") or {}
    awards = row.get("awards") or {}
    careers.append({
        "id": row["runId"], "seed": row["seed"], "nationality": row["nationality"], "region": row["region"],
        "position": row["position"], "route": row["startingRoute"], "quality": row["quality"], "starting_attribute": row["startingAttribute"], "outcome": row["outcome"],
        "final_age": row["finalAge"], "final_phase": row["finalPhase"], "final_role": row["finalRole"], "final_ovr": row["finalOvr"],
        "academy_season": academy.get("season", ""), "academy_age": academy.get("age", ""), "academy_week": academy.get("week", ""), "academy_club": academy.get("club", ""),
        "pro_season": pro.get("season", ""), "pro_age": row["finalAge"] if pro else "", "pro_week_absolute": pro.get("weekSigned", ""), "pro_club": pro.get("clubName", ""),
        "appearances": stats.get("appearances", 0), "goals": stats.get("goals", 0), "assists": stats.get("assists", 0),
        "wins": stats.get("wins", 0), "clean_sheets": stats.get("cleanSheets", 0), "saves": stats.get("saves", 0),
        "tackles": stats.get("tacklesWon", 0), "interceptions": stats.get("interceptions", 0), "headers": stats.get("headersWon", 0), "key_passes": stats.get("keyPasses", 0),
        "motm": stats.get("motmAwards", 0), "best_rating": stats.get("bestRating", ""), "reputation": stats.get("reputation", 0),
        "money_gbp": stats.get("money", 0), "earnings_gbp": stats.get("earnings", 0), "dead_matchdays": row.get("deadMatchdays", 0),
        "personal_awards": compact(awards.get("personal", {})), "club_awards": compact(awards.get("club", {})), "national_awards": compact(awards.get("national", {})),
        "league_stats": compact(stats.get("league") or {}), "cup_stats": compact(stats.get("cup") or {}), "international_stats": compact(stats.get("international") or {}),
        "match_counts": compact(row.get("matchCounts") or {}), "exit_code": row["exitCode"],
        "training_sessions": (row.get("training") or {}).get("sessions", 0),
        "training_xp_spent": (row.get("training") or {}).get("xpSpent", 0),
        "training_injuries": (row.get("training") or {}).get("injuries", 0),
        "training_grades": compact((row.get("training") or {}).get("grades", {})),
    })
    previous = {"appearances": 0, "goals": 0, "assists": 0}
    for snap in row.get("seasonSnapshots", []):
        seasons.append({"id": row["runId"], "nationality": row["nationality"], "position": row["position"],
                        "starting_route": row["startingRoute"], "season": snap["season"], "age_at_season_start": 13 + snap["season"],
                        "route_at_snapshot": snap["route"], "appearances_this_season": snap["appearances"] - previous["appearances"],
                        "goals_this_season": snap["goals"] - previous["goals"], "assists_this_season": snap["assists"] - previous["assists"],
                        "career_appearances": snap["appearances"], "career_goals": snap["goals"], "career_assists": snap["assists"],
                        "reputation": snap["reputation"], "academy_arrival": "yes" if academy.get("season") == snap["season"] else "",
                        "pro_signed": "yes" if pro.get("season") == snap["season"] else ""})
        previous = snap


def csv_write(path, rows):
    if not rows:
        return
    with path.open("w", newline="", encoding="utf-8") as file:
        writer = csv.DictWriter(file, fieldnames=list(rows[0]))
        writer.writeheader()
        writer.writerows(rows)


csv_write(OUT / f"kickoff-{COUNT}-career-stats.csv", careers)
csv_write(OUT / f"kickoff-{COUNT}-year-by-year.csv", seasons)

valid = [row for row in results if row.get("exitCode") == 0 and "stats" in row]
academy = [row for row in valid if row.get("academyEntry")]
pros = [row for row in valid if row["outcome"] == "pro"]
failure_rows = [row for row in results if row.get("exitCode") != 0 or row.get("failures", 0)]


def distribution(rows, key):
    return ", ".join(f"{label}: {count}" for label, count in sorted(Counter(key(row) for row in rows).items())) or "none"


def group_table(field):
    groups = defaultdict(list)
    for row in valid:
        groups[row[field]].append(row)
    lines = [f"| {field.title()} | Careers | Academy | Pro | Aged out |", "|---|---:|---:|---:|---:|"]
    for label, group in sorted(groups.items()):
        lines.append(f"| {label} | {len(group)} | {sum(bool(x.get('academyEntry')) for x in group)} | {sum(x['outcome']=='pro' for x in group)} | {sum(x['outcome']=='age-out' for x in group)} |")
    return "\n".join(lines)


training_on = os.getenv("SIM_TRAINING") == "1"
report = [f"# Kickoff Star — {COUNT} fast careers" + (" with training" if training_on else ""), "", "## What this measures", "",
          "These runs use the real career store, calendar, competition, scouting, trial, negotiation, age-cap, and save/load flows. Match outcomes and trial choices are generated quickly in code. Starting attributes vary between 7, 9, 11, and 13/20 with potential 18. Players receive a starting XI place after opening trials and take the strongest academy trial options when invited. Five simulated performance bands (0.82–1.18) vary match ratings. This is a progression stress test, **not a realistic estimate of success rates for new players**: onboarding normally starts attributes around 1–4, and interactive match execution is not reproduced here. " + ("Training uses the game's generated drills, decision probabilities, grade/XP formulas, energy and injury roll, plus restricted attribute spending through the store. It simulates the game's quick-training option at normal intensity, with randomized choices and mini-game quality. Match XP allocation is still omitted." if training_on else "Training and interactive choices are not reproduced here."), "",
          "## Overall", "",
          f"- Careers requested: **{COUNT}**; completed with all assertions: **{len(valid)}**; failed/crashed: **{len(failure_rows)}**.",
          f"- Academy entrants: **{len(academy)}**; professional signings: **{len(pros)}**; age-outs: **{sum(x.get('outcome')=='age-out' for x in valid)}**.",
          f"- Academy entry season: {distribution(academy, lambda x: x['academyEntry']['season'])}.",
          f"- Pro signing age: {distribution(pros, lambda x: x['finalAge'])}.",
          f"- Pro signing season: {distribution(pros, lambda x: x['proSigning']['season'])}.",
          f"- Dead matchdays: **{sum(x.get('deadMatchdays', 0) for x in valid)}** across all valid careers.", "",
          *([f"- Training sessions: **{sum(x['training']['sessions'] for x in valid)}**; XP spent: **{sum(x['training']['xpSpent'] for x in valid):,}**; training injuries: **{sum(x['training']['injuries'] for x in valid)}**.",
             f"- Final OVR: minimum **{min(x['finalOvr'] for x in valid)}**, median **{sorted(x['finalOvr'] for x in valid)[len(valid)//2]}**, maximum **{max(x['finalOvr'] for x in valid)}**.", ""] if training_on and valid else []),
          "## By position", "", group_table("position"), "", "## By nationality", "", group_table("nationality"), "", "## By starting attribute", "", group_table("startingAttribute"), "", "## By starting route", "", group_table("startingRoute"), "",
          "## Individual outcomes", "", "| # | Nation | Position | Route | Quality | Academy (age/year) | Pro (age/year) | Outcome | Apps | G | A | CS | Saves | OVR |", "|---:|---|---|---|---:|---|---|---|---:|---:|---:|---:|---:|---:|"]
for row in results:
    if "stats" not in row:
        report.append(f"| {row['runId']} | ? | ? | ? | ? | ? | ? | ERROR | - | - | - | - | - | - |")
        continue
    academy_event = row.get("academyEntry") or {}
    pro_event = row.get("proSigning") or {}
    stats = row["stats"]
    report.append(f"| {row['runId']} | {row['nationality']} | {row['position']} | {row['startingRoute']} | {row['quality']:.2f} | "
                  f"{f'{academy_event.get("age")}/Y{academy_event.get("season")}' if academy_event else '—'} | "
                  f"{f'{row["finalAge"]}/Y{pro_event.get("season")}' if pro_event else '—'} | {row['outcome']} | "
                  f"{stats.get('appearances', 0)} | {stats.get('goals', 0)} | {stats.get('assists', 0)} | "
                  f"{stats.get('cleanSheets', 0)} | {stats.get('saves', 0)} | {row['finalOvr']} |")
report += ["", "## Files and interpretation", "",
           f"- `kickoff-{COUNT}-career-stats.csv`: one row per career with full career totals, awards, competition breakdowns, and scouting outcomes.",
           f"- `kickoff-{COUNT}-year-by-year.csv`: season snapshots and season-by-season increments for every career.",
           f"- `kickoff-{COUNT}-careers.json`: full per-career diagnostic data including October recruitment reviews and match counts.",
           "- An academy entry during a season is captured separately from that season-end route snapshot. A pro signing can end a season early, so the final season is partial.",
           "- Age is 14 in Year 1. A successful final-window contract may be signed at 20 during the bounded grace period.", "",
           "## Failures", ""]
if failure_rows:
    report += [f"- Career #{row['runId']}: {row.get('error', 'assertion failed')}" for row in failure_rows]
else:
    report.append("No assertions or process crashes in this cohort.")

(OUT / f"kickoff-{COUNT}-report.md").write_text("\n".join(report) + "\n", encoding="utf-8")
print(f"DONE {len(valid)}/{COUNT} valid, {len(academy)} academy, {len(pros)} pro, {len(failure_rows)} failed; output: {OUT}", flush=True)
