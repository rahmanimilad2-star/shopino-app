package ir.shopino.app.ui.screens.auth

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.DarkMode
import androidx.compose.material.icons.outlined.Dns
import androidx.compose.material.icons.outlined.Language
import androidx.compose.material.icons.outlined.LightMode
import androidx.compose.material.icons.outlined.Lock
import androidx.compose.material.icons.outlined.Person
import androidx.compose.material.icons.outlined.Visibility
import androidx.compose.material.icons.outlined.VisibilityOff
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import ir.shopino.app.i18n.ShopinoStrings
import ir.shopino.app.ui.components.BadgeTone
import ir.shopino.app.ui.components.ShopinoButton
import ir.shopino.app.ui.components.ShopinoStatusBadge
import ir.shopino.app.ui.components.ShopinoSurfaceCard
import ir.shopino.app.ui.components.ShopinoTextField
import ir.shopino.app.ui.theme.ShopinoTheme
import ir.shopino.app.util.AppLanguage

/**
 * Polished Shopino Login Screen supporting Persian RTL & English LTR layouts,
 * Dark & Light themes, server endpoint configuration, and credential validation.
 */
@Composable
fun LoginScreen(
    isLoading: Boolean,
    errorMessage: String?,
    currentBaseUrl: String,
    onLoginSubmit: (username: String, password: String) -> Unit,
    onUpdateBaseUrl: (String) -> Unit,
    onToggleLanguage: () -> Unit,
    onToggleTheme: () -> Unit,
    onBackToPreview: (() -> Unit)? = null,
    modifier: Modifier = Modifier
) {
    val colors = ShopinoTheme.colors
    val language = ShopinoTheme.language

    var username by remember { mutableStateOf("admin") }
    var password by remember { mutableStateOf("") }
    var showPassword by remember { mutableStateOf(false) }
    var showServerDialog by remember { mutableStateOf(false) }
    var serverUrlDraft by remember(currentBaseUrl) { mutableStateOf(currentBaseUrl) }

    Box(
        modifier = modifier
            .fillMaxSize()
            .background(
                Brush.verticalGradient(
                    colors = listOf(
                        colors.background,
                        colors.surface.copy(alpha = 0.92f),
                        colors.background
                    )
                )
            )
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 22.dp, vertical = 28.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            // Top Utility Bar (Language, Theme, Server Config)
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    IconButton(
                        onClick = onToggleLanguage,
                        modifier = Modifier
                            .size(40.dp)
                            .clip(RoundedCornerShape(11.dp))
                            .background(colors.surface)
                            .border(1.dp, colors.border, RoundedCornerShape(11.dp))
                    ) {
                        Icon(
                            imageVector = Icons.Outlined.Language,
                            contentDescription = "Language",
                            tint = colors.accentTurquoise,
                            modifier = Modifier.size(20.dp)
                        )
                    }

                    IconButton(
                        onClick = onToggleTheme,
                        modifier = Modifier
                            .size(40.dp)
                            .clip(RoundedCornerShape(11.dp))
                            .background(colors.surface)
                            .border(1.dp, colors.border, RoundedCornerShape(11.dp))
                    ) {
                        Icon(
                            imageVector = if (colors.isDark) Icons.Outlined.LightMode else Icons.Outlined.DarkMode,
                            contentDescription = "Theme",
                            tint = colors.accentViolet,
                            modifier = Modifier.size(20.dp)
                        )
                    }
                }

                IconButton(
                    onClick = {
                        serverUrlDraft = currentBaseUrl
                        showServerDialog = true
                    },
                    modifier = Modifier
                        .size(40.dp)
                        .clip(RoundedCornerShape(11.dp))
                        .background(colors.surface)
                        .border(1.dp, colors.border, RoundedCornerShape(11.dp))
                ) {
                    Icon(
                        imageVector = Icons.Outlined.Dns,
                        contentDescription = ShopinoStrings.t("server_settings", language),
                        tint = colors.textSecondary,
                        modifier = Modifier.size(20.dp)
                    )
                }
            }

            Spacer(modifier = Modifier.height(28.dp))

            // Shopino Brand Emblem
            Box(
                modifier = Modifier
                    .size(72.dp)
                    .clip(RoundedCornerShape(22.dp))
                    .background(
                        Brush.linearGradient(
                            colors = listOf(
                                colors.accentTurquoise,
                                colors.accentViolet
                            )
                        )
                    )
                    .padding(2.dp)
                    .clip(RoundedCornerShape(20.dp))
                    .background(colors.surface),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = "S",
                    style = MaterialTheme.typography.displaySmall.copy(fontWeight = FontWeight.ExtraBold),
                    color = colors.accentTurquoise
                )
            }

            Spacer(modifier = Modifier.height(16.dp))

            Text(
                text = ShopinoStrings.t("app_name", language),
                style = MaterialTheme.typography.headlineMedium.copy(fontWeight = FontWeight.ExtraBold),
                color = colors.textPrimary
            )
            Spacer(modifier = Modifier.height(4.dp))
            Text(
                text = ShopinoStrings.t("app_tagline", language),
                style = MaterialTheme.typography.bodyMedium,
                color = colors.textSecondary
            )

            Spacer(modifier = Modifier.height(26.dp))

            // Main Authentication Card
            ShopinoSurfaceCard(
                accentColor = colors.accentTurquoise,
                modifier = Modifier.fillMaxWidth()
            ) {
                Text(
                    text = ShopinoStrings.t("login_title", language),
                    style = MaterialTheme.typography.titleLarge,
                    color = colors.textPrimary
                )
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = ShopinoStrings.t("login_subtitle", language),
                    style = MaterialTheme.typography.bodySmall,
                    color = colors.textSecondary
                )

                Spacer(modifier = Modifier.height(20.dp))

                if (!errorMessage.isNullOrBlank()) {
                    ShopinoStatusBadge(
                        label = errorMessage,
                        tone = BadgeTone.DANGER,
                        modifier = Modifier.fillMaxWidth()
                    )
                    Spacer(modifier = Modifier.height(14.dp))
                }

                ShopinoTextField(
                    value = username,
                    onValueChange = { username = it },
                    label = ShopinoStrings.t("username", language),
                    leadingIcon = Icons.Outlined.Person,
                    keyboardOptions = KeyboardOptions(
                        keyboardType = KeyboardType.Text,
                        imeAction = ImeAction.Next
                    )
                )

                Spacer(modifier = Modifier.height(14.dp))

                ShopinoTextField(
                    value = password,
                    onValueChange = { password = it },
                    label = ShopinoStrings.t("password", language),
                    leadingIcon = Icons.Outlined.Lock,
                    visualTransformation = if (showPassword) {
                        VisualTransformation.None
                    } else {
                        PasswordVisualTransformation()
                    },
                    trailingIcon = {
                        IconButton(onClick = { showPassword = !showPassword }) {
                            Icon(
                                imageVector = if (showPassword) Icons.Outlined.VisibilityOff else Icons.Outlined.Visibility,
                                contentDescription = null,
                                tint = colors.textSecondary
                            )
                        }
                    },
                    keyboardOptions = KeyboardOptions(
                        keyboardType = KeyboardType.Password,
                        imeAction = ImeAction.Done
                    )
                )

                Spacer(modifier = Modifier.height(22.dp))

                ShopinoButton(
                    text = if (isLoading) {
                        ShopinoStrings.t("signing_in", language)
                    } else {
                        ShopinoStrings.t("sign_in", language)
                    },
                    onClick = { onLoginSubmit(username, password) },
                    enabled = !isLoading && username.isNotBlank() && password.isNotBlank(),
                    modifier = Modifier.fillMaxWidth()
                )

                if (onBackToPreview != null) {
                    Spacer(modifier = Modifier.height(12.dp))
                    ShopinoButton(
                        text = ShopinoStrings.t("view_foundation_preview", language),
                        onClick = onBackToPreview,
                        outlined = true,
                        accentColor = colors.accentViolet,
                        modifier = Modifier.fillMaxWidth()
                    )
                }
            }

            Spacer(modifier = Modifier.height(20.dp))

            // Active Server Indicator
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.Center
            ) {
                Icon(
                    imageVector = Icons.Outlined.Dns,
                    contentDescription = null,
                    tint = colors.textMuted,
                    modifier = Modifier.size(14.dp)
                )
                Spacer(modifier = Modifier.width(6.dp))
                Text(
                    text = currentBaseUrl,
                    style = MaterialTheme.typography.labelSmall,
                    color = colors.textMuted
                )
            }
        }
    }

    if (showServerDialog) {
        AlertDialog(
            onDismissRequest = { showServerDialog = false },
            containerColor = colors.surface,
            titleContentColor = colors.textPrimary,
            textContentColor = colors.textSecondary,
            title = {
                Text(
                    text = ShopinoStrings.t("server_settings", language),
                    style = MaterialTheme.typography.titleMedium
                )
            },
            text = {
                Column {
                    ShopinoTextField(
                        value = serverUrlDraft,
                        onValueChange = { serverUrlDraft = it },
                        label = ShopinoStrings.t("server_url", language),
                        leadingIcon = Icons.Outlined.Dns
                    )
                }
            },
            confirmButton = {
                TextButton(
                    onClick = {
                        onUpdateBaseUrl(serverUrlDraft)
                        showServerDialog = false
                    }
                ) {
                    Text(
                        text = ShopinoStrings.t("save", language),
                        color = colors.accentTurquoise
                    )
                }
            },
            dismissButton = {
                TextButton(onClick = { showServerDialog = false }) {
                    Text(
                        text = ShopinoStrings.t("cancel", language),
                        color = colors.textSecondary
                    )
                }
            }
        )
    }
}

@Preview(name = "Shopino Login - Persian RTL Dark", showBackground = true, widthDp = 412, heightDp = 892)
@Composable
fun PreviewLoginScreenPersianDark() {
    ShopinoTheme(darkTheme = true, language = AppLanguage.FA) {
        LoginScreen(
            isLoading = false,
            errorMessage = null,
            currentBaseUrl = "http://10.0.2.2:3000/",
            onLoginSubmit = { _, _ -> },
            onUpdateBaseUrl = {},
            onToggleLanguage = {},
            onToggleTheme = {}
        )
    }
}

@Preview(name = "Shopino Login - English LTR Light", showBackground = true, widthDp = 412, heightDp = 892)
@Composable
fun PreviewLoginScreenEnglishLight() {
    ShopinoTheme(darkTheme = false, language = AppLanguage.EN) {
        LoginScreen(
            isLoading = false,
            errorMessage = null,
            currentBaseUrl = "http://10.0.2.2:3000/",
            onLoginSubmit = { _, _ -> },
            onUpdateBaseUrl = {},
            onToggleLanguage = {},
            onToggleTheme = {}
        )
    }
}
