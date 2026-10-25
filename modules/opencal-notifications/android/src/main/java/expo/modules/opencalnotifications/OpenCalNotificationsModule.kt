package expo.modules.opencalnotifications

import android.Manifest
import android.content.Context
import android.os.Build
import androidx.core.app.NotificationManagerCompat
import androidx.core.os.bundleOf
import expo.modules.interfaces.permissions.Permissions
import expo.modules.interfaces.permissions.PermissionsResponse
import expo.modules.interfaces.permissions.PermissionsStatus
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record

class ReminderRecord : Record {
  @Field var key: String = ""
  @Field var atMs: Double = 0.0
  @Field var title: String = ""
  @Field var body: String = ""
  @Field var silent: Boolean = false
}

class OpenCalNotificationsModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  private val permissions: Permissions
    get() = appContext.permissions ?: throw Exceptions.AppContextLost()

  override fun definition() = ModuleDefinition {
    Name("OpenCalNotifications")

    AsyncFunction("ensureChannels") { Channels.ensure(context) }

    AsyncFunction("getPermissions") { promise: Promise -> readPermissions(promise) }

    AsyncFunction("requestPermissions") { promise: Promise ->
      if (Build.VERSION.SDK_INT >= 33) {
        permissions.askForPermissions({ readPermissions(promise) }, Manifest.permission.POST_NOTIFICATIONS)
      } else {
        readPermissions(promise)
      }
    }

    AsyncFunction("getScheduled") {
      ReminderStore.all(context).map { mapOf("key" to it.key, "silent" to it.silent, "title" to it.title, "body" to it.body) }
    }

    AsyncFunction("schedule") { items: List<ReminderRecord> ->
      Scheduler.add(context, items.map { Reminder(0, it.key, it.atMs.toLong(), it.title, it.body, it.silent) })
    }

    AsyncFunction("cancelAll") { Scheduler.cancelAll(context) }
  }

  private fun readPermissions(promise: Promise) {
    val enabled = NotificationManagerCompat.from(context).areNotificationsEnabled()
    if (Build.VERSION.SDK_INT >= 33) {
      permissions.getPermissions(
        { map: Map<String, PermissionsResponse> ->
          val granted = enabled && map.all { it.value.status == PermissionsStatus.GRANTED }
          val canAskAgain = !granted && map.all { it.value.canAskAgain }
          promise.resolve(bundleOf("granted" to granted, "canAskAgain" to canAskAgain))
        },
        Manifest.permission.POST_NOTIFICATIONS,
      )
    } else {
      // Before Android 13 there is no runtime prompt; notifications are simply on or off in system settings.
      promise.resolve(bundleOf("granted" to enabled, "canAskAgain" to false))
    }
  }
}
