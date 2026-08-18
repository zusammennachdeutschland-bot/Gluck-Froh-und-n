export const DEFAULT_OFFLINE_AVATAR = '';

export interface AvatarPreset {
  id: string;
  name: string;
  url: string;
  gender?: 'boy' | 'girl' | 'neutral';
}

export const CARTOON_AVATARS: AvatarPreset[] = [];
