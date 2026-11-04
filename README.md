# Tablero digital · caja para tele de 43"

Webapp (Vite + Three.js) para diseñar y construir una caja de contrachapado de 10 mm que convierte
una **Samsung UE43M5575AU** (43", 972,9 × 570 × 55,1 mm, 9,5 kg, VESA 200 × 200) en un tablero de juego
digital: la tele en horizontal sobre la mesa, mapas en la pantalla y miniaturas encima.

**En vivo:** https://digital-tabletop.miscellanics.com

```bash
npm install
npm run dev      # http://localhost:5181
npm run deploy   # vite build + wrangler deploy (Worker de estáticos)
```

## El diseño en una frase

Un cajón de contrachapado con las cuatro paredes y un marco de una o dos capas **encolados**, y una
**base atornillada** que es la tapa de servicio: todo se monta boca abajo, la tele entra por detrás,
apoya la pantalla en un burlete bajo el marco y cuelga de dos **travesaños VESA** atornillados a
cuatro tacos encolados al marco. Quitando la base se llega a cables y tele sin tocar nada más.

## Qué hay en la app

- **Modelo 3D paramétrico**: tele (con joroba, puertos y receptor IR), paredes, marco (simple o doble
  con pozo para el protector, la capa superior en 4 listones para sacar todo de un tablero),
  base extraíble con ventilación, listones, tacos, travesaños VESA, cables, revestimiento, herrajes y tapa.
- **Opciones**: uniones (a tope, galce, dedos), márgenes, marco y protector (metacrilato, policarbonato,
  vidrio), sujeción (VESA o espuma), fijación de la base, salida de cables (pasamuros, conectores de
  panel, ranura), ventilación y ventiladores USB, altavoces, asas, cantoneras, tapa de transporte,
  bolsillos para dados y acabados (tolex, polipiel, terciopelo, fieltro, corcho, pintura, madera vista).
- **Puntos de partida**: Maleta, Flight case, Taberna, Mínima, Biblioteca.
- **Datos**: despiece, compra con precios orientativos y casillas, peso, pila de capas, rejilla de 1"
  (37 × 21 casillas, 51,2 px por pulgada) y una pestaña de **decisiones** con comparativas calculadas.
- **Planos A3**: conjunto (planta, alzados, sección 1:1), despiece con huecos acotados, optimización
  de corte (tablero y listones), guía de taller con lista de compra y vista explosionada.
  SVG, CSV, **DXF para CNC** o imprimir a PDF.
- **Montaje** en 14–15 pasos (de medir la tele a la tapa), con la caja boca abajo cuando toca y pasos marcables.
- **Cálculos**:
  - **FEM de láminas** de la caja completa en un Web Worker: mesa coja (3 apoyos), sin base, del asa y
    apoyarse en el canto. Elementos MITC4 + membrana con modos incompatibles, contrachapado con su
    módulo de cortante real y la base unida solo por sus tornillos. Validado contra Navier (placa
    apoyada: 3,826 vs 3,827 mm) y contra viga en voladizo en su plano (< 3 %).
  - **Estudios**: tornillos de la base, grosor y tipo de tablero, marco/margen, fijación de la base.
  - **Rápidos**: protector bajo un codo (Navier), travesaños con golpe de 3 g, canto como viga
    compuesta, asa y temperatura interior (red térmica de 2 nudos con tiro natural o ventiladores).
- **Compartir**: un enlace con todas las medidas para abrir el mismo diseño en otro dispositivo.

## Conclusiones de los cálculos (diseño por defecto)

- **Resistencia**: de sobra. La tensión máxima en el contrachapado es ~2 MPa (rotura ~60 MPa).
- **Rigidez**: el punto débil es la **torsión**. En una mesa coja la esquina sin apoyo baja ~10 mm;
  sin la base, ~28 mm. Con menos de 8 tornillos la base deja de trabajar. 12 mm de tablero la bajaría a ~8 mm.
- **Protector**: un metacrilato de 4 mm en el pozo (13 mm sobre la pantalla) llega a tocarla con
  ~5 kg apoyados en el centro; el vidrio templado de 4 mm no la toca ni con un codo, pero pesa el doble.
- **Temperatura**: con rejillas el aire interior se queda en ~39 °C con la habitación a 25 °C; con dos
  ventiladores USB, ~30 °C.

## Estructura

| Archivo | Qué hace |
|---|---|
| `src/params.js` | Parámetros, grupos del panel, materiales y puntos de partida |
| `src/model.js` | Modelo puro: piezas (sólidos planos con huecos), herrajes, cotas, métricas y avisos |
| `src/geometry.js` | Booleana de rectángulos, huecos circulares/ranuras y extrusión por plano |
| `src/scene.js` | Escena 3D, capas, explosión, sección, volteo, tapa, capturas y resultados FEM |
| `src/materials.js` | Texturas procedurales (contrachapado, tolex, polipiel…) y mapas de juego |
| `src/cutlist.js` / `src/plans.js` / `src/dxf.js` | Despiece, corte, planos SVG y DXF |
| `src/assembly.js` | Pasos de montaje |
| `src/bom.js` / `src/decisions.js` | Lista de compra y comparativas |
| `src/sim.js` / `src/fem.js` / `src/simui.js` | Cálculos analíticos, FEM de láminas y su interfaz |

Las medidas marcadas «medir» (fondo del borde, joroba, posición VESA, receptor IR) son estimaciones:
compruébalas con la tele delante antes de cortar (paso 1 de la guía).
