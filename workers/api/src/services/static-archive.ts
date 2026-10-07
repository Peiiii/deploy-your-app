import { Reader, ZipReader, Uint8ArrayWriter, type Entry, type FileEntry } from '@zip.js/zip.js';
import type { ProjectContext } from '../types/project';

export const MAX_ARCHIVE_BYTES = 75 * 1024 * 1024;
const MAX_OUTPUT_BYTES = 500 * 1024 * 1024;
const archiveError = (message: string, code = 'invalid_archive'): Error => Object.assign(new Error(message), { code });
const SOURCE_MESSAGE = 'This project needs a build. Build it locally and upload the dist/build/out folder as a ZIP. HTML and ready static assets can still be published directly.';

export class R2ArchiveReader extends Reader<Uint8Array> {
  constructor(private bucket: R2Bucket, private key: string, size: number, private etag: string) { super(new Uint8Array(0)); this.size = size; }
  readUint8Array = async (offset: number, length: number): Promise<Uint8Array<ArrayBuffer>> => {
    if (!length) return new Uint8Array(0);
    if (offset < 0 || length < 0 || offset + length > this.size) throw archiveError('ZIP byte range is invalid.');
    const object = await this.bucket.get(this.key, { range: { offset, length }, onlyIf: { etagMatches: this.etag } });
    if (!object || !('body' in object)) throw archiveError('The ZIP source changed or expired. Upload it again.');
    const bytes = new Uint8Array(await object.arrayBuffer());
    if (bytes.length !== length) throw archiveError('ZIP upload is incomplete.');
    return bytes;
  };
}

export const openArchive = async (bucket: R2Bucket, key: string, expectedEtag?: string) => {
  const object = await bucket.head(key);
  if (!object || object.size > MAX_ARCHIVE_BYTES || !object.size) throw archiveError('ZIP source is missing or exceeds 75 MB.', 'invalid_source');
  if (expectedEtag && expectedEtag !== object.etag) throw archiveError('The ZIP source changed. Upload it again.', 'invalid_source');
  const reader = new ZipReader(new R2ArchiveReader(bucket, key, object.size, object.etag), { useWebWorkers: false, useCompressionStream: true, checkSignature: true });
  const entries: Entry[] = [];
  for await (const entry of reader.getEntriesGenerator()) {
    if (entries.length === 10000) throw archiveError('ZIP contains more than 10,000 files.', 'archive_too_large');
    entries.push(entry);
  }
  return { reader, entries, etag: object.etag };
};

export const normalizedArchivePath = (name: string): string => {
  name = name.replaceAll('\\', '/');
  if (name.startsWith('/') || /^[a-z]:/i.test(name) || name.includes('\0') || name.split('/').includes('..')) throw archiveError('ZIP contains an unsafe file path.');
  return name.split('/').filter(part => part && part !== '.').join('/');
};
export const privateAsset = (name: string): boolean => name.split('/').some(part => ['__MACOSX', '.DS_Store', 'node_modules', '.git', '.npmrc'].includes(part) || part === '.env' || part.startsWith('.env.'));

export interface ArchiveAsset { entry: number; path: string; size: number }
export interface ArchiveManifest { files: ArchiveAsset[]; context: ProjectContext }

const textEntry = async (entry: FileEntry | undefined, max = 1048576): Promise<string | undefined> => {
  if (!entry || entry.uncompressedSize > max) return undefined;
  return new TextDecoder().decode(await entry.getData(new Uint8ArrayWriter(), { useWebWorkers: false, useCompressionStream: true, checkSignature: true }));
};

