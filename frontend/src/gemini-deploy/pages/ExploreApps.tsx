import { Play, Search, Star, TrendingUp, User, Zap } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { URLS } from '../constants';
import { useProjectStore } from '../stores/projectStore';
import type { Project } from '../types';

const THUMBNAIL_PATH = '/__thumbnail.png';
const DEFAULT_AUTHOR = 'Indie Hacker';
const DEFAULT_CATEGORY = 'Other';
const CREATOR_REVENUE_SHARE = 70;
const BETA_BADGE_TEXT = 'Beta';
const THUMBNAIL_HEIGHT = 'h-24';

export type CategoryFilter =
  | 'All Apps'
  | 'Development'
  | 'Image Gen'
  | 'Productivity'
  | 'Marketing'
  | 'Legal'
  | 'Fun'
  | 'Other';

export const CATEGORIES: readonly CategoryFilter[] = [
  'All Apps',
  'Development',
  'Image Gen',
  'Productivity',
  'Marketing',
  'Legal',
  'Fun',
  'Other',
] as const;

interface AppMeta {
  cost: number;
  category: string;
  rating: number;
  installs: string;
  color: string;
}

const APP_META: readonly AppMeta[] = [
  {
    cost: 5,
    category: 'Development',
    rating: 4.8,
    installs: '12k',
    color: 'from-blue-500 to-cyan-400',
  },
  {
    cost: 12,
    category: 'Image Gen',
    rating: 4.9,
    installs: '8.5k',
    color: 'from-purple-500 to-pink-500',
  },
  {
    cost: 8,
    category: 'Productivity',
    rating: 4.6,
    installs: '5k',
    color: 'from-emerald-500 to-teal-400',
  },
  {
    cost: 3,
    category: 'Marketing',
    rating: 4.5,
    installs: '15k',
    color: 'from-orange-500 to-amber-400',
  },
  {
    cost: 20,
    category: 'Legal',
    rating: 4.9,
    installs: '2k',
    color: 'from-slate-600 to-slate-400',
  },
  {
    cost: 10,
    category: 'Development',
    rating: 4.7,
    installs: '4.2k',
    color: 'from-indigo-500 to-violet-500',
  },
] as const;

interface ExploreAppCard {
  id: string;
  name: string;
  description: string;
  author: string;
  cost: number;
  category: string;
  rating: number;
  installs: string;
  color: string;
  url?: string;
  tags?: string[];
  thumbnailUrl?: string;
}

function buildDescription(project: Project): string {
  const frameworkPart =
    project.framework === 'Unknown' ? 'AI app' : `${project.framework} app`;
  const sourcePart =
    project.sourceType === 'zip'
      ? 'uploaded as a ZIP archive'
      : project.sourceType === 'github'
        ? 'connected from GitHub'
        : 'deployed with GemiGo';
  return `Deployed ${frameworkPart} ${sourcePart}.`;
}

function buildAuthor(project: Project): string {
  if (project.sourceType === 'github' && project.repoUrl.startsWith(URLS.GITHUB_BASE)) {
    const rest = project.repoUrl.replace(URLS.GITHUB_BASE, '');
    const owner = rest.split('/')[0];
    if (owner) return owner;
  }
  return DEFAULT_AUTHOR;
}

function buildThumbnailUrl(projectUrl: string): string | undefined {
  try {
    const url = new URL(projectUrl, window.location.origin);
    url.pathname = THUMBNAIL_PATH;
    url.search = '';
    url.hash = '';
    return url.toString();
  } catch {
    return undefined;
  }
}

function getProjectCategory(project: Project): string {
  return project.category && project.category.trim().length > 0
    ? project.category
    : DEFAULT_CATEGORY;
}

function getProjectDescription(project: Project): string {
  return project.description && project.description.trim().length > 0
    ? project.description
    : buildDescription(project);
}

function mapProjectsToApps(projects: Project[]): ExploreAppCard[] {
  return projects.map((project, index) => {
    const meta = APP_META[index % APP_META.length];
    const category = getProjectCategory(project);
    const description = getProjectDescription(project);
    const thumbnailUrl = project.url ? buildThumbnailUrl(project.url) : undefined;

    return {
      id: project.id,
      name: project.name,
      description,
      author: buildAuthor(project),
      cost: meta.cost,
      category,
      rating: meta.rating,
      installs: meta.installs,
      color: meta.color,
      url: project.url,
      tags: project.tags,
      thumbnailUrl,
    };
  });
}

interface ExploreAppCardViewProps {
  app: ExploreAppCard;
  activeTag: string | null;
  setActiveTag: React.Dispatch<React.SetStateAction<string | null>>;
}

