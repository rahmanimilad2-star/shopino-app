package ir.shopino.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonElement
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Card
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.layout.fillMaxWidth
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
                    repository = repository,
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


@Composable
private fun AuthenticatedLanding(
    user: AuthUser,
    repository: AuthRepository,
    language: AppLanguage,
    onToggleLanguage: () -> Unit,
    onToggleTheme: () -> Unit,
    onLogout: () -> Unit,
    errorMessage: String?,
    loading: Boolean
) {
    var section by remember { mutableStateOf("dashboard") }
    var data by remember(section) { mutableStateOf<JsonElement?>(null) }
    var requestError by remember(section) { mutableStateOf<String?>(null) }
    var refreshing by remember(section) { mutableStateOf(true) }
    val scope = rememberCoroutineScope()
    val fa = language == AppLanguage.FA

    val labels = mapOf(
        "dashboard" to if (fa) "خانه" else "Home",
        "orders" to if (fa) "سفارش‌ها" else "Orders",
        "customers" to if (fa) "مشتریان" else "Customers",
        "products" to if (fa) "محصولات" else "Products",
        "payments" to if (fa) "پرداخت‌ها" else "Payments",
        "reports" to if (fa) "گزارش‌ها" else "Reports"
    )

    LaunchedEffect(section, repository) {
        refreshing = true
        requestError = null
        try {
            data = repository.loadBusinessData("api/$section")
        } catch (e: Exception) {
            data = null
            requestError = readableError(e, language)
        } finally {
            refreshing = false
        }
    }

    Surface(Modifier.fillMaxSize()) {
        Column(Modifier.fillMaxSize()) {
            Row(
                Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 12.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Column(Modifier.weight(1f)) {
                    Text("Shopino", style = MaterialTheme.typography.headlineSmall,
                        fontWeight = FontWeight.Bold)
                    Text(
                        if (fa) "سلام، ${user.nameFa.ifBlank { user.name }}"
                        else "Hello, ${user.name}",
                        style = MaterialTheme.typography.bodyMedium
                    )
                }
                TextButton(onClick = onToggleLanguage) {
                    Text(if (fa) "EN" else "فا")
                }
                TextButton(onClick = onToggleTheme) {
                    Text(if (fa) "پوسته" else "Theme")
                }
                TextButton(onClick = onLogout, enabled = !loading) {
                    Text(if (fa) "خروج" else "Logout")
                }
            }
            HorizontalDivider()

            NavigationBar {
                listOf("dashboard", "orders", "customers", "products").forEach { key ->
                    NavigationBarItem(
                        selected = section == key,
                        onClick = { section = key },
                        icon = {},
                        label = { Text(labels[key].orEmpty(), maxLines = 1) }
                    )
                }
            }

            Row(
                Modifier.fillMaxWidth().padding(horizontal = 12.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                listOf("payments", "reports").forEach { key ->
                    OutlinedButton(
                        onClick = { section = key },
                        modifier = Modifier.weight(1f)
                    ) { Text(labels[key].orEmpty()) }
                }
            }

            if (!errorMessage.isNullOrBlank()) {
                Text(errorMessage, Modifier.padding(12.dp),
                    color = MaterialTheme.colorScheme.error)
            }

            when {
                refreshing -> Box(
                    Modifier.fillMaxSize(),
                    contentAlignment = Alignment.Center
                ) { CircularProgressIndicator() }

                requestError != null -> Column(
                    Modifier.fillMaxSize().padding(24.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.Center
                ) {
                    Text(if (fa) "دریافت اطلاعات فروشگاه ناموفق بود"
                         else "Could not load store data")
                    Spacer(Modifier.height(8.dp))
                    Text(requestError.orEmpty(), color = MaterialTheme.colorScheme.error)
                    Spacer(Modifier.height(12.dp))
                    Button(onClick = {
                        scope.launch {
                            refreshing = true
                            requestError = null
                            try {
                                data = repository.loadBusinessData("api/$section")
                            } catch (e: Exception) {
                                requestError = readableError(e, language)
                            } finally {
                                refreshing = false
                            }
                        }
                    }) { Text(if (fa) "تلاش دوباره" else "Retry") }
                }

                data != null -> BusinessDataContent(data!!, section, language)
            }
        }
    }
}

@Composable
private fun BusinessDataContent(data: JsonElement, section: String, language: AppLanguage) {
    val fa = language == AppLanguage.FA
    val root = data as? JsonObject
    val listKey = when (section) {
        "orders" -> "orders"
        "customers" -> "customers"
        "products" -> "products"
        "payments" -> "payments"
        else -> null
    }
    val records = listKey?.let { root?.get(it) as? JsonArray }

    LazyColumn(
        modifier = Modifier.fillMaxSize().padding(horizontal = 16.dp, vertical = 12.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        if (section == "dashboard") {
            val kpis = root?.get("kpis") as? JsonObject
            val metrics = listOf(
                "todaySales" to if (fa) "فروش امروز" else "Today's sales",
                "periodSales" to if (fa) "فروش دوره" else "Period sales",
                "todayReceived" to if (fa) "دریافتی امروز" else "Received today",
                "customerDebts" to if (fa) "بدهی مشتریان" else "Customer debts",
                "todayOrdersCount" to if (fa) "سفارش‌های امروز" else "Orders today",
                "lowStockCount" to if (fa) "کالاهای کم‌موجود" else "Low-stock products"
            )
            item {
                Text(if (fa) "خلاصه فروشگاه" else "Store overview",
                    style = MaterialTheme.typography.titleLarge,
                    fontWeight = FontWeight.Bold)
            }
            items(metrics) { (key, title) ->
                val value = (kpis?.get(key) as? JsonPrimitive)?.content ?: "—"
                Card(
                    Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(
                        containerColor = MaterialTheme.colorScheme.surfaceVariant
                    )
                ) {
                    Column(Modifier.padding(16.dp)) {
                        Text(title, style = MaterialTheme.typography.bodyMedium)
                        Text(value, style = MaterialTheme.typography.headlineSmall,
                            fontWeight = FontWeight.Bold)
                    }
                }
            }
            item {
                Text(if (fa) "سفارش‌های اخیر" else "Recent orders",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold)
            }
            val recent = root?.get("recentOrders") as? JsonArray
            items(recent?.toList().orEmpty()) { DataRow(it, fa) }
        } else if (records != null) {
            item {
                Text(if (fa) "اطلاعات فروشگاه" else "Store data",
                    style = MaterialTheme.typography.titleLarge,
                    fontWeight = FontWeight.Bold)
            }
            items(records.toList()) { DataRow(it, fa) }
        } else {
            item { Text(data.toString(), style = MaterialTheme.typography.bodyMedium) }
        }
    }
}

@Composable
private fun DataRow(item: JsonElement, fa: Boolean) {
    val obj = item as? JsonObject
    val title = listOf(
        "name_fa", "name", "customer_name", "order_number", "sku", "payment_number"
    ).firstNotNullOfOrNull { key ->
        (obj?.get(key) as? JsonPrimitive)?.content?.takeIf { it.isNotBlank() }
    } ?: if (fa) "رکورد فروشگاه" else "Store record"

    val subtitle = listOf("status", "phone", "email", "order_date", "payment_date")
        .firstNotNullOfOrNull { key ->
            (obj?.get(key) as? JsonPrimitive)?.content?.takeIf { it.isNotBlank() }
        }
    val amount = listOf("final_total", "sale_price", "amount", "outstanding_balance")
        .firstNotNullOfOrNull { key ->
            (obj?.get(key) as? JsonPrimitive)?.content
                ?.takeIf { it.isNotBlank() && it != "null" }
        }

    Card(Modifier.fillMaxWidth()) {
        Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text(title, style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.SemiBold)
            if (subtitle != null) Text(subtitle,
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant)
            if (amount != null) Text(amount, style = MaterialTheme.typography.bodyLarge)
        }
    }
}
