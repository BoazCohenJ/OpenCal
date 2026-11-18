package expo.modules.opencalnotifications

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject

data class Reminder(
  val id: Int,
  val key: String,
  val atMs: Long,
  val title: String,
  val body: String,
  val silent: Boolean,
  /** Rings on the alarm channel until dismissed, snoozed or `ringMinutes` pass. */
  val alarm: Boolean = false,
  val ringMinutes: Int = 10,
  val snoozeMinutes: Int = 10,
  /** A snoozed alarm: not derived from an event, so rescheduling from the app must keep it. */
  val snoozed: Boolean = false,
)

/** Reminders waiting for their alarm, kept in SharedPreferences so they survive a reboot. */
object ReminderStore {
  private const val PREFS = "opencal_reminders"
  private const val ITEMS = "items"
  private const val NEXT_ID = "next_id"

  @Synchronized
  fun all(context: Context): List<Reminder> {
    val raw = prefs(context).getString(ITEMS, null) ?: return emptyList()
    return try {
      val array = JSONArray(raw)
      (0 until array.length()).map { i ->
        val o = array.getJSONObject(i)
        Reminder(
          o.getInt("id"), o.getString("key"), o.getLong("at"), o.getString("title"), o.getString("body"), o.getBoolean("silent"),
          o.optBoolean("alarm", false), o.optInt("ring", 10), o.optInt("snooze", 10), o.optBoolean("snoozed", false),
        )
      }
    } catch (_: Exception) {
      emptyList()
    }
  }

  @Synchronized
  fun save(context: Context, reminders: List<Reminder>) {
    val array = JSONArray()
    reminders.forEach {
      array.put(
        JSONObject()
          .put("id", it.id).put("key", it.key).put("at", it.atMs)
          .put("title", it.title).put("body", it.body).put("silent", it.silent)
          .put("alarm", it.alarm).put("ring", it.ringMinutes).put("snooze", it.snoozeMinutes).put("snoozed", it.snoozed),
      )
    }
    prefs(context).edit().putString(ITEMS, array.toString()).apply()
  }

  @Synchronized
  fun remove(context: Context, id: Int): Reminder? {
    val all = all(context)
    val hit = all.firstOrNull { it.id == id } ?: return null
    save(context, all - hit)
    return hit
  }

  @Synchronized
  fun nextId(context: Context): Int {
    val p = prefs(context)
    val id = p.getInt(NEXT_ID, 1)
    p.edit().putInt(NEXT_ID, if (id == Int.MAX_VALUE) 1 else id + 1).apply()
    return id
  }

  private fun prefs(context: Context) = context.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
}
