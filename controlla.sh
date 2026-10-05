#!/bin/bash
URL="https://salvadegomolinugonif-bot.github.io/boat/"
code() { curl -s -o /dev/null -w "%{http_code}" -L "$1"; }
echo "Pagina principale: $(code "$URL")"
HTML=$(curl -s -L "$URL")
for pat in 'manifest' 'apple-touch-icon' 'serviceWorker'; do
  if echo "$HTML" | grep -qi "$pat"; then echo "OK    trovato '$pat' in index.html"; else echo "MANCA '$pat' in index.html"; fi
done
echo "--- file di sistema ---"
for f in manifest.json sw.js service-worker.js; do
  echo "$f: $(code "$URL$f")"
done
echo "--- file collegati dalla pagina ---"
echo "$HTML" | grep -oE '(href|src)="[^"#:]+"' | sed -E 's/^(href|src)="//; s/"$//' | sort -u | while read -r p; do
  echo "$p: $(code "$URL$p")"
done
