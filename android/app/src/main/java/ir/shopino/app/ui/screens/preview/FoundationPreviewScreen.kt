package ir.shopino.app.ui.screens.preview

import androidx.compose.animation.Crossfade
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.AccountBalanceWallet
import androidx.compose.material.icons.outlined.AddBox
import androidx.compose.material.icons.outlined.AddShoppingCart
import androidx.compose.material.icons.outlined.DarkMode
import androidx.compose.material.icons.outlined.Inventory2
import androidx.compose.material.icons.outlined.Language
import androidx.compose.material.icons.outlined.LightMode
import androidx.compose.material.icons.outlined.Login
import androidx.compose.material.icons.outlined.Menu
import androidx.compose.material.icons.outlined.Payments
import androidx.compose.material.icons.outlined.PersonAdd
import androidx.compose.material.icons.outlined.TrendingUp
import androidx.compose.material.icons.outlined.WarningAmber
import androidx.compose.material3.DrawerValue
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.ModalNavigationDrawer
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.rememberDrawerState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import ir.shopino.app.ui.model.PreviewCustomer
import ir.shopino.app.ui.model.PreviewDailySalesPoint
import ir.shopino.app.ui.model.PreviewProduct
import ir.shopino.app.ui.model.PreviewSalesVsPaymentPoint
import ir.shopino.app.i18n.ShopinoStrings
import ir.shopino.app.ui.components.BadgeTone
import ir.shopino.app.ui.components.ShopinoButton
import ir.shopino.app.ui.components.ShopinoKpiCard
import ir.shopino.app.ui.components.ShopinoSalesAreaChart
import ir.shopino.app.ui.components.ShopinoSalesVsPaymentsBarChart
import ir.shopino.app.ui.components.ShopinoStatusBadge
import ir.shopino.app.ui.components.ShopinoSurfaceCard
import ir.shopino.app.ui.navigation.ShopinoBottomNavigationBar
import ir.shopino.app.ui.navigation.ShopinoMoreDrawerContent
import ir.shopino.app.ui.navigation.ShopinoSection
import ir.shopino.app.ui.screens.auth.LoginScreen
import ir.shopino.app.ui.theme.ShopinoTheme
import ir.shopino.app.util.AppLanguage
import ir.shopino.app.util.ShopinoFormatters
import kotlinx.coroutines.launch

/**
 * Sample preview dataset for Stage 2 UI verification.
 * Explicitly isolated to UI preview state — never submitted to the live backend database.
 */
object Stage2PreviewSampleData {
    const val totalSalesToman = 148_500_000L
    const val totalReceivedToman = 116_200_000L
    const val totalReceivablesToman = 32_300_000L
    const val lowStockCount = 4

    val salesOverTime = listOf(
        PreviewDailySalesPoint(date = "2026-04-01", sales = 14_200_000L, received = 11_000_000L),
        PreviewDailySalesPoint(date = "2026-04-05", sales = 19_800_000L, received = 16_500_000L),
        PreviewDailySalesPoint(date = "2026-04-10", sales = 17_400_000L, received = 14_900_000L),
        PreviewDailySalesPoint(date = "2026-04-15", sales = 26_100_000L, received = 21_200_000L),
        PreviewDailySalesPoint(date = "2026-04-20", sales = 31_500_000L, received = 24_800_000L),
        PreviewDailySalesPoint(date = "2026-04-25", sales = 39_500_000L, received = 27_800_000L)
    )

    val salesVsPayments = listOf(
        PreviewSalesVsPaymentPoint(label = "W1", sales = 28_500_000L, payments = 24_000_000L),
        PreviewSalesVsPaymentPoint(label = "W2", sales = 34_200_000L, payments = 27_400_000L),
        PreviewSalesVsPaymentPoint(label = "W3", sales = 41_000_000L, payments = 31_800_000L),
        PreviewSalesVsPaymentPoint(label = "W4", sales = 44_800_000L, payments = 33_000_000L)
    )

