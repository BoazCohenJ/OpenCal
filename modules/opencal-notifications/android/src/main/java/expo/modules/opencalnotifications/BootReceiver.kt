package expo.modules.opencalnotifications

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

class BootReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    Scheduler.rearmAll(context)
    // Alarms are lost on reboot and when the app is updated, so arm the midnight widget refresh again too.
    WidgetRefresher.scheduleNext(context)
  }
}
