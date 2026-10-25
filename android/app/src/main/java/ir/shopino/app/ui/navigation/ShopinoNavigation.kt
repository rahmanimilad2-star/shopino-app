package ir.shopino.app.ui.navigation

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.Logout
import androidx.compose.material.icons.automirrored.outlined.Send
import androidx.compose.material.icons.outlined.Analytics
import androidx.compose.material.icons.outlined.Dashboard
import androidx.compose.material.icons.outlined.History
import androidx.compose.material.icons.outlined.Inventory2
import androidx.compose.material.icons.outlined.Menu
import androidx.compose.material.icons.outlined.Notifications
import androidx.compose.material.icons.outlined.Payments
import androidx.compose.material.icons.outlined.People
import androidx.compose.material.icons.outlined.Settings
import androidx.compose.material.icons.outlined.ShoppingCart
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalDrawerSheet
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationBarItemDefaults
import androidx.compose.material3.NavigationDrawerItem
import androidx.compose.material3.NavigationDrawerItemDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import ir.shopino.app.i18n.ShopinoStrings
import ir.shopino.app.ui.theme.ShopinoTheme

enum class ShopinoSection(
    val route: String,
    val titleKey: String,
    val icon: ImageVector,
    val allowedRoles: Set<String> = setOf("owner", "manager", "staff")
) {
    DASHBOARD("dashboard", "dashboard", Icons.Outlined.Dashboard),
    ORDERS("orders", "orders", Icons.Outlined.ShoppingCart),
    CUSTOMERS("customers", "customers", Icons.Outlined.People),
    PRODUCTS("products", "products", Icons.Outlined.Inventory2),
    PAYMENTS("payments", "payments", Icons.Outlined.Payments),
    INVENTORY_LOGS(
        "inventory_logs",
        "inventory_logs",
        Icons.Outlined.History,
        allowedRoles = setOf("owner", "manager")
    ),
    REPORTS(
        "reports",
        "reports",
        Icons.Outlined.Analytics,
        allowedRoles = setOf("owner", "manager")
    ),
    NOTIFICATIONS("notifications", "notifications", Icons.Outlined.Notifications),
    SETTINGS("settings", "settings", Icons.Outlined.Settings);

    companion object {
        val primaryBottomTabs = listOf(DASHBOARD, ORDERS, CUSTOMERS, PRODUCTS)
        val drawerSecondaryTabs = listOf(PAYMENTS, INVENTORY_LOGS, REPORTS, NOTIFICATIONS, SETTINGS)
    }
}

/**
 * Shopino bottom navigation bar with primary business sections and a "More" drawer trigger.
 */
@Composable
fun ShopinoBottomNavigationBar(
    currentSection: ShopinoSection,
    onSelectSection: (ShopinoSection) -> Unit,
    onOpenMoreDrawer: () -> Unit,
    modifier: Modifier = Modifier
) {
    val colors = ShopinoTheme.colors
    val language = ShopinoTheme.language

    Column(modifier = modifier.fillMaxWidth()) {
        HorizontalDivider(color = colors.border, thickness = 1.dp)
        NavigationBar(
            containerColor = colors.surface,
            contentColor = colors.textPrimary,
            tonalElevation = 0.dp
        ) {
            ShopinoSection.primaryBottomTabs.forEach { section ->
                val selected = currentSection == section
                NavigationBarItem(
                    selected = selected,
                    onClick = { onSelectSection(section) },
                    icon = {
                        Icon(
                            imageVector = section.icon,
                            contentDescription = ShopinoStrings.t(section.titleKey, language)
                        )
                    },
                    label = {
                        Text(
                            text = ShopinoStrings.t(section.titleKey, language),
                            style = MaterialTheme.typography.labelSmall.copy(
                                fontWeight = if (selected) FontWeight.Bold else FontWeight.Medium
                            ),
                            maxLines = 1
                        )
                    },
                    colors = NavigationBarItemDefaults.colors(
                        selectedIconColor = colors.accentTurquoise,
                        selectedTextColor = colors.accentTurquoise,
                        indicatorColor = colors.accentTurquoiseContainer,
                        unselectedIconColor = colors.textSecondary,
                        unselectedTextColor = colors.textSecondary
                    )
                )
            }

            val isMoreSelected = currentSection in ShopinoSection.drawerSecondaryTabs
            NavigationBarItem(
                selected = isMoreSelected,
                onClick = onOpenMoreDrawer,
                icon = {
                    Icon(
                        imageVector = Icons.Outlined.Menu,
                        contentDescription = ShopinoStrings.t("more", language)
                    )
                },
                label = {
                    Text(
                        text = ShopinoStrings.t("more", language),
                        style = MaterialTheme.typography.labelSmall.copy(
                            fontWeight = if (isMoreSelected) FontWeight.Bold else FontWeight.Medium
                        ),
                        maxLines = 1
                    )
                },
                colors = NavigationBarItemDefaults.colors(
                    selectedIconColor = colors.accentTurquoise,
                    selectedTextColor = colors.accentTurquoise,
                    indicatorColor = colors.accentTurquoiseContainer,
                    unselectedIconColor = colors.textSecondary,
                    unselectedTextColor = colors.textSecondary
                )
            )
        }
    }
}

/**
 * Shopino Modal Navigation Drawer ("More" menu) with RBAC filtering and discreet developer attribution footer.
 */
