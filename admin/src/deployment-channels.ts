export const deploymentChannels: Record<string, string> = {
  web: '网页',
  cli: 'CLI / Skill',
  desktop: '桌面端',
  extension: '浏览器扩展',
  api: 'API',
  unknown: '未知渠道',
};
export const deploymentChannelLabel = (value: unknown) =>
  value == null ? '未记录' : deploymentChannels[String(value)] || '未知渠道';
