import fs from 'node:fs';

const retryUnknown = process.argv.includes('--retry-unknown');
const concurrencyArg = process.argv.find(arg => arg.startsWith('--concurrency='))?.split('=')[1];
const concurrency = Math.max(1, Math.min(5, Number(concurrencyArg) || 3));
const apply = process.argv.includes('--apply');
const tokenFile = process.argv
  .find((arg) => arg.startsWith('--token-file='))
  ?.slice('--token-file='.length);
const token = tokenFile ? fs.readFileSync(tokenFile, 'utf8').trim() : undefined;
if (apply && !token)
  throw new Error('--apply requires --token-file with the scoped content-service token');
const api = 'https://gemigo.io/api/v1';
const projects = [];
for (let page = 1; ; page++) {
  const response = await fetch(`${api}/projects/explore?page=${page}&pageSize=50`, { signal: AbortSignal.timeout(45000) });
  if (!response.ok) throw new Error(`Catalog unavailable: ${response.status}`);
  const data = await response.json();
  projects.push(
    ...data.items.filter(
      (project) =>
        project.appLanguage?.source !== 'author' &&
        (project.appLanguage?.revision !== project.lastSuccessAt || (retryUnknown && !project.appLanguage?.languages.length))
    )
  );
  if (page * data.pageSize >= data.total) break;
}
console.log(JSON.stringify({ mode: apply ? 'apply' : 'dry-run', candidates: projects.length }));
if (apply) {
  let index = 0;
  let completed = 0;
  let failed = 0;
  let infrastructureFailures = 0;
  const counts = {};
  const failureReasons = {};
  await Promise.all(
    Array.from({ length: concurrency }, async () => {
      while (index < projects.length && !(infrastructureFailures >= 6 && completed === 0)) {
        const project = projects[index++];
        try {
          const response = await fetch(
            `${api}/admin/projects/${encodeURIComponent(project.id)}/detect-language`,
            {
              method: 'POST',
              headers: { 'x-gemigo-content-token': token },
              signal: AbortSignal.timeout(75000),
            }
          );
          if (!response.ok) throw new Error(`Scan failed: ${response.status}`);
          const data = await response.json();
          if (!['detected', 'unknown'].includes(data.scan?.status)) throw new Error(`Scan unavailable: ${data.scan?.status}/${data.scan?.contentStatus ?? ''}/${data.scan?.contentStage ?? ''}/${data.scan?.appStatus ?? ''}`);
          for (const language of data.appLanguage?.languages.length
            ? data.appLanguage.languages
            : ['und'])
            counts[language] = (counts[language] || 0) + 1;
          completed++;
        } catch (error) {
          failed++;
          const reason = error.message?.startsWith('Scan ') ? error.message : error.name || 'Error';
          failureReasons[reason] = (failureReasons[reason] || 0) + 1;
          if (!reason.includes('/422/') && !reason.includes('skipped') && !reason.includes('Scan failed: 404')) infrastructureFailures++;
        }
        if ((completed + failed) % 25 === 0)
          console.log(JSON.stringify({ completed, failed, counts, failureReasons }));
      }
    })
  );
  console.log(JSON.stringify({ completed, failed, counts, failureReasons }));
  if (failed) process.exitCode = 1;
}
