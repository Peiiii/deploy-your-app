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
  variant?: 'default' | 'dark';
}

export const DEPLOYMENT_OPTIONS: DeploymentOption[] = [
  {
    id: SourceType.GITHUB,
    titleKey: 'deployment.githubRepository',
    descriptionKey: 'deployment.connectGitHubRepo',
    icon: Github,
    colorFrom: 'from-gray-100',
    colorTo: 'to-gray-200',
    bgFrom: 'dark:from-gray-800',
    bgTo: 'dark:to-gray-700',
    hoverColor: 'gray', // Neutral hover
    iconColor: 'text-gray-900 dark:text-gray-100',
    shadowColor: 'shadow-gray-500/10',
    variant: 'default',
  },
  {
    id: SourceType.ZIP,
    titleKey: 'deployment.uploadArchive',
    descriptionKey: 'deployment.uploadZipFile',
    icon: FolderArchive,
    colorFrom: 'from-blue-50',
    colorTo: 'to-blue-100',
    bgFrom: 'dark:from-blue-900/30',
    bgTo: 'dark:to-blue-800/30',
    hoverColor: 'blue',
    iconColor: 'text-blue-600 dark:text-blue-400',
    shadowColor: 'shadow-blue-500/10',
    variant: 'default',
  },
  {
    id: SourceType.HTML,
    titleKey: 'deployment.inlineHTML',
    descriptionKey: 'deployment.pasteHTML', // Matches 'Create Blank' visual weight
    icon: FileCode,
    colorFrom: 'from-gray-800',
    colorTo: 'to-gray-900',
    bgFrom: 'dark:from-black',
    bgTo: 'dark:to-gray-950',
    hoverColor: 'gray',
    iconColor: 'text-white',
    shadowColor: 'shadow-black/20',
    variant: 'dark', // This triggers the black card style
  },
];
