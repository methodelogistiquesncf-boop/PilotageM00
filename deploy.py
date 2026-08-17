#!/usr/bin/env python3
"""
deploy.py — incrémente la version + commit + push en une commande.
Usage : python3 deploy.py "message de la mise à jour"
"""
import re, subprocess, sys
from pathlib import Path
from datetime import date

def main():
    msg = sys.argv[1] if len(sys.argv) > 1 else "mise à jour"
    p = Path.cwd() / 'version.js'
    if not p.exists():
        print("❌ version.js introuvable — lancez d'abord setup-versionning.py")
        sys.exit(1)

    content = p.read_text(encoding='utf-8')
    m = re.search(r"APP_VERSION\s*=\s*'([^']+)'", content)
    old = m.group(1) if m else ''
    d = date.today()
    base = f"v{d.year}.{d.month:02d}.{d.day:02d}"
    n = int(old.split('-')[-1]) + 1 if old.startswith(base + '-') else 1
    new = f"{base}-{n}"

    content = re.sub(r"APP_VERSION\s*=\s*'[^']+'", f"APP_VERSION = '{new}'", content)
    p.write_text(content, encoding='utf-8')
    print(f"🔢 Version : {old or '(aucune)'} → {new}")

    subprocess.run(['git', 'add', '-A'], check=True)
    subprocess.run(['git', 'commit', '-m', f"{msg} ({new})"], check=True)
    subprocess.run(['git', 'push', 'origin', 'main'], check=True)
    print("🚀 Déployé ! Les postes utilisateurs se mettront à jour automatiquement.")

if __name__ == "__main__":
    main()