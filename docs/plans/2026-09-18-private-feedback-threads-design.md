# Private Feedback Threads Design

## Product decision

Website feedback is a private, forum-style thread rather than a public idea board or a live support chat. A user creates a post with a title, category, and detailed description. The user and the GemiGo team can then add chronological replies below the original post, while the team also maintains a lightweight processing status.

This gives the product three distinct channels:

- WeChat for informal Chinese-language community discussion.
- Discord for informal global community discussion.
- Private website feedback threads for structured product issues, ideas, and questions.

The website must state the privacy boundary before submission: only the author and GemiGo administrators can read the thread. A signed-in user gets a “My feedback” list with status and reply history. Administrators get a combined inbox with category and status filters.

## Interaction model

Each feedback thread contains one immutable opening post and a chronological reply stream. The post author and administrators may reply. Replies support multiline text and remain part of the thread history. This is intentionally closer to a private forum post than a customer-service chat: there are no agents, assignments, presence indicators, read receipts, or real-time delivery requirements.

Only administrators can change status. The initial statuses remain: under review, planned, in progress, and completed. The author or an administrator may delete the whole thread. A reply may be deleted only by its author or an administrator.

Public voting is removed because there is no shared audience in a private model. Community prioritization can happen in WeChat or Discord until a public roadmap is justified by user volume.

## Authorization architecture

The API is the privacy boundary; hiding data in the frontend is insufficient. Every feedback read requires an authenticated session. Non-admin list queries are constrained by `user_id` in SQL, while administrators may list all posts. Reading or writing replies requires the caller to be either the post author or an administrator. Unauthorized access returns a permission error without returning thread content.

The current tables remain compatible. The unused votes table can stay in place to avoid a destructive migration, but voting routes and UI are removed. Creating a reply updates the parent post timestamp so active threads rise to the top of the inbox.

## Error handling and verification

Authentication failures return 401. Authenticated cross-user access returns 403. Missing threads return 404. Existing validation and rate limits remain.

Verification covers anonymous access, owner-only listing, cross-user reply isolation, owner/admin reply behavior, status permissions, lint, TypeScript checks, the frontend build, and visual review in Chinese and English at desktop and mobile widths.
