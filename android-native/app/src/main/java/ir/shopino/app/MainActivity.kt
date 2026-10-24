package ir.shopino.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.io.IOException
import java.util.concurrent.TimeUnit

private val Navy = Color(0xFF101827)
private val Panel = Color(0xFF1B2638)
private val Teal = Color(0xFF20D6C2)
private val Muted = Color(0xFF9BA9BC)
private val AppBackground = Color(0xFF0B1220)

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        setContent {
            CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Rtl) {
                MaterialTheme(
                    colorScheme = darkColorScheme(
                        primary = Teal,
                        onPrimary = Navy,
                        background = AppBackground,
                        surface = Panel,
                        onSurface = Color.White
                    )
                ) {
                    ShopinoApp()
                }
            }
        }
    }
}

private object ShopinoApi {
    private const val BASE = BuildConfig.API_BASE_URL
    private val client = OkHttpClient.Builder()
        .connectTimeout(12, TimeUnit.SECONDS)
        .readTimeout(20, TimeUnit.SECONDS)
        .callTimeout(25, TimeUnit.SECONDS)
        .build()

    fun request(
        path: String,
        token: String? = null,
        body: JSONObject? = null,
        method: String = if (body != null) "POST" else "GET"
    ): JSONObject {
        val builder = Request.Builder().url("$BASE$path")
        if (token != null) builder.header("Authorization", "Bearer $token")

        when (method) {
            "GET" -> builder.get()
            "POST" -> builder.post(
                (body ?: JSONObject()).toString()
                    .toRequestBody("application/json; charset=utf-8".toMediaType())
            )
            else -> throw IllegalArgumentException("HTTP method not supported: $method")
        }

        client.newCall(builder.build()).execute().use { response ->
            val text = response.body?.string().orEmpty()
            val json = try {
                JSONObject(text)
            } catch (_: Exception) {
                JSONObject()
            }

            if (!response.isSuccessful) {
                throw IOException(
                    json.optString("error").ifBlank {
                        "خطای سرور (${response.code})"
                    }
                )
            }
            return json
        }
    }
}

private fun money(value: Any?): String {
    val number = when (value) {
        is Number -> value.toDouble()
        is String -> value.toDoubleOrNull() ?: return value
        else -> return "—"
    }
    return "%,.0f".format(number)
}

