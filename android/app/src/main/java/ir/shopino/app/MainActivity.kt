package ir.shopino.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import ir.shopino.app.data.local.SessionStore
import ir.shopino.app.data.remote.NetworkClient
import ir.shopino.app.data.repository.AuthRepository
import ir.shopino.app.data.repository.AuthResult
import ir.shopino.app.ui.screens.auth.LoginScreen
import ir.shopino.app.ui.screens.preview.FoundationPreviewScreen
import ir.shopino.app.ui.theme.ShopinoTheme
import ir.shopino.app.util.AppLanguage
import kotlinx.coroutines.launch

/**
 * MainActivity hosting the Stage 2 Shopino Android foundation, navigation graph,
 * session management, and interactive visual design preview.
 */
class MainActivity : ComponentActivity() {

    private lateinit var sessionStore: SessionStore
    private lateinit var networkClient: NetworkClient
    private lateinit var authRepository: AuthRepository

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        sessionStore = SessionStore(applicationContext)
        networkClient = NetworkClient(sessionStore)
        authRepository = AuthRepository(networkClient, sessionStore)

        setContent {
            ShopinoRootApp(
                sessionStore = sessionStore,
                authRepository = authRepository
            )
        }
    }
}

@Composable
fun ShopinoRootApp(
    sessionStore: SessionStore,
    authRepository: AuthRepository
) {
    val sessionState by sessionStore.sessionState.collectAsState()
    val navController = rememberNavController()
    val scope = rememberCoroutineScope()

    var isAuthLoading by remember { mutableStateOf(false) }
    var authError by remember { mutableStateOf<String?>(null) }

    val toggleLanguage: () -> Unit = {
        val nextLang = if (sessionState.language == AppLanguage.FA) AppLanguage.EN else AppLanguage.FA
        sessionStore.setLanguage(nextLang)
    }

    val toggleTheme: () -> Unit = {
        sessionStore.setDarkTheme(!sessionState.isDarkTheme)
    }

    ShopinoTheme(
        darkTheme = sessionState.isDarkTheme,
        language = sessionState.language
    ) {
        NavHost(
            navController = navController,
            startDestination = "foundation_preview",
            modifier = Modifier.fillMaxSize()
        ) {
            composable("foundation_preview") {
                FoundationPreviewScreen(
                    currentBaseUrl = sessionState.baseUrl,
                    onToggleLanguage = toggleLanguage,
                    onToggleTheme = toggleTheme,
                    onUpdateBaseUrl = { sessionStore.setBaseUrl(it) },
                    onNavigateToLiveLogin = {
                        authError = null
                        navController.navigate("login")
                    }
                )
            }

            composable("login") {
                LoginScreen(
                    isLoading = isAuthLoading,
                    errorMessage = authError,
                    currentBaseUrl = sessionState.baseUrl,
                    onLoginSubmit = { username, password ->
                        scope.launch {
                            isAuthLoading = true
                            authError = null
                            when (val result = authRepository.login(username, password)) {
                                is AuthResult.Success -> {
                                    isAuthLoading = false
                                    navController.navigate("foundation_preview") {
                                        popUpTo("foundation_preview") { inclusive = true }
                                    }
                                }
                                is AuthResult.Error -> {
                                    isAuthLoading = false
                                    authError = result.message
                                }
                            }
                        }
                    },
                    onUpdateBaseUrl = { sessionStore.setBaseUrl(it) },
                    onToggleLanguage = toggleLanguage,
                    onToggleTheme = toggleTheme,
                    onBackToPreview = {
                        navController.popBackStack()
                    }
                )
            }
        }
    }
}
