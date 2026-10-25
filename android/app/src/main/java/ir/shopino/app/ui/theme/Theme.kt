package ir.shopino.app.ui.theme

import android.provider.Settings
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Shapes
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.remember
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import ir.shopino.app.util.AppLanguage

@Immutable
data class ShopinoExtendedColors(
    val isDark: Boolean,
    val background: Color,
    val surface: Color,
    val surfaceElevated: Color,
    val border: Color,
    val borderSubtle: Color,
    val accentTurquoise: Color,
    val accentTurquoiseContainer: Color,
    val accentViolet: Color,
    val accentVioletContainer: Color,
    val textPrimary: Color,
    val textSecondary: Color,
    val textMuted: Color,
    val success: Color,
    val successContainer: Color,
    val warning: Color,
    val warningContainer: Color,
    val danger: Color,
    val dangerContainer: Color
)

val DarkShopinoExtendedColors = ShopinoExtendedColors(
    isDark = true,
    background = ShopinoDarkBackground,
    surface = ShopinoDarkSurface,
    surfaceElevated = ShopinoDarkSurfaceElevated,
    border = ShopinoDarkBorder,
    borderSubtle = ShopinoDarkBorderSubtle,
    accentTurquoise = ShopinoTurquoise,
    accentTurquoiseContainer = ShopinoTurquoiseContainerDark,
    accentViolet = ShopinoViolet,
    accentVioletContainer = ShopinoVioletContainerDark,
    textPrimary = ShopinoDarkTextPrimary,
    textSecondary = ShopinoDarkTextSecondary,
    textMuted = ShopinoDarkTextMuted,
    success = ShopinoSuccessGreen,
    successContainer = ShopinoSuccessContainerDark,
    warning = ShopinoWarningAmber,
    warningContainer = ShopinoWarningContainerDark,
    danger = ShopinoDangerRed,
    dangerContainer = ShopinoDangerContainerDark
)

val LightShopinoExtendedColors = ShopinoExtendedColors(
    isDark = false,
    background = ShopinoLightBackground,
    surface = ShopinoLightSurface,
    surfaceElevated = ShopinoLightSurfaceElevated,
    border = ShopinoLightBorder,
    borderSubtle = ShopinoLightBorderSubtle,
    accentTurquoise = ShopinoLightPrimary,
    accentTurquoiseContainer = ShopinoLightPrimaryContainer,
    accentViolet = ShopinoLightSecondary,
    accentVioletContainer = ShopinoLightSecondaryContainer,
    textPrimary = ShopinoLightTextPrimary,
    textSecondary = ShopinoLightTextSecondary,
    textMuted = ShopinoLightTextMuted,
    success = ShopinoSuccessGreen,
    successContainer = ShopinoSuccessContainerLight,
    warning = ShopinoWarningAmber,
    warningContainer = ShopinoWarningContainerLight,
    danger = ShopinoDangerRed,
    dangerContainer = ShopinoDangerContainerLight
)

private val DarkColorScheme = darkColorScheme(
    primary = ShopinoTurquoise,
    onPrimary = ShopinoDarkBackground,
    primaryContainer = ShopinoTurquoiseContainerDark,
    onPrimaryContainer = ShopinoTurquoise,
    secondary = ShopinoViolet,
    onSecondary = Color.White,
    secondaryContainer = ShopinoVioletContainerDark,
    onSecondaryContainer = ShopinoViolet,
    background = ShopinoDarkBackground,
    onBackground = ShopinoDarkTextPrimary,
    surface = ShopinoDarkSurface,
    onSurface = ShopinoDarkTextPrimary,
    surfaceVariant = ShopinoDarkSurfaceElevated,
    onSurfaceVariant = ShopinoDarkTextSecondary,
    outline = ShopinoDarkBorder,
    outlineVariant = ShopinoDarkBorderSubtle,
    error = ShopinoDangerRed,
    onError = Color.White
)

private val LightColorScheme = lightColorScheme(
    primary = ShopinoLightPrimary,
    onPrimary = Color.White,
    primaryContainer = ShopinoLightPrimaryContainer,
    onPrimaryContainer = ShopinoLightPrimary,
    secondary = ShopinoLightSecondary,
    onSecondary = Color.White,
    secondaryContainer = ShopinoLightSecondaryContainer,
    onSecondaryContainer = ShopinoLightSecondary,
    background = ShopinoLightBackground,
    onBackground = ShopinoLightTextPrimary,
    surface = ShopinoLightSurface,
    onSurface = ShopinoLightTextPrimary,
    surfaceVariant = ShopinoLightSurfaceElevated,
    onSurfaceVariant = ShopinoLightTextSecondary,
    outline = ShopinoLightBorder,
    outlineVariant = ShopinoLightBorderSubtle,
    error = ShopinoDangerRed,
    onError = Color.White
)

val ShopinoShapes = Shapes(
    extraSmall = RoundedCornerShape(8.dp),
    small = RoundedCornerShape(12.dp),
    medium = RoundedCornerShape(16.dp),
    large = RoundedCornerShape(20.dp),
    extraLarge = RoundedCornerShape(26.dp)
)

val LocalShopinoColors = staticCompositionLocalOf { DarkShopinoExtendedColors }
val LocalShopinoLanguage = staticCompositionLocalOf { AppLanguage.FA }
val LocalReducedMotion = staticCompositionLocalOf { false }

object ShopinoTheme {
    val colors: ShopinoExtendedColors
        @Composable
        get() = LocalShopinoColors.current

    val language: AppLanguage
        @Composable
        get() = LocalShopinoLanguage.current

    val isReducedMotion: Boolean
        @Composable
        get() = LocalReducedMotion.current
}

@Composable
fun ShopinoTheme(
    darkTheme: Boolean = true,
    language: AppLanguage = AppLanguage.FA,
    content: @Composable () -> Unit
) {
    val context = LocalContext.current
    val reducedMotion = remember(context) {
        try {
            val scale = Settings.Global.getFloat(
                context.contentResolver,
                Settings.Global.ANIMATOR_DURATION_SCALE,
                1.0f
            )
            scale == 0f
        } catch (_: Exception) {
            false
        }
    }

    val colorScheme = if (darkTheme) DarkColorScheme else LightColorScheme
    val extendedColors = if (darkTheme) DarkShopinoExtendedColors else LightShopinoExtendedColors
    val layoutDirection = if (language.isRtl) LayoutDirection.Rtl else LayoutDirection.Ltr

    CompositionLocalProvider(
        LocalShopinoColors provides extendedColors,
        LocalShopinoLanguage provides language,
        LocalReducedMotion provides reducedMotion,
        LocalLayoutDirection provides layoutDirection
    ) {
        MaterialTheme(
            colorScheme = colorScheme,
            typography = ShopinoTypography,
            shapes = ShopinoShapes,
            content = content
        )
    }
}
