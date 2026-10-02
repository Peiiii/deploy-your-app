import fs from 'node:fs';

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
  const response = await fetch(`${api}/projects/explore?page=${page}&pageSize=50`);
  if (!response.ok) throw new Error(`Catalog unavailable: ${response.status}`);
  const data = await response.json();
  projects.push(
    ...data.items.filter(
      (project) =>
        project.appLanguage?.source !== 'author' &&
        project.appLanguage?.revision !== project.lastSuccessAt
    )
  );
  if (page * data.pageSize >= data.total) break;
}
console.log(JSON.stringify({ mode: apply ? 'apply' : 'dry-run', candidates: projects.length }));
if (apply) {
  let index = 0;
  let completed = 0;
  let failed = 0;
  const counts = {};
  await Promise.all(
    Array.from({ length: 3 }, async () => {
      while (index < projects.length) {
        const project = projects[index++];
        try {
          const response = await fetch(
            `${api}/admin/projects/${encodeURIComponent(project.id)}/detect-language`,
            {
              method: 'POST',
              headers: { 'x-gemigo-content-token': token },
              signal: AbortSignal.timeout(45000),
            }
          );
          if (!response.ok) throw new Error(`Scan failed: ${response.status}`);
          const data = await response.json();
          for (const language of data.appLanguage?.languages.length
            ? data.appLanguage.languages
            : ['und'])
            counts[language] = (counts[language] || 0) + 1;
          completed++;
        } catch {
          failed++;
        }
        if ((completed + failed) % 25 === 0)
          console.log(JSON.stringify({ completed, failed, counts }));
      }
    })
  );
  console.log(JSON.stringify({ completed, failed, counts }));
  if (failed) process.exitCode = 1;
}
