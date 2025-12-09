import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  Github,
  FolderArchive,
  FileCode,
  ArrowRight,
  Search,
  TrendingUp,
  Clock,
} from 'lucide-react';
import type { ExploreAppCard } from '../components/ExploreAppCard';
import {
  ExploreAppCardView,
  mapProjectsToApps,
} from '../components/ExploreAppCard';
import { usePresenter } from '../contexts/PresenterContext';
import { useProjectStore } from '../stores/projectStore';
import { useReactionStore } from '../stores/reactionStore';
import { SourceType } from '../types';

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
  const { t } = useTranslation();
  return (
    <div className="relative w-full md:w-96 group">
      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
        <Search className="h-4 w-4 text-slate-400 group-focus-within:text-brand-500 transition-colors" />
      </div>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={t('explore.searchApps')}
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
  const { t } = useTranslation();
  const handleCategoryClick = (category: CategoryFilter) => {
    onCategoryChange(category);
    onTagReset();
  };

  const getCategoryLabel = (cat: CategoryFilter): string => {
    const categoryMap: Record<CategoryFilter, string> = {
      'All Apps': t('explore.allApps'),
      'Development': t('explore.development'),
      'Image Gen': t('explore.imageGen'),
      'Productivity': t('explore.productivity'),
      'Marketing': t('explore.marketing'),
      'Legal': t('explore.legal'),
      'Fun': t('explore.fun'),
      'Other': t('explore.other'),
    };
    return categoryMap[cat] || cat;
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
            {getCategoryLabel(cat)}
          </button>
        );
      })}
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

export type SortOption = 'popularity' | 'recent';

export const Home: React.FC = () => {
  const { t } = useTranslation();
  const projects = useProjectStore((state) => state.projects);
  const isLoadingProjects = useProjectStore((state) => state.isLoading);
  const navigate = useNavigate();
  const presenter = usePresenter();
  const reactionByProject = useReactionStore((s) => s.byProjectId);
  // Only show public projects on the marketing / explore surfaces.
  const publicProjects = projects.filter(
    (p) => p.isPublic === undefined || p.isPublic === true,
  );
  const apps = mapProjectsToApps(publicProjects, APP_META);
  const [activeCategory, setActiveCategory] = useState<CategoryFilter>('All Apps');
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('popularity');

  const filteredApps = useMemo(
    () => filterApps(apps, activeCategory, activeTag, searchQuery),
    [apps, activeCategory, activeTag, searchQuery],
  );

  const sortedApps = useMemo(() => {
    const appsWithProjectData = filteredApps.map((app) => {
      const project = publicProjects.find((p) => p.id === app.id);
      const reactions = reactionByProject[app.id];
      const likesCount = reactions?.likesCount ?? 0;
      const favoritesCount = reactions?.favoritesCount ?? 0;
      return {
        app,
        project,
        likesCount,
        favoritesCount,
        popularityScore: likesCount + favoritesCount * 1.5,
        lastDeployed: project?.lastDeployed ? new Date(project.lastDeployed).getTime() : 0,
      };
    });

    if (sortBy === 'popularity') {
      return appsWithProjectData
        .sort((a, b) => {
          if (b.popularityScore !== a.popularityScore) {
            return b.popularityScore - a.popularityScore;
          }
          return b.likesCount - a.likesCount;
        })
        .map((item) => item.app);
    } else {
      return appsWithProjectData
        .sort((a, b) => b.lastDeployed - a.lastDeployed)
        .map((item) => item.app);
    }
  }, [filteredApps, sortBy, publicProjects, reactionByProject]);

  const handleQuickDeploy = (sourceType: SourceType) => {
    navigate('/deploy', { state: { sourceType } });
  };

  // Preload reactions for all public projects (needed for sorting by popularity)
  React.useEffect(() => {
    publicProjects.forEach((project) => {
      if (!reactionByProject[project.id]) {
        presenter.reaction.loadReactionsForProject(project.id);
      }
    });
  }, [publicProjects, presenter.reaction, reactionByProject]);

  return (
    <div className="min-h-screen bg-app-bg">
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-6 md:py-8 space-y-8">
        
        {/* Deploy Section - Top */}
        <section className="glass-card rounded-2xl p-6 md:p-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
                {t('deployment.deployYourApp')}
              </h2>
              <p className="text-slate-600 dark:text-gray-400">
                {t('deployment.chooseDeploymentMethod')}
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
                {t('deployment.githubRepository')}
              </h3>
              <p className="text-sm text-slate-600 dark:text-gray-400">
                {t('deployment.connectGitHubRepo')}
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
                {t('deployment.uploadArchive')}
              </h3>
              <p className="text-sm text-slate-600 dark:text-gray-400">
                {t('deployment.uploadZipFile')}
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
                {t('deployment.inlineHTML')}
              </h3>
              <p className="text-sm text-slate-600 dark:text-gray-400">
                {t('deployment.pasteHTML')}
              </p>
            </button>
          </div>
        </section>

        {/* Explore Section - Bottom */}
        <section>
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-6">
            <div>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
                {t('explore.exploreApps')}
              </h2>
              <p className="text-slate-600 dark:text-gray-400">
                {t('explore.discoverApps')}
              </p>
            </div>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 w-full md:w-auto">
              <SearchBar value={searchQuery} onChange={setSearchQuery} />
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-500 dark:text-gray-400">{t('explore.sortBy')}:</span>
                <div className="inline-flex items-center gap-1 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-1">
                  <button
                    onClick={() => setSortBy('popularity')}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                      sortBy === 'popularity'
                        ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <TrendingUp className="w-3 h-3" />
                    {t('explore.sortByPopularity')}
                  </button>
                  <button
                    onClick={() => setSortBy('recent')}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                      sortBy === 'recent'
                        ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <Clock className="w-3 h-3" />
                    {t('explore.sortByRecent')}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <CategoryFilter
            activeCategory={activeCategory}
            onCategoryChange={setActiveCategory}
            onTagReset={() => setActiveTag(null)}
          />

          {isLoadingProjects ? (
            <ExploreSkeletonGrid />
          ) : sortedApps.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {sortedApps.map((app) => (
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
                {t('explore.noAppsFound')}
              </h4>
              <p className="text-sm text-slate-600 dark:text-gray-400">
                {t('explore.adjustSearch')}
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
