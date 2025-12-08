import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Zap, 
  Github, 
  FolderArchive, 
  FileCode, 
  ArrowRight, 
  Search,
  Star,
  User,
  Play
} from 'lucide-react';
import { useProjectStore } from '../stores/projectStore';
import { SourceType } from '../types';
import { URLS } from '../constants';
import type { Project } from '../types';

const THUMBNAIL_PATH = '/__thumbnail.png';
const DEFAULT_AUTHOR = 'Indie Hacker';
const DEFAULT_CATEGORY = 'Other';

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
    project.sourceType === SourceType.ZIP
      ? 'uploaded as a ZIP archive'
      : project.sourceType === SourceType.GITHUB
        ? 'connected from GitHub'
        : project.sourceType === SourceType.HTML
          ? 'built from inline HTML'
        : 'deployed with GemiGo';
  return `Deployed ${frameworkPart} ${sourcePart}.`;
}

function buildAuthor(project: Project): string {
  if (
    project.sourceType === SourceType.GITHUB &&
    project.repoUrl.startsWith(URLS.GITHUB_BASE)
  ) {
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
    <div className="relative w-full md:w-96 group">
      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
        <Search className="h-4 w-4 text-slate-400 group-focus-within:text-brand-500 transition-colors" />
      </div>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search apps..."
        className="w-full pl-11 pr-4 py-3 bg-slate-50 dark:bg-slate-800/50 border-none rounded-full text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:bg-white dark:focus:bg-slate-800 transition-all shadow-sm hover:shadow-md placeholder:text-slate-400"
      />
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
    <div className="flex gap-2 overflow-x-auto pb-4 pt-2 px-1 scrollbar-hide [mask-image:linear-gradient(to_right,black,black_90%,transparent)]">
      {CATEGORIES.map((cat) => {
        const isActive = cat === activeCategory;
        return (
          <button
            key={cat}
            onClick={() => handleCategoryClick(cat)}
            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all duration-200 ${
              isActive
                ? 'bg-brand-600 text-white shadow-lg shadow-brand-500/30 scale-105'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
            }`}
          >
            {cat}
          </button>
        );
      })}
    </div>
  );
};

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
  const navigate = useNavigate();

  const showThumbnail = app.thumbnailUrl && !thumbError;

  const handleLaunchApp = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (app.url) {
      window.open(app.url, '_blank', 'noopener,noreferrer');
    }
  };

  const handleTagClick = (e: React.MouseEvent, tag: string) => {
    e.stopPropagation();
    setActiveTag((current) => (current === tag ? null : tag));
  };

  const handleCardClick = () => {
    navigate(`/projects/${encodeURIComponent(app.id)}`);
  };

  return (
    <div 
      className="group relative flex flex-col bg-white dark:bg-slate-800/40 backdrop-blur-sm rounded-2xl border border-slate-200 dark:border-slate-700/60 overflow-hidden hover:shadow-2xl hover:shadow-brand-500/10 dark:hover:shadow-black/50 transition-all duration-300 hover:-translate-y-1 h-full cursor-pointer"
      onClick={handleCardClick}
    >
      <div className="relative aspect-video overflow-hidden bg-slate-100 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-700/30 group-hover:border-transparent transition-colors">
        {showThumbnail ? (
        <>
          {!thumbLoaded && (
              <div className="absolute inset-0 animate-pulse bg-slate-200 dark:bg-slate-800" />
          )}
          <img
            src={app.thumbnailUrl}
            alt={app.name}
            loading="lazy"
            onLoad={() => setThumbLoaded(true)}
            onError={() => setThumbError(true)}
              className={`absolute inset-0 w-full h-full object-cover transition-all duration-500 group-hover:scale-105 ${
              thumbLoaded ? 'opacity-100' : 'opacity-0'
            }`}
          />
        </>
        ) : (
          <div className={`absolute inset-0 bg-gradient-to-br ${app.color} opacity-20`} />
        )}
        
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 dark:group-hover:bg-black/20 transition-colors duration-300" />

        <div className="absolute top-3 right-3 z-10">
          <div className="px-2.5 py-1 rounded-full bg-white/90 dark:bg-slate-900/80 backdrop-blur-md text-slate-900 dark:text-white text-[10px] font-bold border border-white/20 shadow-sm flex items-center gap-1">
             <span>⚡</span> {app.cost}
          </div>
        </div>
        </div>

      <div className="flex flex-col flex-1 p-5">
        <div className="flex items-start justify-between mb-3 gap-3">
           <div className="flex items-center gap-3 min-w-0">
               <div className={`w-10 h-10 shrink-0 rounded-xl flex items-center justify-center text-white shadow-sm bg-gradient-to-br ${app.color}`}>
                   <Zap className="w-5 h-5" />
               </div>
               <div className="min-w-0">
                   <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base leading-tight truncate group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">
                     {app.name}
                   </h3>
                   <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-0.5 truncate">
              <User className="w-3 h-3" /> {app.author}
            </div>
               </div>
            </div>
          </div>

        <p className="text-sm text-slate-600 dark:text-slate-300/90 line-clamp-2 mb-4 flex-1 leading-relaxed">
          {app.description}
        </p>

          {app.tags && app.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-4">
            {app.tags.slice(0, 2).map((tag) => (
                  <button
                    key={tag}
                onClick={(e) => handleTagClick(e, tag)}
                className={`px-2 py-0.5 rounded-md text-[10px] font-medium transition-colors border ${
                  tag === activeTag
                    ? 'bg-brand-50 text-brand-700 border-brand-200 dark:bg-brand-900/30 dark:text-brand-300 dark:border-brand-700'
                    : 'bg-slate-50 text-slate-600 border-slate-100 hover:bg-slate-100 dark:bg-slate-800/50 dark:text-slate-400 dark:border-slate-700 dark:hover:bg-slate-800'
                    }`}
                  >
                    #{tag}
                  </button>
            ))}
            </div>
          )}

        <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-700/50 mt-auto">
           <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 font-medium">
               <div className="flex items-center gap-1">
                   <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" /> 
                   <span className="text-slate-700 dark:text-slate-300">{app.rating}</span>
               </div>
               <span className="text-slate-300 dark:text-slate-600">•</span>
               <span>{app.installs}</span>
           </div>
           
           <button 
             onClick={handleLaunchApp} 
             className="text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300 text-sm font-bold flex items-center gap-1 group/btn px-3 py-1.5 rounded-lg hover:bg-brand-50 dark:hover:bg-brand-900/20 transition-all"
           >
               Open <Play className="w-3 h-3 fill-current transition-transform group-hover/btn:translate-x-0.5" />
           </button>
        </div>
      </div>
    </div>
  );
};

const ExploreSkeletonGrid: React.FC = () => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {Array.from({ length: 6 }).map((_, idx) => (
        <div
          key={idx}
          className="flex flex-col rounded-2xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900/40 overflow-hidden animate-pulse"
        >
          <div className="h-44 bg-slate-100 dark:bg-slate-800" />
          <div className="p-5 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-slate-200 dark:bg-slate-700" />
              <div className="space-y-2 flex-1">
                <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-3/4" />
                <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded w-1/2" />
              </div>
            </div>
            <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded w-full" />
            <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded w-5/6" />
            <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
              <div className="w-24 h-3 bg-slate-100 dark:bg-slate-800 rounded" />
              <div className="w-16 h-3 bg-slate-200 dark:bg-slate-700 rounded" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export const Home: React.FC = () => {
  const projects = useProjectStore((state) => state.projects);
  const isLoadingProjects = useProjectStore((state) => state.isLoading);
  const navigate = useNavigate();
  // Only show public projects on the marketing / explore surfaces.
  const publicProjects = projects.filter(
    (p) => p.isPublic === undefined || p.isPublic === true,
  );
  const apps = mapProjectsToApps(publicProjects);
  const [activeCategory, setActiveCategory] = useState<CategoryFilter>('All Apps');
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredApps = useMemo(
    () => filterApps(apps, activeCategory, activeTag, searchQuery),
    [apps, activeCategory, activeTag, searchQuery],
  );

  const handleQuickDeploy = (sourceType: SourceType) => {
    navigate('/deploy', { state: { sourceType } });
  };

  return (
    <div className="min-h-screen bg-app-bg">
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-6 md:py-8 space-y-8">
        
        {/* Deploy Section - Top */}
        <section className="glass-card rounded-2xl p-6 md:p-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
                Deploy Your App
              </h2>
              <p className="text-slate-600 dark:text-gray-400">
                Choose your deployment method
              </p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button
              onClick={() => handleQuickDeploy(SourceType.GITHUB)}
              className="group relative p-6 rounded-xl border-2 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-purple-500 dark:hover:border-purple-500 hover:shadow-lg transition-all text-left"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="p-3 rounded-lg bg-purple-100 dark:bg-purple-900/40 group-hover:bg-purple-200 dark:group-hover:bg-purple-900/60 transition-colors">
                  <Github className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                </div>
                <ArrowRight className="w-5 h-5 text-slate-400 group-hover:text-purple-500 group-hover:translate-x-1 transition-all" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
                GitHub Repository
              </h3>
              <p className="text-sm text-slate-600 dark:text-gray-400">
                Connect your GitHub repo and deploy automatically
              </p>
            </button>

            <button
              onClick={() => handleQuickDeploy(SourceType.ZIP)}
              className="group relative p-6 rounded-xl border-2 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-blue-500 dark:hover:border-blue-500 hover:shadow-lg transition-all text-left"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="p-3 rounded-lg bg-blue-100 dark:bg-blue-900/40 group-hover:bg-blue-200 dark:group-hover:bg-blue-900/60 transition-colors">
                  <FolderArchive className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                </div>
                <ArrowRight className="w-5 h-5 text-slate-400 group-hover:text-blue-500 group-hover:translate-x-1 transition-all" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
                Upload Archive
              </h3>
              <p className="text-sm text-slate-600 dark:text-gray-400">
                Upload a ZIP file and deploy instantly
              </p>
            </button>

            <button
              onClick={() => handleQuickDeploy(SourceType.HTML)}
              className="group relative p-6 rounded-xl border-2 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-green-500 dark:hover:border-green-500 hover:shadow-lg transition-all text-left"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="p-3 rounded-lg bg-green-100 dark:bg-green-900/40 group-hover:bg-green-200 dark:group-hover:bg-green-900/60 transition-colors">
                  <FileCode className="w-6 h-6 text-green-600 dark:text-green-400" />
                </div>
                <ArrowRight className="w-5 h-5 text-slate-400 group-hover:text-green-500 group-hover:translate-x-1 transition-all" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
                Inline HTML
              </h3>
              <p className="text-sm text-slate-600 dark:text-gray-400">
                Paste HTML code and deploy in seconds
              </p>
            </button>
          </div>
        </section>

        {/* Explore Section - Bottom */}
        <section>
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-6">
            <div>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
                Explore Apps
              </h2>
              <p className="text-slate-600 dark:text-gray-400">
                Discover applications from the community
              </p>
            </div>
            <SearchBar value={searchQuery} onChange={setSearchQuery} />
          </div>

          <CategoryFilter
            activeCategory={activeCategory}
            onCategoryChange={setActiveCategory}
            onTagReset={() => setActiveTag(null)}
          />

          {isLoadingProjects ? (
            <ExploreSkeletonGrid />
          ) : filteredApps.length > 0 ? (
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
          ) : (
            <div className="glass-card rounded-xl p-12 text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                <Search className="w-8 h-8 text-slate-400" />
              </div>
              <h4 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
                No apps found
              </h4>
              <p className="text-sm text-slate-600 dark:text-gray-400">
                Try adjusting your search or filter criteria
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