    val sampleProducts = listOf(
        PreviewProduct(
            id = 101,
            name = "روغن موتور سینتتیک ۵W-40 بهران",
            sku = "OIL-5W40-BH",
            category = "روان‌کارها",
            unit = "گالن ۴ لیتری",
            buyPriceCents = 1_120_000L,
            sellPriceCents = 1_380_000L,
            stockQuantity = 42,
            minStockLevel = 10
        ),
        PreviewProduct(
            id = 102,
            name = "فیلتر هوای کابین نانو سرامیکی",
            sku = "FLT-CAB-204",
            category = "فیلترجات",
            unit = "عدد",
            buyPriceCents = 210_000L,
            sellPriceCents = 295_000L,
            stockQuantity = 3,
            minStockLevel = 8
        ),
        PreviewProduct(
            id = 103,
            name = "لنت ترمز جلو سرامیکی پارس",
            sku = "BRK-PAD-900",
            category = "سیستم ترمز",
            unit = "دست",
            buyPriceCents = 740_000L,
            sellPriceCents = 960_000L,
            stockQuantity = 0,
            minStockLevel = 5
        )
    )

    val sampleCustomers = listOf(
        PreviewCustomer(
            id = 201,
            name = "بازرگانی پخش قطعات البرز",
            phone = "09123456789",
            type = "wholesale",
            creditLimitCents = 50_000_000L,
            totalBought = 84_500_000L,
            totalPaid = 66_000_000L,
            currentBalance = 18_500_000L
        ),
        PreviewCustomer(
            id = 202,
            name = "تعمیرگاه تخصصی محمدی",
            phone = "09351122334",
            type = "retail",
            creditLimitCents = 15_000_000L,
            totalBought = 29_200_000L,
            totalPaid = 29_200_000L,
            currentBalance = 0L
        )
    )
}

