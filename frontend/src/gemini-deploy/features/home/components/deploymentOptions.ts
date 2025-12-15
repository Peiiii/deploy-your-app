import type { LucideIcon } from 'lucide-react';
import { Github, FolderArchive, FileCode } from 'lucide-react';
import { SourceType } from '@/types';

export interface DeploymentOption {
  id: SourceType;
  titleKey: string;
  descriptionKey: string;
  icon: LucideIcon;
  colorFrom: string;
  colorTo: string;
  bgFrom: string;
  bgTo: string;
  hoverColor: string;
  iconColor: string;
  shadowColor: string;
}

export const DEPLOYMENT_OPTIONS: DeploymentOption[] = [
  {
    id: SourceType.GITHUB,
    titleKey: 'deployment.githubRepository',
    descriptionKey: 'deployment.connectGitHubRepo',
    icon: Github,
    colorFrom: 'from-purple-100',
    colorTo: 'to-purple-200',
    bgFrom: 'dark:from-purple-900/50',
    bgTo: 'dark:to-purple-800/50',
    hoverColor: 'purple',
    iconColor: 'text-purple-600 dark:text-purple-400',
    shadowColor: 'shadow-purple-500/20',
  },
  {
    id: SourceType.ZIP,
    titleKey: 'deployment.uploadArchive',
    descriptionKey: 'deployment.uploadZipFile',
    icon: FolderArchive,
    colorFrom: 'from-blue-100',
    colorTo: 'to-blue-200',
    bgFrom: 'dark:from-blue-900/50',
    bgTo: 'dark:to-blue-800/50',
    hoverColor: 'blue',
    iconColor: 'text-blue-600 dark:text-blue-400',
    shadowColor: 'shadow-blue-500/20',
  },
  {
    id: SourceType.HTML,
    titleKey: 'deployment.inlineHTML',
    descriptionKey: 'deployment.pasteHTML',
    icon: FileCode,
    colorFrom: 'from-emerald-100',
    colorTo: 'to-emerald-200',
    bgFrom: 'dark:from-emerald-900/50',
    bgTo: 'dark:to-emerald-800/50',
    hoverColor: 'emerald',
    iconColor: 'text-emerald-600 dark:text-emerald-400',
    shadowColor: 'shadow-emerald-500/20',
  },
];
