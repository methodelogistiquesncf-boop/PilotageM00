#!/usr/bin/env python3
"""
fix-pieces-deposees.py
Dans ui-supermarche.js : pour la section PIECES DEPOSEES, les lignes de
remarque n'affichent plus que le champ KIT (pas de SYMBOLE).

Usage :
    python3 fix-pieces-deposees.py --dry   # aperçu sans rien modifier
    python3 fix-pieces-deposees.py         # applique (+ backup automatique)
"""
import sys
import shutil
from pathlib import Path
from datetime import datetime

START = "function buildNoteItemEl("
END = "function buildNoteList("

NEW_FUNC = r'''function buildNoteItemEl(item, onDelete, getMeta, section) {
  var row = document.createElement('div');
  row.className = 'note-item';

  // 🔑 Section PIECES DEPOSEES : champ KIT uniquement (pas de SYMBOLE)
  var secNorm = (section || '').toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ');
  var withSymbole = secNorm.indexOf('PIECES DEPOSEES') === -1;

  var kitInp = document.createElement('textarea'); kitInp.rows = 1;
  kitInp.className = 'note-kit';
  kitInp.placeholder = 'KIT';
  kitInp.value = item.kit || '';
  kitInp.oninput = function () { item.kit = kitInp.value; autoResize(kitInp); markDirty(); };
  requestAnimationFrame(function () { autoResize(kitInp); });
  row.appendChild(kitInp);

  if (withSymbole) {
    var symInp = document.createElement('textarea'); symInp.rows = 1;
    symInp.className = 'note-sym';
    symInp.placeholder = 'SYMBOLE';
    symInp.value = item.symbole || '';
    symInp.oninput = function () { item.symbole = symInp.value; autoResize(symInp); markDirty(); };
    requestAnimationFrame(function () { autoResize(symInp); });
    row.appendChild(symInp);
  }

  var actions = document.createElement('div');
  actions.className = 'note-item-actions';

  var sendBtn = document.createElement('button');
  sendBtn.type = 'button'; sendBtn.className = 'note-send-btn'; sendBtn.textContent = '→';
  sendBtn.title = 'Envoyer cette ligne vers Actions';
  sendBtn.onclick = function () {
    var meta = getMeta();
    sendToAction({ engin: meta.engin, poste: meta.poste, section: section, date: meta.date, jour: meta.jour, kit: item.kit || '', symbole: item.symbole || '' });
  };
  actions.appendChild(sendBtn);

  var delBtn = document.createElement('button');
  delBtn.type = 'button'; delBtn.className = 'note-del-btn'; delBtn.textContent = '✕';
  delBtn.title = 'Supprimer cette ligne';
  delBtn.onclick = onDelete;
  actions.appendChild(delBtn);

  row.appendChild(actions);
  return row;
}

'''

def main():
    dry = "--dry" in sys.argv

    path = Path.cwd() / "ui-supermarche.js"
    if not path.is_file():
        found = list(Path.cwd().rglob("ui-supermarche.js"))
        if not found:
            print("❌ ui-supermarche.js introuvable dans ce répertoire.")
            sys.exit(1)
        path = found[0]

    content = path.read_text(encoding="utf-8")
    i = content.find(START)
    j = content.find(END)

    print(f"📂 {path}")
    if i == -1 or j == -1 or i > j:
        print("❌ Marqueurs introuvables (buildNoteItemEl / buildNoteList). Fichier différent de l'attendu ?")
        sys.exit(1)

    if "withSymbole" in content[i:j]:
        print("✅ Correction déjà appliquée : rien à faire.")
        sys.exit(0)

    l1 = content[:i].count("\n") + 1
    l2 = content[:j].count("\n")
    print(f"🔎 Fonction buildNoteItemEl détectée : lignes {l1} → {l2}")

    if dry:
        print("🟡 DRY-RUN : aucune modification effectuée.")
        sys.exit(0)

    backup = path.parent / (path.name + ".bak-" + datetime.now().strftime("%Y%m%d-%H%M%S"))
    shutil.copy2(path, backup)
    print(f"💾 Backup : {backup.name}")

    new_content = content[:i] + NEW_FUNC + content[j:]
    path.write_text(new_content, encoding="utf-8")

    # Vérifications
    ok = ("withSymbole" in path.read_text(encoding="utf-8")) and (path.read_text(encoding="utf-8").count(START) == 1)
    print("✅ Correction appliquée." if ok else "⚠️ À vérifier manuellement.")

    print("\n🚀 Ensuite :")
    print('   git add ui-supermarche.js')
    print('   git commit -m "feat: PIECES DEPOSEES = champ KIT uniquement (pas de SYMBOLE)"')
    print('   git push origin main')

if __name__ == "__main__":
    main()