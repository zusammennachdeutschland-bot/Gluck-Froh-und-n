import { BuddyActivity, BuddyActivityType } from '../../types/buddy';
import { storage } from '../storageService';

const BUDDY_ACTIVITIES_KEY = 'dl_buddy_activities';

export async function getBuddyActivities(): Promise<BuddyActivity[]> {
  try {
    const raw = await storage.getItem(BUDDY_ACTIVITIES_KEY);
    if (Array.isArray(raw)) {
      return raw;
    }
  } catch (e) {
    console.error('Failed to load buddy activities:', e);
  }
  return [];
}

export async function logBuddyActivity(
  type: BuddyActivityType,
  entityId?: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  try {
    const activities = await getBuddyActivities();
    const newActivity: BuddyActivity = {
      id: `act_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      type,
      timestamp: Date.now(),
      entityId,
      metadata
    };

    // Keep last 50 activities
    const updated = [newActivity, ...activities].slice(0, 50);
    await storage.setItem(BUDDY_ACTIVITIES_KEY, updated);
  } catch (e) {
    console.error('Failed to log buddy activity:', e);
  }
}
