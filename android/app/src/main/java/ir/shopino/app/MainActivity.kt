package ir.shopino.app

import android.net.Uri
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
    var baseUrl by remember { mutableStateOf(BuildConfig.DEFAULT_BASE_URL) }
    var user by remember { mutableStateOf<AuthUser?>(null) }
    var checkingSession by remember { mutableStateOf(true) }
    var sessionRestoreFailed by remember { mutableStateOf(false) }
    var loading by remember { mutableStateOf(false) }
    var errorMessage by remember { mutableStateOf<String?>(null) }

    val repository = remember(baseUrl, context) {
        AuthRepository(context, baseUrl)
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
                    onUpdateBaseUrl = { proposed ->
                        val trimmed = proposed.trim()
                        val uri = Uri.parse(trimmed)
                        if (
                            (uri.scheme == "https" || uri.scheme == "http") &&
                            !uri.host.isNullOrBlank()
                        ) {
                            baseUrl = if (trimmed.endsWith("/")) trimmed else "$trimmed/"
                            errorMessage = null
                        } else {
                            errorMessage = if (language == AppLanguage.FA) {
                                "آدرس سرور معتبر نیست؛ آدرس کامل http یا https وارد کن."
                            } else {
                                "Invalid server URL. Enter a complete http or https URL."
                            }
                        }
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
    if (error is AuthFailure && !error.message.isNullOrBlank()) {
        return error.message!!
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
