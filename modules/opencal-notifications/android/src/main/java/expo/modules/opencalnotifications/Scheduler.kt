package expo.modules.opencalnotifications

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build

object Scheduler {
  private const val ACTION = "com.boazcohen.opencal.REMINDER"

  private fun pendingIntent(context: Context, id: Int): PendingIntent {
    val intent = Intent(context, ReminderReceiver::class.java)
      .setAction(ACTION)
      .setData(Uri.parse("opencal-reminder://$id"))
      .putExtra("id", id)
    return PendingIntent.getBroadcast(context, id, intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
  }

  private fun alarmManager(context: Context) = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager

  private fun arm(context: Context, r: Reminder) {
    val am = alarmManager(context)
    val pi = pendingIntent(context, r.id)
    val exact = Build.VERSION.SDK_INT < Build.VERSION_CODES.S || am.canScheduleExactAlarms()
    if (exact) {
      try {
        am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, r.atMs, pi)
        return
      } catch (_: SecurityException) {
        // Exact-alarm access was revoked between the check and the call; fall back to an inexact alarm.
      }
    }
    am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, r.atMs, pi)
  }

  /** Adds reminders alongside the existing ones, giving each a fresh id. */
  fun add(context: Context, items: List<Reminder>) {
    val stored = ReminderStore.all(context).toMutableList()
    items.forEach {
      val r = it.copy(id = ReminderStore.nextId(context))
      stored.add(r)
      arm(context, r)
    }
    ReminderStore.save(context, stored)
  }

  fun cancelAll(context: Context) {
    val am = alarmManager(context)
    ReminderStore.all(context).forEach { am.cancel(pendingIntent(context, it.id)) }
    ReminderStore.save(context, emptyList())
  }

  /** Re-arms every future reminder (alarms are lost on reboot or when exact-alarm access changes) and drops missed ones. */
  fun rearmAll(context: Context) {
    val now = System.currentTimeMillis()
    val future = ReminderStore.all(context).filter { it.atMs > now }
    ReminderStore.save(context, future)
    future.forEach { arm(context, it) }
  }
}
