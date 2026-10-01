// Gộp public/ thành 1 file HTML duy nhất (chạy offline, nhấp đúp là mở): npm run bundle → dist/planner-2026.html
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');
const read = p => readFileSync(join(root, p), 'utf8');
let html = read('index.html');

html = html.replace(/<link rel="stylesheet" href="([^"]+)">/g, (_, href) => `<style>\n${read(href)}\n</style>`);
html = html.replace(/<script src="([^"]+)"( defer)?><\/script>/g, (_, src) => {
  const js = read(src);
  if (/<\/script/i.test(js)) throw new Error(`${src} chứa chuỗi </script>`);
  return `<script>\n/* ===== ${src} ===== */\n${js}\n</script>`;
});
const favicon = Buffer.from(read('favicon.svg')).toString('base64');
html = html.replace('href="favicon.svg"', `href="data:image/svg+xml;base64,${favicon}"`);
// Script inline chạy ngay (không defer) → bọc khởi động bằng DOMContentLoaded đã có sẵn trong app.js
mkdirSync(join(root, '..', 'dist'), { recursive: true });
writeFileSync(join(root, '..', 'dist', 'planner-2026.html'), html);
console.log('✓ dist/planner-2026.html', Math.round(html.length / 1024), 'KB');
