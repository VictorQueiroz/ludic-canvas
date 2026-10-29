import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { expect, it } from 'vitest';
import { writeCheckpoint } from '../tools/qualification/record.mjs';

it('preserves the last acquired bytes and checksum when storage fails during a checkpoint', async () => {
  const folder = await mkdtemp(join(tmpdir(), 'ludic-record-'));
  const output = join(folder, 'record.json.gz');
  try {
    await writeCheckpoint(output, { status: 'incomplete', checkpoint: 1 });
    const before = await readFile(output);
    const checksum = await readFile(`${output}.sha256`);
    const outOfSpace = async (path, bytes) => {
      await writeFile(path, bytes.subarray(0, 5));
      throw Object.assign(new Error('no space left on device'), { code: 'ENOSPC' });
    };
    await expect(writeCheckpoint(output, { checkpoint: 2 }, outOfSpace)).rejects.toMatchObject({ code: 'ENOSPC' });
    expect(await readFile(output)).toEqual(before);
    expect(await readFile(`${output}.sha256`)).toEqual(checksum);
    expect(await readdir(folder)).toEqual(['record.json.gz', 'record.json.gz.sha256']);
    await writeCheckpoint(output, { status: 'partial', checkpoint: 3 });
    const acquired = await readFile(output);
    expect(JSON.parse(gunzipSync(acquired))).toEqual({ status: 'partial', checkpoint: 3 });
    expect((await readFile(`${output}.sha256`, 'utf8')).split(' ')[0]).toBe(
      createHash('sha256').update(acquired).digest('hex'),
    );
  } finally {
    await rm(folder, { recursive: true, force: true });
  }
});
