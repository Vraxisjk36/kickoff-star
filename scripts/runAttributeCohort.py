"""Thirty paired career seeds: balanced XP versus position-focused XP."""
import csv
import json
import os
from pathlib import Path
import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed

ROOT = Path(__file__).resolve().parents[1]
OUT = Path(sys.argv[1]).resolve()
OUT.mkdir(parents=True, exist_ok=True)
POSITIONS = ['ST', 'GK', 'CB', 'CM', 'WG', 'FB', 'WM']
NATIONS = ['rsa', 'eng', 'bra', 'arg', 'fra', 'ger', 'esp', 'nga', 'jpn', 'usa']


def run(index, strategy):
    seed = 7001 + index * 101
    env = {**os.environ, 'SIM_REAL_MATCH': '1', 'SIM_REAL_START': '1',
           'SIM_TRAINING': '1', 'SIM_MATCH_XP': '1', 'SIM_TRAIN_EVERY': '2',
           'SIM_XP_STRATEGY': strategy, 'SIM_JSON': '1',
           'AUTO_ACADEMY': '1', 'AUTO_PRO': '1',
           'SIM_POSITION': POSITIONS[index % 7], 'SIM_NATION': NATIONS[index % 10],
           'SIM_QUALITY': str([.91, 1, 1.09][index % 3])}
    if index % 2:
        env['FORCE_SUNDAY'] = '1'
    else:
        env.pop('FORCE_SUNDAY', None)
    p = subprocess.run(['node', '--import', 'tsx', 'scripts/careerSim.ts', '6', str(seed)],
                       cwd=ROOT, env=env, capture_output=True, text=True, timeout=90)
    line = next((v[12:] for v in p.stdout.splitlines() if v.startswith('COHORT_JSON:')), None)
    row = json.loads(line) if line else {'error': (p.stdout + p.stderr)[-1500:]}
    row.update(pairId=index + 1, seed=seed, strategy=strategy, exitCode=p.returncode)
    if p.returncode:
        row['assertionMessages'] = [v for v in (p.stdout + p.stderr).splitlines() if 'FAIL:' in v]
    return row


rows = []
with ThreadPoolExecutor(max_workers=6) as pool:
    futures = {pool.submit(run, i, strategy): (i, strategy)
               for i in range(30) for strategy in ('balanced', 'focused')}
    for future in as_completed(futures):
        i, strategy = futures[future]
        try:
            row = future.result()
        except Exception as exc:
            row = {'pairId': i + 1, 'strategy': strategy, 'error': repr(exc), 'exitCode': -1}
        rows.append(row)
        print(f'{len(rows):02d}/60 #{i + 1:02d} {strategy} {row.get("position", "?")} → {row.get("outcome", "ERROR")}', flush=True)
rows.sort(key=lambda r: (r['pairId'], r['strategy']))
(OUT / 'attribute-careers.json').write_text(json.dumps(rows, indent=2) + '\n')

flat = []
for row in rows:
    if 'stats' not in row:
        continue
    stats, full = row['stats'], row.get('fullMatchStats') or {}
    record = {k: row.get(k) for k in ('pairId', 'seed', 'strategy', 'nationality', 'position', 'startingRoute', 'outcome', 'finalAge', 'initialPotential', 'initialOvr', 'finalOvr', 'realMatchesPlayed', 'exitCode')}
    record.update(academy_year=(row.get('academyEntry') or {}).get('season', ''),
                  pro_year=(row.get('proSigning') or {}).get('season', ''),
                  training_sessions=(row.get('training') or {}).get('sessions', 0),
                  training_xp=(row.get('training') or {}).get('xpSpent', 0),
                  match_xp=(row.get('matchXp') or {}).get('xpSpent', 0),
                  appearances=stats.get('appearances', 0),
                  goals=stats.get('goals', 0), assists=stats.get('assists', 0),
                  wins=stats.get('wins', 0), clean_sheets=stats.get('cleanSheets', 0))
    for key, value in full.items():
        record[key] = value
    record.update(initial_attributes=json.dumps(row['initialAttributes'], separators=(',', ':')),
                  final_attributes=json.dumps(row['finalAttributes'], separators=(',', ':')),
                  xp_by_attribute=json.dumps(row['xpByAttribute'], separators=(',', ':')),
                  assertions='; '.join(row.get('assertionMessages', [])))
    flat.append(record)
if flat:
    columns = list(dict.fromkeys(k for row in flat for k in row))
    with (OUT / 'attribute-careers.csv').open('w', newline='') as file:
        writer = csv.DictWriter(file, columns)
        writer.writeheader()
        writer.writerows(flat)
print(f'DONE {len(flat)} careers with stats; {sum("stats" not in row for row in rows)} without data', flush=True)
