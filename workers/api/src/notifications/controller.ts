import { ignoredCategory } from './delivery';
import { registerPush } from './channels';
import type { ApiWorkerEnv } from '../types/env';
import { authRepository } from '../repositories/auth.repository';
import { getSessionIdFromRequest } from '../utils/auth';
import { jsonResponse, readJson } from '../utils/http';
import { NotFoundError, ValidationError } from '../utils/error-handler';
import { projectService } from '../services/project.service';
import { commentService } from '../services/comment.service';
import { commentRepository } from '../repositories/comment.repository';
import { engagementRepository } from '../repositories/engagement.repository';
import { followRepository } from '../repositories/follow.repository';
import { communityRepository } from '../repositories/community.repository';
import { ensureNotificationSchema } from '@gemigo/notifications/persistence';
import {
  listNotifications,
  getNotificationSummary,
  getPreferences,
  readNotifications,
  savePreferences,
} from './repository';

function libraryCursor(value: string | null, numeric = false): [string | number, string] {
  if (!value) return [numeric ? Number.MAX_SAFE_INTEGER : '9999', ''];
  try {
    const [at, id] = JSON.parse(atob(value));
    if (
      (numeric ? !Number.isSafeInteger(at) : typeof at !== 'string') ||
      typeof id !== 'string' ||
      id.length > 128
    )
      throw Error();
    return [at, id];
  } catch {
    throw new ValidationError('Invalid library cursor');
  }
}
function libraryPage(rows: Record<string, unknown>[], time: string) {
  const last = rows[29];
  return {
    items: rows.slice(0, 30),
    cursor: rows.length > 30 ? btoa(JSON.stringify([last[time], last.id])) : null,
  };
}