/**
 * Visually complete Stage 2 Foundation Preview Screen.
 * Demonstrates:
 * - Shopino branding and top bar with instant Light/Dark and RTL (FA)/LTR (EN) switching
 * - Bottom navigation and More modal drawer with developer attribution (`Developed by M. R`, `@rahmani208`)
 * - Dashboard KPI cards with realistic sample values clearly marked as preview data
 * - Sales-over-time area chart and Sales-vs-Payments bar chart
 * - Quick actions for New Sale, Add Customer, Add Product, and Record Payment
 * - Product & Customer preview cards and financial/inventory status badges
 * - Interactive toggle to inspect the polished Login Screen in both Persian and English
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun FoundationPreviewScreen(
    currentBaseUrl: String,
    onToggleLanguage: () -> Unit,
    onToggleTheme: () -> Unit,
    onUpdateBaseUrl: (String) -> ir.shopino.app.data.auth.ServerUrl.Reason?,
    onNavigateToLiveLogin: () -> Unit,
    modifier: Modifier = Modifier
) {
    val colors = ShopinoTheme.colors
    val language = ShopinoTheme.language
    val reducedMotion = ShopinoTheme.isReducedMotion
    val drawerState = rememberDrawerState(initialValue = DrawerValue.Closed)
    val snackbarHostState = remember { SnackbarHostState() }
    val scope = rememberCoroutineScope()

    var currentSection by remember { mutableStateOf(ShopinoSection.DASHBOARD) }
    var showEmbeddedLoginPreview by remember { mutableStateOf(false) }
    var activeQuickActionSheet by remember { mutableStateOf<String?>(null) }

    ModalNavigationDrawer(
        drawerState = drawerState,
        drawerContent = {
            ShopinoMoreDrawerContent(
                currentSection = currentSection,
                userRole = "owner",
                userFullName = if (language == AppLanguage.FA) "مدیر سیستم (پیش‌نمایش)" else "System Owner (Preview)",
                onSelectSection = { section ->
                    currentSection = section
                    scope.launch { drawerState.close() }
                },
                onLogout = {
                    scope.launch { drawerState.close() }
                    onNavigateToLiveLogin()
                }
            )
        }
    ) {
        Scaffold(
            modifier = modifier.fillMaxSize(),
            containerColor = colors.background,
            snackbarHost = { SnackbarHost(snackbarHostState) },
            topBar = {
                ShopinoFoundationTopBar(
                    showLoginPreview = showEmbeddedLoginPreview,
                    onOpenDrawer = { scope.launch { drawerState.open() } },
                    onToggleLanguage = onToggleLanguage,
                    onToggleTheme = onToggleTheme,
                    onToggleLoginPreview = { showEmbeddedLoginPreview = !showEmbeddedLoginPreview },
                    onNavigateToLiveLogin = onNavigateToLiveLogin
                )
            },
            bottomBar = {
                if (!showEmbeddedLoginPreview) {
                    ShopinoBottomNavigationBar(
                        currentSection = currentSection,
                        onSelectSection = { currentSection = it },
                        onOpenMoreDrawer = { scope.launch { drawerState.open() } }
                    )
                }
            }
        ) { innerPadding ->
            Crossfade(
                targetState = showEmbeddedLoginPreview,
                animationSpec = tween(durationMillis = if (reducedMotion) 0 else 280),
                modifier = Modifier.padding(innerPadding),
                label = "foundationOrLoginCrossfade"
            ) { isLoginPreview ->
                if (isLoginPreview) {
                    LoginScreen(
                        isLoading = false,
                        errorMessage = null,
                        currentBaseUrl = currentBaseUrl,
                        onLoginSubmit = { _, _ ->
                            onNavigateToLiveLogin()
                        },
                        onUpdateBaseUrl = onUpdateBaseUrl,
                        onToggleLanguage = onToggleLanguage,
                        onToggleTheme = onToggleTheme
                    )
                } else {
                    LazyColumn(
                        modifier = Modifier.fillMaxSize(),
                        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 16.dp),
                        verticalArrangement = Arrangement.spacedBy(18.dp)
                    ) {
                        // 1. Stage 2 Preview Data Banner
                        item {
                            ShopinoSurfaceCard(
                                accentColor = colors.accentViolet,
                                contentPadding = PaddingValues(14.dp)
                            ) {
                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    modifier = Modifier.fillMaxWidth()
                                ) {
                                    ShopinoStatusBadge(
                                        label = ShopinoStrings.t("stage2_preview_badge", language),
                                        tone = BadgeTone.VIOLET
                                    )
                                    Text(
                                        text = ShopinoFormatters.formatDate(
                                            "2026-04-25T14:30:00Z",
                                            language
                                        ),
                                        style = MaterialTheme.typography.labelMedium,
                                        color = colors.textSecondary
                                    )
                                }
                                Spacer(modifier = Modifier.height(8.dp))
                                Text(
                                    text = ShopinoStrings.t("stage2_preview_subtitle", language),
                                    style = MaterialTheme.typography.bodySmall,
                                    color = colors.textSecondary
                                )
                            }
                        }

                        // 2. Quick Actions Row (New Sale, Add Customer, Add Product, Record Payment)
                        item {
                            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                                Text(
                                    text = ShopinoStrings.t("quick_actions", language),
                                    style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold),
                                    color = colors.textPrimary
                                )
                                LazyRow(
                                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                                ) {
                                    val actions = listOf(
                                        Triple("new_sale", Icons.Outlined.AddShoppingCart, colors.accentTurquoise),
                                        Triple("add_customer", Icons.Outlined.PersonAdd, colors.accentViolet),
                                        Triple("add_product", Icons.Outlined.AddBox, colors.success),
                                        Triple("record_payment", Icons.Outlined.Payments, colors.warning)
                                    )
                                    items(actions) { (key, icon, accent) ->
                                        QuickActionPill(
                                            title = ShopinoStrings.t(key, language),
                                            icon = icon,
                                            accentColor = accent,
                                            onClick = { activeQuickActionSheet = key }
                                        )
                                    }
                                }
                            }
                        }

                        // 3. Dashboard KPI Cards (2x2 Responsive Grid)
                        item {
                            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                                ) {
                                    ShopinoKpiCard(
                                        title = ShopinoStrings.t("total_sales", language),
                                        value = ShopinoFormatters.formatCurrency(
                                            Stage2PreviewSampleData.totalSalesToman,
                                            language
                                        ),
                                        subtitle = if (language == AppLanguage.FA) "+۱۸.۴٪ نسبت به ماه قبل" else "+18.4% vs last month",
                                        icon = Icons.Outlined.TrendingUp,
                                        accentColor = colors.accentTurquoise,
                                        modifier = Modifier.weight(1f)
                                    )
                                    ShopinoKpiCard(
                                        title = ShopinoStrings.t("total_received", language),
                                        value = ShopinoFormatters.formatCurrency(
                                            Stage2PreviewSampleData.totalReceivedToman,
                                            language
                                        ),
                                        subtitle = if (language == AppLanguage.FA) "۷۸٪ نرخ وصول نقدی" else "78% collection rate",
                                        icon = Icons.Outlined.AccountBalanceWallet,
                                        accentColor = colors.success,
                                        modifier = Modifier.weight(1f)
                                    )
                                }

                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                                ) {
                                    ShopinoKpiCard(
                                        title = ShopinoStrings.t("total_receivables", language),
                                        value = ShopinoFormatters.formatCurrency(
                                            Stage2PreviewSampleData.totalReceivablesToman,
                                            language
                                        ),
                                        subtitle = if (language == AppLanguage.FA) "مانده حساب مشتریان" else "Active credit accounts",
                                        icon = Icons.Outlined.Payments,
                                        accentColor = colors.accentViolet,
                                        modifier = Modifier.weight(1f)
                                    )
                                    ShopinoKpiCard(
                                        title = ShopinoStrings.t("low_stock_items", language),
                                        value = ShopinoFormatters.formatNumber(
                                            Stage2PreviewSampleData.lowStockCount,
                                            language
                                        ),
                                        subtitle = if (language == AppLanguage.FA) "نیازمند شارژ مجدد انبار" else "Requires restocking",
                                        icon = Icons.Outlined.WarningAmber,
                                        accentColor = colors.warning,
                                        modifier = Modifier.weight(1f)
                                    )
                                }
                            }
                        }

                        // 4. Sales Over Time Area Chart
                        item {
                            ShopinoSurfaceCard(accentColor = colors.accentTurquoise) {
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Text(
                                        text = ShopinoStrings.t("sales_over_time", language),
                                        style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold),
                                        color = colors.textPrimary
                                    )
                                    ShopinoStatusBadge(
                                        label = ShopinoFormatters.formatCompactCurrency(
                                            Stage2PreviewSampleData.totalSalesToman,
                                            language
                                        ),
                                        tone = BadgeTone.TURQUOISE
                                    )
                                }
                                Spacer(modifier = Modifier.height(14.dp))
                                ShopinoSalesAreaChart(points = Stage2PreviewSampleData.salesOverTime)
                            }
                        }

                        // 5. Sales vs. Payments Bar Chart
                        item {
                            ShopinoSurfaceCard(accentColor = colors.accentViolet) {
                                Text(
                                    text = ShopinoStrings.t("sales_vs_payments", language),
                                    style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold),
                                    color = colors.textPrimary
                                )
                                Spacer(modifier = Modifier.height(12.dp))
                                ShopinoSalesVsPaymentsBarChart(
                                    items = Stage2PreviewSampleData.salesVsPayments
                                )
                            }
                        }

                        // 6. Status Badges Showcase
                        item {
                            ShopinoSurfaceCard {
                                Text(
                                    text = ShopinoStrings.t("status_badges_preview", language),
                                    style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold),
                                    color = colors.textPrimary
                                )
                                Spacer(modifier = Modifier.height(12.dp))
                                LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                    item {
                                        ShopinoStatusBadge(
                                            label = ShopinoStrings.t("status_paid", language),
                                            tone = BadgeTone.SUCCESS
                                        )
                                    }
                                    item {
                                        ShopinoStatusBadge(
                                            label = ShopinoStrings.t("status_partial", language),
                                            tone = BadgeTone.WARNING
                                        )
                                    }
                                    item {
                                        ShopinoStatusBadge(
                                            label = ShopinoStrings.t("status_unpaid", language),
                                            tone = BadgeTone.DANGER
                                        )
                                    }
                                    item {
                                        ShopinoStatusBadge(
                                            label = ShopinoStrings.t("status_in_stock", language),
                                            tone = BadgeTone.TURQUOISE
                                        )
                                    }
                                    item {
                                        ShopinoStatusBadge(
                                            label = ShopinoStrings.t("status_low_stock", language),
                                            tone = BadgeTone.WARNING
                                        )
                                    }
                                    item {
                                        ShopinoStatusBadge(
                                            label = ShopinoStrings.t("status_out_of_stock", language),
                                            tone = BadgeTone.DANGER
                                        )
                                    }
                                }
                            }
                        }

                        // 7. Product Preview Cards
                        item {
                            Text(
                                text = ShopinoStrings.t("recent_products_preview", language),
                                style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold),
                                color = colors.textPrimary
                            )
                        }
                        items(Stage2PreviewSampleData.sampleProducts) { product ->
                            ProductPreviewCard(product = product)
                        }

                        // 8. Customer Preview Cards
                        item {
                            Text(
                                text = ShopinoStrings.t("top_customers_preview", language),
                                style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold),
                                color = colors.textPrimary
                            )
                        }
                        items(Stage2PreviewSampleData.sampleCustomers) { customer ->
                            CustomerPreviewCard(customer = customer)
                        }
                    }
                }
            }
        }
    }

    if (activeQuickActionSheet != null) {
        val actionTitle = ShopinoStrings.t(activeQuickActionSheet!!, language)
        ModalBottomSheet(
            onDismissRequest = { activeQuickActionSheet = null },
            containerColor = colors.surface,
            contentColor = colors.textPrimary
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 22.dp, vertical = 18.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween,
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text(
                        text = actionTitle,
                        style = MaterialTheme.typography.titleLarge.copy(fontWeight = FontWeight.Bold),
                        color = colors.textPrimary
                    )
                    ShopinoStatusBadge(
                        label = "Stage 2 Preview",
                        tone = BadgeTone.TURQUOISE
                    )
                }
                Text(
                    text = ShopinoStrings.t("preview_mode_notice", language),
                    style = MaterialTheme.typography.bodyMedium,
                    color = colors.textSecondary
                )
                Spacer(modifier = Modifier.height(8.dp))
                ShopinoButton(
                    text = ShopinoStrings.t("open_live_login", language),
                    onClick = {
                        activeQuickActionSheet = null
                        onNavigateToLiveLogin()
                    },
                    modifier = Modifier.fillMaxWidth()
                )
                Spacer(modifier = Modifier.height(14.dp))
            }
        }
    }
}

@Composable
private fun ShopinoFoundationTopBar(
    showLoginPreview: Boolean,
    onOpenDrawer: () -> Unit,
    onToggleLanguage: () -> Unit,
    onToggleTheme: () -> Unit,
    onToggleLoginPreview: () -> Unit,
    onNavigateToLiveLogin: () -> Unit
) {
    val colors = ShopinoTheme.colors
    val language = ShopinoTheme.language

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(colors.surface)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 14.dp, vertical = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                IconButton(
                    onClick = onOpenDrawer,
                    modifier = Modifier
                        .size(40.dp)
                        .clip(RoundedCornerShape(11.dp))
                        .background(colors.surfaceElevated)
                        .border(1.dp, colors.border, RoundedCornerShape(11.dp))
                ) {
                    Icon(
                        imageVector = Icons.Outlined.Menu,
                        contentDescription = "Menu",
                        tint = colors.textPrimary,
                        modifier = Modifier.size(20.dp)
                    )
                }

                Box(
                    modifier = Modifier
                        .size(38.dp)
                        .clip(RoundedCornerShape(11.dp))
                        .background(colors.accentTurquoiseContainer)
                        .border(1.dp, colors.accentTurquoise.copy(alpha = 0.45f), RoundedCornerShape(11.dp)),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = "S",
                        style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.ExtraBold),
                        color = colors.accentTurquoise
                    )
                }

                Column {
                    Text(
                        text = ShopinoStrings.t("app_name", language),
                        style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.ExtraBold),
                        color = colors.textPrimary
                    )
                    Text(
                        text = if (language == AppLanguage.FA) "نسخه بومی اندروید • مرحله ۲" else "Native Android • Stage 2",
                        style = MaterialTheme.typography.labelSmall,
                        color = colors.accentTurquoise
                    )
                }
            }

            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(6.dp)
            ) {
                // Language RTL/LTR Toggle
                IconButton(
                    onClick = onToggleLanguage,
                    modifier = Modifier
                        .size(38.dp)
                        .clip(RoundedCornerShape(10.dp))
                        .background(colors.surfaceElevated)
                        .border(1.dp, colors.border, RoundedCornerShape(10.dp))
                ) {
                    Icon(
                        imageVector = Icons.Outlined.Language,
                        contentDescription = "Switch Language",
                        tint = colors.accentTurquoise,
                        modifier = Modifier.size(19.dp)
                    )
                }

                // Dark / Light Theme Toggle
                IconButton(
                    onClick = onToggleTheme,
                    modifier = Modifier
                        .size(38.dp)
                        .clip(RoundedCornerShape(10.dp))
                        .background(colors.surfaceElevated)
                        .border(1.dp, colors.border, RoundedCornerShape(10.dp))
                ) {
                    Icon(
                        imageVector = if (colors.isDark) Icons.Outlined.LightMode else Icons.Outlined.DarkMode,
                        contentDescription = "Switch Theme",
                        tint = colors.accentViolet,
                        modifier = Modifier.size(19.dp)
                    )
                }

                // Switch between Dashboard Preview and Login Preview
                IconButton(
                    onClick = onToggleLoginPreview,
                    modifier = Modifier
                        .size(38.dp)
                        .clip(RoundedCornerShape(10.dp))
                        .background(
                            if (showLoginPreview) colors.accentTurquoiseContainer else colors.surfaceElevated
                        )
                        .border(
                            1.dp,
                            if (showLoginPreview) colors.accentTurquoise else colors.border,
                            RoundedCornerShape(10.dp)
                        )
                ) {
                    Icon(
                        imageVector = Icons.Outlined.Login,
                        contentDescription = ShopinoStrings.t("view_login_preview", language),
                        tint = if (showLoginPreview) colors.accentTurquoise else colors.textSecondary,
                        modifier = Modifier.size(19.dp)
                    )
                }
            }
        }
        HorizontalDivider(color = colors.border, thickness = 1.dp)
    }
}

@Composable
private fun QuickActionPill(
    title: String,
    icon: ImageVector,
    accentColor: Color,
    onClick: () -> Unit
) {
    val colors = ShopinoTheme.colors
    Row(
        modifier = Modifier
            .clip(RoundedCornerShape(14.dp))
            .background(colors.surface)
            .border(1.dp, accentColor.copy(alpha = 0.35f), RoundedCornerShape(14.dp))
            .clickable(onClick = onClick)
            .padding(horizontal = 14.dp, vertical = 11.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        Box(
            modifier = Modifier
                .size(30.dp)
                .clip(RoundedCornerShape(9.dp))
                .background(accentColor.copy(alpha = 0.15f)),
            contentAlignment = Alignment.Center
        ) {
            Icon(
                imageVector = icon,
                contentDescription = title,
                tint = accentColor,
                modifier = Modifier.size(17.dp)
            )
        }
        Text(
            text = title,
            style = MaterialTheme.typography.labelLarge,
            color = colors.textPrimary
        )
    }
}

@Composable
private fun ProductPreviewCard(product: PreviewProduct) {
    val colors = ShopinoTheme.colors
    val language = ShopinoTheme.language

    val (stockBadgeLabel, stockBadgeTone) = when {
        product.stockQuantity <= 0 -> ShopinoStrings.t("status_out_of_stock", language) to BadgeTone.DANGER
        product.stockQuantity <= product.minStockLevel -> ShopinoStrings.t("status_low_stock", language) to BadgeTone.WARNING
        else -> ShopinoStrings.t("status_in_stock", language) to BadgeTone.SUCCESS
    }

    ShopinoSurfaceCard(contentPadding = PaddingValues(15.dp)) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.Top
        ) {
            Row(
                horizontalArrangement = Arrangement.spacedBy(12.dp),
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier.weight(1f)
            ) {
                Box(
                    modifier = Modifier
                        .size(42.dp)
                        .clip(RoundedCornerShape(12.dp))
                        .background(colors.accentTurquoiseContainer)
                        .border(1.dp, colors.accentTurquoise.copy(alpha = 0.3f), RoundedCornerShape(12.dp)),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = Icons.Outlined.Inventory2,
                        contentDescription = null,
                        tint = colors.accentTurquoise,
                        modifier = Modifier.size(20.dp)
                    )
                }
                Column {
                    Text(
                        text = product.name,
                        style = MaterialTheme.typography.titleMedium,
                        color = colors.textPrimary,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                    Spacer(modifier = Modifier.height(2.dp))
                    Text(
                        text = "${ShopinoStrings.t("sku", language)}: ${product.sku ?: "-"} • ${product.category ?: ""}",
                        style = MaterialTheme.typography.bodySmall,
                        color = colors.textSecondary
                    )
                }
            }
            ShopinoStatusBadge(label = stockBadgeLabel, tone = stockBadgeTone)
        }

        Spacer(modifier = Modifier.height(12.dp))
        HorizontalDivider(color = colors.borderSubtle, thickness = 1.dp)
        Spacer(modifier = Modifier.height(10.dp))

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column {
                Text(
                    text = ShopinoStrings.t("sell_price", language),
                    style = MaterialTheme.typography.labelSmall,
                    color = colors.textMuted
                )
                Text(
                    text = ShopinoFormatters.formatCurrency(product.sellPriceCents, language),
                    style = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.Bold),
                    color = colors.accentTurquoise
                )
            }
            Column(horizontalAlignment = Alignment.End) {
                Text(
                    text = ShopinoStrings.t("stock", language),
                    style = MaterialTheme.typography.labelSmall,
                    color = colors.textMuted
                )
                Text(
                    text = "${ShopinoFormatters.formatNumber(product.stockQuantity, language)} ${product.unit}",
                    style = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.Bold),
                    color = colors.textPrimary
                )
            }
        }
    }
}

@Composable
private fun CustomerPreviewCard(customer: PreviewCustomer) {
    val colors = ShopinoTheme.colors
    val language = ShopinoTheme.language

    val hasDebt = customer.currentBalance > 0
    val typeLabel = if (customer.type == "wholesale") {
        ShopinoStrings.t("wholesale", language)
    } else {
        ShopinoStrings.t("retail", language)
    }

    ShopinoSurfaceCard(contentPadding = PaddingValues(15.dp)) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = customer.name,
                    style = MaterialTheme.typography.titleMedium,
                    color = colors.textPrimary
                )
                Spacer(modifier = Modifier.height(2.dp))
                Text(
                    text = if (language == AppLanguage.FA) {
                        ShopinoFormatters.toPersianDigits(customer.phone ?: "")
                    } else {
                        customer.phone ?: ""
                    },
                    style = MaterialTheme.typography.bodySmall,
                    color = colors.textSecondary
                )
            }
            ShopinoStatusBadge(
                label = typeLabel,
                tone = if (customer.type == "wholesale") BadgeTone.VIOLET else BadgeTone.TURQUOISE
            )
        }

        Spacer(modifier = Modifier.height(12.dp))
        HorizontalDivider(color = colors.borderSubtle, thickness = 1.dp)
        Spacer(modifier = Modifier.height(10.dp))

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column {
                Text(
                    text = ShopinoStrings.t("customer_balance", language),
                    style = MaterialTheme.typography.labelSmall,
                    color = colors.textMuted
                )
                Text(
                    text = ShopinoFormatters.formatCurrency(customer.currentBalance, language),
                    style = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.Bold),
                    color = if (hasDebt) colors.warning else colors.success
                )
            }
            Column(horizontalAlignment = Alignment.End) {
                Text(
                    text = ShopinoStrings.t("credit_limit", language),
                    style = MaterialTheme.typography.labelSmall,
                    color = colors.textMuted
                )
                Text(
                    text = ShopinoFormatters.formatCurrency(customer.creditLimitCents, language),
                    style = MaterialTheme.typography.titleSmall,
                    color = colors.textSecondary
                )
            }
        }
    }
}

@Preview(
    name = "Stage 2 Foundation Preview - Persian RTL Dark",
    showBackground = true,
    widthDp = 412,
    heightDp = 915
)
@Composable
fun PreviewFoundationPersianDark() {
    ShopinoTheme(darkTheme = true, language = AppLanguage.FA) {
        FoundationPreviewScreen(
            currentBaseUrl = "http://10.0.2.2:3000/",
            onToggleLanguage = {},
            onToggleTheme = {},
            onUpdateBaseUrl = { null },
            onNavigateToLiveLogin = {}
        )
    }
}

@Preview(
    name = "Stage 2 Foundation Preview - English LTR Light",
    showBackground = true,
    widthDp = 412,
    heightDp = 915
)
@Composable
fun PreviewFoundationEnglishLight() {
    ShopinoTheme(darkTheme = false, language = AppLanguage.EN) {
        FoundationPreviewScreen(
            currentBaseUrl = "http://10.0.2.2:3000/",
            onToggleLanguage = {},
            onToggleTheme = {},
            onUpdateBaseUrl = { null },
            onNavigateToLiveLogin = {}
        )
    }
}
