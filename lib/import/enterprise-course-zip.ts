import JSZip from 'jszip';

import {
  ENTERPRISE_COURSE_IMPORT_LIMITS,
  EnterpriseCourseImportError,
  isSafeZipPath,
  prepareManifestForEnterpriseImport,
  type PreparedEnterpriseCourseImport,
} from './enterprise-course-import';

export interface EnterpriseCourseZipPreview {
  name: string;
  sceneCount: number;
  formatVersion: number;
}

async function loadZip(input: ArrayBuffer | Uint8Array) {
  try {
    return await JSZip.loadAsync(input);
  } catch {
    throw new EnterpriseCourseImportError('课程 ZIP 无法解析');
  }
}

export async function previewEnterpriseCourseZip(
  input: ArrayBuffer,
): Promise<EnterpriseCourseZipPreview> {
  const zip = await loadZip(input);
  const manifestEntry = zip.file('manifest.json');
  if (!manifestEntry) throw new EnterpriseCourseImportError('课程包缺少 manifest.json');
  const text = await manifestEntry.async('text');
  if (new TextEncoder().encode(text).byteLength > ENTERPRISE_COURSE_IMPORT_LIMITS.manifestBytes) {
    throw new EnterpriseCourseImportError('manifest.json 过大');
  }
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new EnterpriseCourseImportError('manifest.json 不是有效 JSON');
  }
  const prepared = prepareManifestForEnterpriseImport(value, new Set());
  return {
    name: String(prepared.stage.name || 'Imported Classroom'),
    sceneCount: prepared.scenes.length,
    formatVersion:
      typeof (value as { formatVersion?: unknown }).formatVersion === 'number'
        ? (value as { formatVersion: number }).formatVersion
        : 1,
  };
}

export async function parseEnterpriseCourseZip(
  input: Uint8Array,
): Promise<PreparedEnterpriseCourseImport> {
  if (input.byteLength > ENTERPRISE_COURSE_IMPORT_LIMITS.archiveBytes) {
    throw new EnterpriseCourseImportError('课程包超过 200MB 限制');
  }
  const zip = await loadZip(input);
  const entries = Object.entries(zip.files).filter(([, entry]) => !entry.dir);
  if (entries.length > ENTERPRISE_COURSE_IMPORT_LIMITS.entryCount) {
    throw new EnterpriseCourseImportError('课程包文件数量超限');
  }
  for (const [path, entry] of entries) {
    const originalName =
      (entry as typeof entry & { unsafeOriginalName?: string }).unsafeOriginalName ?? path;
    if (!isSafeZipPath(originalName) || !isSafeZipPath(path)) {
      throw new EnterpriseCourseImportError(`课程包包含非法路径：${originalName}`);
    }
  }
  const manifestEntry = zip.file('manifest.json');
  if (!manifestEntry) throw new EnterpriseCourseImportError('课程包缺少 manifest.json');
  const manifestText = await manifestEntry.async('text');
  if (
    new TextEncoder().encode(manifestText).byteLength >
    ENTERPRISE_COURSE_IMPORT_LIMITS.manifestBytes
  ) {
    throw new EnterpriseCourseImportError('manifest.json 过大');
  }
  let manifest: unknown;
  try {
    manifest = JSON.parse(manifestText);
  } catch {
    throw new EnterpriseCourseImportError('manifest.json 不是有效 JSON');
  }

  const mediaIndex =
    manifest && typeof manifest === 'object' && !Array.isArray(manifest)
      ? (manifest as { mediaIndex?: unknown }).mediaIndex
      : undefined;
  const mediaPaths =
    mediaIndex && typeof mediaIndex === 'object' && !Array.isArray(mediaIndex)
      ? Object.keys(mediaIndex)
      : [];
  let expandedBytes = 0;
  const extracted = new Map<string, Uint8Array>();
  for (const [path, entry] of entries) {
    const data = await entry.async('uint8array');
    expandedBytes += data.byteLength;
    if (expandedBytes > ENTERPRISE_COURSE_IMPORT_LIMITS.expandedBytes) {
      throw new EnterpriseCourseImportError('课程包累计解压大小超限');
    }
    extracted.set(path, data);
  }
  const binaries = new Map<string, { data: Uint8Array; posterData?: Uint8Array }>();
  for (const path of mediaPaths) {
    const data = extracted.get(path);
    if (!data) continue;
    binaries.set(path, {
      data,
      posterData: extracted.get(path.replace(/\.[^.]+$/, '.poster.jpg')),
    });
  }
  return prepareManifestForEnterpriseImport(
    manifest,
    new Set(entries.map(([path]) => path)),
    binaries,
  );
}
