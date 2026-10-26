package ir.shopino.app.data.auth

import android.content.Context

/**
 * Persists a user-selected API origin in private app preferences. The compiled default
 * (BuildConfig.DEFAULT_BASE_URL) is never written here; only an explicit override is.
 * Stored values are re-validated on read, so a stale/invalid override falls back to the default.
 */
class ServerConfigStore(context: Context, private val allowDevelopmentHosts: Boolean) {
    private val prefs = context.applicationContext.getSharedPreferences("shopino_server", Context.MODE_PRIVATE)

    fun readOverride(): String? {
        val raw = prefs.getString(KEY, null) ?: return null
        return (ServerUrl.normalize(raw, allowDevelopmentHosts) as? ServerUrl.Result.Valid)?.origin
    }

    fun writeOverride(origin: String) = prefs.edit().putString(KEY, origin).apply()

    fun clearOverride() = prefs.edit().remove(KEY).apply()

    private companion object { const val KEY = "origin_override" }
}
