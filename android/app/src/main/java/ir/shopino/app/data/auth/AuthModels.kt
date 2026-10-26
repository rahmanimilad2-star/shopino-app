package ir.shopino.app.data.auth

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonElement

@Serializable
data class LoginRequest(
    val email: String,
    val password: String
)

@Serializable
data class AuthUser(
    val id: String,
    val name: String,
    @SerialName("name_fa") val nameFa: String,
    val email: String,
    val role: String,
    val status: String
)

@Serializable
data class LoginResponse(
    val token: String,
    val user: AuthUser
)

@Serializable
data class MeResponse(
    val user: AuthUser,
    val settings: JsonElement? = null,
    val allowDemoLogin: Boolean = false,
    val unreadNotificationsCount: Int = 0
)