export async function notificationViewer(request: Request, db: D1Database) {
  const id = getSessionIdFromRequest(request);
  const session = id ? await authRepository.getSessionWithUser(db, id) : null;
  return session?.user ?? null;
}
export async function handleNotifications(
  request: Request,
  env: ApiWorkerEnv,
  action: string,
  params: Record<string, string> = {}
) {
  const db = env.PROJECTS_DB;
  const user = await notificationViewer(request, db);
  if (!user) return jsonResponse({ error: 'Login required', code: 'UNAUTHORIZED' }, 401);
  const expectedViewer = request.headers.get('X-Gemigo-Viewer');
  if (expectedViewer && expectedViewer !== user.id)
    return jsonResponse({ error: 'Session changed', code: 'SESSION_CHANGED' }, 409);
  await Promise.all([
    ensureNotificationSchema(db),
    commentRepository.ensureSchema(db),
    engagementRepository.ensureSchema(db),
    followRepository.ensureSchema(db),
    communityRepository.ensureSchema(db),
  ]);
  const url = new URL(request.url);
  if (action === 'summary') {
    if (request.headers.get('X-Gemigo-Visible') === '1')
      await db
        .prepare(
          'INSERT INTO notification_presence(user_id,last_visible_at) VALUES(?,?) ON CONFLICT(user_id) DO UPDATE SET last_visible_at=excluded.last_visible_at'
        )
        .bind(user.id, Date.now())
        .run();
  }
  if (action === 'summary') return jsonResponse(await getNotificationSummary(db, user.id));
  if (action === 'list') {
    const page = await listNotifications(
      db,
      user.id,
      url.searchParams.get('category') ?? 'all',
      url.searchParams.get('cursor'),
      url.searchParams.get('needsReply') === '1'
    );
    return jsonResponse(page);
  }
  if (action === 'preferences') {
    const subscription = await db
      .prepare('SELECT endpoint_hash FROM notification_push_subscriptions WHERE user_id=? LIMIT 1')
      .bind(user.id)
      .first();
    const pushAvailable =
      !!env.NOTIFICATION_VAPID_JWK &&
      !!env.NOTIFICATION_VAPID_PUBLIC_KEY &&
      env.NOTIFICATION_SEND_ENABLED === '1';
    if (request.method === 'PATCH')
      await savePreferences(db, user.id, await readJson(request), pushAvailable && !!subscription);
    const prefs = await getPreferences(db, user.id);
    const reducedCategories = (
      await Promise.all(
        (['direct', 'feedback', 'deployment'] as const).map(async (category) =>
          prefs.external[category] && (await ignoredCategory(db, user.id, category, Date.now()))
            ? category
            : null
        )
      )
    ).filter(Boolean);
    return jsonResponse({ ...prefs, pushAvailable, reducedCategories });
  }
  if (action === 'push-key')
    return jsonResponse({ publicKey: env.NOTIFICATION_VAPID_PUBLIC_KEY ?? null });
  if (action === 'push-subscription' && request.method === 'GET') {
    const hash = url.searchParams.get('hash') ?? '';
    if (!/^[0-9a-f]{64}$/.test(hash)) throw new ValidationError('Invalid device hash');
    const row = await db
      .prepare(
        'SELECT endpoint_hash FROM notification_push_subscriptions WHERE endpoint_hash=? AND user_id=?'
      )
      .bind(hash, user.id)
      .first();
    return jsonResponse({ connected: !!row });
  }
  if (action === 'push-subscription') {
    if (
      request.method !== 'DELETE' &&
      (!env.NOTIFICATION_VAPID_JWK || !env.NOTIFICATION_VAPID_PUBLIC_KEY)
    )
      throw new ValidationError('Device notifications are unavailable');
    await registerPush(db, user.id, await readJson(request), request.method === 'DELETE');
    return jsonResponse({ ok: true });
  }
  if (action === 'delivery-receipt') {
    const body = await readJson(request);
    if (typeof body.id !== 'string' || !/^[0-9a-f-]{36}$/i.test(body.id))
      throw new ValidationError('Invalid delivery');
    await db
      .prepare(
        "UPDATE notification_deliveries SET state='delivered',delivered_at=? WHERE id=? AND recipient_id=? AND state IN ('leased','accepted','unknown')"
      )
      .bind(Date.now(), body.id, user.id)
      .run();
    return jsonResponse({ ok: true });
  }
  if (action === 'read') {
    const body = await readJson(request);
    const group = body.all === true ? '__all__' : body.groupKey;
    if (typeof group !== 'string' || (body.all !== true && group === '__all__'))
      throw new ValidationError('Invalid group');
    await readNotifications(db, user.id, group, Number(body.throughSeq));
    return jsonResponse({ ok: true });
  }
  if (action === 'mute') {
    const body = await readJson(request);
    const id = body.subjectId;
    if (typeof id !== 'string' || id.length > 128) throw new ValidationError('Invalid subject');
    const project = await projectService.getProjectById(db, id);
    const feedback = await db
      .prepare(
        'SELECT id FROM community_feedback_posts WHERE id=? AND user_id=? AND deleted_at IS NULL'
      )
      .bind(id, user.id)
      .first();
    if (!feedback && (!project || (!project.isPublic && project.ownerId !== user.id)))
      throw new NotFoundError('Subject not found');
    await db
      .prepare(
        request.method === 'DELETE'
          ? 'INSERT INTO notification_subject_mutes(user_id,subject_id,muted,suppressed_through_seq) SELECT ?,?,0,COALESCE(MAX(seq),0) FROM notifications WHERE recipient_id=? AND subject_id=? ON CONFLICT(user_id,subject_id) DO UPDATE SET muted=0,suppressed_through_seq=excluded.suppressed_through_seq'
          : 'INSERT INTO notification_subject_mutes(user_id,subject_id) VALUES(?,?) ON CONFLICT(user_id,subject_id) DO UPDATE SET muted=1'
      )
      .bind(...(request.method === 'DELETE' ? [user.id, id, user.id, id] : [user.id, id]))
      .run();
    return jsonResponse({ ok: true });
  }
  if (action === 'disposition') {
    const comment = await commentRepository.getCommentById(db, params.id);
    const project = comment ? await projectService.getProjectById(db, comment.projectId) : null;
    if (!comment || comment.replyTo || project?.ownerId !== user.id)
      throw new NotFoundError('Comment not found');
    const body = await readJson(request);
    await db
      .prepare(
        body.dismiss === true
          ? 'INSERT OR IGNORE INTO comment_response_dispositions VALUES(?,?)'
          : 'DELETE FROM comment_response_dispositions WHERE user_id=? AND comment_id=?'
      )
      .bind(user.id, params.id)
      .run();
    return jsonResponse({ ok: true });
  }
  if (action === 'feedback-context') {
    const post = await communityRepository.getPostById(db, params.id);
    if (!post || post.author.id !== user.id) throw new NotFoundError('Feedback not found');
    const comments = await communityRepository.listComments(db, params.id);
    return jsonResponse({
      post: { ...post, canDelete: true, canUpdateStatus: false },
      comments: comments.map((comment) => ({
        ...comment,
        canDelete: comment.author.id === user.id,
      })),
    });
  }
  if (action === 'context') {
    const project = await projectService.getProjectById(db, params.id);
    if (!project || (!project.isPublic && project.ownerId !== user.id))
      throw new NotFoundError('Project not found');
    const page = await commentService.listProjectComments(db, params.id, {
      page: Number(url.searchParams.get('page') ?? 1),
      pageSize: 30,
      viewer: { userId: user.id, isAdmin: false },
    });
    const targetId = url.searchParams.get('commentId');
    const target = targetId ? await commentRepository.getCommentById(db, targetId) : null;
    if (targetId && (!target || target.projectId !== params.id))
      throw new NotFoundError('Comment not found');
    const parent = target?.replyTo
      ? await commentRepository.getCommentById(db, target.replyTo.commentId)
      : null;
    return jsonResponse({
      project: { id: project.id, name: project.name, url: project.url },
      ...page,
      parent: parent ? { ...parent, canDelete: parent.author.id === user.id } : null,
      target: target ? { ...target, canDelete: target.author.id === user.id } : null,
    });
  }
  if (action === 'favorites') {
    const [before, id] = libraryCursor(url.searchParams.get('before'));
    const rows = await db
      .prepare(
        `SELECT p.id,p.name,p.url,p.description,f.created_at FROM project_favorites f JOIN projects p ON p.id=f.project_id WHERE f.user_id=? AND (f.created_at<? OR (f.created_at=? AND p.id>?)) AND (p.is_public=1 OR p.owner_id=?) AND (p.is_deleted=0 OR p.is_deleted IS NULL) ORDER BY f.created_at DESC,p.id LIMIT 31`
      )
      .bind(user.id, before, before, id, user.id)
      .all();
    return jsonResponse(libraryPage(rows.results ?? [], 'created_at'));
  }
  if (action === 'following' || action === 'followers') {
    const [before, id] = libraryCursor(url.searchParams.get('before'));
    const direction =
      action === 'following'
        ? { member: 'following_id', owner: 'follower_id' }
        : { member: 'follower_id', owner: 'following_id' };
    const rows = await db
      .prepare(
        `SELECT u.id,u.handle,u.display_name,f.created_at FROM user_follows f JOIN users u ON u.id=f.${direction.member} WHERE f.${direction.owner}=? AND (f.created_at<? OR (f.created_at=? AND u.id>?)) ORDER BY f.created_at DESC,u.id LIMIT 31`
      )
      .bind(user.id, before, before, id)
      .all();
    return jsonResponse(libraryPage(rows.results ?? [], 'created_at'));
  }
  if (action === 'publications') {
    const [before, id] = libraryCursor(url.searchParams.get('before'), true);
    const rows = await db
      .prepare(
        `SELECT p.id,p.name,p.url,fp.published_at,u.handle,u.display_name FROM first_publications fp JOIN projects p ON p.id=fp.project_id JOIN user_follows f ON f.following_id=fp.author_id JOIN users u ON u.id=fp.author_id WHERE f.follower_id=? AND fp.baseline=0 AND fp.author_id=p.owner_id AND p.is_public=1 AND p.status='Live' AND p.url IS NOT NULL AND (p.is_deleted=0 OR p.is_deleted IS NULL) AND fp.published_at>=CAST(strftime('%s',f.created_at) AS INTEGER)*1000 AND (fp.published_at<? OR (fp.published_at=? AND p.id>?)) ORDER BY fp.published_at DESC,p.id LIMIT 31`
      )
      .bind(user.id, before, before, id)
      .all();
    return jsonResponse(libraryPage(rows.results ?? [], 'published_at'));
  }
  throw new NotFoundError('Notification action not found');
}