const ExploreAppCardView: React.FC<ExploreAppCardViewProps> = ({
  app,
  activeTag,
  setActiveTag,
}) => {
  const [thumbLoaded, setThumbLoaded] = useState(false);
  const [thumbError, setThumbError] = useState(false);

  const showThumbnail = app.thumbnailUrl && !thumbError;

  const handleLaunchApp = () => {
    if (app.url) {
      window.open(app.url, '_blank', 'noopener,noreferrer');
    }
  };

  const handleTagClick = (tag: string) => {
    setActiveTag((current) => (current === tag ? null : tag));
  };

  return (
    <div className="glass-card rounded-xl p-5 hover:shadow-xl hover:scale-[1.01] transition-all duration-300 group">
      {showThumbnail ? (
        <div className="mb-4">
          {!thumbLoaded && (
            <div
              className={`${THUMBNAIL_HEIGHT} w-full rounded-lg bg-slate-200 dark:bg-slate-800 animate-pulse`}
            />
          )}
          <img
            src={app.thumbnailUrl}
            alt={app.name}
            loading="lazy"
            onLoad={() => setThumbLoaded(true)}
            onError={() => setThumbError(true)}
            className={`w-full ${THUMBNAIL_HEIGHT} object-cover rounded-lg transition-opacity ${
              thumbLoaded ? 'opacity-100' : 'opacity-0'
            }`}
          />
        </div>
      ) : (
        <div className="flex justify-between items-start mb-4 gap-3">
          <div className="flex items-center gap-3">
            <div
              className={`w-14 h-14 rounded-xl bg-gradient-to-br ${app.color} flex items-center justify-center text-white shadow-lg`}
            >
              <Zap className="w-7 h-7" />
            </div>
            <span className="text-[11px] text-slate-400 dark:text-gray-500">
              Preview not available yet
            </span>
          </div>
          <div className="bg-slate-100 dark:bg-white/5 px-2 py-1 rounded-lg flex items-center gap-1 text-xs font-semibold text-slate-600 dark:text-gray-300 border border-slate-200 dark:border-white/5">
            <span className="text-amber-500">⚡</span> {app.cost} Credits
          </div>
        </div>
      )}

      <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1 group-hover:text-brand-500 transition-colors">
        {app.name}
      </h3>
      <p className="text-sm text-slate-500 dark:text-gray-400 mb-4 h-10 line-clamp-2 leading-relaxed">
        {app.description}
      </p>

      <div className="mb-4 pb-4 border-b border-slate-100 dark:border-white/5 space-y-2">
        <div className="flex items-center gap-4 text-xs text-slate-400 dark:text-gray-500">
          <div className="flex items-center gap-1">
            <User className="w-3 h-3" /> {app.author}
          </div>
          <div className="flex items-center gap-1">
            <Star className="w-3 h-3 text-amber-400 fill-amber-400" /> {app.rating}
          </div>
          <div>{app.installs} uses</div>
        </div>

        {app.tags && app.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {app.tags.map((tag) => {
              const isActiveTag = tag === activeTag;
              return (
                <button
                  key={tag}
                  onClick={() => handleTagClick(tag)}
                  className={`px-2 py-0.5 rounded-full text-[10px] font-medium border transition-colors ${
                    isActiveTag
                      ? 'bg-brand-600 text-white border-brand-500'
                      : 'bg-slate-50 dark:bg-white/5 text-slate-500 dark:text-gray-400 border-slate-200 dark:border-white/10 hover:border-brand-500/50'
                  }`}
                >
                  #{tag}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <button
        onClick={handleLaunchApp}
        className="w-full py-2.5 rounded-lg border border-slate-200 dark:border-white/10 text-slate-700 dark:text-gray-300 font-medium text-sm hover:bg-brand-500 hover:text-white hover:border-brand-500 transition-all flex items-center justify-center gap-2 group-hover:shadow-lg group-hover:shadow-brand-500/20"
      >
        <Play className="w-4 h-4 fill-current" /> Launch App
      </button>
    </div>
  );
};

function matchesCategory(app: ExploreAppCard, category: CategoryFilter): boolean {
  return category === 'All Apps' || app.category === category;
}

function matchesTag(app: ExploreAppCard, tag: string | null): boolean {
  if (!tag) return true;
  const tags = app.tags ?? [];
  return tags.includes(tag);
}

function matchesSearchQuery(app: ExploreAppCard, query: string): boolean {
  if (!query) return true;
  const searchableText = [
    app.name,
    app.description,
    app.author,
    ...(app.tags ?? []),
  ]
    .join(' ')
    .toLowerCase();
  return searchableText.includes(query.toLowerCase());
}

function filterApps(
  apps: ExploreAppCard[],
  category: CategoryFilter,
  tag: string | null,
  searchQuery: string,
): ExploreAppCard[] {
  const query = searchQuery.trim();
  return apps.filter(
    (app) =>
      matchesCategory(app, category) &&
      matchesTag(app, tag) &&
      matchesSearchQuery(app, query),
  );
}

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
}

const SearchBar: React.FC<SearchBarProps> = ({ value, onChange }) => {
  return (
    <div className="relative w-full md:w-96">
      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
        <Search className="h-5 w-5 text-slate-400" />
      </div>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search for AI apps..."
        className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all shadow-sm placeholder:text-slate-400 dark:placeholder:text-gray-500"
      />
    </div>
  );
};

interface FeaturedBannerProps {
  onNavigateToDeploy: () => void;
}

const FeaturedBanner: React.FC<FeaturedBannerProps> = ({ onNavigateToDeploy }) => {
  return (
    <div className="relative rounded-2xl overflow-hidden bg-slate-900 text-white p-8 md:p-12">
      <div className="absolute top-0 right-0 w-96 h-96 bg-brand-500/30 blur-3xl rounded-full -translate-y-1/2 translate-x-1/3" />
      <div className="absolute bottom-0 left-0 w-64 h-64 bg-purple-500/30 blur-3xl rounded-full translate-y-1/3 -translate-x-1/3" />

      <div className="relative z-10 max-w-2xl">
        <div className="flex items-center gap-2 mb-4 text-brand-300 font-medium">
          <TrendingUp className="w-5 h-5" />
          <span>Top Trending</span>
        </div>
        <h3 className="text-4xl font-extrabold mb-4 leading-tight">
          Monetize Your AI Models
        </h3>
        <p className="text-slate-300 text-lg mb-8">
          Publish your Gemini-powered applications to the marketplace. You earn{' '}
          {CREATOR_REVENUE_SHARE}% of the credit revenue every time someone uses your app.
        </p>
        <button
          onClick={onNavigateToDeploy}
          className="bg-white text-slate-900 px-6 py-3 rounded-xl font-bold hover:bg-slate-100 transition-colors"
        >
          Become a Creator
        </button>
      </div>
    </div>
  );
};

interface CategoryFilterProps {
  activeCategory: CategoryFilter;
  onCategoryChange: (category: CategoryFilter) => void;
  onTagReset: () => void;
}

const CategoryFilter: React.FC<CategoryFilterProps> = ({
  activeCategory,
  onCategoryChange,
  onTagReset,
}) => {
  const handleCategoryClick = (category: CategoryFilter) => {
    onCategoryChange(category);
    onTagReset();
  };

  return (
    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
      {CATEGORIES.map((cat) => {
        const isActive = cat === activeCategory;
        return (
          <button
            key={cat}
            onClick={() => handleCategoryClick(cat)}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              isActive
                ? 'bg-brand-600 text-white shadow-lg shadow-brand-500/20'
                : 'bg-white dark:bg-white/5 text-slate-600 dark:text-gray-300 hover:bg-slate-50 dark:hover:bg-white/10 border border-slate-200 dark:border-white/5'
            }`}
          >
            {cat}
          </button>
        );
      })}
    </div>
  );
};

export const ExploreApps: React.FC = () => {
  const projects = useProjectStore((state) => state.projects);
  const navigate = useNavigate();
  const apps = mapProjectsToApps(projects);
  const [activeCategory, setActiveCategory] = useState<CategoryFilter>('All Apps');
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredApps = useMemo(
    () => filterApps(apps, activeCategory, activeTag, searchQuery),
    [apps, activeCategory, activeTag, searchQuery],
  );

  const handleNavigateToDeploy = () => {
    navigate('/deploy');
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 animate-fade-in">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h2 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-3">
            Explore Apps{' '}
            <span className="bg-brand-100 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400 text-xs px-2 py-1 rounded-full border border-brand-200 dark:border-brand-500/20">
              {BETA_BADGE_TEXT}
            </span>
          </h2>
          <p className="text-slate-500 dark:text-gray-400 mt-1">
            Discover AI tools built by the community. Spend credits, support creators.
          </p>
        </div>
        <SearchBar value={searchQuery} onChange={setSearchQuery} />
      </div>

      <FeaturedBanner onNavigateToDeploy={handleNavigateToDeploy} />

      <CategoryFilter
        activeCategory={activeCategory}
        onCategoryChange={setActiveCategory}
        onTagReset={() => setActiveTag(null)}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredApps.map((app) => (
          <ExploreAppCardView
            key={app.id}
            app={app}
            activeTag={activeTag}
            setActiveTag={setActiveTag}
          />
        ))}
      </div>
    </div>
  );
};
