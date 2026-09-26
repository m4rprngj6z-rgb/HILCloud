# HILCloud — Harvey AI x Gentera, pipeline de reportes DJ

Repo privado. Contiene datos de personal de la Direccion Juridica (DJ) de Gentera/Banco
Compartamos: roster, vacaciones, incapacidades. **Nunca lo hagas publico. Nunca subas los
exports semanales crudos (harvey-usage-*.xlsx, vaults_export_*.xlsx) a este repo**: son
demasiado grandes y cambian cada semana, se procesan desde /mnt/user-data/uploads/ en cada
sesion, no se versionan aqui.

## Que es esto

Tony Bueno (jbueno) es Harvey AI Champion de Champions en la DJ (~70 personas, 6
sub-direcciones: ENN, CN, PLD, GC, JC, RL). Cada semana ("corte") se generan 13 reportes
docx (6 SD x Ejecutivo+Champion, mas 1 para su jefa Fibi) a partir de exports de uso de
Harvey. Antes de este repo, el pipeline (roster, scripts de generacion) vivia solo en la
memoria de cada sesion de Claude y se perdia con cada reinicio de sandbox. Este repo es la
fuente de verdad versionada para que eso deje de pasar.

## Fuente de verdad para METODOLOGIA y EXCEPCIONES: Notion, no este repo

El HIL (Harvey Intelligence Layer) en Notion sigue siendo la fuente de verdad operativa:
- Pagina principal (metodologia, semaforo, excepciones activas, gobierno de licencias):
  notion.so/37df66a17162812a9f53e15cb031792d
- Base de Usuarios (roster oficial): notion.so/376f66a1716281c5a12fd8385313d6e7
- KPIs: notion.so/384f66a1716281c4a244e5c15cb28bf2

`data/roster.py` es una COPIA sincronizada del roster de Notion para uso en scripts Python/
Node. Si hay conflicto entre este archivo y Notion, Notion gana: corrige alla primero, luego
sincroniza aqui.

## Estructura

- `data/roster.py` — roster oficial (user_id -> SD, puesto, Champion), listas de exclusion.
- `scripts/` — pipeline de generacion de reportes (en construccion, ver docs/PENDIENTES.md).
- `docs/` — metodologia resumida para referencia rapida sin tener que ir a Notion.

## Metodologia clave (resumen; el detalle completo vive en Notion)

- **Semaforo (self-relative, desde 26 sep 2026)**: cada persona se compara contra su propio
  promedio movil de 5 semanas, no contra su SD. 🟢 >=100% de su ritmo, 🟡 40-99%, 🔴 <40%,
  ⚪ excepcion documentada (se excluye del calculo de baseline, no solo se anota), ? <5
  semanas de historial.
- **Racha**: cortes consecutivos en 🟢 o 🟡 con mas de 5 interacciones, dentro del ciclo de
  5 semanas mas reciente. Las semanas ⚪ se saltan sin romper la racha. Si una SD completa
  tiene una excepcion vigente que cubre todo el ciclo, se reporta como N/A de ciclo, no como
  racha 0.
- **Diversidad de Workflows**: cuantos workflows DISTINTOS ejecuta cada persona (no cuantas
  veces), promedio semanal en las ultimas 5 semanas.
- **Outlook**: se cuenta aparte de Assistant desde el corte del 26 sep 2026 en adelante.
- **Codigos de herramienta**: A=Assistant, W=Workflow, V=Vault, Wo=Word add-in, O=Outlook.

## Al iniciar una sesion nueva sobre este repo

1. Lee este archivo (ya lo hiciste si estas viendo esto).
2. Si vas a tocar metodologia o excepciones, confirma contra Notion antes de asumir que
   `data/roster.py` o `docs/` estan al dia: pudieron cambiar entre sesiones.
3. Los exports semanales (xlsx) llegan como adjuntos de la conversacion, no viven aqui.
   Procesalos desde `/mnt/user-data/uploads/` cada vez.
