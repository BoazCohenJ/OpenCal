package expo.modules.opencalnotifications

import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.media.AudioAttributes
import android.media.RingtoneManager

/** A channel's sound can't change after creation, so sound and silent reminders use separate channels. */
object Channels {
  const val SOUND = "reminders"
  const val SILENT = "reminders-silent"

  fun ensure(context: Context) {
    val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    val loud = NotificationChannel(SOUND, "Event reminders", NotificationManager.IMPORTANCE_HIGH).apply {
      enableVibration(true)
      vibrationPattern = longArrayOf(0, 250, 200, 250)
      setSound(
        RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION),
        AudioAttributes.Builder()
          .setUsage(AudioAttributes.USAGE_NOTIFICATION)
          .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
          .build(),
      )
    }
    val quiet = NotificationChannel(SILENT, "Quiet reminders", NotificationManager.IMPORTANCE_DEFAULT).apply {
      description = "Reminders during quiet hours or with sound turned off"
      setSound(null, null)
      enableVibration(false)
    }
    nm.createNotificationChannels(listOf(loud, quiet))
  }
}
