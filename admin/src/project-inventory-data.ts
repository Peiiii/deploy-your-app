export type Inventory = {
  summary: {
    total: number;
    public: number;
    private: number;
    visibilityUnknown: number;
    live: number;
    publicLive: number;
    languageKnown: number;
  };
  categories: { name: string; total: number }[];
  languages: { name: string; total: number }[];
};
// Labels project the current discovery taxonomy; they do not alter stored metadata.
export const categoryLabels: Record<string, string> = {
  Education: '学习与教育',
  Games: '游戏',
  Productivity: '实用工具',
  Creative: '创意与展示',
  Development: '开发',
  Other: '其他 / 未分类',
};
const displayNames = new Intl.DisplayNames(['zh-CN'], { type: 'language' });
export const languageLabel = (code: string) => {
  if (code === 'und') return '未确认';
  if (code === 'zxx') return '无语言文字';
  try {
    return displayNames.of(code) || code;
  } catch {
    return code;
  }
};
export const projectLanguages = (value: unknown): string[] => {
  try {
    const codes = JSON.parse(String(value || '[]')) as unknown;
    return Array.isArray(codes)
      ? codes.filter((code): code is string => typeof code === 'string')
      : [];
  } catch {
    return [];
  }
};
