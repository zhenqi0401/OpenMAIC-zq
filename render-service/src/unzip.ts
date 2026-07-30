/**
 * unzip — expand the app's export ZIP into a project directory the producer can
 * render. The archive layout is exactly what `packageVideoZip` produces:
 * `index.html` + `assets/**` + the vendored GSAP, all project-relative.
 *
 * The archive is untrusted input, so extraction is bounded *before* any bytes
 * are decompressed: fflate's `filter` runs per entry with the entry's declared
 * compressed (`size`) and expanded (`originalSize`) sizes, letting us reject
 * ZIP bombs (too many entries, an oversized entry, oversized total, or an
 * implausible compression ratio) without ever materializing them. Path
 * traversal (`../`) is rejected too.
 *
 * Decompression uses fflate's **async** `unzip`, which offloads the actual
 * inflate to a worker thread instead of blocking the service's event loop (so
 * `/health` and poll requests stay responsive during a large expansion). The
 * `filter` still runs synchronously in the initial pass — that's the cheap,
 * declared-size security gate — and a limit breach throws straight out of the
 * `unzip()` call, which we translate into a rejected promise.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve, sep } from 'node:path';
import { unzip, type Unzipped, type UnzipFileInfo } from 'fflate';
import { config } from './config.js';

export class InvalidProjectError extends Error {}

function readU16(data: Uint8Array, offset: number): number {
  return data[offset] | (data[offset + 1] << 8);
}

function readU32(data: Uint8Array, offset: number): number {
  return (
    (data[offset] |
      (data[offset + 1] << 8) |
      (data[offset + 2] << 16) |
      (data[offset + 3] << 24)) >>>
    0
  );
}

/**
 * fflate's unzip filter intentionally omits central-directory attributes, so
 * inspect that directory before decompression and reject Unix symlink entries.
 * ZIP64 is unnecessary within our 300 MiB / 5000-entry contract and is rejected
 * rather than accepted without a complete attribute audit.
 */
function assertNoSymbolicLinks(zip: Uint8Array): void {
  const minimumEocdSize = 22;
  const earliest = Math.max(0, zip.length - 65_557);
  let eocd = -1;
  for (let offset = zip.length - minimumEocdSize; offset >= earliest; offset -= 1) {
    if (readU32(zip, offset) === 0x06054b50) {
      eocd = offset;
      break;
    }
  }
  if (eocd < 0) throw new InvalidProjectError('Invalid ZIP central directory');

  const entryCount = readU16(zip, eocd + 10);
  const centralSize = readU32(zip, eocd + 12);
  const centralOffset = readU32(zip, eocd + 16);
  if (entryCount === 0xffff || centralSize === 0xffffffff || centralOffset === 0xffffffff) {
    throw new InvalidProjectError('ZIP64 archives are not supported');
  }
  if (centralOffset + centralSize > eocd || centralOffset > zip.length) {
    throw new InvalidProjectError('Invalid ZIP central directory bounds');
  }

  let offset = centralOffset;
  for (let index = 0; index < entryCount; index += 1) {
    if (offset + 46 > zip.length || readU32(zip, offset) !== 0x02014b50) {
      throw new InvalidProjectError('Invalid ZIP central directory entry');
    }
    const externalAttributes = readU32(zip, offset + 38);
    const unixMode = externalAttributes >>> 16;
    if ((unixMode & 0xf000) === 0xa000) {
      throw new InvalidProjectError('Symbolic links are not allowed');
    }
    const nameLength = readU16(zip, offset + 28);
    const extraLength = readU16(zip, offset + 30);
    const commentLength = readU16(zip, offset + 32);
    offset += 46 + nameLength + extraLength + commentLength;
  }
  if (offset > centralOffset + centralSize) {
    throw new InvalidProjectError('Invalid ZIP central directory size');
  }
}

/**
 * Expand `zip` into `destDir`. Throws {@link InvalidProjectError} if the archive
 * escapes `destDir`, trips a size/entry limit, or lacks an `index.html` entry.
 */
export async function unzipProject(zip: Uint8Array, destDir: string): Promise<void> {
  assertNoSymbolicLinks(zip);
  let entryCount = 0;
  let expandedTotal = 0;

  // The filter is the security boundary: it runs for every entry using only the
  // ZIP's declared sizes, before fflate decompresses anything. Throwing here
  // aborts the whole unzip. Directory entries carry no data.
  const filter = (file: UnzipFileInfo): boolean => {
    const portableName = file.name.replace(/\\/g, '/');
    if (
      portableName.includes('\0') ||
      portableName.startsWith('/') ||
      /^[a-zA-Z]:\//.test(portableName) ||
      portableName.split('/').includes('..')
    ) {
      throw new InvalidProjectError(`Unsafe path in archive: ${file.name}`);
    }
    entryCount += 1;
    if (entryCount > config.maxEntries) {
      throw new InvalidProjectError(`Archive has too many entries (> ${config.maxEntries})`);
    }
    if (portableName.endsWith('/')) return false;
    if (file.originalSize > config.maxEntryBytes) {
      throw new InvalidProjectError(`Archive entry too large: ${file.name}`);
    }
    // Ratio guard catches deeply-compressed bombs (a tiny entry claiming a
    // huge expansion). Ignore tiny entries where the ratio is meaningless.
    if (file.size > 0 && file.originalSize / file.size > config.maxCompressionRatio) {
      throw new InvalidProjectError(`Archive entry compression ratio too high: ${file.name}`);
    }
    expandedTotal += file.originalSize;
    if (expandedTotal > config.maxExpandedBytes) {
      throw new InvalidProjectError('Archive expands beyond the allowed total size');
    }
    return true;
  };

  // Promisify the async (worker-offloaded) unzip. A filter breach throws
  // synchronously out of unzip(); the decompression itself reports via callback.
  const entries = await new Promise<Unzipped>((resolvePromise, rejectPromise) => {
    try {
      unzip(zip, { filter }, (err, data) => {
        if (err) rejectPromise(err);
        else resolvePromise(data);
      });
    } catch (err) {
      rejectPromise(err);
    }
  });

  const names = Object.keys(entries);
  if (!names.some((n) => n === 'index.html' || n.endsWith('/index.html'))) {
    throw new InvalidProjectError('Export archive is missing index.html');
  }

  const destRoot = resolve(destDir);
  for (const [name, bytes] of Object.entries(entries)) {
    const target = resolve(destRoot, name);
    const rel = relative(destRoot, target);
    if (rel.startsWith('..') || rel.startsWith(`..${sep}`)) {
      throw new InvalidProjectError(`Unsafe path in archive: ${name}`);
    }

    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, bytes);
  }
}
