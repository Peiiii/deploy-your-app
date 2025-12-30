import React, { useState, useRef, useEffect } from 'react';
import type { InstalledApp } from './App';

interface ExploreFeedProps {
    apps: InstalledApp[];
    onInstall: (app: InstalledApp) => void;
    installedApps: InstalledApp[];
}

export const ExploreFeed: React.FC<ExploreFeedProps> = ({ apps, onInstall, installedApps }) => {
    const [activeIndex, setActiveIndex] = useState(0);
    const containerRef = useRef<HTMLDivElement>(null);

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
            { threshold: 0.6 }
        );

        const items = containerRef.current?.querySelectorAll('.feed-item');
        items?.forEach((item) => observer.observe(item));

        return () => observer.disconnect();
    }, [apps.length]);

    return (
        <div className="explore-feed" ref={containerRef}>
            {apps.map((app, index) => {
                const isVisible = Math.abs(index - activeIndex) <= 1;
                const isActive = index === activeIndex;

                return (
                    <div key={app.id} className="feed-item" data-index={index}>
                        <FeedItem
                            app={app}
                            onInstall={onInstall}
                            isInstalled={installedApps.some((installed) => installed.url === app.url)}
                            isRendered={isVisible}
                            isActive={isActive}
                        />
                    </div>
                );
            })}
        </div>
    );
};

interface FeedItemProps {
    app: InstalledApp;
    onInstall: (app: InstalledApp) => void;
    isInstalled: boolean;
    isRendered: boolean;
    isActive: boolean;
}

const FeedItem: React.FC<FeedItemProps> = ({ app, onInstall, isInstalled, isRendered, isActive }) => {
    const [isEntered, setIsEntered] = useState(false);
    const iframeRef = useRef<HTMLIFrameElement>(null);

    useEffect(() => {
        if (!isActive) setIsEntered(false);
    }, [isActive]);

    const handleEnter = () => {
        setIsEntered(true);
    };

    const handleExit = (e: React.MouseEvent) => {
        e.stopPropagation();
        setIsEntered(false);
    };

    return (
        <div className={`feed-item-inner ${isEntered ? 'entered' : ''}`}>
            <div className="feed-item-container">
                {/* Iframe or Thumbnail/Placeholder */}
                {isRendered && isEntered ? (
                    <iframe
                        ref={iframeRef}
                        src={app.url}
                        className="feed-item-iframe"
                        sandbox="allow-scripts allow-same-origin allow-forms"
                        title={app.name}
                    />
                ) : (
                    <div className="feed-item-placeholder" style={{ background: app.iconBg }}>
                        {app.thumbnailUrl ? (
                            <img
                                src={app.thumbnailUrl}
                                alt={app.name}
                                className="feed-thumbnail opacity-80"
                            />
                        ) : (
                            <div className="placeholder-text">{app.icon}</div>
                        )}
                    </div>
                )}

                {!isEntered && (
                    <div className="feed-item-shield" onClick={handleEnter}>
                        {isRendered && (
                            <>
                                <div className="play-icon"></div>
                                <div className="shield-hint">点击进入应用</div>
                            </>
                        )}
                    </div>
                )}

                {/* TikTok-style UI Overlay */}
                <div className={`feed-ui-overlay ${isEntered ? 'hidden-ui' : ''}`}>
                    {/* Bottom Info */}
                    <div className="feed-info-bottom">
                        <h3 className="feed-app-handle">@{app.author || 'user'}</h3>
                        <p className="feed-app-desc">{app.description}</p>
                    </div>

                    {/* Sidebar Actions */}
                    <div className="feed-sidebar">
                        <div className="feed-action-item">
                            <div className="feed-avatar-wrapper">
                                <div className="feed-avatar" style={{ background: app.iconBg }}>
                                    {app.icon}
                                </div>
                                <button
                                    className={`feed-follow-btn ${isInstalled ? 'installed' : ''}`}
                                    onClick={() => !isInstalled && onInstall(app)}
                                >
                                    {isInstalled ? '✓' : '+'}
                                </button>
                            </div>
                        </div>

                        <div className="feed-action-item">
                            <div className="feed-icon-btn">❤️</div>
                            <span className="feed-count">
                                {app.likesCount && app.likesCount > 0 ? (app.likesCount > 1000 ? `${(app.likesCount / 1000).toFixed(1)}k` : app.likesCount) : '0'}
                            </span>
                        </div>

                        <div className="feed-action-item">
                            <div className="feed-icon-btn">💬</div>
                            <span className="feed-count">0</span>
                        </div>

                        <div className="feed-action-item">
                            <div className="feed-icon-btn">⭐</div>
                            <span className="feed-count">
                                {app.favoritesCount && app.favoritesCount > 0 ? (app.favoritesCount > 1000 ? `${(app.favoritesCount / 1000).toFixed(1)}k` : app.favoritesCount) : '0'}
                            </span>
                        </div>

                        <div className="feed-action-item">
                            <div className="feed-icon-btn">🔗</div>
                            <span className="feed-count">分享</span>
                        </div>
                    </div>
                </div>

                {isEntered && (
                    <div className="feed-header-minimal">
                        <button className="feed-exit-btn" onClick={handleExit} title="Exit Interaction">
                            <span>✕</span> 退出互动
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};
