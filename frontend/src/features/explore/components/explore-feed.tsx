import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Heart, MessageCircle, Star, Share2, Play, X, ChevronLeft } from 'lucide-react';
import type { ExploreAppCard } from '@/components/explore-app-card';
import { usePresenter } from '@/contexts/presenter-context';
import { useReactionStore } from '@/stores/reaction.store';

interface ExploreFeedProps {
    apps: ExploreAppCard[];
    onToggleView: () => void;
}

interface Comment {
    id: string;
    author: string;
    avatar: string;
    text: string;
    timestamp: string;
    likes: number;
}

const MOCK_COMMENTS: Comment[] = [
    { id: '1', author: 'AI_Master', avatar: 'A', text: '这个应用太强了！简直是生产力神器。', timestamp: '2小时前', likes: 124 },
    { id: '2', author: 'DesignExplorer', avatar: 'D', text: 'UI 设计得很高级，毛玻璃效果很有质感。', timestamp: '5小时前', likes: 89 },
    { id: '3', author: 'CodeRunner', avatar: 'C', text: '希望能增加更多的主题选择！', timestamp: '1天前', likes: 45 },
    { id: '4', author: 'Gemigo_Fan', avatar: 'G', text: '这就是我一直在找的工具。', timestamp: '2天前', likes: 231 },
];

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
                className={`fixed top-0 left-0 right-0 z-[110] px-6 h-20 flex items-center justify-between transition-all duration-500 ease-in-out bg-gradient-to-b from-black/60 to-transparent ${showHeader ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-full pointer-events-none'
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
    const [comments, setComments] = useState<Comment[]>(MOCK_COMMENTS);
    const [newComment, setNewComment] = useState('');
    const iframeRef = useRef<HTMLIFrameElement>(null);

    const likesCount = reactionEntry?.likesCount ?? 0;
    const isLiked = reactionEntry?.likedByCurrentUser ?? false;
    const favoritesCount = reactionEntry?.favoritesCount ?? 0;
    const isFavorited = reactionEntry?.favoritedByCurrentUser ?? false;

    const handleAddComment = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newComment.trim()) return;

        const comment: Comment = {
            id: Date.now().toString(),
            author: 'You',
            avatar: 'U',
            text: newComment,
            timestamp: '刚刚',
            likes: 0,
        };

        setComments([comment, ...comments]);
        setNewComment('');
    };

    // Reset enter state when moving away
    useEffect(() => {
        if (!isActive && isEntered) {
            setIsEntered(false);
            onEnterStateChange(false);
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
                <div className="h-16 w-full flex items-center justify-between px-4 bg-black/40 backdrop-blur-lg border-b border-white/10 z-50">
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
                                className="w-full h-full object-cover transition-transform duration-500 scale-[0.98] rounded-xl opacity-80"
                            />
                        ) : (
                            <div className={`w-full h-full flex items-center justify-center bg-gradient-to-br ${app.color} scale-[0.98] rounded-xl`}>
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
                        className="absolute inset-0 z-10 cursor-pointer bg-black/40 backdrop-blur-[1px] flex flex-col items-center justify-center group transition-all duration-300"
                        onClick={handleEnter}
                    >
                        {isRendered && (
                            <>
                                <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center border-2 border-white/40 group-hover:scale-110 transition-transform duration-300">
                                    <Play className="w-10 h-10 text-white fill-current translate-x-1" />
                                </div>
                                <p className="mt-4 text-white font-bold text-lg drop-shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                    {t('common.clickToEnter')}
                                </p>
                            </>
                        )}
                    </div>
                )}

                {/* TikTok-style UI Overlay (Info remains visible or fades partially) */}
                <div className={`absolute inset-0 pointer-events-none z-10 flex flex-col justify-end p-6 bg-gradient-to-t from-black/80 via-transparent to-transparent transition-all duration-500 ${isEntered ? 'opacity-40 -translate-y-4' : 'opacity-100 translate-y-0'
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
                            onClick={() => setIsCommentsOpen(true)}
                        >
                            <MessageCircle className="w-8 h-8 text-white fill-white/20" />
                        </div>
                        <span className="text-white text-xs font-semibold drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                            {comments.length + 852}
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
                        onClick={() => setIsCommentsOpen(false)}
                    />

                    {/* Drawer Content */}
                    <div
                        className={`absolute bottom-0 left-0 right-0 w-full max-h-[60%] bg-[#121212] rounded-t-2xl flex flex-col transition-transform duration-300 ease-out border-t border-white/10 ${isCommentsOpen ? 'translate-y-0' : 'translate-y-full'
                            }`}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between p-4 border-b border-white/5">
                            <div className="w-8" />
                            <h4 className="text-white font-bold text-sm">{t('explore.feed.commentsCount', { count: comments.length + 852 })}</h4>
                            <button
                                onClick={() => setIsCommentsOpen(false)}
                                className="w-8 h-8 flex items-center justify-center text-white/60 hover:text-white"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Comment List */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-6">
                            {comments.map((comment) => (
                                <div key={comment.id} className="flex gap-3">
                                    <div className={`w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-xs font-bold text-white shadow-inner ${comment.author === 'You' ? `bg-gradient-to-tr ${app.color}` : 'bg-slate-700'
                                        }`}>
                                        {comment.avatar}
                                    </div>
                                    <div className="flex-1 space-y-1">
                                        <div className="flex items-center justify-between">
                                            <span className="text-white/60 text-xs font-bold">{comment.author}</span>
                                            <div className="flex flex-col items-center gap-0.5">
                                                <Heart className="w-3.5 h-3.5 text-white/40" />
                                                <span className="text-[10px] text-white/40">{comment.likes}</span>
                                            </div>
                                        </div>
                                        <p className="text-white text-sm leading-relaxed">{comment.text}</p>
                                        <p className="text-white/40 text-[10px]">{comment.timestamp}</p>
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
                                U
                            </div>
                            <input
                                type="text"
                                value={newComment}
                                onChange={(e) => setNewComment(e.target.value)}
                                placeholder={t('explore.feed.addComment')}
                                className="flex-1 bg-white/5 border-none rounded-full px-4 py-2 text-white text-sm focus:ring-1 focus:ring-white/20 placeholder:text-white/20"
                            />
                            <button
                                type="submit"
                                disabled={!newComment.trim()}
                                className={`text-sm font-bold transition-colors ${newComment.trim() ? 'text-[#ff0050]' : 'text-white/20'
                                    }`}
                            >
                                {t('explore.feed.send')}
                            </button>
                        </form>
                    </div>
                </div>
            </div>
        </div >
    );
};


