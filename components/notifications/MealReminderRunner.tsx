/**
 * MealReminderRunner — the headless host that keeps the tap-to-log window full.
 *
 * Meal reminders are individually-dated notifications laid down a week ahead
 * (services/notifications/mealReminders), which is what lets each day's copy be
 * different and lets a reminder name the actual meal. The cost of that design is
 * that the window DRAINS: every reminder that fires is one fewer in the queue,
 * and a phone that never re-syncs would quietly go silent after seven days.
 *
 * So the window is topped up here, on two events:
 *
 *   · MOUNT — every cold start.
 *   · FOREGROUND — every return to the app. Timers are suspended while
 *     backgrounded, so this, and not an interval, is what covers the person who
 *     opens the app once a day.
 *
 * The sync is a converging REPLACE (it cancels the ids it wrote last time and
 * re-lays the window), so running it more often than necessary is harmless —
 * which is exactly the property a top-up needs.
 *
 * It also carries the other half of the loop: when a meal is logged from a
 * lock-screen button while the app is ALIVE, nothing in React knows. AppContext
 * re-reads on foreground, which covers the phone-was-locked case; this covers
 * the app-was-open case, where the diet screen would otherwise keep rendering a
 * meal the user just told us they had eaten.
 *
 * Signed out, it does nothing at all: a reminder is scheduled against one
 * person's meal plan, and it must not survive into the next account.
 */
import { useAuth } from "@/components/SupabaseAuthProvider";
import { useNutrition } from "@/contexts/AppContext";
import { subscribeMealLoggedFromNotification } from "@/services/notifications/mealActions";
import { syncMealReminders } from "@/services/notifications/mealReminders";
import { useEffect } from "react";
import { AppState } from "react-native";

export function MealReminderRunner(): null {
  const { user } = useAuth();
  const signedIn = !!user;
  const { refreshTodayDiet } = useNutrition();

  useEffect(() => {
    if (!signedIn) return;
    let alive = true;

    const topUp = () => {
      // Fire-and-forget: syncMealReminders never throws and returns a count
      // nobody here needs. A failure means no reminders, which the settings
      // screen reports on its own.
      void syncMealReminders();
    };

    topUp();
    const sub = AppState.addEventListener("change", (state) => {
      if (alive && state === "active") topUp();
    });

    return () => {
      alive = false;
      sub.remove();
    };
  }, [signedIn]);

  // A meal ticked from a notification while this tree is mounted.
  useEffect(() => {
    return subscribeMealLoggedFromNotification(() => {
      void refreshTodayDiet();
    });
  }, [refreshTodayDiet]);

  return null;
}
