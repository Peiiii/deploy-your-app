import { Uint8ArrayWriter, ERR_BAD_FORMAT, ERR_EOCDR_NOT_FOUND, type FileEntry } from '@zip.js/zip.js';
import { applyRuleBasedRewrite, looksLikeGenAIClient } from '@gemigo/deployment-assets';
import type { ApiWorkerEnv } from '../types/env';
import { SourceType, type Project, type DeploymentStatusPayload } from '../types/project';
import { deploymentRepository } from '../repositories/deployment.repository';
import { projectService } from './project.service';
import { deployService, type DeployInput } from './deploy.service';
import { configService } from './config.service';
import { aiService } from './ai.service';
import { assetMetadata, deploymentStorage } from './deployment-storage.service';
import { openArchive, prepareArchive, stageGithub, type ArchiveManifest } from './static-archive';

interface PublicationJob {
  id: string; projectId: string; sourceType: SourceType; sourceKey?: string; sourceEtag?: string; repoUrl: string;
  startedAt: string; stage: 'source' | 'publish' | 'activate' | 'finish';
  manifestKey: string; slug?: string; done: number; retries: number;
}
const JOB_PREFIX = 'publication:';
const sourcePrefix = (projectId: string) => `deployment-sources/${new Date().toISOString().slice(0, 10)}/${projectId}/`;