@Composable
private fun ShopinoApp() {
    val context = androidx.compose.ui.platform.LocalContext.current
    val scope = rememberCoroutineScope()

    var token by remember { mutableStateOf<String?>(null) }
    var userName by remember { mutableStateOf("") }
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var error by remember { mutableStateOf("") }
    var loading by remember { mutableStateOf(false) }
    var section by remember { mutableStateOf("dashboard") }
    var dashboard by remember { mutableStateOf<JSONObject?>(null) }
    var records by remember { mutableStateOf<List<String>>(emptyList()) }
    var refreshing by remember { mutableStateOf(false) }

    fun loadSection(currentToken: String, selected: String) {
        scope.launch {
            refreshing = true
            error = ""
            try {
                val result = withContext(Dispatchers.IO) {
                    when (selected) {
                        "dashboard" -> ShopinoApi.request("/api/dashboard", currentToken)
                        "products" -> ShopinoApi.request("/api/products", currentToken)
                        "orders" -> ShopinoApi.request("/api/orders", currentToken)
                        "customers" -> ShopinoApi.request("/api/customers", currentToken)
                        else -> JSONObject()
                    }
                }

                when (selected) {
                    "dashboard" -> dashboard = result
                    "products" -> records = result.optJSONArray("products").toStringList()
                    "orders" -> records = result.optJSONArray("orders").toStringList()
                    "customers" -> records = result.optJSONArray("customers").toStringList()
                }
            } catch (e: Exception) {
                error = e.message ?: "ارتباط با سرور برقرار نشد."
                if (error.contains("401") || error.contains("authenticated", true)) {
                    token = null
                }
            } finally {
                refreshing = false
            }
        }
    }

    LaunchedEffect(Unit) {
        try {
            val key = MasterKey.Builder(context)
                .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
                .build()
            val prefs = EncryptedSharedPreferences.create(
                context,
                "shopino_secure_session",
                key,
                EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
                EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
            )
            val saved = prefs.getString("token", null)
            if (!saved.isNullOrBlank()) {
                try {
                    val me = withContext(Dispatchers.IO) {
                        ShopinoApi.request("/api/auth/me", saved)
                    }
                    token = saved
                    userName = me.optJSONObject("user")?.optString("name_fa")
                        ?.takeIf { !it.isNullOrBlank() }
                        ?: me.optJSONObject("user")?.optString("name").orEmpty()
                    loadSection(saved, "dashboard")
                } catch (_: Exception) {
                    prefs.edit().remove("token").apply()
                }
            }
        } catch (_: Exception) {
            error = "ذخیره‌سازی امن نشست آماده نشد."
        }
    }

    if (token == null) {
        LoginScreen(
            email = email,
            password = password,
            loading = loading,
            error = error,
            onEmail = { email = it },
            onPassword = { password = it },
            onLogin = {
                scope.launch {
                    loading = true
                    error = ""
                    try {
                        val result = withContext(Dispatchers.IO) {
                            ShopinoApi.request(
                                "/api/auth/login",
                                body = JSONObject().put("email", email.trim()).put("password", password)
                            )
                        }
                        val newToken = result.optString("token")
                        if (newToken.isBlank()) throw IOException("توکن ورود از سرور دریافت نشد.")

                        val key = MasterKey.Builder(context)
                            .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
                            .build()
                        val prefs = EncryptedSharedPreferences.create(
                            context,
                            "shopino_secure_session",
                            key,
                            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
                            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
                        )
                        prefs.edit().putString("token", newToken).apply()

                        userName = result.optJSONObject("user")?.optString("name_fa")
                            ?.takeIf { !it.isNullOrBlank() }
                            ?: result.optJSONObject("user")?.optString("name").orEmpty()
                        token = newToken
                        section = "dashboard"
                        loadSection(newToken, "dashboard")
                    } catch (e: Exception) {
                        error = e.message ?: "ورود ناموفق بود. اتصال اینترنت را بررسی کنید."
                    } finally {
                        loading = false
                    }
                }
            }
        )
    } else {
        MainScreen(
            userName = userName,
            section = section,
            dashboard = dashboard,
            records = records,
            loading = refreshing,
            error = error,
            onSelect = {
                section = it
                loadSection(token!!, it)
            },
            onRefresh = { loadSection(token!!, section) },
            onLogout = {
                val oldToken = token
                scope.launch {
                    withContext(Dispatchers.IO) {
                        try {
                            ShopinoApi.request("/api/auth/logout", oldToken, method = "POST")
                        } catch (_: Exception) {
                        }
                    }
                    try {
                        val key = MasterKey.Builder(context)
                            .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
                            .build()
                        EncryptedSharedPreferences.create(
                            context,
                            "shopino_secure_session",
                            key,
                            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
                            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
                        ).edit().remove("token").apply()
                    } catch (_: Exception) {
                    }
                    token = null
                    password = ""
                    dashboard = null
                    records = emptyList()
                    error = ""
                }
            }
        )
    }
}

private fun org.json.JSONArray?.toStringList(): List<String> {
    if (this == null) return emptyList()
    return (0 until length()).map { index ->
        val item = optJSONObject(index)
        if (item == null) {
            optString(index)
        } else {
            val title = item.optString("name_fa").ifBlank {
                item.optString("name").ifBlank {
                    item.optString("customer_name").ifBlank {
                        item.optString("id", "رکورد")
                    }
                }
            }
            val details = listOf(
                item.optString("sku"),
                item.optString("phone"),
                item.optString("payment_status"),
                item.optString("status")
            ).filter { it.isNotBlank() && it != "null" }.distinct().joinToString(" • ")
            if (details.isBlank()) title else "$title\n$details"
        }
    }
}

@Composable
private fun BrandHeader() {
    Row(verticalAlignment = Alignment.CenterVertically) {
        Box(
            modifier = Modifier
                .size(48.dp)
                .background(Teal, RoundedCornerShape(16.dp)),
            contentAlignment = Alignment.Center
        ) {
            Icon(Icons.Default.Storefront, contentDescription = null, tint = Navy, modifier = Modifier.size(29.dp))
        }
        Spacer(Modifier.width(12.dp))
        Column {
            Text("SHOPINO", fontSize = 22.sp, fontWeight = FontWeight.Black, color = Color.White)
            Text("مدیریت هوشمند فروشگاه", fontSize = 12.sp, color = Muted)
        }
    }
}

