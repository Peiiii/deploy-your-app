import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Heart, MessageCircle, Star, Share2, Play, X, ChevronLeft } from 'lucide-react';
import type { ExploreAppCard } from '@/components/explore-app-card';
import { usePresenter } from '@/contexts/presenter-context';
import { useReactionStore } from '@/stores/reaction.store';
import type { ProjectComment } from '@/types';
import { createProjectComment, deleteComment, fetchProjectComments } from '@/services/http/comments-api';

interface ExploreFeedProps {
    apps: ExploreAppCard[];
    onToggleView: () => void;
}

const buildAvatarFallback = (author: ProjectComment['author']): string => {
    const base = author.handle || author.displayName || 'U';
    return base.trim().slice(0, 1).toUpperCase() || 'U';
};

const buildAuthorLabel = (author: ProjectComment['author']): string => {
    if (author.handle && author.handle.trim().length > 0) {
        return `@${author.handle}`;
    }
    return author.displayName?.trim() || 'User';
};

const formatRelativeTime = (iso: string): string => {
    const ts = Date.parse(iso);
    if (!Number.isFinite(ts)) return '';
    const diffSeconds = Math.max(0, Math.floor((Date.now() - ts) / 1000));
    if (diffSeconds < 60) return '刚刚';
    const minutes = Math.floor(diffSeconds / 60);
    if (minutes < 60) return `${minutes}分钟前`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}小时前`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}天前`;
    return new Date(ts).toLocaleDateString();
};

