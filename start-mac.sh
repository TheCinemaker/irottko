#!/bin/zsh
# Helyi indítás Macen: weboldal + függvények, mobilról is elérhetően (https).
#   ./start-mac.sh
# A telefon legyen ugyanazon a Wi-Fin. Első megnyitáskor a böngésző figyelmeztet
# (önaláírt tanúsítvány) → "Speciális" / "Részletek" → "Tovább az oldalra".
# Node 22 kell – a /usr/local/bin/node a 22-es (a homebrew-s 20-as túl régi).
cd "$(dirname "$0")"
export PATH=/usr/local/bin:$PATH
[ -d node_modules ] || npm install

IP=$(ipconfig getifaddr en0 || ipconfig getifaddr en1)
export DEV_HTTPS=1
# A .env-beli URL helyett ez megy a Barion-visszairányításba és a levél linkjeibe.
export URL="https://${IP:-localhost}:5173"

echo "Node: $(node -v)"
echo "Gépen:   https://localhost:5173"
echo "Mobilon: $URL        Szkenner: $URL/scan"

npm run dev:functions &
FN=$!
trap "kill $FN 2>/dev/null" EXIT INT TERM
npm run dev
