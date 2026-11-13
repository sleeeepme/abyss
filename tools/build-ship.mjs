#!/usr/bin/env node
/* 出荷用の単一HTMLを作る。proto/index.html の外部 <script src> をすべてインライン化し、
   コメント・空白を除いて（可能なら minify して）1ファイルにする。出力物はコミットしない（output/ は .gitignore 済み）。

   使い方（リポジトリ直下で）:
     node tools/build-ship.mjs                    # output/ship/index.html を作り、サイズを output/ship/build.json に残す
     node tools/build-ship.mjs --out /tmp/x.html
     node tools/build-ship.mjs --no-minify        # インライン化だけ（デバッグ用）
     node tools/build-ship.mjs --safe             # 空白・コメント・構文の圧縮だけ。ローカル変数名は変えない

   minify には esbuild を使う。リポジトリには入れない（package.json を持たない方針）。次のどちらかで見つける:
     ・ESBUILD_DIR=<esbuild を npm install したディレクトリ> を付ける（例: npm install --prefix /tmp/esb esbuild）
     ・通常の解決（NODE_PATH / 親ディレクトリの node_modules）
   見つからなければ「インライン化のみ」で出力し、警告を出す（壊れないほうに倒す）。

   変えないもの: トップレベルの名前（クラシックスクリプトなので esbuild は改名しない＝script 間・onclick・テストから見える名前はそのまま）、
   画面の文字列、<style>の中身（空白とコメントだけ詰める）。
   同梱しないもの: assets/ 配下のファイル（BGMのmp3 4本・スプライトPNGなど。HTMLと同じ相対位置に置く）。
   ※ output/ship/ には proto/assets への symlink を作る（ローカルで開いて確認するため。配る物ではない）。 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PROTO = path.join(ROOT, 'proto');
const args = process.argv.slice(2);
const flag = n => args.includes(n);
const opt = n => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
const outFile = path.resolve(opt('--out') || path.join(ROOT, 'output/ship/index.html'));

async function loadEsbuild() {
  const tries = [];
  if (process.env.ESBUILD_DIR) tries.push(() => createRequire(path.join(path.resolve(process.env.ESBUILD_DIR), 'x.js'))('esbuild'));
  tries.push(() => createRequire(path.join(ROOT, 'x.js'))('esbuild'));
  tries.push(() => createRequire('/home/claude/x.js')('esbuild'));
  for (const t of tries) { try { return t(); } catch (e) { /* 次へ */ } }
  try { return await import('esbuild'); } catch (e) { return null; }
}

const esbuild = flag('--no-minify') ? null : await loadEsbuild();
if (!flag('--no-minify') && !esbuild) console.warn('警告: esbuild が見つからない。インライン化だけ行う（ESBUILD_DIR を指定すると minify する）。');

const html = fs.readFileSync(path.join(PROTO, 'index.html'), 'utf8');
const sizes = { source: { 'index.html': Buffer.byteLength(html) }, inlinedJs: {} };

const minJs = (code, name) => {
  if (!esbuild) return code;
  try {
    const r = esbuild.transformSync(code, flag('--safe')
      ? { minifyWhitespace: true, minifySyntax: true, target: 'esnext', legalComments: 'none' }
      : { minify: true, target: 'esnext', legalComments: 'none' });
    return r.code;
  } catch (e) { console.warn('minify 失敗（そのまま入れる）: ' + name + ': ' + String(e.message).split('\n')[0]); return code; }
};
const safeJs = code => code.replace(/<\/script/gi, '<\\/script');

let out = html.replace(/<script\b([^>]*)>([\s\S]*?)<\/script>/g, (m, attrs, body) => {
  const type = (/\btype\s*=\s*["']?([^"'\s>]+)/i.exec(attrs) || [])[1];
  if (type && !/^(text|application)\/javascript$/i.test(type)) return m;          // JSON など
  const src = (/\bsrc\s*=\s*"([^"]+)"/i.exec(attrs) || /\bsrc\s*=\s*'([^']+)'/i.exec(attrs) || [])[1];
  if (src) {
    if (/^(https?:)?\/\//i.test(src)) { console.warn('外部URLはそのまま残す: ' + src); return m; }
    const file = path.join(PROTO, src.split('?')[0]);
    const code = fs.readFileSync(file, 'utf8');
    sizes.inlinedJs[path.basename(file)] = { before: Buffer.byteLength(code) };
    const min = minJs(code, src);
    sizes.inlinedJs[path.basename(file)].after = Buffer.byteLength(min);
    return '<script>' + safeJs(min) + '</script>';
  }
  if (!body.trim()) return m;
  const min = minJs(body, 'inline');
  sizes.inlinedJs['(inline #' + Object.keys(sizes.inlinedJs).filter(k => k.startsWith('(inline')).length + ')'] = { before: Buffer.byteLength(body), after: Buffer.byteLength(min) };
  return '<script' + attrs + '>' + safeJs(min) + '</script>';
});

/* <style>: コメントと余分な空白だけ詰める（data: URL の中は触らない） */
out = out.replace(/<style\b([^>]*)>([\s\S]*?)<\/style>/g, (m, attrs, css) => {
  if (!esbuild) return m;
  try { return '<style' + attrs + '>' + esbuild.transformSync(css, { loader: 'css', minify: true }).code + '</style>'; }
  catch (e) { return m; }
});
/* HTML コメント（<!-- … -->）。条件付きコメントは使っていない */
out = out.replace(/<!--(?!\[if)[\s\S]*?-->/g, '');

fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, out);
// ローカル確認用: 相対の assets/ を開けるようにする（出力先が output/ship の既定のときだけ）
const link = path.join(path.dirname(outFile), 'assets');
if (!fs.existsSync(link)) { try { fs.symlinkSync(path.join(PROTO, 'assets'), link); } catch (e) { /* 無くても良い */ } }

const total = Buffer.byteLength(out);
const before = sizes.source['index.html'] + Object.values(sizes.inlinedJs).reduce((a, v) => a + v.before, 0)
  - Object.values(sizes.inlinedJs).filter(v => v.before && false).length; // 外部JSの合計 + HTML本体（インライン<script>は二重に数えない）
sizes.shipBytes = total;
sizes.minify = esbuild ? (flag('--safe') ? 'esbuild(whitespace+syntax)' : 'esbuild(full)') : (flag('--no-minify') ? 'off' : 'unavailable');
const ext = Object.entries(sizes.inlinedJs).filter(([k]) => !k.startsWith('(inline'));
sizes.externalJsBefore = ext.reduce((a, [, v]) => a + v.before, 0);
sizes.beforeTotal = sizes.source['index.html'] + sizes.externalJsBefore;
fs.writeFileSync(path.join(path.dirname(outFile), 'build.json'), JSON.stringify(sizes, null, 1));
const mb = n => (n / 1048576).toFixed(2) + 'MB';
console.log('出力: ' + outFile + '\n  開発版 ' + mb(sizes.beforeTotal) + '（index.html ' + mb(sizes.source['index.html']) + ' + 外部JS ' + mb(sizes.externalJsBefore) + '） → 出荷版 ' + mb(total) + '  [' + sizes.minify + ']');
