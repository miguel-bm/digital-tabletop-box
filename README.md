# Tablero digital · caja para tele de 43"

Webapp (Vite + Three.js) para diseñar y construir una caja de contrachapado de 10 mm que convierte
una **Samsung UE43M5575AU** (43", 972,9 × 570 × 55,1 mm, 9,5 kg, VESA 200 × 200) en un tablero de juego
digital: la tele en horizontal sobre la mesa, mapas en la pantalla y miniaturas encima.

**En vivo:** https://digital-tabletop.miscellanics.com

```bash
npm install
npm run dev      # http://localhost:5181
npm run deploy   # vite build + wrangler deploy (Worker de estáticos)
npm test         # barrido de todas las opciones + comprobación de solapes
```

## El diseño en una frase

Un cajón de contrachapado: cuatro paredes y un marco de una capa **encolados**, y una **bandeja
extraíble** (la base con cuatro tacos de apoyo encolados en su perímetro). La tele entra **justa entre
las paredes** y apoya su borde fino sobre los tacos (con un burlete), así que su peso baja directo a la
base; el marco solo tapa el bisel. Además se **atornilla a la base por sus 4 roscas VESA** a través de
dos costillas de punta a punta, que la sujetan contra el burlete. La bandeja se atornilla por los
costados (M5 a insertos en los tacos) y es la tapa de servicio: todo se monta boca abajo y, al
sacarla, se llega a cables y tele sin tocar nada más. El protector de metacrilato cubre toda la caja.

## Qué hay en la app

- **Modelo 3D paramétrico**: tele con su trasera en cuña (fina arriba y gruesa en el tercio inferior,
  ajustada a fotos de perfil de la serie M de Samsung), ranura de ventilación, hueco de conexiones
  escalonado con los HDMI mirando al lateral, enchufe junto al canto inferior y receptor IR; paredes, postes, marco (simple con
  el protector encima, doble con pozo o simple con el protector debajo), base extraíble con costillas
  VESA y ventilación, listones, cables, revestimiento, herrajes y tapa.
- **Opciones**: uniones (a tope, galce, dedos), márgenes, marco y protector (metacrilato, policarbonato,
  vidrio), sujeción (VESA a la base, travesaños VESA colgados del marco o espuma), fijación de la base, salida de cables (pasamuros, conectores de
  panel, ranura), ventilación y ventiladores USB, altavoces, asas, cantoneras, tapa de transporte,
  bolsillos para dados y acabados (tolex, polipiel, terciopelo, fieltro, corcho, pintura, madera vista).
- **Puntos de partida**: Maleta, Flight case, Taberna, Mínima, Biblioteca.
- **Datos**: despiece, compra con precios orientativos y casillas, peso, pila de capas, rejilla de 1"
  (37 × 21 casillas, 51,2 px por pulgada) y una pestaña de **decisiones** con comparativas calculadas.
- **Planos A3**: conjunto (planta, alzados, sección 1:1), despiece con huecos acotados, optimización
  de corte (tablero y listones), guía de taller con lista de compra y vista explosionada.
  SVG, CSV, **DXF para CNC** o imprimir a PDF; **plantillas 1:1** por trozos de A3 para marcar taladros
  y el **patrón del revestimiento** (tira continua con pliegues y cortes de esquina).
- **Montaje** en 14–15 pasos (de medir la tele a la tapa), con la caja boca abajo cuando toca, pasos marcables,
  reproducción automática y tiempos orientativos (≈ 8 h de trabajo + ≈ 5 h de secados). También como
  **montaje ilustrado** imprimible (una imagen 3D por paso).
- **Cálculos**:
  - **FEM de láminas** de la caja completa en un Web Worker: mesa coja (3 apoyos), sin base, del asa y
    apoyarse en el canto. Elementos MITC4 + membrana con modos incompatibles, contrachapado con su
    módulo de cortante real y la base unida solo por sus tornillos. Validado contra Navier (placa
    apoyada: 3,826 vs 3,827 mm) y contra viga en voladizo en su plano (< 3 %).
  - **Estudios**: tornillos de la base, grosor y tipo de tablero, marco/margen, fijación de la base.
  - **Rápidos**: protector bajo un codo (Navier), travesaños con golpe de 3 g, canto como viga
    compuesta, asa y temperatura interior (red térmica de 2 nudos con tiro natural o ventiladores).
- **Compartir**: un enlace con todas las medidas para abrir el mismo diseño en otro dispositivo.
- **Variantes**: guarda versiones con nombre y compáralas con el diseño actual.
- **Cotas editables en 3D** (largo, ancho, alto) y medidas reales de la tele en el paso 1 del montaje.
- **Bolsillos para dados** y **ranuras para cartas** en el marco doble.
- **Fuente de imagen**: portátil fuera (HDMI), stick o Raspberry Pi dentro (solo sale la corriente).
- **Rejilla de calibración** (`/rejilla`): ábrela en la tele y comprueba que la casilla mide 25,4 mm.

## Conclusiones de los cálculos (diseño por defecto)

- **Resistencia**: de sobra. La tensión máxima en el contrachapado es ~2 MPa (rotura ~60 MPa).
- **Rigidez**: el punto débil es la **torsión**. En una mesa coja la esquina sin apoyo baja ~3,4 mm
  con la bandeja (5,4 mm con la tele flotando en una cámara perimetral y atornillada a la base, ~11 mm
  con la tele colgada del marco); sin la base, ~21 mm. Con menos de 8 tornillos la base deja de trabajar.
- **Costillas VESA**: un golpe de 3 g al dejarla dobla la costilla ~2 mm sin contar las patas centrales
  (coef. de seguridad ~11); con las patas apoyadas, prácticamente nada.
- **Protector**: un metacrilato de 4 mm sobre el marco (13 mm sobre la pantalla) llega a tocarla con
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

Los tacos de apoyo de la bandeja pueden ser listón de pino o tiras del mismo contrachapado encoladas
(dos de 10 mm por taco); la rigidez es prácticamente la misma.

Las medidas marcadas «medir» (fondo del borde fino, tamaño y posición de la zona de fondo máximo de la
trasera, posición VESA, enchufe, receptor IR) son estimaciones:
compruébalas con la tele delante antes de cortar (paso 1 de la guía).
