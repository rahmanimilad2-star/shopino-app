package ir.shopino.app.data.auth

import android.content.Context
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.JsonElement
import okhttp3.Interceptor
import okhttp3.OkHttpClient
import okhttp3.MediaType.Companion.toMediaType
import java.util.concurrent.TimeUnit
import retrofit2.Response
import retrofit2.Retrofit
import com.jakewharton.retrofit2.converter.kotlinx.serialization.asConverterFactory

class AuthFailure(
    message: String,
    val httpCode: Int? = null
) : Exception(message)

class AuthRepository(
    context: Context,
    baseUrl: String,
    private val tokenStore: SecureTokenStore = SecureTokenStore(context)
) {
    /** Normalized origin this repository talks to; session tokens are bound to it. */
    private val origin: String = baseUrl.trim().let { if (it.endsWith("/")) it else "$it/" }

    private val json = Json {
        ignoreUnknownKeys = true
        isLenient = false
        explicitNulls = false
    }

    private val api: AuthApi

    init {
        val authInterceptor = Interceptor { chain ->
            val original = chain.request()
            val isLogin = original.url.encodedPath.endsWith("api/auth/login")
            val token = if (isLogin) null else tokenStore.read(origin)
            val request = original.newBuilder().apply {
                if (!token.isNullOrBlank()) {
                    header("Authorization", "Bearer $token")
                }
            }.build()
            chain.proceed(request)
        }

        val client = OkHttpClient.Builder()
            .connectTimeout(15, TimeUnit.SECONDS)
            .readTimeout(30, TimeUnit.SECONDS)
            .writeTimeout(30, TimeUnit.SECONDS)
            .addInterceptor(authInterceptor)
            .build()

        api = Retrofit.Builder()
            .baseUrl(origin)
            .client(client)
            .addConverterFactory(
                json.asConverterFactory("application/json".toMediaType())
            )
            .build()
            .create(AuthApi::class.java)
    }

    suspend fun login(email: String, password: String): AuthUser =
        withContext(Dispatchers.IO) {
            val response = api.login(
                LoginRequest(
                    email = email.trim().lowercase(),
                    password = password
                )
            )
            val body = response.requireBody("login")
            if (body.token.isBlank()) {
                throw AuthFailure("The server returned an empty session token.")
            }
            tokenStore.save(body.token, origin)
            body.user
        }

    suspend fun restoreSession(): AuthUser? = withContext(Dispatchers.IO) {
        if (tokenStore.read(origin).isNullOrBlank()) return@withContext null

        val response = api.me()
        if (response.code() == 401 || response.code() == 403) {
            // Token rejected by the server (expired/revoked): drop it and return to login.
            tokenStore.clear()
            return@withContext null
        }

        val body = response.requireBody("session validation")
        body.user
    }

    suspend fun logout() = withContext(Dispatchers.IO) {
        try {
            if (!tokenStore.read(origin).isNullOrBlank()) {
                api.logout()
            }
        } finally {
            tokenStore.clear()
        }
    }

    suspend fun loadBusinessData(path: String): JsonElement =
        withContext(Dispatchers.IO) {
            api.businessData(path).requireBody(path)
        }

    private fun <T : Any> Response<T>.requireBody(operation: String): T {
        if (isSuccessful) {
            return body() ?: throw AuthFailure(
                "The server returned an empty response during $operation."
            )
        }

        val message = parseError(errorBody()?.string())
            ?: when (code()) {
                400 -> "Please check the submitted information."
                401 -> "Email or password is incorrect, or the session has expired."
                403 -> "Access denied."
                429 -> "Too many attempts. Please try again later."
                in 500..599 -> "The server is temporarily unavailable."
                else -> "Request failed (HTTP ${code()})."
            }

        throw AuthFailure(message, code())
    }

    private fun parseError(raw: String?): String? {
        if (raw.isNullOrBlank()) return null

        return try {
            val obj = json.parseToJsonElement(raw).jsonObject
            listOf("error", "message", "detail")
                .firstNotNullOfOrNull { key ->
                    obj[key]?.jsonPrimitive?.content
                        ?.takeIf { it.isNotBlank() }
                }
        } catch (_: Exception) {
            null
        }
    }
}
