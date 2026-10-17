# 中学数学 レベル1（やりなおし数学）

公開URL: https://chugaku-suugaku.senta1111.workers.dev/

- 配信するのは `public/index.html` の1枚だけ（KaTeXの式表示も中に入っている）。
- 問題を直す・足すとき: `tools/gen.js`（計算で作る問題）か `tools/src/handmade.js`（手書きの問題）を直す。
  1. `cd tools`
  2. `node gen.js`（`src/data.js` を作る）
  3. `node check.js`（答えと選択肢の検査。ALL OK が出ること）
  4. `node build.js --repo`（`tools/public/index.html` を作る）→ `public/index.html` に置きかえる
