import type { Group } from '../types';

/**
 * Which online platform a group's lessons run on.
 * 'zoom' when unset — legacy groups created before the platform choice existed.
 */
export function getGroupOnlinePlatform(group?: Partial<Group> | null): 'zoom' | 'meet' {
  return group?.onlinePlatform === 'meet' ? 'meet' : 'zoom';
}

export function isMeetGroup(group?: Partial<Group> | null): boolean {
  return getGroupOnlinePlatform(group) === 'meet';
}

/** The group's meeting link for its chosen platform (Meet link for Meet groups, Zoom link otherwise). */
export function getGroupMeetingLink(group?: Partial<Group> | null): string {
  if (!group) return '';
  return (isMeetGroup(group) ? group.meetLink || group.zoomLink : group.zoomLink || group.meetLink || '').trim();
}
