export interface CommunityChannelConfig {
  wechatQrUrl: string | null;
  discordInviteUrl: string | null;
}

const normalizeImageUrl = (value: string | undefined): string | null => {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('/')) return trimmed;
  try {
    const url = new URL(trimmed);
    return url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
};

const normalizeDiscordUrl = (value: string | undefined): string | null => {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    const allowedHosts = new Set(['discord.gg', 'discord.com', 'www.discord.com']);
    return url.protocol === 'https:' && allowedHosts.has(url.hostname)
      ? url.toString()
      : null;
  } catch {
    return null;
  }
};

export const communityChannelConfig: CommunityChannelConfig = {
  wechatQrUrl: normalizeImageUrl(import.meta.env.VITE_COMMUNITY_WECHAT_QR_URL),
  discordInviteUrl: normalizeDiscordUrl(
    import.meta.env.VITE_COMMUNITY_DISCORD_INVITE_URL,
  ),
};
