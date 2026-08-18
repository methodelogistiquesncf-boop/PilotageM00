#!/usr/bin/env python3
"""deploy.py v3 — UNE version par jour : les push de la même journée sont
consolidés dans la même entrée (messages accumulés avec • ).
Usage : python3 deploy.py "message de la mise à jour"
"""
import json, subprocess, sys
from pathlib import Path
from datetime import datetime, date

def main():
    msg = sys.argv[1] if len(sys.argv) > 1 else "mise à jour"
    vfile = Path.cwd() / 'version.js'
    hfile = Path.cwd() / 'versions.json'
    if not vfile.exists():
        print("❌ version.js introuvable — lancez d'abord setup-versionning.py"); sys.exit(1)

    history = json.loads(hfile.read_text(encoding='utf-8')) if hfile.exists() else []
    d = date.today()
    day = f"v{d.year}.{d.month:02d}.{d.day:02d}"
    now = datetime.now().isoformat(timespec='seconds')

    if history and history[0]['version'] == day:
        entry = history[0]
        if msg not in entry['message']:
            entry['message'] = (entry['message'] + ' • ' + msg) if entry['message'] else msg
        entry['date'] = now
        print(f"🔢 Version du jour consolidée : {day}")
    else:
        history.insert(0, {'version': day, 'date': now, 'message': msg})
        print(f"🔢 Nouvelle version : {day}")

    history = history[:30]
    hfile.write_text(json.dumps(history, ensure_ascii=False, indent=2), encoding='utf-8')
    vfile.write_text("/* version.js — généré automatiquement par deploy.py */\n"
                     f"self.APP_VERSION = '{day}';\n"
                     "self.APP_HISTORY = " + json.dumps(history, ensure_ascii=False) + ";\n",
                     encoding='utf-8')

    subprocess.run(['git', 'add', '-A'], check=True)
    subprocess.run(['git', 'commit', '-m', f"{msg} ({day})"], check=True)
    subprocess.run(['git', 'push', 'origin', 'main'], check=True)
    print("🚀 Déployé — les postes se mettront à jour automatiquement.")

if __name__ == '__main__':
    main()
