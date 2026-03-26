import { spawn } from 'node:child_process';
import { join } from 'node:path';

const vitestBin = join(process.cwd(), 'node_modules', 'vitest', 'vitest.mjs');

const child = spawn(
  process.execPath,
  ['--max-old-space-size=6144', vitestBin, 'run', '--pool', 'forks', '--maxWorkers', '1'],
  {
    stdio: 'inherit',
    env: process.env,
  },
);

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 1);
});
