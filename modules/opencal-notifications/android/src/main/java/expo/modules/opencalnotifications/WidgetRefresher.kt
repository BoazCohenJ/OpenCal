package expo.modules.opencalnotifications

import android.app.AlarmManager
import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.content.Context
import android.content.Intent
import android.os.Build
import java.util.Calendar

/**
 * Home-screen widgets draw "today" once and only redraw on Android's 30-minute timer, which doesn't run
 * while the phone is idle. So after midnight a widget could keep showing yesterday until the phone woke up.
 * This arms an alarm for the start of every day (and re-arms it after reboots and clock or time zone
 * changes) that redraws every OpenCal widget.
 */
object WidgetRefresher {
  const val ACTION = "com.boazcohen.opencal.WIDGET_REFRESH"

  /** A little after midnight, so the clock is safely on the new day when the widgets draw. */
  private const val MIDNIGHT_DELAY_MS = 15_000L

  private fun pendingIntent(context: Context): PendingIntent {
    val intent = Intent(context, WidgetRefreshReceiver::class.java).setAction(ACTION)
    return PendingIntent.getBroadcast(context, 0, intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
  }

  private fun nextMidnightMs(): Long {
    val c = Calendar.getInstance()
    c.add(Calendar.DAY_OF_YEAR, 1)
    c.set(Calendar.HOUR_OF_DAY, 0)
    c.set(Calendar.MINUTE, 0)
    c.set(Calendar.SECOND, 0)
    c.set(Calendar.MILLISECOND, 0)
    return c.timeInMillis + MIDNIGHT_DELAY_MS
  }

  /** Arms (or re-arms) the alarm for the next midnight. */
  fun scheduleNext(context: Context) {
    val am = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
    val pi = pendingIntent(context)
    val at = nextMidnightMs()
    val exact = Build.VERSION.SDK_INT < Build.VERSION_CODES.S || am.canScheduleExactAlarms()
    if (exact) {
      try {
        am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi)
        return
      } catch (_: SecurityException) {
        // Exact-alarm access was revoked between the check and the call; fall back to an inexact alarm.
      }
    }
    am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi)
  }

  /** Asks every OpenCal widget on the home screen to redraw, the same way Android's own timer does. */
  fun refreshAll(context: Context) {
    val manager = AppWidgetManager.getInstance(context)
    manager.installedProviders.filter { it.provider.packageName == context.packageName }.forEach { info ->
      val ids = manager.getAppWidgetIds(info.provider)
      if (ids.isEmpty()) return@forEach
      val update = Intent(AppWidgetManager.ACTION_APPWIDGET_UPDATE)
        .setComponent(info.provider)
        .putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, ids)
      context.sendBroadcast(update)
    }
  }
}
