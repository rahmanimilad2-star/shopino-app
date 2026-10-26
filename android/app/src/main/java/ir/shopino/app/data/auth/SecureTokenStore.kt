package ir.shopino.app.data.auth

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey

/**
 * Encrypted session-token storage. The token is bound to the server origin that issued it:
 * [read] returns null (and wipes the entry) when asked for a different origin, so a token can
 * never be sent to another server.
 */
class SecureTokenStore(context: Context) {
    private val appContext = context.applicationContext
    private val preferences: SharedPreferences = open()

    /** Token for [origin], or null if none / issued by a different server. */
    @Synchronized
    fun read(origin: String): String? {
        val token = preferences.getString(KEY_TOKEN, null)?.takeIf { it.isNotBlank() } ?: return null
        if (preferences.getString(KEY_ORIGIN, null) != origin) {
            clear()
            return null
        }
        return token
    }

    @Synchronized
    fun save(token: String, origin: String) {
        check(token.isNotBlank()) { "Server returned an empty session token." }
        preferences.edit().putString(KEY_TOKEN, token).putString(KEY_ORIGIN, origin).apply()
    }

    @Synchronized
    fun clear() {
        preferences.edit().remove(KEY_TOKEN).remove(KEY_ORIGIN).apply()
    }

    private fun open(): SharedPreferences {
        fun create() = EncryptedSharedPreferences.create(
            appContext,
            FILE,
            MasterKey.Builder(appContext).setKeyScheme(MasterKey.KeyScheme.AES256_GCM).build(),
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
        )
        return try {
            create()
        } catch (e: Exception) {
            // Unreadable keystore/prefs: drop them (forces a fresh login). Never fall back to plaintext.
            appContext.deleteSharedPreferences(FILE)
            create()
        }
    }

    private companion object {
        const val FILE = "shopino_secure_auth"
        const val KEY_TOKEN = "session_token"
        const val KEY_ORIGIN = "session_origin"
    }
}
