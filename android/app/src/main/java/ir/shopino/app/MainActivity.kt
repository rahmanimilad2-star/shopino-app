package ir.shopino.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import ir.shopino.app.data.auth.AuthFailure
import ir.shopino.app.data.auth.AuthRepository
import ir.shopino.app.data.auth.AuthUser
import ir.shopino.app.data.auth.SecureTokenStore
import ir.shopino.app.data.auth.ServerConfigStore
import ir.shopino.app.data.auth.ServerUrl
import ir.shopino.app.i18n.ShopinoStrings
import ir.shopino.app.ui.screens.auth.LoginScreen
import ir.shopino.app.ui.theme.ShopinoTheme
import ir.shopino.app.util.AppLanguage
import kotlinx.coroutines.launch
import java.io.IOException

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent { ShopinoRootApp() }
    }
}

@Composable
fun ShopinoRootApp() {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()

    var language by remember { mutableStateOf(AppLanguage.FA) }
    var darkTheme by remember { mutableStateOf(true) }
    // Compiled default (BuildConfig, from android/gradle.properties) unless the user saved a validated override.
    val serverConfig = remember { ServerConfigStore(context, allowDevelopmentHosts = BuildConfig.DEBUG) }
    val tokenStore = remember { SecureTokenStore(context) }
    var baseUrl by remember { mutableStateOf(serverConfig.readOverride() ?: BuildConfig.DEFAULT_BASE_URL) }
    var user by remember { mutableStateOf<AuthUser?>(null) }
    var checkingSession by remember { mutableStateOf(true) }
    var sessionRestoreFailed by remember { mutableStateOf(false) }
    var loading by remember { mutableStateOf(false) }
    var errorMessage by remember { mutableStateOf<String?>(null) }

    val repository = remember(baseUrl, context) {
        AuthRepository(context, baseUrl, tokenStore)
    }

    LaunchedEffect(repository) {
        checkingSession = true
        sessionRestoreFailed = false
        errorMessage = null
        try {
            user = repository.restoreSession()
        } catch (e: Exception) {
            user = null
            sessionRestoreFailed = true
            errorMessage = readableError(e, language)
        } finally {
            checkingSession = false
        }
    }

    ShopinoTheme(darkTheme = darkTheme, language = language) {
        when {
            checkingSession -> {
                Box(
                    modifier = Modifier.fillMaxSize(),
                    contentAlignment = Alignment.Center
                ) {
                    CircularProgressIndicator()
                }
            }

            sessionRestoreFailed -> {
                SessionRestoreError(
                    language = language,
                    message = errorMessage,
                    onRetry = {
                        if (!loading) {
                            scope.launch {
                                checkingSession = true
                                sessionRestoreFailed = false
                                errorMessage = null
                                try {
                                    user = repository.restoreSession()
                                } catch (e: Exception) {
                                    user = null
                                    sessionRestoreFailed = true
                                    errorMessage = readableError(e, language)
                                } finally {
                                    checkingSession = false
                                }
                            }
                        }
                    },
                    onContinueToLogin = {
                        sessionRestoreFailed = false
                    }
                )
            }
            user != null -> {
                AuthenticatedLanding(
                    user = user!!,
                    language = language,
                    onToggleLanguage = {
                        language = if (language == AppLanguage.FA) {
                            AppLanguage.EN
                        } else AppLanguage.FA
                    },
                    onToggleTheme = { darkTheme = !darkTheme },
                    onLogout = {
                        if (!loading) {
                            scope.launch {
                                loading = true
                                errorMessage = null
                                try {
                                    repository.logout()
                                    user = null
                                } catch (e: Exception) {
                                    errorMessage = readableError(e, language)
                                    user = null
                                } finally {
                                    loading = false
                                }
                            }
                        }
                    },
                    errorMessage = errorMessage,
                    loading = loading
                )
            }

            else -> {
                LoginScreen(
                    isLoading = loading,
                    errorMessage = errorMessage,
                    currentBaseUrl = baseUrl,
                    onLoginSubmit = { email, password ->
                        if (!loading) {
                            scope.launch {
                                loading = true
                                errorMessage = null
                                try {
                                    user = repository.login(email, password)
                                } catch (e: Exception) {
                                    errorMessage = readableError(e, language)
                                } finally {
                                    loading = false
                                }
                            }
                        }
                    },
                    isBaseUrlOverridden = baseUrl != BuildConfig.DEFAULT_BASE_URL,
                    onUpdateBaseUrl = { proposed ->
                        when (val result = ServerUrl.normalize(proposed, BuildConfig.DEBUG)) {
                            is ServerUrl.Result.Invalid -> result.reason
                            is ServerUrl.Result.Valid -> {
                                if (result.origin != baseUrl) {
                                    // New server: the previous server's token must never be reused.
                                    tokenStore.clear()
                                    if (result.origin == BuildConfig.DEFAULT_BASE_URL) {
                                        serverConfig.clearOverride()
                                    } else {
                                        serverConfig.writeOverride(result.origin)
                                    }
                                    baseUrl = result.origin
                                }
                                errorMessage = null
                                null
                            }
                        }
                    },
                    onResetBaseUrl = {
                        tokenStore.clear()
                        serverConfig.clearOverride()
                        baseUrl = BuildConfig.DEFAULT_BASE_URL
                        errorMessage = null
                    },
                    onToggleLanguage = {
                        language = if (language == AppLanguage.FA) {
                            AppLanguage.EN
                        } else AppLanguage.FA
                    },
                    onToggleTheme = { darkTheme = !darkTheme },
                    modifier = Modifier.fillMaxSize()
                )
            }
        }
    }
}

