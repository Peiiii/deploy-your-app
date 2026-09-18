import assert from 'node:assert/strict';
import { DeploymentMetadataPolicy } from '../workers/api/src/services/deployment-metadata-policy.ts';
import { SourceType, type Project } from '../workers/api/src/types/project.ts';
import * as frontendProjectUtils from '../frontend/src/utils/project.ts';
import type { Project as FrontendProject } from '../frontend/src/types.ts';

const buildProject = (patch: Partial<Project> = {}): Project => ({
  id: 'project-1',
  name: 'Garden Planner',
  repoUrl: 'https://github.com/example/garden-planner',
  sourceType: SourceType.GitHub,
  slug: 'garden-planner',
  lastDeployed: '2026-09-18T00:00:00.000Z',
  status: 'Live',
  framework: 'Unknown',
  category: 'Other',
  tags: [],
  ...patch,
});

const policy = new DeploymentMetadataPolicy();
const projectUtils = (
  frontendProjectUtils as typeof frontendProjectUtils & {
    default?: typeof frontendProjectUtils;
  }
).default ?? frontendProjectUtils;

const incompleteWithSlug = buildProject();
assert.equal(
  policy.needsEnrichment(incompleteWithSlug),
  true,
  'an existing slug must not suppress enrichment when description is missing',
);
assert.deepEqual(policy.getMissingFields(incompleteWithSlug), [
  'description',
  'category',
  'tags',
]);

const completeProject = buildProject({
  description: 'Plans crop rotations and greenhouse layouts.',
  category: 'Productivity',
  tags: ['planning', 'agriculture'],
});
assert.equal(policy.needsEnrichment(completeProject), false);

const protectedPatch = policy.buildPatch(
  completeProject,
  {
    name: 'AI Rename',
    slug: 'ai-rename',
    description: 'AI replacement description',
    category: 'Development',
    tags: ['replacement'],
  },
  {},
);
assert.deepEqual(
  protectedPatch,
  {},
  'generated metadata must not overwrite user-authored metadata',
);

const generatedPatch = policy.buildPatch(
  incompleteWithSlug,
  {
    name: 'AI Rename',
    slug: 'ai-rename',
    description: 'Design greenhouse layouts and crop rotations.',
    category: 'Productivity',
    tags: ['planning', 'agriculture'],
  },
  {},
);
assert.deepEqual(generatedPatch, {
  description: 'Design greenhouse layouts and crop rotations.',
  category: 'Productivity',
  tags: ['planning', 'agriculture'],
});

const sourceFallbackPatch = policy.buildPatch(
  incompleteWithSlug,
  {
    name: null,
    slug: null,
    description: null,
    category: null,
    tags: [],
  },
  {
    packageJson: {
      description: 'Open-source greenhouse layout planning toolkit.',
    },
  },
);
assert.equal(
  sourceFallbackPatch.description,
  'Open-source greenhouse layout planning toolkit.',
);

const htmlFallbackPatch = policy.buildPatch(
  incompleteWithSlug,
  {
    description: null,
    category: null,
    tags: [],
  },
  {
    indexHtml:
      '<html><head><title>Garden Planner</title></head><body>Plan crop rotations and harvest schedules.</body></html>',
  },
);
assert.equal(
  htmlFallbackPatch.description,
  'Garden Planner — Plan crop rotations and harvest schedules.',
);

const legacyFallback = projectUtils.buildProjectDescription({
  ...incompleteWithSlug,
  sourceType: undefined,
} as unknown as FrontendProject);
assert.equal(
  legacyFallback,
  '',
  'missing descriptions must stay empty instead of displaying invented copy',
);
assert.equal(
  projectUtils.buildProjectDescription({
    ...incompleteWithSlug,
    name: 'Budget Helper',
    sourceType: undefined,
  } as unknown as FrontendProject),
  legacyFallback,
  'changing the project name must not turn a template into a description',
);

console.log('OK: deployment metadata enrichment policy regression checks passed.');