export const prepareArchive = async (entries: Entry[]): Promise<ArchiveManifest> => {
  if (entries.length > 10000) throw archiveError('ZIP contains more than 10,000 files.', 'archive_too_large');
  const names = new Set<string>();
  let bytes = 0;
  const files = entries.flatMap((entry, index) => {
    const path = normalizedArchivePath(entry.filename);
    bytes += entry.uncompressedSize;
    if (!Number.isSafeInteger(bytes) || bytes > MAX_OUTPUT_BYTES) throw archiveError('ZIP expands beyond 500 MB.', 'archive_too_large');
    if (entry.encrypted || ((entry.externalFileAttributes >>> 16) & 0o170000) === 0o120000) throw archiveError('Encrypted files and symbolic links cannot be published.');
    if (entry.directory || privateAsset(path)) return [];
    if (names.has(path)) throw archiveError('ZIP contains duplicate file paths.');
    names.add(path);
    return [{ entry: index, path, size: entry.uncompressedSize }];
  });
  const first = files[0]?.path.split('/')[0];
  const wrapper = first && files.every(file => file.path.startsWith(`${first}/`)) ? `${first}/` : '';
  for (const file of files) file.path = file.path.slice(wrapper.length);
  const find = (path: string) => files.find(file => file.path === path);
  const entry = (path: string) => { const file = find(path); return file ? entries[file.entry] as FileEntry : undefined; };
  const rawPackage = await textEntry(entry('package.json'));
  let packageJson: ProjectContext['packageJson'];
  if (rawPackage) {
    try { packageJson = JSON.parse(rawPackage); } catch { throw archiveError('package.json is not valid JSON.'); }
  }
  const output = ['dist/', 'build/', 'out/'].find(prefix => find(`${prefix}index.html`));
  if (packageJson?.scripts?.build && !output) throw archiveError(SOURCE_MESSAGE, 'source_build_unavailable');
  const root = (packageJson?.scripts?.build && output) || (!find('index.html') && output) || '';
  const index = await textEntry(entry(`${root}index.html`), 10 * 1024 * 1024);
  if (!find(`${root}index.html`)) throw archiveError(packageJson?.scripts?.build ? SOURCE_MESSAGE : 'No index.html found in the published directory. Upload a static folder containing index.html.', packageJson?.scripts?.build ? 'source_build_unavailable' : 'missing_entry');
  if (index && /<script\b[^>]*\bsrc\s*=\s*["'][^"']*\.(?:tsx?|jsx)(?:[?#][^"']*)?["']/i.test(index)) throw archiveError(SOURCE_MESSAGE, 'source_build_unavailable');
  if (!root && index && find('index.tsx') && /<div[^>]+id=["']root["']/i.test(index) && !/<script[^>]+type=["']module["'][^>]*src=/i.test(index)) throw archiveError(SOURCE_MESSAGE, 'source_build_unavailable');
  const readme = await textEntry(entry('README.md'));
  return {
    files: files.filter(file => file.path.startsWith(root)).map(file => ({ ...file, path: file.path.slice(root.length) })),
    context: { indexHtml: index?.slice(0, 100000), readme: readme?.slice(0, 8000), packageJson, directoryTree: files.map(file => file.path).slice(0, 100) },
  };
};

/** GitHub has no stable Content-Length: bounded multipart staging avoids buffering its archive. */
export const stageGithub = async (bucket: R2Bucket, projectId: string, repoUrl: string): Promise<string> => {
  const url = new URL(repoUrl), parts = url.pathname.split('/').filter(Boolean);
  const [owner, rawRepo] = parts;
  const repo = rawRepo?.replace(/\.git$/, '');
  if (url.hostname !== 'github.com' || !owner || !repo || url.username || url.password) throw archiveError('Enter a public GitHub repository.', 'invalid_repository');
  let branch = parts[2] === 'tree' ? decodeURIComponent(parts.slice(3).join('/')) : '';
  if (!branch) {
    const response = await fetch(`https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`, { headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'GemiGo-deployment' }, signal: AbortSignal.timeout(20000) });
    if (!response.ok) throw archiveError('Could not read this public GitHub repository.', 'invalid_repository');
    branch = (await response.json() as { default_branch: string }).default_branch;
  }
  const response = await fetch(`https://codeload.github.com/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/zip/refs/heads/${encodeURIComponent(branch)}`, { signal: AbortSignal.timeout(120000) });
  if (!response.ok || !response.body) throw archiveError('Could not download the GitHub branch.', 'invalid_repository');
  const key = `deployment-sources/${new Date().toISOString().slice(0, 10)}/${projectId}/${crypto.randomUUID()}.zip`;
  const upload = await bucket.createMultipartUpload(key, { customMetadata: { projectId }, httpMetadata: { contentType: 'application/zip' } });
  const reader = response.body.getReader(), partsUploaded: R2UploadedPart[] = [];
  let size = 0, buffer = new Uint8Array(5 * 1024 * 1024), used = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_ARCHIVE_BYTES) throw archiveError('GitHub archive exceeds 75 MB.', 'archive_too_large');
      let offset = 0;
      while (offset < value.length) {
        const length = Math.min(buffer.length - used, value.length - offset);
        buffer.set(value.subarray(offset, offset + length), used); used += length; offset += length;
        if (used === buffer.length) { partsUploaded.push(await upload.uploadPart(partsUploaded.length + 1, buffer)); buffer = new Uint8Array(buffer.length); used = 0; }
      }
    }
    if (used) partsUploaded.push(await upload.uploadPart(partsUploaded.length + 1, buffer.subarray(0, used)));
    if (!size) throw archiveError('GitHub archive is empty.');
    await upload.complete(partsUploaded);
    return key;
  } catch (error) { await upload.abort().catch(() => {}); throw error; }
  finally { await reader.cancel(); }
};
