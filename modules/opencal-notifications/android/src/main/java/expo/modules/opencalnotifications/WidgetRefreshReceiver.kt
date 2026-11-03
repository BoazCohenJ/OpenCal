package expo.modules.opencalnotifications

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/** Redraws the widgets at midnight and whenever the date, time or time zone changes, then arms the next midnight. */
class WidgetRefreshReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    WidgetRefresher.refreshAll(context)
    WidgetRefresher.scheduleNext(context)
  }
}
