// 경제·밸런스 시뮬레이터 실행 (#262)
// 사용: npm run sim            표를 콘솔에 출력
//       npm run sim -- --write docs/balance/E_DAY_C_BALANCE.md 의 결과 구간을 갱신
//       npm run sim -- --quick 회차를 줄여 빠르게 확인
// src/balance-sim.ts를 esbuild(vite 의존성)로 묶어 Node에서 실행합니다. 시드가 고정되어 같은 옵션이면 같은 표가 나옵니다.
import { build } from 'esbuild';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = resolve(import.meta.dirname, '..');
const docPath = join(root, 'docs/balance/E_DAY_C_BALANCE.md');
const args = new Set(process.argv.slice(2));
const outDir = mkdtempSync(join(tmpdir(), 'dbg-balance-sim-'));
const outFile = join(outDir, 'balance-sim.mjs');

try {
  await build({ entryPoints: [join(root, 'src/balance-sim.ts')], bundle: true, platform: 'node', format: 'esm', outfile: outFile, logLevel: 'warning' });
  const sim = await import(pathToFileURL(outFile).href);
  const options = args.has('--quick') ? { workbenchRuns: 60, workbenchOrders: 30, realtimeRuns: 10, realDays: 14 } : sim.FULL_REPORT;
  const started = Date.now();
  const report = sim.buildBalanceReport(options);
  console.log(report);
  console.error(`\n완료: ${((Date.now() - started) / 1000).toFixed(1)}초 · 옵션 ${JSON.stringify(options)}`);
  if (args.has('--write')) {
    const doc = readFileSync(docPath, 'utf8');
    const start = '<!-- SIM:START -->';
    const end = '<!-- SIM:END -->';
    const from = doc.indexOf(start);
    const to = doc.indexOf(end);
    if (from < 0 || to < from) throw new Error(`${docPath}에 결과 구간 표시(${start} … ${end})가 없습니다.`);
    const meta = `> 생성: \`npm run sim -- --write\` · 옵션 ${JSON.stringify(options)}`;
    writeFileSync(docPath, `${doc.slice(0, from + start.length)}\n${meta}\n\n${report}\n${doc.slice(to)}`);
    console.error(`문서 갱신: ${docPath}`);
  }
} finally {
  rmSync(outDir, { recursive: true, force: true });
}
