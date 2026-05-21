import * as LucideIcons from 'lucide-react';

type LucideIcon = React.ComponentType<{ size?: number; strokeWidth?: number }>;
const Icons = LucideIcons as unknown as Record<string, LucideIcon>;

export interface SocialProvider {
  id: string;
  label: string;
  /** Lucide icon name */
  icon: string;
  /** CSS color for the chip */
  color: string;
  /** Optional default URL prefix shown in input placeholder */
  placeholder?: string;
}

export const SOCIAL_PROVIDERS: SocialProvider[] = [
  { id: 'website',   label: 'Сайт',      icon: 'Globe',      color: '#64748b', placeholder: 'https://example.com' },
  { id: 'telegram',  label: 'Telegram',  icon: 'Send',       color: '#0088cc', placeholder: 'https://t.me/username' },
  { id: 'vk',        label: 'VK',        icon: 'AtSign',     color: '#0077ff', placeholder: 'https://vk.com/username' },
  { id: 'discord',   label: 'Discord',   icon: 'MessageSquare', color: '#5865f2', placeholder: 'username#1234' },
  { id: 'github',    label: 'GitHub',    icon: 'Github',     color: '#9aa0a6', placeholder: 'https://github.com/username' },
  { id: 'twitter',   label: 'X / Twitter', icon: 'Twitter',  color: '#1d9bf0', placeholder: 'https://x.com/username' },
  { id: 'instagram', label: 'Instagram', icon: 'Instagram',  color: '#e1306c', placeholder: 'https://instagram.com/username' },
  { id: 'youtube',   label: 'YouTube',   icon: 'Youtube',    color: '#ff0033', placeholder: 'https://youtube.com/@channel' },
  { id: 'twitch',    label: 'Twitch',    icon: 'Twitch',     color: '#9146ff', placeholder: 'https://twitch.tv/channel' },
  { id: 'email',     label: 'Email',     icon: 'Mail',       color: '#16a34a', placeholder: 'me@example.com' },
];

export const SOCIAL_MAP = new Map(SOCIAL_PROVIDERS.map(p => [p.id, p]));

export function getSocialIcon(id: string): LucideIcon | null {
  const p = SOCIAL_MAP.get(id);
  if (!p) return null;
  return Icons[p.icon] ?? null;
}

/** Resolve href for various social link formats. */
export function resolveSocialHref(providerId: string, value: string): string {
  const v = value.trim();
  if (!v) return '#';
  if (v.startsWith('http://') || v.startsWith('https://') || v.startsWith('mailto:')) return v;
  if (providerId === 'email' && v.includes('@')) return `mailto:${v}`;
  if (providerId === 'telegram' && v.startsWith('@')) return `https://t.me/${v.slice(1)}`;
  if (providerId === 'twitter' && v.startsWith('@'))  return `https://x.com/${v.slice(1)}`;
  return `https://${v}`;
}
