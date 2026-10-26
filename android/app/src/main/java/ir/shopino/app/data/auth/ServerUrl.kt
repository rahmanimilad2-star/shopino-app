package ir.shopino.app.data.auth

import java.net.URI

/**
 * Validation + normalization for the API origin (base URL). Pure Kotlin so it is unit-testable.
 * The result always ends with "/" so Retrofit's relative paths ("api/auth/login") resolve correctly.
 */
object ServerUrl {

    /** Retired Cloud Run host. Must never be used as an API origin. */
    const val RETIRED_HOST = "ais-pre-ak3ludbj3fwi2bggcjwafc-225659912425.europe-west3.run.app"

    private val developmentOnlyHosts = setOf("localhost", "127.0.0.1", "10.0.2.2", "0.0.0.0", "[::1]", "::1")

    enum class Reason {
        EMPTY, MALFORMED, UNSUPPORTED_SCHEME, MISSING_HOST, CREDENTIALS_NOT_ALLOWED,
        QUERY_NOT_ALLOWED, CLEARTEXT_NOT_ALLOWED, LOCAL_HOST_NOT_ALLOWED, RETIRED_HOST
    }

    sealed interface Result {
        data class Valid(val origin: String) : Result
        data class Invalid(val reason: Reason) : Result
    }

    /**
     * @param allowDevelopmentHosts true only for debug builds: permits http:// and localhost/10.0.2.2.
     */
    fun normalize(raw: String?, allowDevelopmentHosts: Boolean): Result {
        val text = raw?.trim().orEmpty()
        if (text.isEmpty()) return Result.Invalid(Reason.EMPTY)
        val uri = try { URI(text) } catch (e: Exception) { return Result.Invalid(Reason.MALFORMED) }

        val scheme = uri.scheme?.lowercase() ?: return Result.Invalid(Reason.MALFORMED)
        if (scheme != "http" && scheme != "https") return Result.Invalid(Reason.UNSUPPORTED_SCHEME)
        val host = uri.host?.lowercase()
        if (host.isNullOrBlank()) return Result.Invalid(Reason.MISSING_HOST)
        if (uri.userInfo != null) return Result.Invalid(Reason.CREDENTIALS_NOT_ALLOWED)
        if (uri.query != null || uri.fragment != null) return Result.Invalid(Reason.QUERY_NOT_ALLOWED)
        if (host == RETIRED_HOST) return Result.Invalid(Reason.RETIRED_HOST)
        if (!allowDevelopmentHosts) {
            if (scheme != "https") return Result.Invalid(Reason.CLEARTEXT_NOT_ALLOWED)
            if (host in developmentOnlyHosts) return Result.Invalid(Reason.LOCAL_HOST_NOT_ALLOWED)
        }
        val port = if (uri.port != -1) ":${uri.port}" else ""
        val path = (uri.path ?: "").trimEnd('/') + "/"
        return Result.Valid("$scheme://$host$port$path")
    }
}
