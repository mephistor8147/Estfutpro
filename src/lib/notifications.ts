import type { InAppNotificationItem, NotificationPreferences } from '../types/football.ts';

export type BrowserNotificationSupport = 'unsupported' | 'default' | 'granted' | 'denied';

export function getBrowserNotificationPermission(): BrowserNotificationSupport {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  return window.Notification.permission;
}

export async function requestBrowserNotificationPermission(): Promise<BrowserNotificationSupport> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  try {
    const perm = await window.Notification.requestPermission();
    return perm;
  } catch {
    return window.Notification.permission;
  }
}

export function playNotificationChime(): void {
  if (typeof window === 'undefined') return;
  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) return;

  try {
    const ctx = new AudioCtx();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(660, now);
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.14);
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.exponentialRampToValueAtTime(0.08, now + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.25);
    setTimeout(() => {
      void ctx.close().catch(() => {});
    }, 350);
  } catch {
    // Ignore autoplay restriction if user hasn't interacted yet
  }
}

export function dispatchAppNotification(
  prefs: NotificationPreferences,
  payload: {
    title: string;
    message: string;
    category: InAppNotificationItem['category'];
  },
  forceTest = false
): InAppNotificationItem | null {
  if (!forceTest && !prefs.enabled) {
    return null;
  }

  if (prefs.soundEnabled) {
    playNotificationChime();
  }

  if (
    prefs.browserPush &&
    typeof window !== 'undefined' &&
    'Notification' in window &&
    window.Notification.permission === 'granted'
  ) {
    try {
      new window.Notification(payload.title, {
        body: payload.message,
      });
    } catch {
      // Some embedded iframes restrict constructor; ignore gracefully
    }
  }

  return {
    id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    title: payload.title,
    message: payload.message,
    category: payload.category,
    createdAt: new Date().toISOString(),
  };
}
