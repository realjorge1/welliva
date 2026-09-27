package expo.modules.wellivaalarms

import android.app.AlarmManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Exact-alarm access for reminders — the one thing expo-notifications can't tell
 * JavaScript.
 *
 * expo-notifications already schedules with setExactAndAllowWhileIdle whenever
 * AlarmManager.canScheduleExactAlarms() is true, and falls back to an inexact
 * alarm that Android may hold for several minutes while the phone is idle when it
 * isn't. On Android 13+ that access ("Alarms & reminders") is not granted at
 * install, so the app needs to (1) know whether it has it and (2) send the user to
 * the one settings page that grants it. That is all this module does.
 */
class WellivaAlarmsModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("WellivaAlarms")

    // True when reminders will be scheduled as exact alarms. Always true below
    // Android 12, where exact alarms needed no permission.
    Function("canScheduleExactAlarms") {
      canScheduleExact()
    }

    // Opens welliva's own "Alarms & reminders" page (Android 12+), falling back
    // to the app's details page. Returns false if nothing could be opened.
    Function("openExactAlarmSettings") {
      openSettings()
    }
  }

  private val context: Context?
    get() = appContext.currentActivity ?: appContext.reactContext

  private fun canScheduleExact(): Boolean {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) return true
    val ctx = context ?: return false
    val alarms = ctx.getSystemService(Context.ALARM_SERVICE) as? AlarmManager ?: return false
    return alarms.canScheduleExactAlarms()
  }

  private fun openSettings(): Boolean {
    val ctx = context ?: return false
    val pkg = Uri.parse("package:${ctx.packageName}")
    val candidates = mutableListOf<Intent>()
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      candidates.add(Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM, pkg))
    }
    candidates.add(Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, pkg))
    for (intent in candidates) {
      try {
        if (appContext.currentActivity == null) intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        ctx.startActivity(intent)
        return true
      } catch (_: Exception) {
        // some OEM builds don't ship the exact-alarm page — try the next one
      }
    }
    return false
  }
}