@Composable
fun ShopinoMoreDrawerContent(
    currentSection: ShopinoSection,
    userRole: String,
    userFullName: String,
    onSelectSection: (ShopinoSection) -> Unit,
    onLogout: (() -> Unit)? = null,
    modifier: Modifier = Modifier
) {
    val colors = ShopinoTheme.colors
    val language = ShopinoTheme.language
    val context = LocalContext.current

    ModalDrawerSheet(
        drawerContainerColor = colors.surface,
        drawerContentColor = colors.textPrimary,
        modifier = modifier.width(300.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .weight(1f)
                .padding(horizontal = 16.dp, vertical = 20.dp)
        ) {
            // Brand + User Identity Header
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Box(
                    modifier = Modifier
                        .size(44.dp)
                        .clip(RoundedCornerShape(13.dp))
                        .background(colors.accentTurquoiseContainer)
                        .border(1.dp, colors.accentTurquoise.copy(alpha = 0.4f), RoundedCornerShape(13.dp)),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = "S",
                        style = MaterialTheme.typography.titleLarge.copy(fontWeight = FontWeight.ExtraBold),
                        color = colors.accentTurquoise
                    )
                }
                Column {
                    Text(
                        text = ShopinoStrings.t("app_name", language),
                        style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold),
                        color = colors.textPrimary
                    )
                    Text(
                        text = "$userFullName • ${
                            when (userRole) {
                                "owner" -> ShopinoStrings.t("role_owner", language)
                                "manager" -> ShopinoStrings.t("role_manager", language)
                                else -> ShopinoStrings.t("role_staff", language)
                            }
                        }",
                        style = MaterialTheme.typography.bodySmall,
                        color = colors.textSecondary
                    )
                }
            }

            Spacer(modifier = Modifier.height(18.dp))
            HorizontalDivider(color = colors.border, thickness = 1.dp)
            Spacer(modifier = Modifier.height(12.dp))

            // Secondary navigation items filtered by user role
            val visibleItems = ShopinoSection.drawerSecondaryTabs.filter {
                userRole in it.allowedRoles
            }

            visibleItems.forEach { section ->
                val selected = currentSection == section
                NavigationDrawerItem(
                    label = {
                        Text(
                            text = ShopinoStrings.t(section.titleKey, language),
                            style = MaterialTheme.typography.bodyMedium.copy(
                                fontWeight = if (selected) FontWeight.Bold else FontWeight.Medium
                            )
                        )
                    },
                    selected = selected,
                    onClick = { onSelectSection(section) },
                    icon = {
                        Icon(
                            imageVector = section.icon,
                            contentDescription = ShopinoStrings.t(section.titleKey, language)
                        )
                    },
                    shape = RoundedCornerShape(12.dp),
                    colors = NavigationDrawerItemDefaults.colors(
                        selectedContainerColor = colors.accentTurquoiseContainer,
                        selectedIconColor = colors.accentTurquoise,
                        selectedTextColor = colors.accentTurquoise,
                        unselectedContainerColor = Color.Transparent,
                        unselectedIconColor = colors.textSecondary,
                        unselectedTextColor = colors.textPrimary
                    ),
                    modifier = Modifier.padding(vertical = 2.dp)
                )
            }

            if (onLogout != null) {
                Spacer(modifier = Modifier.height(8.dp))
                HorizontalDivider(color = colors.borderSubtle, thickness = 1.dp)
                Spacer(modifier = Modifier.height(8.dp))
                NavigationDrawerItem(
                    label = {
                        Text(
                            text = ShopinoStrings.t("logout", language),
                            style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.SemiBold)
                        )
                    },
                    selected = false,
                    onClick = onLogout,
                    icon = {
                        Icon(
                            imageVector = Icons.AutoMirrored.Outlined.Logout,
                            contentDescription = ShopinoStrings.t("logout", language)
                        )
                    },
                    shape = RoundedCornerShape(12.dp),
                    colors = NavigationDrawerItemDefaults.colors(
                        unselectedContainerColor = Color.Transparent,
                        unselectedIconColor = colors.danger,
                        unselectedTextColor = colors.danger
                    )
                )
            }
        }

        // Discreet Developer Attribution Footer (Preserved from Shopino Web Sidebar Footer)
        HorizontalDivider(color = colors.border, thickness = 1.dp)
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 20.dp, vertical = 14.dp),
            verticalArrangement = Arrangement.spacedBy(4.dp)
        ) {
            Text(
                text = ShopinoStrings.t("dev_credit_line1", language),
                style = MaterialTheme.typography.labelSmall,
                color = colors.textMuted
            )
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(6.dp),
                modifier = Modifier
                    .clip(RoundedCornerShape(6.dp))
                    .clickable {
                        try {
                            val intent = Intent(
                                Intent.ACTION_VIEW,
                                Uri.parse("https://t.me/rahmani208")
                            )
                            context.startActivity(intent)
                        } catch (_: Exception) {
                            // Ignore if no browser/Telegram handler in preview
                        }
                    }
                    .padding(vertical = 2.dp)
            ) {
                Box(
                    modifier = Modifier
                        .size(16.dp)
                        .clip(CircleShape)
                        .background(colors.accentTurquoise.copy(alpha = 0.16f)),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = Icons.AutoMirrored.Outlined.Send,
                        contentDescription = "Telegram",
                        tint = colors.accentTurquoise,
                        modifier = Modifier.size(10.dp)
                    )
                }
                Text(
                    text = ShopinoStrings.t("dev_credit_handle", language),
                    style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.Medium),
                    color = colors.textSecondary
                )
            }
        }
    }
}
