package ir.shopino.app.data.auth

import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Path
import kotlinx.serialization.json.JsonElement

interface AuthApi {
    @POST("api/auth/login")
    suspend fun login(
        @Body request: LoginRequest
    ): Response<LoginResponse>

    @GET("api/auth/me")
    suspend fun me(): Response<MeResponse>

    @POST("api/auth/logout")
    suspend fun logout(): Response<Unit>

    @GET("{path}")
    suspend fun businessData(
        @Path(value = "path", encoded = true) path: String
    ): Response<JsonElement>
}
