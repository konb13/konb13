import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import type { Benefit } from './data/types';
import { daysUntil } from './data/valueAtRisk';

// Phase 0: local expiration reminders (30/7/1 day per the build plan). In
// production these are reinforced by a server-side Supabase pg_cron sweep so
// reminders fire even if the app never opens — but local scheduling gives the
// personal MVP working notifications with zero backend.

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function registerForExpirationReminders(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  const settings = await Notifications.getPermissionsAsync();
  let status = settings.status;
  if (status !== 'granted') {
    status = (await Notifications.requestPermissionsAsync()).status;
  }
  return status === 'granted';
}

/** Schedule the 30/7/1-day reminder ladder for a single unused benefit. */
export async function scheduleBenefitReminders(benefit: Benefit): Promise<void> {
  if (Platform.OS === 'web' || benefit.used || !benefit.expiration_date) return;

  for (const lead of benefit.notify_days_before) {
    const days = daysUntil(benefit.expiration_date);
    if (days === null || days <= lead) continue; // already past this lead time

    const fireDate = new Date(benefit.expiration_date + 'T09:00:00');
    fireDate.setDate(fireDate.getDate() - lead);

    await Notifications.scheduleNotificationAsync({
      content: {
        title: `${benefit.name} expires in ${lead} day${lead === 1 ? '' : 's'}`,
        body: `~$${benefit.est_value_usd} at risk. Use it before ${benefit.expiration_date}.`,
      },
      trigger: { date: fireDate },
    });
  }
}
