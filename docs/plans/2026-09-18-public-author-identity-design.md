# Public Author Identity Design

## Problem

Public project cards currently collapse many owners into the same localized
`Creator` label. The label is translated while projects are mapped into UI
state, so it can also remain Chinese after the interface changes to English.
The underlying issue is that author identity, privacy filtering, localization,
and card presentation are mixed together.

## Options considered

1. **Frontend-only fallback repair.** Reorder the existing fallbacks and remap
   cards after a language change. This is fast, but every public surface can
   still implement a different privacy and identity policy.
2. **Author snapshots on projects.** Persist the author's current label on each
   project. Reads are simple, but profile edits become stale and require data
   migrations or fan-out updates.
3. **Structured public identity (chosen).** Resolve an author from live user and
   project data into a shared, privacy-safe domain object. Store that object in
   client state and localize only its anonymous presentation during render.

## Product decision

An author label is resolved in this order:

1. An explicit, privacy-safe public display name.
2. A public handle, rendered as `@handle`.
3. For ownerless legacy GitHub projects only, the repository owner as source
   attribution. A repository organization must not override the identity of a
   known GemiGo user.
4. A stable pseudonymous identity such as `Creator A7K9`. The code is derived
   from the owner ID, or from the project ID when no owner exists, so the same
   unknown owner remains recognizable without exposing an email or internal ID.

Email addresses and internal user IDs are never labels. A profile link may keep
using the internal ID for backward compatibility when no handle exists, but the
ID is not rendered. Users can replace a pseudonym immediately by setting a
public display name or handle in their profile.

## Architecture

Create a small shared package, `@gemigo/public-author`, containing the domain
type and pure resolver. Both the API Worker and frontend use the same precedence,
sanitization, pseudonym generation, and identity-kind semantics.

The API enriches Explore projects with a nested `publicAuthor` object. The
public-profile response exposes the same object, making cards and profile pages
consistent. Existing flat owner fields remain temporarily for compatibility.

The frontend stores `PublicAuthorIdentity`, never a translated author string.
Components call a small formatting helper with React i18next's current `t`
function. A language change therefore updates anonymous labels immediately,
without refetching or rewriting application state.

## Data flow

```text
users + project
      |
      v
@gemigo/public-author resolver
      |
      v
API publicAuthor (semantic, unlocalized)
      |
      v
frontend state (semantic, unlocalized)
      |
      v
render with current locale
```

## Compatibility and rollout

The frontend reconstructs `publicAuthor` from legacy flat fields when talking
to an older API during a staggered deployment. The API does not require a
database migration. Existing URLs and profile links keep working.

## Testing

Automated coverage must prove:

- display names and handles have the intended precedence;
- email-like names and control characters never become public labels;
- anonymous codes are stable for the same owner and differ across owners;
- owner-backed GitHub projects do not impersonate repository organizations;
- ownerless legacy GitHub projects retain useful source attribution;
- the same stored identity renders in English and Chinese after a language
  switch, without remapping project data;
- lint and TypeScript project references pass.
