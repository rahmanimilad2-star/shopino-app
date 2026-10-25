package ir.shopino.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import ir.shopino.app.ui.screens.preview.FoundationPreviewScreen
import ir.shopino.app.ui.theme.ShopinoTheme
import ir.shopino.app.util.AppLanguage

/**
 * Stage 2: isolated, UI-only preview.
 * Authentication and backend requests are intentionally not connected.
 */
class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        setContent {
            ShopinoRootApp()
        }
    }
}

@Composable
fun ShopinoRootApp() {
    var language by remember { mutableStateOf(AppLanguage.FA) }
    var darkTheme by remember { mutableStateOf(true) }
    var baseUrl by remember { mutableStateOf(BuildConfig.DEFAULT_BASE_URL) }

    ShopinoTheme(
        darkTheme = darkTheme,
        language = language
    ) {
        FoundationPreviewScreen(
            currentBaseUrl = baseUrl,
            onToggleLanguage = {
                language = if (language == AppLanguage.FA) {
                    AppLanguage.EN
                } else {
                    AppLanguage.FA
                }
            },
            onToggleTheme = {
                darkTheme = !darkTheme
            },
            onUpdateBaseUrl = { baseUrl = it },
            onNavigateToLiveLogin = {
                // Stage 2 is a visual preview; no real login is performed.
            },
            modifier = Modifier.fillMaxSize()
        )
    }
}