@Composable
private fun LoginScreen(
    email: String,
    password: String,
    loading: Boolean,
    error: String,
    onEmail: (String) -> Unit,
    onPassword: (String) -> Unit,
    onLogin: () -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(AppBackground)
            .imePadding()
            .padding(horizontal = 24.dp),
        verticalArrangement = Arrangement.Center
    ) {
        BrandHeader()
        Spacer(Modifier.height(36.dp))
        Text("خوش آمدید", fontSize = 29.sp, fontWeight = FontWeight.Bold, color = Color.White)
        Spacer(Modifier.height(8.dp))
        Text("برای ورود به پنل فروشگاه اطلاعات حساب خود را وارد کنید.", color = Muted, fontSize = 14.sp)
        Spacer(Modifier.height(28.dp))

        OutlinedTextField(
            value = email,
            onValueChange = onEmail,
            modifier = Modifier.fillMaxWidth(),
            label = { Text("ایمیل") },
            singleLine = true,
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email),
            shape = RoundedCornerShape(16.dp),
            colors = OutlinedTextFieldDefaults.colors(
                focusedBorderColor = Teal,
                unfocusedBorderColor = Panel,
                focusedLabelColor = Teal,
                cursorColor = Teal
            )
        )
        Spacer(Modifier.height(14.dp))
        OutlinedTextField(
            value = password,
            onValueChange = onPassword,
            modifier = Modifier.fillMaxWidth(),
            label = { Text("رمز عبور") },
            singleLine = true,
            visualTransformation = PasswordVisualTransformation(),
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
            shape = RoundedCornerShape(16.dp),
            colors = OutlinedTextFieldDefaults.colors(
                focusedBorderColor = Teal,
                unfocusedBorderColor = Panel,
                focusedLabelColor = Teal,
                cursorColor = Teal
            )
        )
        if (error.isNotBlank()) {
            Spacer(Modifier.height(12.dp))
            Text(error, color = Color(0xFFFF8A8A), fontSize = 13.sp)
        }
        Spacer(Modifier.height(22.dp))
        Button(
            onClick = onLogin,
            enabled = !loading && email.isNotBlank() && password.isNotBlank(),
            modifier = Modifier.fillMaxWidth().height(54.dp),
            shape = RoundedCornerShape(16.dp),
            colors = ButtonDefaults.buttonColors(containerColor = Teal, contentColor = Navy)
        ) {
            if (loading) CircularProgressIndicator(
                modifier = Modifier.size(22.dp),
                color = Navy,
                strokeWidth = 2.dp
            ) else Text("ورود به پنل", fontWeight = FontWeight.Bold, fontSize = 16.sp)
        }
        Spacer(Modifier.height(20.dp))
        Text("اتصال امن به پنل فروشگاه", color = Muted, fontSize = 12.sp)
    }
}

@Composable
private fun MainScreen(
    userName: String,
    section: String,
    dashboard: JSONObject?,
    records: List<String>,
    loading: Boolean,
    error: String,
    onSelect: (String) -> Unit,
    onRefresh: () -> Unit,
    onLogout: () -> Unit
) {
    val sections = listOf(
        Triple("dashboard", "داشبورد", Icons.Default.Dashboard),
        Triple("products", "محصولات", Icons.Default.Inventory2),
        Triple("orders", "سفارش‌ها", Icons.Default.ReceiptLong),
        Triple("customers", "مشتریان", Icons.Default.People)
    )

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(AppBackground)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 18.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            BrandHeader()
            IconButton(onClick = onLogout) {
                Icon(Icons.Default.Logout, contentDescription = "خروج", tint = Muted)
            }
        }

        Row(
            modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            sections.forEach { item ->
                val selected = section == item.first
                Surface(
                    onClick = { onSelect(item.first) },
                    modifier = Modifier.weight(1f),
                    shape = RoundedCornerShape(14.dp),
                    color = if (selected) Teal else Panel
                ) {
                    Column(
                        modifier = Modifier.padding(vertical = 12.dp, horizontal = 3.dp),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Icon(
                            item.third,
                            contentDescription = null,
                            tint = if (selected) Navy else Muted,
                            modifier = Modifier.size(21.dp)
                        )
                        Spacer(Modifier.height(5.dp))
                        Text(
                            item.second,
                            fontSize = 10.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = if (selected) Navy else Color.White,
                            maxLines = 1
                        )
                    }
                }
            }
        }

        Row(
            modifier = Modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 20.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column {
                Text(
                    when (section) {
                        "products" -> "مدیریت محصولات"
                        "orders" -> "مدیریت سفارش‌ها"
                        "customers" -> "مدیریت مشتریان"
                        else -> "داشبورد فروشگاه"
                    },
                    color = Color.White,
                    fontSize = 22.sp,
                    fontWeight = FontWeight.Bold
                )
                Text(
                    if (userName.isBlank()) "به پنل Shopino خوش آمدید" else "خوش آمدید، $userName",
                    color = Muted,
                    fontSize = 12.sp
                )
            }
            IconButton(onClick = onRefresh, enabled = !loading) {
                if (loading) {
                    CircularProgressIndicator(Modifier.size(22.dp), color = Teal, strokeWidth = 2.dp)
                } else {
                    Icon(Icons.Default.Refresh, contentDescription = "به‌روزرسانی", tint = Teal)
                }
            }
        }

        if (error.isNotBlank()) {
            Surface(
                modifier = Modifier.fillMaxWidth().padding(horizontal = 20.dp),
                color = Color(0xFF3B2029),
                shape = RoundedCornerShape(12.dp)
            ) {
                Text(error, color = Color(0xFFFFB6B6), modifier = Modifier.padding(14.dp), fontSize = 13.sp)
            }
            Spacer(Modifier.height(12.dp))
        }

        when (section) {
            "dashboard" -> DashboardContent(dashboard)
            else -> RecordsContent(section, records, loading)
        }
    }
}

