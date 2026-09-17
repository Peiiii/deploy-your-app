import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import i18next from '../frontend/node_modules/i18next';
import {
  resolvePublicAuthorIdentity,
  createPublicIdentityCode,
} from '../packages/public-author/src/index';
const { getAuthorInitial, getAuthorName } = createRequire(import.meta.url)('../frontend/src/utils/author.ts') as {
  getAuthorInitial: typeof import('../frontend/src/utils/author').getAuthorInitial;
  getAuthorName: typeof import('../frontend/src/utils/author').getAuthorName;
};

const named = resolvePublicAuthorIdentity({
  ownerId: 'user-1',
  displayName: '小简 Jane',
  handle: 'jane',
});
assert.equal(named.kind, 'profile');
assert.equal(named.label, '小简 Jane');
assert.equal(named.handle, 'jane');
assert.equal(named.profileIdentifier, 'jane');

const handled = resolvePublicAuthorIdentity({
  ownerId: 'user-2',
  displayName: 'private@example.com',
  handle: 'public-jane',
});
assert.equal(handled.label, '@public-jane');
assert.equal(handled.label?.includes('private@example.com'), false);

const anonymousOne = resolvePublicAuthorIdentity({
  ownerId: 'private-internal-user-id',
  displayName: 'private@example.com',
  projectId: 'project-1',
  sourceType: 'github',
  repoUrl: 'https://github.com/acme/project',
});
const anonymousSameOwner = resolvePublicAuthorIdentity({
  ownerId: 'private-internal-user-id',
  projectId: 'project-2',
});
const anonymousOtherOwner = resolvePublicAuthorIdentity({
  ownerId: 'another-private-user-id',
  projectId: 'project-3',
});
assert.equal(anonymousOne.kind, 'anonymous');
assert.equal(anonymousOne.anonymousCode, anonymousSameOwner.anonymousCode);
assert.notEqual(anonymousOne.anonymousCode, anonymousOtherOwner.anonymousCode);
assert.equal(anonymousOne.label, null, 'known users must not be represented by a repository org');
assert.equal(anonymousOne.profileIdentifier, 'private-internal-user-id');

const legacyRepository = resolvePublicAuthorIdentity({
  projectId: 'legacy-project',
  sourceType: 'github',
  repoUrl: 'https://github.com/acme/project',
});
assert.equal(legacyRepository.kind, 'repository');
assert.equal(legacyRepository.label, 'acme');
assert.equal(legacyRepository.profileIdentifier, null);

assert.equal(createPublicIdentityCode('same-seed'), createPublicIdentityCode('same-seed'));

await i18next.init({
  lng: 'en',
  resources: {
    en: { translation: { profile: { anonymousCreator: 'Creator {{code}}' } } },
    'zh-CN': { translation: { profile: { anonymousCreator: '创作者 {{code}}' } } },
  },
});
const storedIdentity = anonymousOne;
assert.equal(
  getAuthorName(storedIdentity, i18next.t.bind(i18next)),
  `Creator ${storedIdentity.anonymousCode}`,
);
await i18next.changeLanguage('zh-CN');
assert.equal(
  getAuthorName(storedIdentity, i18next.t.bind(i18next)),
  `创作者 ${storedIdentity.anonymousCode}`,
  'a stored semantic identity must react to locale changes without remapping',
);
assert.equal(getAuthorName(named, i18next.t.bind(i18next)), '小简 Jane');
assert.equal(
  getAuthorInitial('创作者', storedIdentity.anonymousCode),
  storedIdentity.anonymousCode?.[0],
);

console.log('PASS public author precedence, privacy, pseudonyms, legacy attribution, and live locale rendering');