export const ExploreFeed: React.FC<ExploreFeedProps> = ({ apps, onToggleView }) => {
    const { t } = useTranslation();
    const [activeIndex, setActiveIndex] = useState(0);
    const [isAnyAppEntered, setIsAnyAppEntered] = useState(false);
    const [lastScrollTop, setLastScrollTop] = useState(0);
    const [isScrollingUp, setIsScrollingUp] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    // Header visibility logic: Show at top OR when scrolling up
    const showHeader = (activeIndex === 0 || isScrollingUp) && !isAnyAppEntered;

    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        const index = Number(entry.target.getAttribute('data-index'));
                        setActiveIndex(index);
                    }
                });
            },
            { threshold: 0.6 } // High threshold for "active" item
        );

        const items: NodeListOf<Element> | undefined = containerRef.current?.querySelectorAll('.feed-item-wrapper');
        items?.forEach((item) => observer.observe(item));

        // Scroll direction tracking
        const handleScroll = (e: Event) => {
            const target = e.target as HTMLDivElement;
            const currentScrollTop = target.scrollTop;

            // Re-show header if scrolling up significantly
            if (currentScrollTop < lastScrollTop - 10) {
                setIsScrollingUp(true);
            } else if (currentScrollTop > lastScrollTop + 10) {
                setIsScrollingUp(false);
            }

            setLastScrollTop(currentScrollTop);
        };

        const container = containerRef.current;
        container?.addEventListener('scroll', handleScroll);

        return () => {
            observer.disconnect();
            container?.removeEventListener('scroll', handleScroll);
        };
    }, [apps.length, lastScrollTop]);

    return (
        <div className="fixed inset-0 z-[100] bg-black overflow-hidden flex flex-col">
            {/* Custom Auto-Hiding Header */}
            <div
                className={`fixed top-0 left-0 right-0 z-[110] px-6 h-20 flex items-center justify-between transition-all duration-500 ease-in-out bg-gradient-to-b from-black/30 to-transparent ${showHeader ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-full pointer-events-none'
                    }`}
            >
                {/* Left Side - Back Button */}
                <div className="flex-1">
                    <button
                        onClick={onToggleView}
                        className="p-2 -ml-2 text-white hover:text-white/80 transition-all active:scale-95 filter drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]"
                    >
                        <ChevronLeft className="w-8 h-8" />
                    </button>
                </div>

                {/* Center - Empty/Spacing */}
                <div className="flex-1" />

                {/* Right Side - Close Button */}
                <div className="flex-1 flex justify-end">
                    <button
                        onClick={onToggleView}
                        className="p-2 text-white hover:text-white/80 transition-all active:scale-95 filter drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]"
                        title={t('explore.feed.exitFullscreen')}
                    >
                        <X className="w-7 h-7" />
                    </button>
                </div>
            </div>

            <div
                ref={containerRef}
                className="flex-1 overflow-y-scroll snap-y snap-mandatory scrollbar-hide"
            >
                {apps.map((app, index) => {
                    const isVisible = Math.abs(index - activeIndex) <= 1;
                    const isActive = index === activeIndex;

                    return (
                        <div
                            key={app.id}
                            className="feed-item-wrapper h-screen w-full snap-start snap-always"
                            data-index={index}
                        >
                            <FeedItem
                                app={app}
                                isRendered={isVisible}
                                isActive={isActive}
                                onEnterStateChange={setIsAnyAppEntered}
                            />
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

interface FeedItemProps {
    app: ExploreAppCard;
    isRendered: boolean;
    isActive: boolean;
    onEnterStateChange: (isEntered: boolean) => void;
}

const FeedItem: React.FC<FeedItemProps> = ({ app, isRendered, isActive, onEnterStateChange }) => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const presenter = usePresenter();
    const reactionEntry = useReactionStore((s) => s.byProjectId[app.id]);
    const [isEntered, setIsEntered] = useState(false);
    const [isCommentsOpen, setIsCommentsOpen] = useState(false);
    const [comments, setComments] = useState<ProjectComment[]>([]);
    const [commentsTotal, setCommentsTotal] = useState(0);
    const [commentsLoading, setCommentsLoading] = useState(false);
    const [commentsError, setCommentsError] = useState<string | null>(null);
    const [newComment, setNewComment] = useState('');
    const [replyTo, setReplyTo] = useState<ProjectComment | null>(null);
    const [isSubmittingComment, setIsSubmittingComment] = useState(false);
    const iframeRef = useRef<HTMLIFrameElement>(null);

    const likesCount = reactionEntry?.likesCount ?? 0;
    const isLiked = reactionEntry?.likedByCurrentUser ?? false;
    const favoritesCount = reactionEntry?.favoritesCount ?? 0;
    const isFavorited = reactionEntry?.favoritedByCurrentUser ?? false;

    const openComments = () => {
        setIsCommentsOpen(true);
        setCommentsError(null);
        setCommentsLoading(true);

        fetchProjectComments(app.id, { page: 1, pageSize: 30 })
            .then((data) => {
                setComments(data.items);
                setCommentsTotal(data.total);
            })
            .catch((err) => {
                console.error('Failed to load comments', err);
                setCommentsError('Failed to load comments');
            })
            .finally(() => {
                setCommentsLoading(false);
            });
    };

    const closeComments = () => {
        setIsCommentsOpen(false);
        setReplyTo(null);
        setNewComment('');
        setCommentsError(null);
    };

    const handleAddComment = async (e: React.FormEvent) => {
        e.preventDefault();
        const content = newComment.trim();
        if (!content) return;

        const user = presenter.auth.getCurrentUser();
        if (!user) {
            presenter.auth.openAuthModal('login');
            return;
        }

        setIsSubmittingComment(true);
        setCommentsError(null);
        try {
            const created = await createProjectComment(app.id, {
                content,
                replyToCommentId: replyTo?.id ?? null,
            });
            setComments((prev) => [created, ...prev]);
            setCommentsTotal((prev) => prev + 1);
            setNewComment('');
            setReplyTo(null);
        } catch (err) {
            console.error('Failed to create comment', err);
            if (err instanceof Error && err.message === 'unauthorized') {
                presenter.auth.openAuthModal('login');
                return;
            }
            setCommentsError(err instanceof Error ? err.message : 'Failed to create comment');
        } finally {
            setIsSubmittingComment(false);
        }
    };

    const handleDeleteComment = async (commentId: string) => {
        setCommentsError(null);
        try {
            await deleteComment(commentId);
            setComments((prev) => prev.filter((c) => c.id !== commentId));
            setCommentsTotal((prev) => Math.max(0, prev - 1));
        } catch (err) {
            console.error('Failed to delete comment', err);
            if (err instanceof Error && err.message === 'unauthorized') {
                presenter.auth.openAuthModal('login');
                return;
            }
            setCommentsError(err instanceof Error ? err.message : 'Failed to delete comment');
        }
    };

    // Reset enter state when moving away
    useEffect(() => {
        if (!isActive && isEntered) {
            const timer = window.setTimeout(() => {
                setIsEntered(false);
                onEnterStateChange(false);
            }, 0);
            return () => window.clearTimeout(timer);
        }
    }, [isActive, isEntered, onEnterStateChange]);

    const handleEnter = () => {
        setIsEntered(true);
        onEnterStateChange(true);
    };

    const handleExit = (e: React.MouseEvent) => {
        e.stopPropagation();
        setIsEntered(false);
        onEnterStateChange(false);
    };

    return (
        <div className="h-full w-full relative bg-black flex flex-col overflow-hidden">
            {/* Interaction Header (Dedicated Top Space) */}
            {isEntered && (
                <div className="h-16 w-full flex items-center justify-between px-4 bg-black/20 backdrop-blur-md border-b border-white/5 z-50">
                    {/* Left: Author Info */}
                    <div className="flex items-center gap-2 p-1.5 bg-white/5 rounded-full pr-3 border border-white/10 backdrop-blur-md shadow-lg">
                        <div className={`w-8 h-8 rounded-full bg-gradient-to-tr ${app.color} flex items-center justify-center text-white font-bold text-xs shrink-0 shadow-md`}>
                            {app.author.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex flex-col max-w-[100px]">
                            <span className="text-white text-xs font-bold truncate drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">@{app.author}</span>
                            <span className="text-white/60 text-[10px] drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">1.2k {t('explore.feed.followers')}</span>
                        </div>
                        <button className="ml-1 px-3 py-1 bg-[#ff0050] text-white text-[10px] font-bold rounded-full hover:brightness-110 active:scale-95 transition-all shadow-md">
                            {t('explore.feed.follow')}
                        </button>
                    </div>

                    {/* Right: Exit Button */}
                    <div className="flex items-center gap-3">
                        <div className="hidden sm:flex items-center gap-2 px-3 py-1 bg-white/5 rounded-full border border-white/10">
                            <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                            <span className="text-white/60 text-[10px] font-medium uppercase drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">{t('explore.feed.interactive')}</span>
                        </div>
                        <button
                            className="w-10 h-10 flex items-center justify-center text-white/80 hover:text-white transition-all active:scale-90 filter drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]"
                            onClick={handleExit}
                            title="Exit Interaction"
                        >
                            <X className="w-8 h-8" />
                        </button>
                    </div>
                </div>
            )}

            <div className="flex-1 relative w-full h-full overflow-hidden flex flex-col">
                {/* Iframe or Thumbnail/Placeholder */}
                {isRendered && isEntered ? (
                    <iframe
                        ref={iframeRef}
                        src={app.url}
                        className="w-full h-full border-none bg-white transition-all duration-300"
                        title={app.name}
                    />
                ) : (
                    <div className="w-full h-full relative overflow-hidden bg-black flex items-center justify-center">
                        {app.thumbnailUrl ? (
                            <img
                                src={app.thumbnailUrl}
                                alt={app.name}
                                className="w-full h-full object-cover transition-transform duration-500 rounded-xl opacity-100"
                            />
                        ) : (
                            <div className={`w-full h-full flex items-center justify-center bg-gradient-to-br ${app.color} rounded-xl`}>
                                <span className="text-9xl font-black text-white/20 select-none">
                                    {app.name.charAt(0).toUpperCase()}
                                </span>
                            </div>
                        )}
                    </div>
                )}

                {/* Interaction Shield */}
                {!isEntered && (
                    <div
                        className="absolute inset-0 z-10 cursor-pointer bg-transparent flex flex-col items-center justify-center group transition-all duration-300"
                        onClick={handleEnter}
                    >
                        {isRendered && (
                            <>
                                <div className="w-16 h-16 rounded-full border-2 border-white flex items-center justify-center filter drop-shadow-[0_4px_12px_rgba(0,0,0,0.5)] group-hover:scale-110 transition-transform duration-300">
                                    <Play className="w-8 h-8 text-white fill-current translate-x-0.5" />
                                </div>
                                <p className="mt-4 text-white font-bold text-lg drop-shadow-[0_2px_12px_rgba(0,0,0,0.8)] opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                    {t('common.clickToEnter')}
                                </p>
                            </>
                        )}
                    </div>
                )}

                {/* TikTok-style UI Overlay (Info remains visible or fades partially) */}
                <div className={`absolute bottom-0 left-0 right-0 h-[40%] pointer-events-none z-10 flex flex-col justify-end p-6 bg-gradient-to-t from-black/30 to-transparent transition-all duration-500 ${isEntered ? 'opacity-40 -translate-y-4' : 'opacity-100 translate-y-0'
                    }`}>
                    {/* Bottom Info */}
                    <div className="max-w-[80%] text-white mb-4">
                        <h3
                            className="text-xl font-bold mb-2 flex items-center gap-2 cursor-pointer pointer-events-auto hover:text-brand-400 transition-colors drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]"
                            onClick={() => navigate(`/u/${app.authorProfileIdentifier || app.author}`)}
                        >
                            <span className="opacity-80">@</span>
                            {app.author.replace(/\s+/g, '_').toLowerCase()}
                        </h3>
                        <p className="text-sm text-gray-200 line-clamp-2 mb-4 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                            {app.description}
                        </p>
                    </div>
                </div>

                {/* Vertical Sidebar Actions (Persistent) */}
                <div className="absolute right-4 bottom-16 flex flex-col items-center gap-6 z-20 pointer-events-auto">
                    {!isEntered && (
                        <div
                            className="relative mb-4 cursor-pointer"
                            onClick={() => navigate(`/u/${app.authorProfileIdentifier || app.author}`)}
                        >
                            <div className={`w-12 h-12 rounded-full border-2 border-white overflow-hidden bg-gradient-to-tr ${app.color} flex items-center justify-center text-xl shadow-xl text-white font-bold`}>
                                {app.author.charAt(0).toUpperCase()}
                            </div>
                            <button className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-5 h-5 bg-[#ff0050] text-white rounded-full flex items-center justify-center font-bold text-lg border-2 border-white shadow-lg hover:scale-110 transition-transform">
                                +
                            </button>
                        </div>
                    )}

                    <div className="flex flex-col items-center gap-1">
                        <div
                            className="p-2 transition-transform active:scale-90 cursor-pointer filter drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]"
                            onClick={() => presenter.reaction.toggleLike(app.id)}
                        >
                            <Heart className={`w-8 h-8 text-white transition-colors ${isLiked ? 'fill-[#ff0050] text-[#ff0050]' : 'fill-white/20'}`} />
                        </div>
                        <span className="text-white text-xs font-semibold drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                            {likesCount > 1000 ? `${(likesCount / 1000).toFixed(1)}k` : likesCount}
                        </span>
                    </div>

                    <div className="flex flex-col items-center gap-1">
                        <div
                            className="p-2 transition-transform active:scale-90 cursor-pointer filter drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]"
                            onClick={openComments}
                        >
                            <MessageCircle className="w-8 h-8 text-white fill-white/20" />
                        </div>
                        <span className="text-white text-xs font-semibold drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                            {commentsTotal}
                        </span>
                    </div>

                    <div className="flex flex-col items-center gap-1">
                        <div
                            className="p-2 transition-transform active:scale-90 cursor-pointer filter drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]"
                            onClick={() => presenter.reaction.toggleFavorite(app.id)}
                        >
                            <Star className={`w-8 h-8 text-white transition-colors ${isFavorited ? 'fill-yellow-400 text-yellow-400' : 'fill-white/20'}`} />
                        </div>
                        <span className="text-white text-xs font-semibold drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                            {favoritesCount > 1000 ? `${(favoritesCount / 1000).toFixed(1)}k` : favoritesCount}
                        </span>
                    </div>

                    <div className="flex flex-col items-center gap-1">
                        <div className="p-2 transition-transform active:scale-90 cursor-pointer filter drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                            <Share2 className="w-8 h-8 text-white fill-white/20" />
                        </div>
                        <span className="text-white text-xs font-semibold drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">{t('explore.feed.share')}</span>
                    </div>
                </div>

                {/* Comment Drawer */}
                <div
                    className={`absolute inset-0 z-50 transition-all duration-300 ${isCommentsOpen ? 'pointer-events-auto' : 'pointer-events-none'
                        }`}
                >
                    {/* Backdrop */}
                    <div
                        className={`absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity duration-300 ${isCommentsOpen ? 'opacity-100' : 'opacity-0'
                            }`}
                        onClick={closeComments}
                    />

                    {/* Drawer Content */}
                    <div
                        className={`absolute bottom-0 left-0 right-0 w-full max-h-[60%] bg-[#121212] rounded-t-2xl flex flex-col transition-transform duration-300 ease-out border-t border-white/10 ${isCommentsOpen ? 'translate-y-0' : 'translate-y-full'
                            }`}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between p-4 border-b border-white/5">
                            <div className="w-8" />
                            <h4 className="text-white font-bold text-sm">{t('explore.feed.commentsCount', { count: commentsTotal })}</h4>
                            <button
                                onClick={closeComments}
                                className="w-8 h-8 flex items-center justify-center text-white/60 hover:text-white"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Comment List */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-6">
                            {commentsLoading && (
                                <div className="text-white/40 text-sm">Loading…</div>
                            )}

                            {!commentsLoading && commentsError && (
                                <div className="text-red-400 text-sm">{commentsError}</div>
                            )}

                            {!commentsLoading && !commentsError && comments.length === 0 && (
                                <div className="text-white/40 text-sm">还没有评论，来抢沙发吧。</div>
                            )}

                            {!commentsLoading && comments.map((comment) => (
                                <div key={comment.id} className="flex gap-3">
                                    <div className={`w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-xs font-bold text-white shadow-inner ${comment.author.id === presenter.auth.getCurrentUser()?.id ? `bg-gradient-to-tr ${app.color}` : 'bg-slate-700'
                                        }`}>
                                        {comment.author.avatarUrl ? (
                                            <img src={comment.author.avatarUrl} alt="" className="w-full h-full object-cover rounded-full" />
                                        ) : (
                                            buildAvatarFallback(comment.author)
                                        )}
                                    </div>
                                    <div className="flex-1 space-y-1">
                                        <div className="flex items-center justify-between">
                                            <span className="text-white/60 text-xs font-bold">{buildAuthorLabel(comment.author)}</span>
                                            <div className="flex items-center gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => setReplyTo(comment)}
                                                    className="text-white/40 text-[11px] hover:text-white/70"
                                                >
                                                    回复
                                                </button>
                                                {comment.canDelete && (
                                                    <button
                                                        type="button"
                                                        onClick={() => handleDeleteComment(comment.id)}
                                                        className="text-white/40 text-[11px] hover:text-red-300"
                                                    >
                                                        删除
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                        {(comment.replyTo?.handle || comment.replyTo?.displayName) && (
                                            <p className="text-white/40 text-xs">
                                                回复 {comment.replyTo?.handle ? `@${comment.replyTo.handle}` : comment.replyTo?.displayName}
                                            </p>
                                        )}
                                        <p className="text-white text-sm leading-relaxed">{comment.content}</p>
                                        <p className="text-white/40 text-[10px]">{formatRelativeTime(comment.createdAt)}</p>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Footer Input */}
                        <form
                            onSubmit={handleAddComment}
                            className="p-4 border-t border-white/10 flex items-center gap-3 bg-[#1e1e1e]"
                        >
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white bg-gradient-to-tr ${app.color}`}>
                                {buildAvatarFallback({
                                    id: presenter.auth.getCurrentUser()?.id ?? 'me',
                                    handle: presenter.auth.getCurrentUser()?.handle ?? null,
                                    displayName: presenter.auth.getCurrentUser()?.displayName ?? null,
                                    avatarUrl: presenter.auth.getCurrentUser()?.avatarUrl ?? null,
                                })}
                            </div>
                            <div className="flex-1 flex flex-col gap-2">
                                {replyTo && (
                                    <div className="flex items-center justify-between text-[11px] text-white/50">
                                        <span>回复 {buildAuthorLabel(replyTo.author)}</span>
                                        <button
                                            type="button"
                                            onClick={() => setReplyTo(null)}
                                            className="text-white/40 hover:text-white/70"
                                        >
                                            取消
                                        </button>
                                    </div>
                                )}
                                <input
                                    type="text"
                                    value={newComment}
                                    onChange={(e) => setNewComment(e.target.value)}
                                    placeholder={replyTo ? '写下你的回复…' : t('explore.feed.addComment')}
                                    className="w-full bg-white/5 border-none rounded-full px-4 py-2 text-white text-sm focus:ring-1 focus:ring-white/20 placeholder:text-white/20"
                                    maxLength={500}
                                />
                            </div>
                            <button
                                type="submit"
                                disabled={!newComment.trim() || isSubmittingComment}
                                className={`text-sm font-bold transition-colors ${newComment.trim() ? 'text-[#ff0050]' : 'text-white/20'
                                    }`}
                            >
                                {isSubmittingComment ? '...' : t('explore.feed.send')}
                            </button>
                        </form>
                    </div>
                </div>
            </div>
        </div >
    );
};
