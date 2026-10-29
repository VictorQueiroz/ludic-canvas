import { createHash } from 'node:crypto';
import { mkdir, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, basename } from 'node:path';
import { gzipSync } from 'node:zlib';

// Stage complete bytes before replacing the previous checkpoint. A failed write
// must not truncate the last acquired report. The pair of renames is not a
// filesystem-wide transaction; readers still verify the companion checksum.
export async function writeCheckpoint(output, report, write = writeFile) {
  const temporary = `${output}.${process.pid}.pending`;
  const checksum = `${temporary}.sha256`;
  const bytes = gzipSync(JSON.stringify(report));
  const hash = createHash('sha256').update(bytes).digest('hex');
  await mkdir(dirname(output), { recursive: true });
  try {
    await write(temporary, bytes);
    await write(checksum, `${hash}  ${basename(output)}\n`);
    await rename(temporary, output);
    await rename(checksum, `${output}.sha256`);
  } finally {
    await rm(temporary, { force: true });
    await rm(checksum, { force: true });
  }
}
