package expo.modules.opencalshare

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.provider.OpenableColumns
import androidx.core.content.IntentCompat
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/** Larger shared files aren't invitations or calendars worth reading into memory. */
private const val MAX_BYTES = 8 * 1024 * 1024

/**
 * Receives what other apps share to OpenCal (Android's Share menu): an invite.ics, an email file or
 * plain text. A shared file is read here, while the sender's read grant is still valid, and handed to
 * JS as text. The launch share is taken once; shares that arrive while the app runs come as events.
 */
class OpenCalShareModule : Module() {
  private val context: Context?
    get() = appContext.reactContext

  override fun definition() = ModuleDefinition {
    Name("OpenCalShare")

    Events("onShare")

    AsyncFunction("takeLaunchShare") {
      val intent = appContext.currentActivity?.intent ?: return@AsyncFunction null
      val shared = read(intent) ?: return@AsyncFunction null
      // Taken: a JS reload mustn't open the same share again.
      intent.action = Intent.ACTION_MAIN
      shared
    }

    OnNewIntent { intent ->
      val shared = read(intent) ?: return@OnNewIntent
      intent.action = Intent.ACTION_MAIN
      sendEvent("onShare", shared)
    }
  }

  private fun read(intent: Intent): Map<String, Any?>? {
    if (intent.action != Intent.ACTION_SEND) return null
    val subject = intent.getStringExtra(Intent.EXTRA_SUBJECT)
    val stream = IntentCompat.getParcelableExtra(intent, Intent.EXTRA_STREAM, Uri::class.java)
    if (stream == null) {
      val text = intent.getCharSequenceExtra(Intent.EXTRA_TEXT)?.toString() ?: return null
      return mapOf("isFile" to false, "text" to text, "subject" to subject, "type" to intent.type)
    }
    return try {
      val resolver = context?.contentResolver ?: throw IllegalStateException("OpenCal isn't ready yet.")
      val bytes = resolver.openInputStream(stream)?.use { input ->
        val buffer = input.readNBytesCompat(MAX_BYTES + 1)
        if (buffer.size > MAX_BYTES) throw IllegalStateException("The file is too large to be a calendar invitation.")
        buffer
      } ?: throw IllegalStateException("The file couldn't be read.")
      mapOf("isFile" to true, "text" to String(bytes, Charsets.UTF_8), "name" to displayName(stream), "subject" to subject, "type" to intent.type)
    } catch (e: Exception) {
      mapOf("isFile" to true, "error" to (e.message ?: e.toString()), "name" to displayName(stream))
    }
  }

  private fun displayName(uri: Uri): String? =
    try {
      context?.contentResolver?.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)?.use { c ->
        if (c.moveToFirst()) c.getString(0) else null
      } ?: uri.lastPathSegment
    } catch (_: Exception) {
      uri.lastPathSegment
    }
}

/** InputStream.readNBytes is API 33+; reads at most `limit` bytes on any version. */
private fun java.io.InputStream.readNBytesCompat(limit: Int): ByteArray {
  val out = java.io.ByteArrayOutputStream()
  val chunk = ByteArray(64 * 1024)
  while (out.size() < limit) {
    val n = read(chunk, 0, minOf(chunk.size, limit - out.size()))
    if (n < 0) break
    out.write(chunk, 0, n)
  }
  return out.toByteArray()
}