@Composable
private fun DashboardContent(data: JSONObject?) {
    val kpis = data?.optJSONObject("kpis")
    val cards = listOf(
        Triple("فروش امروز", kpis?.opt("todaySales"), Icons.Default.TrendingUp),
        Triple("فروش دوره", kpis?.opt("periodSales"), Icons.Default.Assessment),
        Triple("دریافتی امروز", kpis?.opt("todayReceived"), Icons.Default.Payments),
        Triple("مانده بدهی مشتریان", kpis?.opt("customerDebts"), Icons.Default.AccountBalanceWallet),
        Triple("سفارش‌های امروز", kpis?.opt("todayOrdersCount"), Icons.Default.ReceiptLong),
        Triple("موجودی کم", kpis?.opt("lowStockCount"), Icons.Default.Inventory)
    )

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(start = 20.dp, end = 20.dp, bottom = 24.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        item {
            Surface(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(22.dp),
                color = Panel
            ) {
                Row(
                    modifier = Modifier.padding(20.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text("نمای کلی کسب‌وکار", color = Color.White, fontSize = 18.sp, fontWeight = FontWeight.Bold)
                        Spacer(Modifier.height(6.dp))
                        Text("خلاصهٔ اطلاعات دریافتی از سرور", color = Muted, fontSize = 12.sp)
                    }
                    Box(
                        modifier = Modifier.size(54.dp).background(Teal.copy(alpha = 0.14f), CircleShape),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(Icons.Default.Store, contentDescription = null, tint = Teal, modifier = Modifier.size(28.dp))
                    }
                }
            }
        }
        items(cards.chunked(2)) { pair ->
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                pair.forEach { card ->
                    Surface(
                        modifier = Modifier.weight(1f),
                        shape = RoundedCornerShape(18.dp),
                        color = Panel
                    ) {
                        Column(Modifier.padding(16.dp)) {
                            Icon(card.third, contentDescription = null, tint = Teal, modifier = Modifier.size(24.dp))
                            Spacer(Modifier.height(14.dp))
                            Text(card.first, color = Muted, fontSize = 12.sp)
                            Spacer(Modifier.height(8.dp))
                            val value = card.second
                            Text(
                                if (value == null || value == JSONObject.NULL) "—" else money(value),
                                color = Color.White,
                                fontWeight = FontWeight.Bold,
                                fontSize = 18.sp
                            )
                        }
                    }
                }
            }
        }
        item {
            Text(
                "مقادیر این صفحه از API پنل دریافت می‌شوند.",
                color = Muted,
                fontSize = 11.sp,
                modifier = Modifier.padding(top = 4.dp)
            )
        }
    }
}

@Composable
private fun RecordsContent(section: String, records: List<String>, loading: Boolean) {
    if (loading && records.isEmpty()) {
        Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            CircularProgressIndicator(color = Teal)
        }
    } else if (records.isEmpty()) {
        Box(Modifier.fillMaxSize().padding(28.dp), contentAlignment = Alignment.Center) {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Icon(Icons.Default.Inbox, contentDescription = null, tint = Muted, modifier = Modifier.size(42.dp))
                Spacer(Modifier.height(12.dp))
                Text("موردی برای نمایش دریافت نشد.", color = Muted)
            }
        }
    } else {
        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(horizontal = 20.dp, vertical = 4.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            items(records) { record ->
                Surface(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(16.dp),
                    color = Panel
                ) {
                    Row(
                        modifier = Modifier.padding(16.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Box(
                            modifier = Modifier.size(42.dp).background(Teal.copy(alpha = 0.12f), CircleShape),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(
                                when (section) {
                                    "products" -> Icons.Default.Inventory2
                                    "orders" -> Icons.Default.ReceiptLong
                                    else -> Icons.Default.Person
                                },
                                contentDescription = null,
                                tint = Teal
                            )
                        }
                        Spacer(Modifier.width(12.dp))
                        Text(record, color = Color.White, fontSize = 14.sp, modifier = Modifier.weight(1f))
                    }
                }
            }
        }
    }
}
