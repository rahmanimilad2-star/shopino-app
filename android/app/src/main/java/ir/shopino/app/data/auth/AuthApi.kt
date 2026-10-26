package ir.shopino.app.data.auth

import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST

interface AuthApi {
    @POST("api/auth/login")
    suspend fun login(
        @Body request: LoginRequest
    ): Response<LoginResponse>

    @GET("api/auth/me")
    suspend fun me(): Response<MeResponse>

    @POST("api/auth/logout")
    suspend fun logout(): Response<Unit>
}
