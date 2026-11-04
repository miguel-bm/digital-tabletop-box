# Tablero digital · caja para tele de 43"

Webapp (Vite + Three.js) para diseñar y construir una caja de contrachapado de 10 mm que convierte
una **Samsung UE43M5575AU** (43", 972,9 × 570 × 55,1 mm, 9,5 kg, VESA 200) en un tablero de juego
digital: la tele en horizontal sobre la mesa, mapas en la pantalla y fichas encima.

En vivo: https://digital-tabletop.miscellanics.com

```bash
npm install
npm run dev      # http://localhost:5181
npm run deploy   # vite build + wrangler deploy
```

## Qué hay

- **Modelo 3D paramétrico**: tele, paredes, marco (simple o doble con pozo para el protector),
  base extraíble, listones, tacos, travesaños VESA, revestimiento, herrajes y tapa opcional.
- **Opciones** de geometría (uniones, márgenes, marco), sujeción (VESA colgado o espuma),
  cables (pasamuros, conectores de panel, ranura), ventilación, asas y acabados.
- **Despiece**, compra estimada, **planos A3** (conjunto, despiece, corte, taller) y **guía de montaje**
  paso a paso (con la caja boca abajo cuando toca).
- **Cálculos**: flexión del protector y de la base, rigidez de las paredes, torsión, asa y temperatura.

## Estructura

| Archivo | Qué hace |
|---|---|
| `src/params.js` | Parámetros, grupos del panel, materiales y combinaciones de partida |
| `src/model.js` | Modelo puro: piezas (sólidos planos con huecos), herrajes, métricas y avisos |
| `src/geometry.js` | Booleana de rectángulos, huecos circulares/ranuras y extrusión por plano |
| `src/scene.js` | Escena 3D, capas, explosión, sección, volteo para el montaje |
| `src/materials.js` | Texturas procedurales (contrachapado, tolex, polipiel…) y mapas de juego |
| `src/cutlist.js` / `src/plans.js` | Despiece, optimización de corte y planos SVG |
| `src/assembly.js` | Pasos de montaje |
| `src/sim.js` / `src/simui.js` | Cálculos estructurales y térmicos |
