# Sidebar project loading state

## Problem

The sidebar initially treated an empty in-memory project array as a completed empty response. Authentication, project loading, and profile loading start independently, so the empty message could appear before the current user and their pinned-project preferences were available. The copy was also inaccurate because the list contains pinned projects plus recent projects.

## Decision

Keep request lifecycle state in the shared project store. The sidebar renders a skeleton while authentication is being restored, the first project request has not completed, projects are refreshing, or the current user's profile is unresolved. It renders the empty state only after successful project loading. A failed first request gets an explicit retry state. Profile responses are scoped to the user that initiated them so a stale request cannot update a later session.

The project store also loads from an authenticated `scope=mine` API query. Previously it fetched the first page of all projects and filtered by owner in the browser. Once the site had more than one page of projects, a user's projects could be absent from that page and the sidebar would incorrectly appear empty. Session restoration now completes before the request starts, and signed-out sessions skip the request.

The alternatives were a fixed delay, which would only hide the race, and sidebar-only request flags, which would duplicate shared data state. Shared lifecycle state plus server-side ownership filtering is the smallest durable fix and can be reused by other project consumers.

## Acceptance criteria

- The sidebar never displays an empty state before session, project, and profile initialization completes.
- A real empty result says “暂无项目” / “No projects yet”.
- A failed initial request shows a retry action instead of an empty state.
- Switching users cannot apply a stale profile response to the new user.
- The project API returns the current user's paginated projects directly instead of filtering a global page in the browser.
