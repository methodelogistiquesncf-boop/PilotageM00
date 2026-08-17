#!/usr/bin/env python3
"""deploy.py v2 — nouvelle version + entrée d'historique + commit + push.
Usage : python3 deploy.py "message décrivant la mise à jour"
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
    old = history[0]['version'] if history else ''
    d = date.today()
    base = f"v{d.year}.{d.month:02d}.{d.day:02d}"
    n = int(old.split('-')[-1]) + 1 if old.startswith(base + '-') else 1
    new = f"{base}-{n}"

    history.insert(0, {"version": new, "date": datetime.now().isoformat(timespec='seconds'), "message": msg})
    history = history[:30]
    hfile.write_text(json.dumps(history, ensure_ascii=False, indent=2), encoding='utf-8')
    vfile.write_text("/* version.js — généré automatiquement par deploy.py */\n"
                     f"self.APP_VERSION = '{new}';\n"
                     "self.APP_HISTORY = " + json.dumps(history, ensure_ascii=False) + ";\n",
                     encoding='utf-8')

    print(f"🔢 {old or '(aucune)'} → {new} | 📝 {msg}")
    subprocess.run(['git', 'add', '-A'], check=True)
    subprocess.run(['git', 'commit', '-m', f"{msg} ({new})"], check=True)
    subprocess.run(['git', 'push', 'origin', 'main'], check=True)
    print("🚀 Déployé — les postes se mettront à jour automatiquement.")

if __name__ == "__main__":
    main()