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
    url: 'http://localhost:5173/prototypes/browser-extension/test-app/',
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
    category: 'Utilities',
    author: 'GemiGo Team'
  }
];
