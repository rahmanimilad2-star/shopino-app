package ir.shopino.app.data.auth

import android.content.Context
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import okhttp3.Interceptor
import okhttp3.OkHttpClient
import okhttp3.MediaType.Companion.toMediaType
import retrofit2.Response
import retrofit2.Retrofit
import com.jakewharton.retrofit2.converter.kotlinx.serialization.asConverterFactory

class AuthFailure(
    message: String,
    val httpCode: Int? = null
) : Exception(message)

class AuthRepository(
    context: Context,
    baseUrl: String
) {
    private val tokenStore = SecureTokenStore(context)

    private val json = Json {
        ignoreUnknownKeys = true
        isLenient = false
        explicitNulls = false
    }

    private val api: AuthApi

    init {
        val normalizedUrl = baseUrl.trim().let {
            if (it.endsWith("/")) it else "$it/"
        }

        val authInterceptor = Interceptor { chain ->
            val original = chain.request()
            val token = tokenStore.read()
            val request = original.newBuilder().apply {
                if (!token.isNullOrBlank()) {
                    header("Authorization", "Bearer $token")
                }
            }.build()
            chain.proceed(request)
        }

        val client = OkHttpClient.Builder()
            .addInterceptor(authInterceptor)
            .build()

        api = Retrofit.Builder()
            .baseUrl(normalizedUrl)
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
            tokenStore.save(body.token)
            body.user
        }

    suspend fun restoreSession(): AuthUser? = withContext(Dispatchers.IO) {
        if (tokenStore.read().isNullOrBlank()) return@withContext null

        val response = api.me()
        if (response.code() == 401) {
            tokenStore.clear()
            return@withContext null
        }

        val body = response.requireBody("session validation")
        body.user
    }

    suspend fun logout() = withContext(Dispatchers.IO) {
        try {
            if (!tokenStore.read().isNullOrBlank()) {
                api.logout()
            }
        } finally {
            tokenStore.clear()
        }
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

        if (code() == 401 && operation == "login") {
            throw AuthFailure(message, code())
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
