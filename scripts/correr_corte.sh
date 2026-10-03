#!/usr/bin/env bash
# Corre el corte completo: 6 Champion + 6 Ejecutivo + Fibi + Gobierno de Licencias (14 docx).
# El ultimo viernes del mes, el Fibi es el mensual (narrativa DJ.json -> fibi_mensual).
#
# Uso: scripts/correr_corte.sh 2026-09-25 "28 de septiembre de 2026"
#   $1 = viernes del corte (AAAA-MM-DD); $2 = fecha que aparece en los reportes (opcional).
#
# Requiere la narrativa del corte ya redactada en narrativa/<fecha>/{ENN,CN,PLD,GC,JC,RL,DJ}.json.
# Se detiene en el primer error: narrativa rechazada, docx invalido o prueba de regresion fallida.
set -euo pipefail
cd "$(dirname "$0")/.."
FIN="${1:?viernes del corte, AAAA-MM-DD}"
FECHA="${2:-}"
FARG=(); [ -n "$FECHA" ] && FARG=(--fecha "$FECHA")
TAG=$(python3 -c "import datetime as d;x=d.date.fromisoformat('$FIN');m=['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];print(f'{x.day:02d}{m[x.month-1]}{x.year}')")
N="narrativa/$FIN"
VAL=/mnt/skills/public/docx/scripts/office/validate.py
UPL="${UPLOADS:-/mnt/user-data/uploads}"   # carpeta con los exports; se puede cambiar con UPLOADS=...
# Ultimo viernes del mes: el Fibi mensual sustituye al semanal (Tony, 2 oct 2026).
MENSUAL=$(python3 -c "import datetime as d;x=d.date.fromisoformat('$FIN');print(1 if (x+d.timedelta(days=7)).month!=x.month else 0)")

echo "== ETL por SD"
for SD in ENN CN PLD GC JC RL; do python3 scripts/etl.py --corte-fin "$FIN" --sd "$SD" --uploads "$UPL" >/dev/null; done
python3 scripts/dj.py --corte-fin "$FIN"
python3 scripts/licencias.py --corte-fin "$FIN" --uploads "$UPL"
[ "$MENSUAL" = 1 ] && python3 scripts/fibi_mensual.py --corte-fin "$FIN" >/dev/null

echo "== Revisión de narrativa"
for SD in ENN CN PLD GC JC RL; do python3 scripts/validar_narrativa.py "out/${SD}_$FIN.json" "$N/$SD.json" ejecutivo >/dev/null || { echo "Narrativa $SD rechazada"; python3 scripts/validar_narrativa.py "out/${SD}_$FIN.json" "$N/$SD.json" ejecutivo; exit 1; }; done
if [ "$MENSUAL" = 1 ]; then
  python3 scripts/validar_narrativa.py "out/FM_$FIN.json" "$N/DJ.json" fibi_mensual >/dev/null || { python3 scripts/validar_narrativa.py "out/FM_$FIN.json" "$N/DJ.json" fibi_mensual; exit 1; }
else
  python3 scripts/validar_narrativa.py "out/DJ_$FIN.json" "$N/DJ.json" fibi >/dev/null || { python3 scripts/validar_narrativa.py "out/DJ_$FIN.json" "$N/DJ.json" fibi; exit 1; }
fi
python3 scripts/validar_narrativa.py "out/GL_$FIN.json" "$N/DJ.json" licencias >/dev/null || true   # notas opcionales

echo "== Reportes"
for SD in ENN CN PLD GC JC RL; do
  node scripts/generate_champion.js "out/${SD}_$FIN.json" "out/${SD}_Champion_$TAG.docx" "${FARG[@]}" >/dev/null
  # El Ejecutivo debe caber en una pagina: si no, se regenera con mas compactacion (hasta nivel 3).
  for C in 0 1 2 3; do
    node scripts/generate_ejecutivo.js "out/${SD}_$FIN.json" "$N/$SD.json" "out/${SD}_Ejecutivo_$TAG.docx" "${FARG[@]}" --compacto $C >/dev/null
    [ "$(python3 scripts/paginas.py "out/${SD}_Ejecutivo_$TAG.docx")" = "1" ] && break
    [ $C = 3 ] && echo "  AVISO: ${SD} Ejecutivo sigue en 2 paginas; acortar la narrativa"
  done
done
if [ "$MENSUAL" = 1 ]; then
  rm -f "out/FibiDJ_$TAG.docx"   # no queda un semanal viejo junto al mensual
  node scripts/generate_fibi_mensual.js "out/FM_$FIN.json" "$N/DJ.json" "out/FibiDJ_Mensual_$TAG.docx" "${FARG[@]}" >/dev/null
  [ "$(python3 scripts/paginas.py "out/FibiDJ_Mensual_$TAG.docx")" = "1" ] || echo "  AVISO: Fibi mensual en mas de 1 pagina; acortar la narrativa"
else
  node scripts/generate_fibi.js "out/DJ_$FIN.json" "$N/DJ.json" "out/FibiDJ_$TAG.docx" "${FARG[@]}" >/dev/null
fi
node scripts/generate_licencias.js "out/GL_$FIN.json" "$N/DJ.json" "out/GobiernoDeLicencias_$TAG.docx" "${FARG[@]}" >/dev/null

echo "== Validación docx"
for f in out/*_"$TAG".docx; do python3 "$VAL" "$f" | tail -1 | grep -q PASSED || { echo "INVALIDO: $f"; exit 1; }; echo "  ok $f"; done
echo "Listo: $(ls out/*_"$TAG".docx | wc -l) reportes. Falta la revisión visual (PDF) que pide el Estándar."