@Composable
private fun SessionRestoreError(
    language: AppLanguage,
    message: String?,
    onRetry: () -> Unit,
    onContinueToLogin: () -> Unit
) {
    Surface(modifier = Modifier.fillMaxSize()) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(24.dp),
            verticalArrangement = Arrangement.Center,
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Text(
                text = if (language == AppLanguage.FA) {
                    "بررسی نشست ناموفق بود"
                } else {
                    "Could not restore your session"
                },
                style = MaterialTheme.typography.titleLarge
            )
            Spacer(Modifier.height(12.dp))
            Text(
                text = message.orEmpty(),
                color = MaterialTheme.colorScheme.error
            )
            Spacer(Modifier.height(20.dp))
            Button(onClick = onRetry) {
                Text(if (language == AppLanguage.FA) "تلاش دوباره" else "Retry")
            }
            TextButton(onClick = onContinueToLogin) {
                Text(
                    if (language == AppLanguage.FA) {
                        "رفتن به صفحه ورود"
                    } else {
                        "Continue to login"
                    }
                )
            }
        }
    }
}
private fun readableError(error: Exception, language: AppLanguage): String {
    if (error is AuthFailure) {
        val code = error.httpCode
        val key = when {
            code == 401 -> "err_invalid_credentials"
            code == 429 -> "err_too_many"
            code != null && code >= 500 -> "err_server"
            else -> null
        }
        if (key != null) return ShopinoStrings.t(key, language)
        if (!error.message.isNullOrBlank()) return error.message!!
    }

    return when {
        error is IOException -> if (language == AppLanguage.FA) {
            "اتصال به سرور برقرار نشد. اینترنت و آدرس سرور را بررسی کن."
        } else {
            "Could not connect to the server. Check your internet and server URL."
        }

        language == AppLanguage.FA ->
            "خطای غیرمنتظره رخ داد. دوباره تلاش کن."

        else -> "An unexpected error occurred. Please try again."
    }
}

/**
 * TEMPORARY post-login screen (pre-existing in this snapshot). It is shown only after a server-confirmed login
 * or a server-validated restored session. The real AppShell/dashboard is NOT part of this source snapshot and
 * must replace this composable; see the integration notes delivered with the patch.
 */
@Composable
private fun AuthenticatedLanding(
    user: AuthUser,
    language: AppLanguage,
    onToggleLanguage: () -> Unit,
    onToggleTheme: () -> Unit,
    onLogout: () -> Unit,
    errorMessage: String?,
    loading: Boolean
) {
    Surface(modifier = Modifier.fillMaxSize()) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(24.dp),
            verticalArrangement = Arrangement.Center,
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Text(
                text = if (language == AppLanguage.FA) "شوپینو" else "Shopino",
                style = MaterialTheme.typography.headlineLarge
            )
            Spacer(Modifier.height(20.dp))
            Text(
                text = if (language == AppLanguage.FA) {
                    "ورود موفق بود"
                } else {
                    "Successfully signed in"
                },
                style = MaterialTheme.typography.titleLarge
            )
            Spacer(Modifier.height(16.dp))
            Text(if (language == AppLanguage.FA) user.nameFa else user.name)
            Text(user.email)
            Text(
                text = (if (language == AppLanguage.FA) "نقش: " else "Role: ") +
                    user.role
            )
            Text(
                text = (if (language == AppLanguage.FA) "وضعیت: " else "Status: ") +
                    user.status
            )

            if (!errorMessage.isNullOrBlank()) {
                Spacer(Modifier.height(12.dp))
                Text(
                    text = errorMessage,
                    color = MaterialTheme.colorScheme.error
                )
            }

            Spacer(Modifier.height(24.dp))
            Button(onClick = onLogout, enabled = !loading) {
                Text(
                    if (language == AppLanguage.FA) {
                        if (loading) "در حال خروج..." else "خروج از حساب"
                    } else {
                        if (loading) "Signing out..." else "Sign out"
                    }
                )
            }

            Spacer(Modifier.height(12.dp))
            TextButton(onClick = onToggleLanguage) {
                Text(if (language == AppLanguage.FA) "English" else "فارسی")
            }
            TextButton(onClick = onToggleTheme) {
                Text(if (language == AppLanguage.FA) "تغییر پوسته" else "Toggle theme")
            }
        }
    }
}