/** AppGateway's durable queue owns work; deployment_attempts owns observable results. */
export const staticPublication = {
  async enqueue(env: ApiWorkerEnv, storage: DurableObjectStorage, project: Project, input: DeployInput, id: string, startedAt: string): Promise<void> {
    const bucket = deploymentStorage.bucket(env);
    let sourceKey = input.zipSourceKey;
    const sourceType = deployService.resolveSourceType(input, project);
    if (sourceType === SourceType.Html) {
      sourceKey = `${sourcePrefix(project.id)}${id}.html`;
      await bucket.put(sourceKey, input.htmlContent || project.htmlContent!, { customMetadata: { projectId: project.id } });
    } else if (sourceType === SourceType.Zip && input.zipData && !sourceKey) {
      sourceKey = `${sourcePrefix(project.id)}${id}.zip`;
      await bucket.put(sourceKey, Uint8Array.from(atob(input.zipData), char => char.charCodeAt(0)), { customMetadata: { projectId: project.id } });
    }
    const job: PublicationJob = { id, projectId: project.id, sourceType, sourceKey, repoUrl: project.repoUrl, startedAt, stage: 'source', manifestKey: `${sourcePrefix(project.id)}${id}.manifest.json`, done: 0, retries: 0 };
    await storage.transaction(async transaction => {
      const sequence = (await transaction.get<number>('publicationSequence') || 0) + 1;
      await transaction.put('publicationSequence', sequence);
      await transaction.put(`${JOB_PREFIX}${String(sequence).padStart(16, '0')}:${id}`, job);
      await transaction.setAlarm(Date.now() + 1);
    });
  },

  async runNext(env: ApiWorkerEnv, storage: DurableObjectStorage): Promise<void> {
    const pending = await storage.list<PublicationJob>({ prefix: JOB_PREFIX, limit: 1 });
    const [key, job] = [...pending][0] || [];
    if (!job) return;
    // A crash/CPU termination must not strand the saved job after alarm auto-retries end.
    await storage.setAlarm(Date.now() + 30000);
    const bucket = deploymentStorage.bucket(env);
    try {
      await deploymentRepository.updateProgress(env.PROJECTS_DB, job.id, job.stage);
      const project = await projectService.getProjectById(env.PROJECTS_DB, job.projectId);
      if (!project || project.isDeleted) throw Object.assign(new Error('Project was deleted.'), { code: 'project_deleted' });
      if (job.stage === 'source') {
        let manifest: ArchiveManifest;
        if (job.sourceType === SourceType.Html) {
          const html = await (await bucket.get(job.sourceKey!))?.text();
          if (!html) throw new Error('HTML source expired.');
          manifest = { files: [{ entry: -1, path: 'index.html', size: new TextEncoder().encode(html).length }], context: { indexHtml: html.slice(0, 100000), directoryTree: ['index.html'] } };
        } else {
          if (!job.sourceKey) {
            job.sourceKey = await stageGithub(bucket, job.projectId, job.repoUrl);
            await storage.put(key, job);
          }
          const archive = await openArchive(bucket, job.sourceKey);
          try { manifest = await prepareArchive(archive.entries); job.sourceEtag = archive.etag; } finally { await archive.reader.close(); }
        }
        const enriched = await deployService.enrichProjectMetadata(env, env.PROJECTS_DB, new Request('https://publication.internal/'), project, job.sourceType, {}, manifest.context);
        job.slug = enriched.project.slug;
        if (!job.slug || !/^[a-z0-9-]{1,63}$/.test(job.slug)) throw new Error('Publication address is unavailable.');
        await bucket.put(job.manifestKey, JSON.stringify(manifest));
        job.stage = 'publish'; job.retries = 0;
        await storage.put(key, job);
      } else if (job.stage === 'publish') {
        const object = await bucket.get(job.manifestKey);
        if (!object) throw new Error('Publication manifest expired.');
        const manifest = await object.json<ArchiveManifest>();
        const archive = job.sourceType === SourceType.Html ? undefined : await openArchive(bucket, job.sourceKey!, job.sourceEtag);
        try {
          const batchEnd = Math.min(manifest.files.length, job.done + 20);
          for (; job.done < batchEnd; job.done++) {
            const file = manifest.files[job.done], destination = `apps/${job.slug}/releases/${job.id}/${file.path}`;
            if (!archive) {
              const html = await bucket.get(job.sourceKey!);
              if (!html) throw new Error('HTML source expired.');
              await bucket.put(destination, html.body, { httpMetadata: assetMetadata(file.path) });
            } else {
              const entry = archive.entries[file.entry] as FileEntry;
              const originalPath = entry.filename.replaceAll('\\', '/');
              const rewrite = /\.(?:js|mjs|cjs)$/i.test(file.path) && !originalPath.split('/').some(part => ['dist', 'build', '.next', '.output', '.vercel', '.cache'].includes(part));
              if (rewrite && file.size <= 8 * 1024 * 1024) {
                const bytes = await entry.getData(new Uint8ArrayWriter(), { useWebWorkers: false, checkSignature: true });
                const text = new TextDecoder().decode(bytes);
                let rewritten = text;
                if (looksLikeGenAIClient(text)) {
                  rewritten = applyRuleBasedRewrite(text, 'https://genai-api.gemigo.io');
                  if (rewritten === text) rewritten = await aiService.rewriteGenAIBaseUrl(env, originalPath, text, 'https://genai-api.gemigo.io') || text;
                }
                await bucket.put(destination, rewritten === text ? bytes : rewritten, { httpMetadata: assetMetadata(file.path) });
              } else {
                const stream = new FixedLengthStream(file.size);
                const write = entry.getData(stream.writable, { useWebWorkers: false, useCompressionStream: true, checkSignature: true }).catch(async error => { await stream.writable.abort(error).catch(() => {}); throw error; });
                await Promise.all([write, bucket.put(destination, stream.readable, { httpMetadata: assetMetadata(file.path) })]);
              }
            }
          }
        } finally { await archive?.reader.close(); }
        if (job.done === manifest.files.length) job.stage = 'activate';
        job.retries = 0; await storage.put(key, job);
      } else if (job.stage === 'activate') {
        const pointerKey = `apps/${job.slug}/deployment.json`, prefix = `apps/${job.slug}/releases/${job.id}`;
        const object = await bucket.get(pointerKey);
        const pointer = object ? await object.json<{ prefix: string; previousPrefix?: string }>() : { prefix: `apps/${job.slug}/current` };
        if (pointer.prefix !== prefix) await bucket.put(pointerKey, JSON.stringify({ prefix, previousPrefix: pointer.prefix }), { httpMetadata: { contentType: 'application/json', cacheControl: 'no-cache' } });
        job.stage = 'finish'; job.retries = 0; await storage.put(key, job);
      } else {
        const url = `https://${job.slug}.${configService.getAppsRootDomain(env)}/`;
        const handle = await deployService.statusHandler(env, env.PROJECTS_DB, job.id);
        await handle({ type: 'status', status: 'SUCCESS', stage: 'complete', buildMode: 'static', projectMetadata: { name: project.name, slug: project.slug, description: project.description, category: project.category, tags: project.tags, url } });
        await deploymentStorage.prune(env, job.slug!);
        await bucket.delete([job.sourceKey!, job.manifestKey].filter(Boolean));
        await storage.delete(key);
      }
    } catch (error) {
      const coded = error as Error & { code?: string };
      if ([ERR_BAD_FORMAT, ERR_EOCDR_NOT_FOUND].includes(coded.message)) coded.code = 'invalid_archive';
      // After activation, a storage/database outage must retry completion, never undo the live release.
      if (job.stage === 'finish' || (!coded.code && ++job.retries < 4)) { await storage.put(key, job); return; }
      if (job.stage === 'activate') {
        const pointer = await bucket.get(`apps/${job.slug}/deployment.json`);
        if (pointer && (await pointer.json<{ prefix: string }>()).prefix === `apps/${job.slug}/releases/${job.id}`) { job.stage = 'finish'; await storage.put(key, job); return; }
      }
      const handle = await deployService.statusHandler(env, env.PROJECTS_DB, job.id);
      await handle({ type: 'status', status: 'FAILED', stage: job.stage, buildMode: 'static', errorCode: coded.code || 'publication_failed', errorMessage: coded.message });
      if (job.slug) await deploymentStorage.clear(bucket, `apps/${job.slug}/releases/${job.id}/`);
      await bucket.delete([job.sourceKey!, job.manifestKey].filter(Boolean));
      await storage.delete(key);
    }
    if ((await storage.list({ prefix: JOB_PREFIX, limit: 1 })).size) await storage.setAlarm(Date.now() + 1);
    else await storage.deleteAlarm();
  },

  async cancel(env: ApiWorkerEnv, storage: DurableObjectStorage): Promise<void> {
    const jobs = await storage.list<PublicationJob>({ prefix: JOB_PREFIX });
    for (const job of jobs.values()) {
      await deploymentRepository.finishAttempt(env.PROJECTS_DB, job.id, 'failed', new Date().toISOString(), Date.now() - Date.parse(job.startedAt), 'project_deleted', { stage: 'cancelled', buildMode: 'static', errorMessage: 'Project was deleted.' });
    }
    if (jobs.size) await storage.delete([...jobs.keys()]);
    await storage.deleteAlarm();
  },

  async stream(env: ApiWorkerEnv, id: string): Promise<Response> {
    const encoder = new TextEncoder();
    let cancelled = false;
    const body = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'log', message: 'Publishing your static assets…', level: 'info' })}\n\n`));
          while (!cancelled) {
            const payload: DeploymentStatusPayload = await deployService.reconcileDeployment(env, env.PROJECTS_DB, id);
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
            if (['SUCCESS', 'FAILED'].includes(payload.status || '')) break;
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
          if (!cancelled) controller.close();
        } catch (error) { if (!cancelled) controller.error(error); }
      },
      cancel() { cancelled = true; },
    });
    return new Response(body, { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' } });
  },
};
