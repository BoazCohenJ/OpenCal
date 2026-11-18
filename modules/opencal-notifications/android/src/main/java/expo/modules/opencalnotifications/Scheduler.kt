package expo.modules.opencalnotifications

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build

object Scheduler {
  const val ACTION = "com.boazcohen.opencal.REMINDER"
  const val ACTION_DISMISS = "com.boazcohen.opencal.ALARM_DISMISS"
  const val ACTION_SNOOZE = "com.boazcohen.opencal.ALARM_SNOOZE"
  const val ACTION_TIMEOUT = "com.boazcohen.opencal.ALARM_TIMEOUT"

  /** One broadcast per reminder id and action; the data URI keeps them from replacing each other. */
  fun pendingIntent(context: Context, id: Int, action: String = ACTION): PendingIntent {
    val intent = Intent(context, ReminderReceiver::class.java)
      .setAction(action)
      .setData(actionUri(id, action))
      .putExtra("id", id)
    return PendingIntent.getBroadcast(context, id, intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
  }

  fun actionUri(id: Int, action: String): Uri =
    Uri.parse(if (action == ACTION) "opencal-reminder://$id" else "opencal-reminder://$id/${action.substringAfterLast('.')}")

  private fun alarmManager(context: Context) = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager

  private fun arm(context: Context, r: Reminder) = armAt(context, r.atMs, pendingIntent(context, r.id))

  private fun armAt(context: Context, atMs: Long, pi: PendingIntent) {
    val am = alarmManager(context)
    val exact = Build.VERSION.SDK_INT < Build.VERSION_CODES.S || am.canScheduleExactAlarms()
    if (exact) {
      try {
        am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, atMs, pi)
        return
      } catch (_: SecurityException) {
        // Exact-alarm access was revoked between the check and the call; fall back to an inexact alarm.
      }
    }
    am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, atMs, pi)
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

  /**
   * Cancels every reminder the app scheduled. Snoozed alarms aren't rebuilt from events, so they stay,
   * unless their event is not in `keepSnoozedFor` (it was deleted or lost its alarm). Null keeps them all.
   */
  fun cancelAll(context: Context, keepSnoozedFor: Set<String>? = null) {
    val am = alarmManager(context)
    val (snoozed, rest) = ReminderStore.all(context).partition { it.snoozed }
    val keep = if (keepSnoozedFor == null) snoozed else snoozed.filter { eventIdOf(it.key) in keepSnoozedFor }
    (rest + (snoozed - keep.toSet())).forEach { am.cancel(pendingIntent(context, it.id)) }
    ReminderStore.save(context, keep)
  }

  /** Reminder keys are `eventId@epochMs`. */
  fun eventIdOf(key: String) = key.substringBeforeLast('@')

  /** Rings `r` again after its snooze length, under a new id. */
  fun snooze(context: Context, r: Reminder) {
    val again = r.copy(
      id = ReminderStore.nextId(context),
      atMs = System.currentTimeMillis() + r.snoozeMinutes * 60_000L,
      snoozed = true,
    )
    ReminderStore.save(context, ReminderStore.all(context) + again)
    arm(context, again)
  }

  /** Stops a ringing alarm after its ring length, so it doesn't loop forever when nobody is there. */
  fun armTimeout(context: Context, r: Reminder) =
    armAt(context, System.currentTimeMillis() + r.ringMinutes * 60_000L, Alarms.intent(context, r, ACTION_TIMEOUT))

  fun cancelTimeout(context: Context, id: Int) = alarmManager(context).cancel(pendingIntent(context, id, ACTION_TIMEOUT))

  /** Re-arms every future reminder (alarms are lost on reboot or when exact-alarm access changes) and drops missed ones. */
  fun rearmAll(context: Context) {
    val now = System.currentTimeMillis()
    val future = ReminderStore.all(context).filter { it.atMs > now }
    ReminderStore.save(context, future)
    future.forEach { arm(context, it) }
  }
}
