import { InstalledApp } from './App';

export interface MarketApp extends Omit<InstalledApp, 'id'> {
  id: string;
  category: string;
  author: string;
}

export const marketApps: MarketApp[] = [
  {
    id: 'gemigo-test',
    name: 'SDK Test App',
    description: 'Official test utilities for GemiGo SDK verification.',
    icon: '🧪',
    iconBg: 'linear-gradient(135deg, #3b82f6, #2563eb)',
    url: 'http://localhost:3000/test-app/index.html',
    permissions: ['extension.modify', 'extension.capture', 'network'],
    networkAllowlist: ['https://api.github.com', 'http://localhost:*'],
    category: 'Development',
    author: 'GemiGo Team'
  },
  {
    id: 'demo-reader',
    name: 'Reader Mode',
    description: 'Distraction-free reading environment.',
    icon: '📖',
    iconBg: 'linear-gradient(135deg, #10b981, #059669)',
    url: 'http://localhost:3000/reader-app/index.html',
    permissions: ['extension.modify'],
    networkAllowlist: [],
    category: 'Productivity',
    author: 'GemiGo Team'
  },
  {
    id: 'translator-app',
    name: 'Quick Translate',
    description: 'Translate selected text instantly via context menu or manual selection.',
    icon: '🌏',
    iconBg: 'linear-gradient(135deg, #3b82f6, #2563eb)',
    url: 'http://localhost:3000/translator-app/index.html',
    permissions: [],
    networkAllowlist: [],
    category: 'Utilities',
    author: 'GemiGo Team'
  },
  {
    id: 'link-analyzer',
    name: 'Link Analyzer',
    description: 'Analyze and categorize all links on the current page.',
    icon: '🔗',
    iconBg: 'linear-gradient(135deg, #22c55e, #16a34a)',
    url: 'http://localhost:3000/link-analyzer/index.html',
    permissions: ['extension.modify'],
    networkAllowlist: [],
    category: 'Utilities',
    author: 'GemiGo Team'
  }
];
