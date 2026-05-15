// ============================================================
// CONSTANTS & CONFIG
// ============================================================

// Canvas internal dimensions used by every algorithm.
export const W = 1200;
export const H = 1200;

// Per-algorithm descriptive copy shown in the UI.
export const descriptions = {
  voronoi: {
    title: 'Voronoi tessellation — the canonical baseline',
    body: 'ポアソン円板サンプリングで配置した種点の Voronoi 図を生成。各セル境界がそのまま道路になる。Y接合（120°）が支配的になる典型例で、本物の貫入や都市道路の T接合（90°）は再現されない。比較用ベースラインとして提示。jitter を 0 にすると六角格子に収束し、計画都市の格子に近づく。'
  },
  recursive: {
    title: 'Recursive Voronoi — temporal hierarchy through subdivision',
    body: '親セル境界＝主道路を生成後、各セル内部で再帰的に Voronoi を実行。世代ごとに線幅を減衰させ、幹線・地区道・路地の階層を表現。Bogatov ら（2025）の Algorithm A.2 に対応。通常 Voronoi より T接合ピークが現れやすく、貫入の階層構造に近づく。階層深さ depth を増やすと急速に密度が上がる。'
  },
  growth: {
    title: "Crack growth — sequential T-junction formation",
    body: "初期亀裂を seed として配置し、各先端が逐次伸長する。既存クラックに接近すると 90°回頭して T接合を強制形成。先端が全て消滅すると既存ネットワーク上に新規クラックが派生 (nucleation)。Iben & O'Brien（2009）の釉薬カップ・シミュレーションを単純化したもので、実際の貫入と最も近い角度分布を生む。Strano（2012）の道路網順次成長モデルと同型構造で、α パラメータが branch probability に対応する。steps を増やすと密度が上がる。"
  },
  grammar: {
    title: 'City grammar — Parish-Müller style L-system',
    body: '幹線から直角分岐を繰り返す古典的な都市生成。Parish & Müller（2001 SIGGRAPH）の簡易版。完全な T接合構造を持つが、画一的な格子模様になりやすく、有機都市や貫入の不規則性は再現しない。比較対照。angle noise を上げると有機都市寄りになる。'
  }
};

// Display number used in the meta line per algorithm.
export const algoNumbers = { voronoi: '01', recursive: '02', growth: '03', grammar: '04' };
