package expo.modules.opencalnotifications

import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import androidx.core.app.NotificationCompat

class ReminderReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    val reminder = ReminderStore.remove(context, intent.getIntExtra("id", -1)) ?: return
    Channels.ensure(context)

    val open = context.packageManager.getLaunchIntentForPackage(context.packageName)?.let {
      PendingIntent.getActivity(context, reminder.id, it, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    }
    val notification = NotificationCompat.Builder(context, if (reminder.silent) Channels.SILENT else Channels.SOUND)
      .setSmallIcon(R.drawable.opencal_notification_icon)
      .setColor(0xFFE2553A.toInt())
      .setContentTitle(reminder.title)
      .setContentText(reminder.body)
      .setStyle(NotificationCompat.BigTextStyle().bigText(reminder.body))
      .setCategory(NotificationCompat.CATEGORY_REMINDER)
      .setPriority(if (reminder.silent) NotificationCompat.PRIORITY_DEFAULT else NotificationCompat.PRIORITY_HIGH)
      .setWhen(reminder.atMs)
      .setAutoCancel(true)
      .setContentIntent(open)
      .build()
    try {
      (context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager).notify(reminder.id, notification)
    } catch (_: SecurityException) {
      // Notification permission was revoked after scheduling; there is nothing to show.
    }
  }
}
