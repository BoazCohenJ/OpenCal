package expo.modules.opencalnotifications

import android.app.Notification
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import androidx.core.app.NotificationCompat

class ReminderReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    val id = intent.getIntExtra("id", -1)
    when (intent.action) {
      Scheduler.ACTION_DISMISS -> stop(context, id)
      Scheduler.ACTION_SNOOZE -> {
        stop(context, id)
        Alarms.fromIntent(intent)?.let { Scheduler.snooze(context, it) }
      }
      Scheduler.ACTION_TIMEOUT -> {
        // Still ringing after its ring length: replace it with a quiet copy that can still be snoozed.
        val r = Alarms.fromIntent(intent) ?: return
        if (manager(context).activeNotifications.none { it.id == id }) return
        post(context, r, build(context, r, ringing = false))
      }
      else -> {
        val reminder = ReminderStore.remove(context, id) ?: return
        Channels.ensure(context)
        post(context, reminder, build(context, reminder, ringing = reminder.alarm && !reminder.silent))
        if (reminder.alarm && !reminder.silent) Scheduler.armTimeout(context, reminder)
      }
    }
  }

  private fun manager(context: Context) = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

  private fun stop(context: Context, id: Int) {
    manager(context).cancel(id)
    Scheduler.cancelTimeout(context, id)
  }

  private fun post(context: Context, reminder: Reminder, notification: Notification) {
    try {
      manager(context).notify(reminder.id, notification)
    } catch (_: SecurityException) {
      // Notification permission was revoked after scheduling; there is nothing to show.
    }
  }

  private fun build(context: Context, reminder: Reminder, ringing: Boolean): Notification {
    val open = context.packageManager.getLaunchIntentForPackage(context.packageName)?.let {
      PendingIntent.getActivity(context, reminder.id, it, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    }
    val channel = when {
      ringing -> Channels.ALARM
      reminder.silent || reminder.alarm -> Channels.SILENT
      else -> Channels.SOUND
    }
    val builder = NotificationCompat.Builder(context, channel)
      .setSmallIcon(R.drawable.opencal_notification_icon)
      .setColor(0xFFE2553A.toInt())
      .setContentTitle(reminder.title)
      .setContentText(reminder.body)
      .setStyle(NotificationCompat.BigTextStyle().bigText(reminder.body))
      .setCategory(if (reminder.alarm) NotificationCompat.CATEGORY_ALARM else NotificationCompat.CATEGORY_REMINDER)
      .setPriority(
        when {
          ringing -> NotificationCompat.PRIORITY_MAX
          channel == Channels.SILENT -> NotificationCompat.PRIORITY_DEFAULT
          else -> NotificationCompat.PRIORITY_HIGH
        },
      )
      .setWhen(reminder.atMs)
      .setAutoCancel(true)
      .setContentIntent(open)
    if (reminder.alarm) {
      builder.addAction(0, "Snooze ${reminder.snoozeMinutes} min", Alarms.intent(context, reminder, Scheduler.ACTION_SNOOZE))
      if (ringing) {
        builder.addAction(0, "Dismiss", Alarms.intent(context, reminder, Scheduler.ACTION_DISMISS))
        // Swiping it away counts as dismissing, so the timeout doesn't fire for a gone notification.
        builder.setDeleteIntent(Alarms.intent(context, reminder, Scheduler.ACTION_DISMISS))
      }
    }
    val notification = builder.build()
    // Insistent: the sound loops until the notification is opened, dismissed, snoozed or times out.
    if (ringing) notification.flags = notification.flags or Notification.FLAG_INSISTENT
    return notification
  }
}

/** Alarm action intents carry the reminder itself: once fired, it is no longer in the store. */
object Alarms {
  fun intent(context: Context, r: Reminder, action: String): PendingIntent {
    val intent = Intent(context, ReminderReceiver::class.java)
      .setAction(action)
      .setData(Scheduler.actionUri(r.id, action))
      .putExtra("id", r.id)
      .putExtra("key", r.key)
      .putExtra("at", r.atMs)
      .putExtra("title", r.title)
      .putExtra("body", r.body)
      .putExtra("ring", r.ringMinutes)
      .putExtra("snooze", r.snoozeMinutes)
    return PendingIntent.getBroadcast(context, r.id, intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
  }

  fun fromIntent(intent: Intent): Reminder? {
    val key = intent.getStringExtra("key") ?: return null
    return Reminder(
      id = intent.getIntExtra("id", -1),
      key = key,
      atMs = intent.getLongExtra("at", System.currentTimeMillis()),
      title = intent.getStringExtra("title") ?: "",
      body = intent.getStringExtra("body") ?: "",
      silent = false,
      alarm = true,
      ringMinutes = intent.getIntExtra("ring", 10),
      snoozeMinutes = intent.getIntExtra("snooze", 10),
    )
  }
}
