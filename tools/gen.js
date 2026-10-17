// 問題データの生成: node gen.js  -> src/data.js
// 手書き10問（src/handmade.js）＋ 計算で作る問題。誤答は「よくあるまちがい」から作り、理由も一緒に付ける。
const fs = require('fs'), path = require('path');
const HM = require('./src/handmade.js');
const hm = {};
HM.forEach(P => P.qs.forEach(q => { hm[q.id] = q; }));

let seed = 20261017;
function R() { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }
function shuffle(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
const MINUS = '−';
const lab = v => (v < 0 ? MINUS + (-v) : String(v));
const T = v => String(v);
const fr = (n, d) => '\\dfrac{' + n + '}{' + d + '}';
const gcd = (a, b) => (b ? gcd(b, a % b) : Math.abs(a));
function lcmBrute(a, b) { for (let x = Math.max(a, b); ; x++) if (x % a === 0 && x % b === 0) return x; }
const key = v => (v == null ? 'null:' + Math.random() : Array.isArray(v) ? v.map(x => x.toFixed(9)).join(',') : v.toFixed(9));

/* 問題を組み立てる。truth={v,tex}, cands=[{v,tex,why}]（先のものほど優先） */
function build(o) {
  const unit = o.unit || '';
  const wrap = (tex, raw) => (raw ? tex : '$' + tex + '$' + unit);
  const seen = [o.truth.tex], seenV = [key(o.truth.v)], wrongs = [];
  for (const c of o.cands) {
    if (wrongs.length >= 3) break;
    if (seen.includes(c.tex)) continue;
    if (!c.same && seenV.includes(key(c.v))) continue;
    seen.push(c.tex); seenV.push(key(c.v)); wrongs.push(c);
  }
  if (wrongs.length < 3) throw new Error(o.id + ': 誤答の候補が足りない');
  const all = shuffle([{ t: wrap(o.truth.tex, o.truth.raw), v: o.truth.v, ok: true }].concat(wrongs.map(c => (c.same ? { t: wrap(c.tex, c.raw), v: c.v, why: c.why, same: true } : { t: wrap(c.tex, c.raw), v: c.v, why: c.why }))));
  const ans = all.findIndex(x => x.ok);
  all.forEach(x => delete x.ok);
  const q = { id: o.id, expr: o.expr, p: o.p, ch: all, ans, steps: o.steps, point: o.point };
  if (o.fig) q.fig = o.fig;
  if (o.figAfter) q.figAfter = o.figAfter;
  return q;
}
const OFF = '答えが少しずれているよ。数直線の上を、指で1つずつたどって確かめよう。';
function offBy(res) {
  return [{ v: res + 1, tex: T(res + 1), why: OFF }, { v: res - 1, tex: T(res - 1), why: OFF }, { v: res + 2, tex: T(res + 2), why: OFF }, { v: res - 2, tex: T(res - 2), why: OFF }];
}
function nlFig(a, res, label) {
  const min = Math.min(a, res, 0) - 1, max = Math.max(a, res, 0) + 1;
  return {
    fig: { type: 'nl', min, max, pts: [{ v: a, label: lab(a) }] },
    figAfter: { type: 'nl', min, max, pts: [{ v: a, label: lab(a) }, { v: res, label: '答え' }], arrows: [{ from: a, to: res, label }] }
  };
}

/* ---------- 足し算・引き算の共通パーツ ---------- */
function addSteps(a, b, unit) {
  const res = a + b, u = unit || '';
  const s = ['足す＝数直線の<b>右へ進む</b>。'];
  if (a < 0 && res > 0) { s.push('$' + a + '$ から右へ ' + (-a) + ' つ進むと 0。'); s.push('残りは $' + b + '-' + (-a) + '=' + res + '$ つ。0からさらに右へ ' + res + ' つ進む。'); }
  else if (a < 0 && res === 0) { s.push('$' + a + '$ から右へ ' + b + ' つ進むと、ちょうど 0。'); }
  else if (a < 0) { s.push('$' + a + '$ から右へ ' + b + ' つ進む。0には届かないので、マイナスのまま。'); }
  else { s.push('$' + a + '$ から右へ ' + b + ' つ進む。'); }
  s.push('答えは $' + a + '+' + b + '=' + res + '$' + u + '。');
  return s;
}
function subSteps(a, b, unit) {
  const res = a - b, u = unit || '';
  const s = ['引く＝数直線の<b>左へ進む</b>。'];
  if (a > 0 && res < 0) { s.push('$' + a + '$ から左へ ' + a + ' つ進むと 0。'); s.push('残りは $' + b + '-' + a + '=' + (-res) + '$ つ。0からさらに左へ ' + (-res) + ' つ進む。'); }
  else if (a > 0) { s.push('$' + a + '$ から左へ ' + b + ' つ進む。'); }
  else { s.push('$' + a + '$ から左へ ' + b + ' つ進む。0から遠ざかるので、マイナスの大きさが増える。'); }
  s.push('答えは $' + a + '-' + b + '=' + res + '$' + u + '。');
  return s;
}
function signWhy(a, b, op, res) {
  if (op === '+') {
    if (a < 0 && res > 0) return '大きさ（' + res + '）は合っているけれど、右へ ' + b + ' つ進むと0を<b>こえる</b>ので、答えはプラスだよ。';
    if (a < 0) return '右へ進んでも0に届かないので、答えはマイナスのままだよ。';
    return 'プラスの数に正の数を足すので、答えはマイナスにならないよ。';
  }
  if (a > 0 && res < 0) return '大きさ（' + (-res) + '）は合っているけれど、' + a + 'より大きい ' + b + ' を引くと0を<b>こえて</b>マイナスになるよ。';
  if (a > 0) return a + 'から' + b + 'を引いても0をこえないので、答えはプラスだよ。';
  return 'マイナスの数からさらに引いているので、答えはプラスにならないよ。';
}
function addSubCands(a, b, op, res) {
  const c = [];
  if (op === '+') {
    if (a < 0) c.push({ v: -a + b, tex: T(-a + b), why: '$' + a + '$ のマイナスを見落として、$' + (-a) + '+' + b + '$ を計算していないかな。$' + a + '$ は0より<b>左</b>からスタートするよ。' });
    c.push({ v: a - b, tex: T(a - b), why: '足し算なのに、<b>左</b>へ進んでしまっているよ。＋は<b>右へ</b>進む。' });
  } else {
    if (a < 0) c.push({ v: -a - b, tex: T(-a - b), why: '$' + a + '$ のマイナスを見落として、$' + (-a) + '-' + b + '$ を計算していないかな。$' + a + '$ は0より<b>左</b>からスタートするよ。' });
    c.push({ v: a + b, tex: T(a + b), why: '引き算なのに、<b>右</b>へ進んでしまっているよ。−は<b>左へ</b>進む。' });
  }
  if (res !== 0) c.push({ v: -res, tex: T(-res), why: signWhy(a, b, op, res) });
  return c.concat(offBy(res));
}

/* ---------- 正負の数 ---------- */
function genSeifu1() {
  return [4, -6, -1, 7, -3].map((v, i) => {
    const right = v > 0, color = right ? '赤' : '青';
    const cands = [
      { v: -v, tex: T(-v), why: right ? '点は0の<b>右</b>にある。右側はプラスだから、「−」はつかないよ。' : '点は0の<b>左</b>にある。左側はマイナスだから、数字の前に「−」がつくよ。' },
      { v: v > 0 ? v + 1 : v - 1, tex: T(v > 0 ? v + 1 : v - 1), why: '0から1つずつ数えてみよう。点は ' + Math.abs(v) + ' つ目の目盛りだよ。' },
      { v: v > 0 ? v - 1 : v + 1, tex: T(v > 0 ? v - 1 : v + 1), why: '0から1つずつ数えてみよう。点は ' + Math.abs(v) + ' つ目の目盛りだよ。' },
      { v: -(v > 0 ? v + 1 : v - 1), tex: T(-(v > 0 ? v + 1 : v - 1)), why: '符号（＋か−か）と、目盛りの数え方の両方を見直そう。0の' + (right ? '右' : '左') + 'へ ' + Math.abs(v) + ' つ目だよ。' }
    ];
    return build({
      id: 'sg1-' + (i + 1), expr: String(v),
      p: '数直線の<b>' + color + 'い点</b>は、いくつを表している？',
      fig: { type: 'nl', min: -7, max: 7, pts: [{ v, label: '?' }] },
      figAfter: { type: 'nl', min: -7, max: 7, pts: [{ v, label: lab(v) }] },
      truth: { v, tex: T(v) }, cands,
      steps: ['点は0より<b>' + (right ? '右' : '左') + '</b>にある。' + (right ? '右側はプラスの数。' : '左側はマイナスの数。'), '0から' + (right ? '右' : '左') + 'へ数えると、<b>' + Math.abs(v) + ' つ目</b>の目盛り。', 'だから答えは $' + v + '$。'],
      point: '0より右はプラス、左はマイナス。0から何つ目かを数えて、符号をつける。'
    });
  });
}
function genSeifu2() {
  const sets = [[3, -2, 5, -4, 'max'], [-1, 4, -6, 2, 'min'], [-3, 0, -5, 6, 'max'], [5, -7, 1, -2, 'min'], [-4, -1, -8, -3, 'max']];
  return sets.map((s, i) => {
    const nums = s.slice(0, 4), mode = s[4];
    const truth = mode === 'max' ? Math.max(...nums) : Math.min(...nums);
    const sorted = nums.slice().sort((x, y) => x - y);
    const cands = nums.filter(x => x !== truth).map(x => {
      let why;
      if (mode === 'max') why = '$' + x + '$ は、答えの $' + truth + '$ より<b>左</b>にある（小さい）。数直線では右にあるほど大きい。' + (x < 0 && Math.abs(x) > Math.abs(truth) ? 'マイナスの数は、数字が大きいほど小さくなるよ。' : '');
      else why = '$' + x + '$ は、答えの $' + truth + '$ より<b>右</b>にある（大きい）。数直線では左にあるほど小さい。' + (x > 0 ? 'プラスの数はマイナスの数より大きいよ。' : '');
      return { v: x, tex: T(x), why };
    });
    return build({
      id: 'sg2-' + (i + 1), expr: 'Math.' + mode + '(' + nums.join(',') + ')',
      p: '次の4つの数のうち、いちばん<b>' + (mode === 'max' ? '大きい' : '小さい') + '</b>数はどれ？<br>$' + nums.join(',\\ ') + '$',
      figAfter: { type: 'nl', min: -8, max: 8, pts: nums.map(x => ({ v: x, label: lab(x) })) },
      truth: { v: truth, tex: T(truth) }, cands,
      steps: ['数直線に並べると、左から順に $' + sorted.join(',\\ ') + '$。', mode === 'max' ? '<b>いちばん右</b>にある数が、いちばん大きい。' : '<b>いちばん左</b>にある数が、いちばん小さい。', '答えは $' + truth + '$。'],
      point: '大小は「右にあるほど大きい」。マイナスの数は、0から遠いほど小さい。'
    });
  });
}
function genAdd(list, prefix) {
  return list.map(([a, b], i) => {
    const res = a + b;
    return build({
      id: prefix + (i + 1), expr: a + '+' + b,
      p: '$' + a + '+' + b + '$ を計算しよう。',
      ...nlFig(a, res, '右へ' + b),
      truth: { v: res, tex: T(res) }, cands: addSubCands(a, b, '+', res),
      steps: addSteps(a, b),
      point: '足し算は「右へ進む」。0をまたぐときは、「0まで何歩」と「残り何歩」に分けて考える。'
    });
  });
}
function genSub(list, prefix) {
  return list.map(([a, b], i) => {
    const res = a - b;
    return build({
      id: prefix + (i + 1), expr: a + '-' + b,
      p: '$' + a + '-' + b + '$ を計算しよう。',
      ...nlFig(a, res, '左へ' + b),
      truth: { v: res, tex: T(res) }, cands: addSubCands(a, b, '-', res),
      steps: subSteps(a, b),
      point: '引き算は「左へ進む」。マイナスの数から引くと、もっとマイナスが大きくなる。'
    });
  });
}
function genParen() {
  const list = [['+', 3, 5], ['+', -2, 4], ['+', 4, 7], ['-', 1, 4], ['-', -3, 5], ['-', -2, 6]];
  return list.map(([op, a, b], i) => {
    const res = op === '+' ? a - b : a + b;
    const cands = [];
    if (op === '+') {
      cands.push({ v: a + b, tex: T(a + b), why: 'かっこの中の「−」を見落としているよ。$(-' + b + ')$ を足すのは、$' + b + '$ を<b>引く</b>のと同じ。' });
      cands.push({ v: -a - b, tex: T(-a - b), why: '最初の数 $' + a + '$ の符号を変えてしまっているよ。最初の数はそのまま。' });
    } else {
      cands.push({ v: a - b, tex: T(a - b), why: '「−(−' + b + ')」のマイナスが2つ並んでいるのを、ふつうの引き算にしていないかな。マイナスの数を引くと、<b>プラス</b>に変わる。' });
      cands.push({ v: -a - b, tex: T(-a - b), why: '最初の数 $' + a + '$ の符号を変えてしまっているよ。最初の数はそのまま。' });
    }
    if (res !== 0) cands.push({ v: -res, tex: T(-res), why: '大きさは合っているけれど、符号が逆だよ。$' + (op === '+' ? b + '$ を引く' : b + '$ を足す') + 'と考えて、数直線で確かめよう。' });
    const c2 = cands.concat(offBy(res));
    const expr = a + op + '(-' + b + ')';
    const steps = op === '+'
      ? ['$(-' + b + ')$ を足すのは、$' + b + '$ を<b>引く</b>のと同じ。', 'だから $' + a + '+(-' + b + ')=' + a + '-' + b + '$。'].concat(subSteps(a, b))
      : ['$(-' + b + ')$ を引くのは、$' + b + '$ を<b>足す</b>のと同じ（マイナスのマイナスはプラス）。', 'だから $' + a + '-(-' + b + ')=' + a + '+' + b + '$。'].concat(addSteps(a, b));
    return build({
      id: 'sg5-' + (i + 1), expr,
      p: '$' + a + (op === '+' ? '+' : '-') + '(-' + b + ')$ を計算しよう。',
      ...nlFig(a, res, op === '+' ? '左へ' + b : '右へ' + b),
      truth: { v: res, tex: T(res) }, cands: c2, steps,
      point: op === '+' ? '「マイナスの数を足す」は「その数を引く」のと同じ。' : '「マイナスの数を引く」は「その数を足す」のと同じ。'
    });
  });
}
function genStory() {
  const items = [
    { op: '-', a: 2, b: 7, unit: '℃', word: '下がった', p: '夕方の気温は $2$℃。夜までに $7$℃ <b>下がった</b>。夜の気温は？' },
    { op: '+', a: -5, b: 3, unit: '点', word: 'とった', p: 'ゲームで、いまの得点は $-5$点。次の問題で $3$点 <b>とった</b>。得点は？' },
    { op: '-', a: 1, b: 4, unit: '点', word: '引かれた', p: 'ゲームで、いまの得点は $1$点。まちがえて $4$点 <b>引かれた</b>。得点は？' },
    { op: '+', a: -8, b: 5, unit: 'm', word: '上がった', p: '海面を0mとする。潜水艦は $-8$m の深さにいる。そこから $5$m <b>上がった</b>。いまの高さは？' },
    { op: '-', a: -2, b: 3, unit: 'm', word: '下がった', p: '海面を0mとする。いまは $-2$m の深さにいる。そこから $3$m <b>下がった</b>。いまの高さは？' }
  ];
  return items.map((it, i) => {
    const { op, a, b, unit } = it, res = op === '+' ? a + b : a - b;
    const word = '「' + it.word + '」は ' + (op === '+' ? '＋' : '−') + '。式にすると $' + a + op + b + '$。';
    return build({
      id: 'sg6-' + (i + 1), expr: a + op + b, unit,
      p: it.p,
      ...nlFig(a, res, (op === '+' ? '右へ' : '左へ') + b),
      truth: { v: res, tex: T(res) }, cands: addSubCands(a, b, op, res),
      steps: [word].concat(op === '+' ? addSteps(a, b, unit) : subSteps(a, b, unit)),
      point: '「上がる・ふえる・もらう」は＋、「下がる・へる・引かれる」は−。式にできれば、あとは数直線で進むだけ。'
    });
  });
}

/* ---------- かっこをはずす・書き方のルール ---------- */
function genKakko() {
  const val = (a, c, b) => (c === '+' ? a + b : a - b);
  const listA = [[7, '-', '-', 3], [5, '+', '-', 2], [4, '-', '+', 6], [2, '+', '+', 8], [-3, '-', '-', 5], [-6, '+', '-', 1]];
  const qa = listA.map(([a, o, sg, b], i) => {
    const same = o === sg, c = same ? '+' : '-', c2 = same ? '-' : '+';
    const orig = a + o + '(' + sg + b + ')', res = a + c + b;
    const hint = '「' + (o === '+' ? '＋' : '−') + '」と「' + (sg === '+' ? '＋' : '−') + '」は' + (same ? '同じ' : 'ちがう') + 'から、' + (same ? '＋' : '−') + 'にまとめる。';
    const cands = [
      { v: val(a, c2, b), tex: a + c2 + b, why: 'かっこの前は「' + (o === '+' ? '＋' : '−') + '」、中は「' + (sg === '+' ? '＋' : '−') + '」。' + (same ? '同じ符号なので＋' : 'ちがう符号なので−') + 'になるよ。「同じなら＋、ちがうなら−」。' },
      { same: true, v: val(a, c, b), tex: a + c + '(' + b + ')', why: 'かっこが残っているよ。「かっこをはずす」問題なので、かっこはなくして書く。' },
      { v: null, tex: a + o + sg + b, why: '符号を2つ続けて書くのはまちがい。かっこをはずしたら、符号は<b>1つにまとめる</b>。' },
      { v: val(-a, c, b), tex: (-a) + c + b, why: '最初の数 $' + a + '$ の符号が変わってしまっているよ。最初の数はそのまま書く。' }
    ];
    return build({
      id: 'sgk-' + (i + 1), expr: a + c + b,
      p: '$' + orig + '$ の、かっこをはずして書こう。<br><small>計算はしなくていい。かっこをはずすだけ。</small>',
      truth: { v: val(a, c, b), tex: res }, cands,
      steps: ['かっこの前の符号は「' + (o === '+' ? '＋' : '−') + '」、かっこの中の符号は「' + (sg === '+' ? '＋' : '−') + '」。', hint, 'だから $' + orig + '=' + res + '$。'],
      point: '同じ符号なら＋、ちがう符号なら−。かっこは、はずしたら残さない。'
    });
  });
  const plus = [{ v: null, tex: '+(-3)' }, { v: null, tex: '-(+3)' }, { v: null, tex: '-3' }];
  const qb = [
    build({
      id: 'sgk-7', expr: '-(-3)', p: 'かっこをはずすと「$+3$」になるのは、どれ？',
      truth: { v: 3, tex: '-(-3)' },
      cands: [
        { v: null, tex: '+(-3)', why: '前が「＋」、中が「−」でちがうから、−3 になるよ。' },
        { v: null, tex: '-(+3)', why: '前が「−」、中が「＋」でちがうから、−3 になるよ。' },
        { v: null, tex: '-3', why: 'もともと −3 だよ。「＋3」にはならない。' }
      ],
      steps: ['2つの符号を見る。「同じなら＋、ちがうなら−」。', '$-(-3)$ は、前も中も「−」で<b>同じ</b>。だから＋になる。', '答えは $-(-3)=+3$。'],
      point: '「−(−」のように、マイナスが2つ並んだら＋になる。'
    }),
    build({
      id: 'sgk-8', expr: '+(-3)', p: 'かっこをはずすと「$-3$」になるのは、どれ？',
      truth: { v: -3, tex: '+(-3)' },
      cands: [
        { v: null, tex: '+(+3)', why: '前も中も「＋」で同じだから、＋3 になるよ。' },
        { v: null, tex: '-(-3)', why: '前も中も「−」で同じだから、＋3 になるよ。' },
        { v: null, tex: '+3', why: 'これはもともと ＋3。−3 ではない。' }
      ],
      steps: ['2つの符号を見る。「同じなら＋、ちがうなら−」。', '$+(-3)$ は、前が「＋」、中が「−」で<b>ちがう</b>。だから−になる。', '答えは $+(-3)=-3$。'],
      point: '符号がちがうときは−。「＋(−」も「−(＋」も、−になる。'
    }),
    build({
      id: 'sgk-9', expr: '1', raw: true,
      p: 'かっこの前の符号と、かっこの中の符号が<b>同じ</b>とき、かっこをはずすと、符号はどうなる？<br><small>例：$-(-3)$、$+(+3)$</small>',
      truth: { v: 1, tex: '＋になる', raw: true },
      cands: [
        { v: null, raw: true, tex: '−になる', why: '同じ符号が並んだときは＋だよ。「同じなら＋、ちがうなら−」。' },
        { v: null, raw: true, tex: '0になる', why: '符号が0になることはないよ。2つの符号を1つにまとめて、＋か−のどちらかになる。' },
        { v: null, raw: true, tex: '2つのまま残す', why: '符号を2つ並べて書いてはいけない。かならず1つにまとめる。' }
      ],
      steps: ['かっこの前と中の符号が同じ → ＋にまとめる。', '例：$-(-3)=+3$、$+(+3)=+3$。'],
      point: '同じなら＋。'
    }),
    build({
      id: 'sgk-10', expr: '-1', raw: true,
      p: 'かっこの前の符号と、かっこの中の符号が<b>ちがう</b>とき、かっこをはずすと、符号はどうなる？<br><small>例：$+(-3)$、$-(+3)$</small>',
      truth: { v: -1, tex: '−になる', raw: true },
      cands: [
        { v: null, raw: true, tex: '＋になる', why: 'ちがう符号が並んだときは−だよ。＋になるのは、同じ符号が並んだとき。' },
        { v: null, raw: true, tex: '0になる', why: '符号が0になることはないよ。2つの符号を1つにまとめて、＋か−のどちらかになる。' },
        { v: null, raw: true, tex: '2つのまま残す', why: '符号を2つ並べて書いてはいけない。かならず1つにまとめる。' }
      ],
      steps: ['かっこの前と中の符号がちがう → −にまとめる。', '例：$+(-3)=-3$、$-(+3)=-3$。'],
      point: 'ちがうなら−。'
    })
  ];
  return qa.concat(qb);
}
const HW_SVG = (() => {
  const panel = (dx, label, minusX, threeX, bad) =>
    '<g transform="translate(' + dx + ',0)"><text class="hw-t" x="8" y="22">' + label + '</text>' +
    '<text class="hw-n" x="8" y="76">7−10</text><line class="hw-l" x1="82" y1="68" x2="104" y2="68"/><line class="hw-l" x1="82" y1="78" x2="104" y2="78"/>' +
    '<line class="hw-l ' + (bad ? 'hw-bad' : 'hw-ok') + '" x1="' + minusX + '" y1="73" x2="' + (minusX + (bad ? 14 : 18)) + '" y2="73"/>' +
    '<text class="hw-n" x="' + threeX + '" y="76">3</text></g>';
  return '<svg class="hw" viewBox="0 0 420 100" role="img" aria-label="答えの書き方のくらべ">' + panel(0, 'ア', 98, 118, true) + panel(220, 'イ', 120, 146, false) + '</svg>';
})();
function genKaki() {
  const out = [];
  out.push(build({
    id: 'sgw-1', expr: '7-(-3)', p: '7から $-3$ を引く式を、正しく書いているのはどれ？',
    truth: { v: 10, tex: '7-(-3)' },
    cands: [
      { v: null, tex: '7--3', why: '符号を2つ続けて書いてはいけない。マイナスの数には<b>かっこをつけて</b>、$7-(-3)$ と書く。' },
      { v: 4, tex: '7-(3)', why: 'これは「3」を引く式。引くのは「$-3$」だから、かっこの中にもマイナスが必要。' },
      { v: -4, tex: '-7-(-3)', why: '最初の数 7 の符号が変わってしまっているよ。' }
    ],
    steps: ['引く数は「$-3$」。マイナスの数なので、かっこをつける。', '式は $7-(-3)$。'],
    point: 'マイナスの数は、かっこをつけて書く。'
  }));
  out.push(build({
    id: 'sgw-2', expr: '7+(-3)', p: '7に $-3$ を足す式を、正しく書いているのはどれ？',
    truth: { v: 4, tex: '7+(-3)' },
    cands: [
      { v: null, tex: '7+-3', why: '「＋」と「−」を続けて書いてはいけない。マイナスの数には<b>かっこをつけて</b>、$7+(-3)$ と書く。' },
      { v: 10, tex: '7+(3)', why: 'これは「3」を足す式。足すのは「$-3$」だから、かっこの中にもマイナスが必要。' },
      { v: -10, tex: '-7+(-3)', why: '最初の数 7 の符号が変わってしまっているよ。' }
    ],
    steps: ['足す数は「$-3$」。マイナスの数なので、かっこをつける。', '式は $7+(-3)$。'],
    point: 'マイナスの数は、かっこをつけて書く。足すときも同じ。'
  }));
  const bad = [
    ['sgw-3', '7--3', ['7-(-3)', '7+(-3)', '-3+7']],
    ['sgw-4', '2+-7', ['2-(-7)', '2+(-7)', '-7+2']],
    ['sgw-5', '4--6', ['4-(-6)', '4+(-6)', '-6+4']]
  ];
  bad.forEach(([id, wrong, oks]) => {
    out.push(build({
      id, expr: '1', p: '式の書き方が<b>まちがっている</b>のは、どれ？',
      truth: { v: 1, tex: wrong },
      cands: oks.map(t => ({ v: null, tex: t, why: t.startsWith('-') ? 'これは正しい書き方。「' + t + '」のように、先頭のマイナスにはかっこはいらない。' : 'これは正しい書き方。マイナスの数に<b>かっこがついている</b>。' })),
      steps: ['マイナスの数には、かっこをつける。', '「$' + wrong + '$」は、符号が2つ続いてしまっている。', '正しくは $' + (wrong.includes('--') ? wrong.replace('--', '-(-') + ')' : wrong.replace('+-', '+(-') + ')') + '$ と書く。'],
      point: '「−−」「＋−」のように、符号を続けて書かない。マイナスの数には、かっこをつける。'
    }));
  });
  out.push(build({
    id: 'sgw-6', expr: '1', p: '計算して、答えが「$-3$」だと気づいた。でも、もう「＝3」と書いてしまった。どうする？',
    truth: { v: 1, tex: '「＝3」を一度消して、「＝」と「−」が重ならないように書き直す', raw: true },
    cands: [
      { v: null, raw: true, tex: '＝のすぐ右のすきまに、「−」をねじこんで書く', why: '「＝」と「−」がくっついて、読めなくなる。読めない字は、まちがいとされて減点されることがある。' },
      { v: null, raw: true, tex: '3の上に、小さく「−」を書く', why: '小さい「−」は、採点する人が見落とす。見落とされたら「3」と同じ。' },
      { v: null, raw: true, tex: '気にせず、そのまま「3」で出す', why: '3 と −3 はちがう数。符号がちがうと、不正解になる。' }
    ],
    steps: ['すきまに「−」をねじこむと、「＝」にくっついて読めなくなる。', '消して書き直すのは数秒。その数秒で、点がもらえる。', '「＝−3」と、重ならないように書く。'],
    point: 'めんどうがらずに、一回消して書き直す。それで点がもらえる。'
  }));
  out.push(build({
    id: 'sgw-7', expr: '1', raw: true, p: '答えを書く前に、先にやっておくと、ねじこまずにすむことは？',
    truth: { v: 1, tex: '答えの符号（＋か−か）を先に決めてから、「＝」を書く', raw: true },
    cands: [
      { v: null, raw: true, tex: '数だけ先に書いて、符号はあとで考える', why: 'それだと、あとから符号を足す「ねじこみ」になってしまう。' },
      { v: null, raw: true, tex: '何も考えず、すぐ「＝」を書く', why: '先に書くと、符号を忘れていたときに直せなくなる。' },
      { v: null, raw: true, tex: '答えは、いつも「＋」にしておく', why: '答えがマイナスのときは、まちがいになる。' }
    ],
    steps: ['数直線で、答えが0より右か左かを先に決める。', '右なら＋（符号は書かない）、左なら−。', '決めてから、「＝−3」のように書く。'],
    point: '先に符号、あとで数。'
  }));
  out.push(build({
    id: 'sgw-8', expr: '1', raw: true, p: '「＝」と「−」の書き方。点がもらえるのは、ア・イのどちら？',
    fig: { type: 'svg', html: HW_SVG },
    truth: { v: 1, tex: 'イ', raw: true },
    cands: [
      { v: null, raw: true, tex: 'ア', why: 'アは、「−」が「＝」にくっついてしまっている。「＝」なのか「−」なのか、読みにくい。' },
      { v: null, raw: true, tex: 'どちらも同じ', why: 'ちがうよ。アは「−」が「＝」に重なっていて読みにくい。イは、すきまがあって読みやすい。' },
      { v: null, raw: true, tex: 'どちらも点がもらえない', why: 'イは、「＝」と「−」の間にすきまがあって、はっきり読める。これは点がもらえる。' }
    ],
    steps: ['アは、「−」が「＝」の右はしにくっついている。', 'イは、「＝」と「−」の間に、すきまがある。', '「＝」と「−」は、重ならないように、間をあけて書く。'],
    point: '「＝」と「−」の間に、すきまをあける。'
  }));
  return out;
}

/* ---------- 分数 ---------- */
function barsRow(n, d) { return { tex: fr(n, d), n: d, k: n }; }
function genEqual() {
  const list = [[1, 3, 2], [2, 3, 4], [3, 4, 2], [3, 5, 3], [2, 5, 2]];
  return list.map(([a, b, k], i) => {
    const D = b * k, ans = a * k;
    const cands = [
      { v: a, tex: T(a), why: '分母だけ ' + b + '→' + D + ' に変えて、分子を ' + a + ' のままにしていないかな。ピースの大きさが変わるので、$' + fr(a, D) + '$ は $' + fr(a, b) + '$ より小さくなってしまう。' },
      { v: a + (D - b), tex: T(a + (D - b)), why: '分母に ' + (D - b) + ' を<b>足した</b>から、分子にも ' + (D - b) + ' を足していないかな。足すのではなく、<b>' + k + '倍</b>（かけ算）にそろえるのがルール。' },
      { v: D, tex: T(D), why: '$' + fr(D, D) + '$ は全部（＝1）という意味になる。$' + fr(a, b) + '$ は1より小さいよ。' },
      { v: a * (k + 1), tex: T(a * (k + 1)), why: '分母が ' + b + '→' + D + ' で<b>' + k + '倍</b>になっているよ。分子も、同じ ' + k + '倍。' }
    ].concat(offBy(ans));
    return build({
      id: 'tb1-' + (i + 1), expr: a + '*' + k,
      p: '$' + fr(a, b) + '=' + fr('\\square', D) + '$ の □ に入る数は？',
      fig: { type: 'bars', rows: [barsRow(a, b), { tex: fr('\\square', D), n: D, k: 0 }] },
      figAfter: { type: 'bars', rows: [barsRow(a, b), barsRow(ans, D)] },
      truth: { v: ans, tex: T(ans) }, cands,
      steps: ['分母が $' + b + '\\to' + D + '$ で、<b>' + k + '倍</b>になった。', '分子も同じ<b>' + k + '倍</b>にする。$' + a + '\\times' + k + '=' + ans + '$。', '答えは $' + fr(a, b) + '=' + fr(ans, D) + '$。大きさは変わらず、切り方だけ細かくなった。'],
      point: '分母と分子に、同じ数をかける。大きさは変わらない。'
    });
  });
}
function genReduce() {
  const list = [[6, 8], [4, 10], [9, 12], [12, 18], [18, 24], [8, 20]];
  return list.map(([n, d], i) => {
    const g = gcd(n, d), rn = n / g, rd = d / g;
    const cands = [];
    for (const p of [2, 3, 5]) if (g % p === 0 && p < g) cands.push({ same: true, v: (n / p) / (d / p), tex: fr(n / p, d / p), why: '$' + fr(n / p, d / p) + '$ は、まだ約分できるよ。分子と分母は、まだ ' + (g / p) + ' でわれる。もっと小さい分数になるまでわろう。' });
    cands.push({ v: rn / d, tex: fr(rn, d), why: '分子だけをわっているよ。分母も<b>同じ数</b>でわらないと、大きさが変わってしまう。' });
    cands.push({ v: n / rd, tex: fr(n, rd), why: '分母だけをわっているよ。分子も<b>同じ数</b>でわらないと、大きさが変わってしまう。' });
    cands.push({ v: (n - g) / (d - g), tex: fr(n - g, d - g), why: 'わり算ではなく、引き算になっているよ。分子と分母から同じ数を引くと、大きさが変わってしまう。わるなら大きさは変わらない。' });
    cands.push({ v: (rn + 1) / rd, tex: fr(rn + 1, rd), why: '分子の計算がずれているよ。$' + n + '\\div' + g + '=' + rn + '$ だよ。' });
    cands.push({ v: rn / (rd + 1), tex: fr(rn, rd + 1), why: '分母の計算がずれているよ。$' + d + '\\div' + g + '=' + rd + '$ だよ。' });
    return build({
      id: 'tb2-' + (i + 1), expr: n + '/' + d,
      p: '$' + fr(n, d) + '$ を約分しよう。',
      fig: { type: 'bars', rows: [barsRow(n, d)] },
      figAfter: { type: 'bars', rows: [barsRow(n, d), barsRow(rn, rd)] },
      truth: { v: rn / rd, tex: fr(rn, rd) }, cands,
      steps: ['分子と分母を、同じ数でわる。$' + n + '$ と $' + d + '$ をどちらもわれる、いちばん大きい数は <b>' + g + '</b>。', '$' + fr(n, d) + '=' + fr(n + '\\div' + g, d + '\\div' + g) + '=' + fr(rn, rd) + '$。', 'これ以上、分子と分母に共通してわれる数はない。答えは $' + fr(rn, rd) + '$。'],
      point: '約分は、分子と分母を同じ数でわる。これ以上われなくなるまで続ける。'
    });
  });
}
function notCommonWhy(x, b, d) {
  if (x % b !== 0 && x % d !== 0) return x + ' は、' + b + ' でも ' + d + ' でも割り切れない。';
  if (x % b !== 0) return x + ' は ' + b + ' で割り切れない。';
  return x + ' は ' + d + ' で割り切れない。';
}
function genLcm() {
  const list = [[1, 3, 1, 4], [3, 4, 1, 6], [1, 3, 1, 6], [1, 6, 4, 9], [3, 4, 3, 10]];
  return list.map(([n1, b, n2, d], i) => {
    const L = lcmBrute(b, d), cands = [];
    const prod = b * d, mx = Math.max(b, d);
    if (prod !== L) cands.push({ v: prod, tex: T(prod), why: prod + ' でもそろえることはできるけれど、問題は「いちばん<b>小さい</b>」分母。もっと小さい ' + L + ' でそろうよ。' });
    if (mx !== L) cands.push({ v: mx, tex: T(mx), why: notCommonWhy(mx, b, d) + 'どちらの分母でも割り切れる数を探そう。' });
    cands.push({ v: b + d, tex: T(b + d), why: (b + d === L ? '' : notCommonWhy(b + d, b, d)) + '分母を足しても、そろえたことにならないよ。' });
    if (L % 2 === 0) cands.push({ v: L / 2, tex: T(L / 2), why: notCommonWhy(L / 2, b, d) + 'どちらの分母でも割り切れる数が必要だよ。' });
    cands.push({ v: L + Math.min(b, d), tex: T(L + Math.min(b, d)), why: '大きすぎる。もっと小さく、どちらでも割り切れる数があるよ。' });
    cands.push({ v: L - 1, tex: T(L - 1), why: notCommonWhy(L - 1, b, d) });
    const mulList = (x) => { const r = []; for (let m = x; m <= L; m += x) r.push(m); return r.join(',\\ '); };
    return build({
      id: 'tb3-' + (i + 1), expr: String(L),
      p: '$' + fr(n1, b) + '$ と $' + fr(n2, d) + '$ を通分したい。いちばん<b>小さい</b>共通の分母は？',
      fig: { type: 'bars', rows: [barsRow(n1, b), barsRow(n2, d)] },
      truth: { v: L, tex: T(L) }, cands,
      steps: ['$' + b + '$ の倍数：$' + mulList(b) + '$、…', '$' + d + '$ の倍数：$' + mulList(d) + '$、…', '2つに最初に共通して出てくる数が <b>' + L + '</b>。これがいちばん小さい共通の分母。'],
      point: '通分の分母は、2つの分母の「いちばん小さい共通の倍数」にする。数がいちばん小さくて計算が楽になる。'
    });
  });
}
function genTsubun() {
  const list = [[1, 2, 2, 3], [1, 3, 1, 4], [3, 4, 1, 6], [2, 3, 3, 4], [1, 4, 5, 6], [2, 5, 1, 2]];
  const pair = (x, y, D) => fr(x, D) + ',\\ ' + fr(y, D);
  return list.map(([a, b, c, d], i) => {
    const D = lcmBrute(b, d), k1 = D / b, k2 = D / d, x = a * k1, y = c * k2;
    const cands = [
      { v: [a / D, c / D], tex: pair(a, c, D), why: '分母だけ ' + D + ' に変えて、分子をそのままにしていないかな。分母が変わったら、分子にも<b>同じ数</b>をかけないと、大きさが変わる。' },
      { v: [a * k2 / D, c * k1 / D], tex: pair(a * k2, c * k1, D), why: 'かける数が入れかわっているよ。$' + fr(a, b) + '$ は分母が ' + b + '→' + D + ' で<b>' + k1 + '倍</b>だから、分子も ' + k1 + '倍。' },
      { v: [x / D, c / D], tex: pair(x, c, D), why: '$' + fr(a, b) + '$ は直せているけれど、$' + fr(c, d) + '$ の分子を直し忘れているよ。分母が ' + d + '→' + D + ' で<b>' + k2 + '倍</b>だから、分子も ' + k2 + '倍。' },
      { v: [a / D, y / D], tex: pair(a, y, D), why: '$' + fr(c, d) + '$ は直せているけれど、$' + fr(a, b) + '$ の分子を直し忘れているよ。分母が ' + b + '→' + D + ' で<b>' + k1 + '倍</b>だから、分子も ' + k1 + '倍。' },
      { v: [(x + 1) / D, y / D], tex: pair(x + 1, y, D), why: '1つめの分子の計算がずれているよ。$' + a + '\\times' + k1 + '=' + x + '$。' },
      { v: [x / D, (y + 1) / D], tex: pair(x, y + 1, D), why: '2つめの分子の計算がずれているよ。$' + c + '\\times' + k2 + '=' + y + '$。' }
    ];
    return build({
      id: 'tb4-' + (i + 1), expr: '[' + a + '/' + b + ',' + c + '/' + d + ']',
      p: '$' + fr(a, b) + '$ と $' + fr(c, d) + '$ を、いちばん小さい分母で通分すると？',
      fig: { type: 'bars', rows: [barsRow(a, b), barsRow(c, d)] },
      figAfter: { type: 'bars', rows: [barsRow(x, D), barsRow(y, D)] },
      truth: { v: [x / D, y / D], tex: pair(x, y, D) }, cands,
      steps: ['分母 ' + b + ' と ' + d + ' の、いちばん小さい共通の倍数は <b>' + D + '</b>。', '$' + fr(a, b) + '$：分母が ' + b + '→' + D + ' で ' + k1 + '倍。分子も ' + k1 + '倍にして $' + fr(x, D) + '$。', '$' + fr(c, d) + '$：分母が ' + d + '→' + D + ' で ' + k2 + '倍。分子も ' + k2 + '倍にして $' + fr(y, D) + '$。', '答えは $' + pair(x, y, D) + '$。'],
      point: '通分の手順：①分母をそろえる数を決める ②分母に何をかけたか見る ③分子にも同じ数をかける。'
    });
  });
}
function genFracCalc(list, op, prefix, point) {
  return list.map(([a, b, c, d], i) => {
    const D = lcmBrute(b, d), k1 = D / b, k2 = D / d, x = a * k1, y = c * k2;
    const num = op === '+' ? x + y : x - y;
    const g = gcd(num, D);
    if (g !== 1 || num <= 0) throw new Error(prefix + (i + 1) + ': 答えが約分できるか負になる');
    const val = (n, dd) => n / dd, sym = op;
    const cands = [];
    if (op === '+') cands.push({ v: val(a + c, b + d), tex: fr(a + c, b + d), why: '分子どうし（' + a + '＋' + c + '）、分母どうし（' + b + '＋' + d + '）を足しているね。分母を足すと、ピースの大きさが変わってしまう。足し算で数えるのは<b>ピースの数（分子）だけ</b>。' });
    else if (b - d > 0) cands.push({ v: val(a - c, b - d), tex: fr(a - c, b - d), why: '分子どうし、分母どうしを引いているね。分母を引くと、ピースの大きさが変わってしまう。引き算で数えるのは<b>ピースの数（分子）だけ</b>。' });
    cands.push({ v: val(op === '+' ? a + c : a - c, D), tex: fr(op === '+' ? a + c : a - c, D), why: '分母だけ ' + D + ' にそろえて、分子を直さないまま計算しているよ。分母が変わったら、分子にも<b>同じ数</b>をかける必要がある。' });
    cands.push({ v: val(op === '+' ? x + c : x - c, D), tex: fr(op === '+' ? x + c : x - c, D), why: '1つめの分数しか通分できていないよ。$' + fr(c, d) + '$ も $' + fr(y, D) + '$ に直そう。' });
    cands.push({ v: val(op === '+' ? a + y : a - y, D), tex: fr(op === '+' ? a + y : a - y, D), why: '2つめの分数しか通分できていないよ。$' + fr(a, b) + '$ も $' + fr(x, D) + '$ に直そう。' });
    if (op === '-') cands.push({ v: val(x + y, D), tex: fr(x + y, D), why: '引き算なのに、分子を足してしまっているよ。' });
    cands.push({ v: val(op === '+' ? a * k2 + c * k1 : a * k2 - c * k1, D), tex: fr(op === '+' ? a * k2 + c * k1 : a * k2 - c * k1, D), why: 'かける数が入れかわっているよ。$' + fr(a, b) + '$ の分子には ' + k1 + '、$' + fr(c, d) + '$ の分子には ' + k2 + ' をかける。' });
    cands.push({ v: val(num + 1, D), tex: fr(num + 1, D), why: '分子の計算がずれているよ。もう一度、' + x + (op === '+' ? '＋' : '−') + y + ' を計算してみよう。' });
    return build({
      id: prefix + (i + 1), expr: a + '/' + b + op + c + '/' + d,
      p: '$' + fr(a, b) + sym + fr(c, d) + '$ を計算しよう。' + (op === '-' ? '' : ''),
      fig: { type: 'bars', rows: [barsRow(a, b), barsRow(c, d)] },
      figAfter: { type: 'bars', rows: [barsRow(x, D), barsRow(y, D), barsRow(num, D)] },
      truth: { v: val(num, D), tex: fr(num, D) }, cands,
      steps: ['分母を ' + D + ' にそろえる（通分）。', '$' + fr(a, b) + '=' + fr(a + '\\times' + k1, b + '\\times' + k1) + '=' + fr(x, D) + '$、$' + fr(c, d) + '=' + fr(c + '\\times' + k2, d + '\\times' + k2) + '=' + fr(y, D) + '$。', '分母がそろったので、分子だけ' + (op === '+' ? '足す' : '引く') + '。$' + x + (op === '+' ? '+' : '-') + y + '=' + num + '$。', '答えは $' + fr(num, D) + '$。これ以上約分できない。'],
      point
    });
  });
}

/* ---------- 組み立て ---------- */
const I = {
  sg1: '数直線は、数の<span class="mark">ものさし</span>。0がスタートで、<b>右がプラス（赤）、左がマイナス（青）</b>。点を見たら、「0より右か左か」と「0から何つ目か」の2つを見る。',
  sg2: '大小は数直線で決まる。<b>右にあるほど大きい</b>。<br>マイナスの数は、数字が大きいほど小さい。気温なら、$-10$℃は $-2$℃よりずっと寒い。',
  sg3: '足す＝数直線の<b>右へ進む</b>。<br>0をまたぐときは、「0まで何歩」と「残り何歩」に分けて数える。',
  sg4: '引く＝数直線の<b>左へ進む</b>。<br>マイナスの数から引くと、もっと左へ行くので、マイナスの大きさが増える。',
  sg5: 'かっこの中がマイナスの数のとき。<br>・マイナスの数を<b>足す</b> ＝ その数を<b>引く</b>。$3+(-5)=3-5$<br>・マイナスの数を<b>引く</b> ＝ その数を<b>足す</b>。$3-(-5)=3+5$<br>たとえば、5円の借金を「なかったことにする（引く）」と、持っているお金は5円ふえる。',
  sgk: 'マイナスの数は、かっこをつけて書く。かっこをはずすときは、<b>かっこの前の符号</b>と<b>かっこの中の符号</b>を見て、1つにまとめる。<br><span class="mark">同じなら ＋、ちがうなら −</span>' +
    '<table class="rtab"><tr><td>$+(+3)$</td><td>→</td><td>$+3$</td><td>同じ → ＋</td></tr><tr><td>$-(-3)$</td><td>→</td><td>$+3$</td><td>同じ → ＋</td></tr><tr><td>$+(-3)$</td><td>→</td><td>$-3$</td><td>ちがう → −</td></tr><tr><td>$-(+3)$</td><td>→</td><td>$-3$</td><td>ちがう → −</td></tr></table>' +
    '<br>たとえば $7-(-3)$ は、$7+3$ になる。',
  sgw: '<b>1. マイナスの数には、かっこをつける。</b><br>$7-(-3)$ と書く。<b>$7--3$</b> や <b>$7+-3$</b> のように、符号を続けて書かない。<br><br><b>2. 答えを書くときは、先に符号を決める。</b><br>答えが「$-3$」とわかってから「＝」を書く。「＝3」と書いたあとで気づいたら、すきまに「−」をねじこまない。<b>一回消して</b>、「＝」と「−」が重ならないように書き直す。それで点がもらえる。',
  sg6: '文章題は、まず式にする。<b>「上がる・ふえる・もらう」は＋、「下がる・へる・引かれる」は−</b>。式にできたら、あとは数直線で進むだけ。',
  tb1: '分数は、同じ大きさのピースが何こ分か。<br>分母と分子に<b>同じ数</b>をかけても、大きさは変わらない。$\\dfrac12=\\dfrac36$',
  tb2: '約分は、通分のぎゃく。分子と分母を<b>同じ数</b>でわって、小さい数の分数にする。<br>これ以上われなくなったら完成。',
  tb3: '通分は、分母を同じ大きさに切りそろえること。そろえる分母は、2つの分母の<b>いちばん小さい共通の倍数</b>。',
  tb4: '通分の手順：<br>①分母をそろえる数を決める<br>②分母に何をかけたかを見る<br>③分子にも<b>同じ数</b>をかける',
  tb5: '分母がちがう足し算は、まず通分。分母がそろったら、<b>分母はそのまま、分子だけ</b>足す。',
  tb6: '引き算も足し算と同じ。通分して、<b>分母はそのまま、分子だけ</b>引く。'
};
const PARTS = [
  {
    id: 'seifu', title: '正負の数', sub: 'マイナスを数直線で',
    steps: [
      { id: 'seifu-1', title: '数直線を読む', sub: '点は、いくつ？', intro: I.sg1, qs: [hm.s1].concat(genSeifu1()) },
      { id: 'seifu-2', title: '大きい・小さい', sub: '右にあるほど大きい', intro: I.sg2, qs: [hm.s2].concat(genSeifu2()) },
      { id: 'seifu-3', title: '足す ＝ 右へ', sub: '0をまたぐ足し算', intro: I.sg3, qs: [hm.s5].concat(genAdd([[-6, 2], [-2, 5], [3, 4], [-5, 8], [-4, 1]], 'sg3-')) },
      { id: 'seifu-4', title: '引く ＝ 左へ', sub: '0をまたぐ引き算', intro: I.sg4, qs: [hm.s4, hm.s6].concat(genSub([[7, 3], [-1, 6], [4, 9], [-5, 2]], 'sg4-')) },
      { id: 'seifu-5', title: 'かっこつきの計算', sub: 'マイナスを足す・引く', intro: I.sg5, qs: genParen() },
      { id: 'seifu-kakko', title: 'かっこをはずす', sub: '同じなら＋、ちがうなら−', intro: I.sgk, qs: genKakko() },
      { id: 'seifu-kaki', title: '書き方のルール', sub: '−−と書かない・消して直す', intro: I.sgw, qs: genKaki() },
      { id: 'seifu-6', title: '文章題', sub: '気温・得点・深さ', intro: I.sg6, qs: [hm.s3].concat(genStory()) }
    ]
  },
  {
    id: 'tsubun', title: '分数と通分', sub: '同じ大きさに切りそろえる',
    steps: [
      { id: 'tsubun-1', title: '同じ大きさの分数', sub: '分母と分子に同じ数', intro: I.tb1, qs: [hm.t2].concat(genEqual()) },
      { id: 'tsubun-2', title: '約分', sub: '小さい数の分数にする', intro: I.tb2, qs: genReduce() },
      { id: 'tsubun-3', title: '共通の分母を探す', sub: 'いちばん小さい倍数', intro: I.tb3, qs: [hm.t1].concat(genLcm()) },
      { id: 'tsubun-4', title: '通分する', sub: '分子も同じ数をかける', intro: I.tb4, qs: genTsubun() },
      { id: 'tsubun-5', title: '分数のたし算', sub: '通分してから足す', intro: I.tb5, qs: [hm.t3].concat(genFracCalc([[1, 4, 1, 6], [2, 3, 1, 4], [1, 3, 1, 5], [2, 5, 1, 2], [1, 2, 1, 4]], '+', 'tb5-', '分母がちがう足し算は、まず通分。そろったら、分母はそのままで分子だけ足す。')) },
      { id: 'tsubun-6', title: '分数のひき算', sub: '通分してから引く', intro: I.tb6, qs: [hm.t4].concat(genFracCalc([[5, 6, 1, 4], [2, 3, 1, 2], [3, 5, 1, 3], [3, 4, 1, 2], [1, 2, 1, 5]], '-', 'tb6-', '引き算も足し算と同じ。通分して、分母はそのまま、分子だけ引く。')) }
    ]
  }
];

const out = '// 自動生成（node gen.js）。手で直すときは gen.js か src/handmade.js を直す。\nconst PARTS = ' + JSON.stringify(PARTS) + ';\nif (typeof module !== \'undefined\') module.exports = PARTS;\n';
fs.writeFileSync(path.join(__dirname, 'src/data.js'), out);
let n = 0; PARTS.forEach(P => P.steps.forEach(s => { n += s.qs.length; }));
console.log('src/data.js を作成：' + n + '問、' + (out.length / 1024).toFixed(0) + 'KB');
