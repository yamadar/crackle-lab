# crackle-lab — アーキテクチャ

貫入（クラック）パターン図鑑。4 種の手続き的アルゴリズムをパラメータ調整しながら canvas 表示する SPA。Vite 6 / vanilla JS。
`index.html`（UI コントロール + canvas）→ `src/main.js`（`./style.css` を import）。

## モジュール構成（`src/`）

| ファイル | 役割 | 主な export |
| --- | --- | --- |
| `config.js` | 定数・説明文 | `W` `H`（=1200）`descriptions` `algoNumbers` |
| `rng.js` | シード付き PRNG | `mulberry32` |
| `geometry.js` | **純粋**な幾何（Poisson / Voronoi / クリップ等） | `poissonDisk` `clipHalfPlane` `voronoiCells` `polyBbox` `pointInPolygon` `shClip` `pointToSegmentDist` `isOnParentBoundary` |
| `algorithms/voronoi.js` `recursive.js` `growth.js` `grammar.js` | **純粋**アルゴリズム `(params, rand) => { segments }` | `algoVoronoi` `algoRecursive` `algoGrowth` `algoGrammar` |
| `algorithms/index.js` | アルゴリズム登録 | `algorithms`（レジストリ）+ 各 `algo*` |
| `params.js` | スライダー値読取（データ駆動 `paramSpecs`） | `paramSpecs` `getParams` |
| `render.js` | canvas 描画 + 純粋な `countJunctions` | `render` `countJunctions` |
| `ui.js` | イベント配線 | `wireUI` |
| `main.js` | 薄いエントリ | — |

## テスト

- `rng.test.js`(5) `geometry.test.js`(15) `render.test.js`(3) `algorithms/algorithms.test.js`(28) — 計 51 件。

## 注意点

- 各アルゴリズムは RNG を注入する純粋関数。決定的（同シードで同結果）。
- `render.js` の紙質スペックルは意図的に `Math.random()`（装飾であり挙動の一部、シード化しない）。
- `render.js` は import 時 DOM 非依存（`canvas.getContext` は `render()` 内のみ）。

## コマンド

`npm run dev|test|build -w crackle-lab`
