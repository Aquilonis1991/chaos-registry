export interface NotificationProfile {
  nickname: string | null;
  avatar: string | null;
}

export interface RawNotification {
  id: string;
  user_id: string | null;
  type: 'announcement' | 'personal' | 'system' | 'contact';
  title: string;
  content: string;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
  expires_at: string | null;
  created_by: string | null;
}

export interface AdminNotification extends RawNotification {
  profiles?: NotificationProfile;
  announcement_recipient_count?: number;
}

export const mergeAnnouncements = (notifications: AdminNotification[]): AdminNotification[] => {
  if (!notifications || notifications.length === 0) {
    return [];
  }

  let merged: AdminNotification[] = [];

  const announcementMap = new Map<string, AdminNotification>();

  notifications.forEach((notification) => {
    if (notification.type === 'announcement') {
      const key = `${notification.title}__${notification.content}__${notification.created_at}`;
      const existing = announcementMap.get(key);
      if (existing) {
        existing.announcement_recipient_count = (existing.announcement_recipient_count || 1) + 1;
      } else {
        announcementMap.set(key, { ...notification, announcement_recipient_count: 1 });
      }
    } else {
      merged.push(notification);
    }
  });

  merged = [...Array.from(announcementMap.values()), ...merged];

  merged.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return merged;
};

