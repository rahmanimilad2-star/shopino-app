package ir.shopino.app.ui.components

import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import ir.shopino.app.ui.model.PreviewDailySalesPoint
import ir.shopino.app.ui.model.PreviewSalesVsPaymentPoint
import ir.shopino.app.ui.theme.ShopinoTheme
import ir.shopino.app.util.ShopinoFormatters

enum class BadgeTone {
    SUCCESS,
    WARNING,
    DANGER,
    TURQUOISE,
    VIOLET,
    NEUTRAL
}

/**
 * Elevated Shopino surface card with subtle low-contrast border and optional top accent glow.
 */
@Composable
fun ShopinoSurfaceCard(
    modifier: Modifier = Modifier,
    accentColor: Color? = null,
    contentPadding: PaddingValues = PaddingValues(16.dp),
    onClick: (() -> Unit)? = null,
    content: @Composable ColumnScope.() -> Unit
) {
    val colors = ShopinoTheme.colors
    val shape = RoundedCornerShape(18.dp)
    val cardModifier = modifier
        .clip(shape)
        .background(colors.surface)
        .border(
            width = 1.dp,
            color = accentColor?.copy(alpha = 0.28f) ?: colors.border,
            shape = shape
        )
        .let { base ->
            if (onClick != null) base.clickable(onClick = onClick) else base
        }

    Box(modifier = cardModifier) {
        if (accentColor != null) {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(3.dp)
                    .background(
                        Brush.horizontalGradient(
                            colors = listOf(
                                accentColor.copy(alpha = 0.85f),
                                accentColor.copy(alpha = 0.15f)
                            )
                        )
                    )
            )
        }
        Column(
            modifier = Modifier.padding(contentPadding),
            content = content
        )
    }
}

/**
 * Financial KPI card displaying a localized title, formatted monetary/count figure,
 * icon badge, and optional subtitle/trend indicator.
 */
@Composable
fun ShopinoKpiCard(
    title: String,
    value: String,
    subtitle: String,
    icon: ImageVector,
    accentColor: Color,
    modifier: Modifier = Modifier
) {
    val colors = ShopinoTheme.colors
    ShopinoSurfaceCard(
        modifier = modifier,
        accentColor = accentColor,
        contentPadding = PaddingValues(16.dp)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = title,
                style = MaterialTheme.typography.bodyMedium,
                color = colors.textSecondary,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.weight(1f)
            )
            Spacer(modifier = Modifier.width(8.dp))
            Box(
                modifier = Modifier
                    .size(38.dp)
                    .clip(RoundedCornerShape(11.dp))
                    .background(accentColor.copy(alpha = 0.14f))
                    .border(1.dp, accentColor.copy(alpha = 0.28f), RoundedCornerShape(11.dp)),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = icon,
                    contentDescription = title,
                    tint = accentColor,
                    modifier = Modifier.size(20.dp)
                )
            }
        }
        Spacer(modifier = Modifier.height(12.dp))
        Text(
            text = value,
            style = MaterialTheme.typography.headlineSmall.copy(fontWeight = FontWeight.ExtraBold),
            color = colors.textPrimary,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis
        )
        Spacer(modifier = Modifier.height(6.dp))
        Text(
            text = subtitle,
            style = MaterialTheme.typography.labelMedium,
            color = accentColor,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis
        )
    }
}

/**
 * Semantic status badge for paid/partial/unpaid orders and stock levels.
 */
@Composable
fun ShopinoStatusBadge(
    label: String,
    tone: BadgeTone,
    modifier: Modifier = Modifier
) {
    val colors = ShopinoTheme.colors
    val (fg, bg) = when (tone) {
        BadgeTone.SUCCESS -> colors.success to colors.successContainer
        BadgeTone.WARNING -> colors.warning to colors.warningContainer
        BadgeTone.DANGER -> colors.danger to colors.dangerContainer
        BadgeTone.TURQUOISE -> colors.accentTurquoise to colors.accentTurquoiseContainer
        BadgeTone.VIOLET -> colors.accentViolet to colors.accentVioletContainer
        BadgeTone.NEUTRAL -> colors.textSecondary to colors.surfaceElevated
    }

    Surface(
        modifier = modifier,
        shape = RoundedCornerShape(8.dp),
        color = bg,
        border = BorderStroke(1.dp, fg.copy(alpha = 0.30f))
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(5.dp)
        ) {
            Box(
                modifier = Modifier
                    .size(6.dp)
                    .clip(CircleShape)
                    .background(fg)
            )
            Text(
                text = label,
                style = MaterialTheme.typography.labelMedium.copy(fontWeight = FontWeight.SemiBold),
                color = fg
            )
        }
    }
}

/**
 * Primary turquoise button or outlined secondary button matching Shopino fintech styling.
 */
@Composable
fun ShopinoButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    icon: ImageVector? = null,
    enabled: Boolean = true,
    outlined: Boolean = false,
    accentColor: Color = ShopinoTheme.colors.accentTurquoise
) {
    val colors = ShopinoTheme.colors
    val shape = RoundedCornerShape(12.dp)

    if (outlined) {
        OutlinedButton(
            onClick = onClick,
            enabled = enabled,
            modifier = modifier.height(46.dp),
            shape = shape,
            border = BorderStroke(1.dp, accentColor.copy(alpha = 0.45f)),
            colors = ButtonDefaults.outlinedButtonColors(
                contentColor = accentColor
            ),
            contentPadding = PaddingValues(horizontal = 16.dp, vertical = 10.dp)
        ) {
            if (icon != null) {
                Icon(
                    imageVector = icon,
                    contentDescription = null,
                    modifier = Modifier.size(18.dp)
                )
                Spacer(modifier = Modifier.width(8.dp))
            }
            Text(
                text = text,
                style = MaterialTheme.typography.labelLarge
            )
        }
    } else {
        Button(
            onClick = onClick,
            enabled = enabled,
            modifier = modifier.height(46.dp),
            shape = shape,
            colors = ButtonDefaults.buttonColors(
                containerColor = accentColor,
                contentColor = if (colors.isDark) Color(0xFF06101E) else Color.White,
                disabledContainerColor = colors.surfaceElevated,
                disabledContentColor = colors.textMuted
            ),
            contentPadding = PaddingValues(horizontal = 16.dp, vertical = 10.dp)
        ) {
            if (icon != null) {
                Icon(
                    imageVector = icon,
                    contentDescription = null,
                    modifier = Modifier.size(18.dp)
                )
                Spacer(modifier = Modifier.width(8.dp))
            }
            Text(
                text = text,
                style = MaterialTheme.typography.labelLarge.copy(fontWeight = FontWeight.Bold)
            )
        }
    }
}

/**
 * Custom styled OutlinedTextField for Shopino forms and authentication.
 */
@Composable
fun ShopinoTextField(
    value: String,
    onValueChange: (String) -> Unit,
    label: String,
    modifier: Modifier = Modifier,
    leadingIcon: ImageVector? = null,
    trailingIcon: @Composable (() -> Unit)? = null,
    visualTransformation: VisualTransformation = VisualTransformation.None,
    keyboardOptions: KeyboardOptions = KeyboardOptions.Default,
    singleLine: Boolean = true
) {
    val colors = ShopinoTheme.colors
    OutlinedTextField(
        value = value,
        onValueChange = onValueChange,
        label = { Text(label, style = MaterialTheme.typography.bodyMedium) },
        leadingIcon = if (leadingIcon != null) {
            {
                Icon(
                    imageVector = leadingIcon,
                    contentDescription = label,
                    tint = colors.textSecondary,
                    modifier = Modifier.size(20.dp)
                )
            }
        } else null,
        trailingIcon = trailingIcon,
        visualTransformation = visualTransformation,
        keyboardOptions = keyboardOptions,
        singleLine = singleLine,
        shape = RoundedCornerShape(13.dp),
        colors = OutlinedTextFieldDefaults.colors(
            focusedBorderColor = colors.accentTurquoise,
            unfocusedBorderColor = colors.border,
            focusedContainerColor = colors.surfaceElevated.copy(alpha = 0.55f),
            unfocusedContainerColor = colors.surfaceElevated.copy(alpha = 0.35f),
            focusedLabelColor = colors.accentTurquoise,
            unfocusedLabelColor = colors.textSecondary,
            focusedTextColor = colors.textPrimary,
            unfocusedTextColor = colors.textPrimary,
            cursorColor = colors.accentTurquoise
        ),
        modifier = modifier.fillMaxWidth()
    )
}

/**
 * Smooth Canvas Area Chart for Sales Over Time with turquoise gradient fill and data nodes.
 */
@Composable
fun ShopinoSalesAreaChart(
    points: List<PreviewDailySalesPoint>,
    modifier: Modifier = Modifier,
    chartHeight: Dp = 185.dp
) {
    val colors = ShopinoTheme.colors
    val language = ShopinoTheme.language
    val reducedMotion = ShopinoTheme.isReducedMotion

    val progress by animateFloatAsState(
        targetValue = 1f,
        animationSpec = tween(
            durationMillis = if (reducedMotion) 0 else 650,
            easing = FastOutSlowInEasing
        ),
        label = "areaChartProgress"
    )

    if (points.isEmpty()) return

    val maxSales = (points.maxOfOrNull { it.sales } ?: 1L).coerceAtLeast(1L)

    Column(modifier = modifier.fillMaxWidth()) {
        Canvas(
            modifier = Modifier
                .fillMaxWidth()
                .height(chartHeight)
        ) {
            val width = size.width
            val height = size.height
            val verticalPadding = 16.dp.toPx()
            val usableHeight = (height - verticalPadding * 2).coerceAtLeast(1f)

            // Horizontal subtle grid lines
            val gridSteps = 3
            for (i in 0..gridSteps) {
                val y = verticalPadding + (usableHeight / gridSteps) * i
                drawLine(
                    color = colors.border.copy(alpha = 0.6f),
                    start = Offset(0f, y),
                    end = Offset(width, y),
                    strokeWidth = 1.dp.toPx()
                )
            }

            val stepX = if (points.size > 1) width / (points.size - 1) else width
            val coordinates = points.mapIndexed { index, pt ->
                val x = index * stepX
                val normalized = (pt.sales.toFloat() / maxSales.toFloat()) * progress
                val y = verticalPadding + usableHeight * (1f - normalized)
                Offset(x, y)
            }

            val linePath = Path().apply {
                coordinates.forEachIndexed { idx, offset ->
                    if (idx == 0) moveTo(offset.x, offset.y)
                    else {
                        val prev = coordinates[idx - 1]
                        val ctrlX = (prev.x + offset.x) / 2f
                        cubicTo(ctrlX, prev.y, ctrlX, offset.y, offset.x, offset.y)
                    }
                }
            }

            val fillPath = Path().apply {
                addPath(linePath)
                lineTo(coordinates.last().x, height - verticalPadding / 2)
                lineTo(coordinates.first().x, height - verticalPadding / 2)
                close()
            }

            drawPath(
                path = fillPath,
                brush = Brush.verticalGradient(
                    colors = listOf(
                        colors.accentTurquoise.copy(alpha = 0.34f),
                        colors.accentTurquoise.copy(alpha = 0.02f)
                    ),
                    startY = 0f,
                    endY = height
                )
            )

            drawPath(
                path = linePath,
                color = colors.accentTurquoise,
                style = Stroke(
                    width = 3.dp.toPx(),
                    cap = StrokeCap.Round,
                    join = StrokeJoin.Round
                )
            )

            coordinates.forEach { pt ->
                drawCircle(
                    color = colors.surface,
                    radius = 5.dp.toPx(),
                    center = pt
                )
                drawCircle(
                    color = colors.accentTurquoise,
                    radius = 3.5.dp.toPx(),
                    center = pt
                )
            }
        }

        Spacer(modifier = Modifier.height(8.dp))

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            points.forEach { pt ->
                Text(
                    text = ShopinoFormatters.formatDate(pt.date, language, shortMonth = true),
                    style = MaterialTheme.typography.labelSmall,
                    color = colors.textMuted
                )
            }
        }
    }
}

/**
 * Dual Bar Chart comparing Sales (Turquoise `#20D6C2`) vs Payments Received (Violet `#7C83FF`).
 */
@Composable
fun ShopinoSalesVsPaymentsBarChart(
    items: List<PreviewSalesVsPaymentPoint>,
    modifier: Modifier = Modifier,
    chartHeight: Dp = 180.dp
) {
    val colors = ShopinoTheme.colors
    val language = ShopinoTheme.language
    val reducedMotion = ShopinoTheme.isReducedMotion

    val progress by animateFloatAsState(
        targetValue = 1f,
        animationSpec = tween(
            durationMillis = if (reducedMotion) 0 else 650,
            easing = FastOutSlowInEasing
        ),
        label = "barChartProgress"
    )

    if (items.isEmpty()) return

    val maxVal = items.maxOfOrNull { maxOf(it.sales, it.payments) }?.coerceAtLeast(1L) ?: 1L

    Column(modifier = modifier.fillMaxWidth()) {
        // Legend row
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(16.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            LegendDot(
                color = colors.accentTurquoise,
                label = if (language.isRtl) "فروش" else "Sales"
            )
            LegendDot(
                color = colors.accentViolet,
                label = if (language.isRtl) "دریافتی" else "Received"
            )
        }

        Spacer(modifier = Modifier.height(12.dp))

        Canvas(
            modifier = Modifier
                .fillMaxWidth()
                .height(chartHeight)
        ) {
            val width = size.width
            val height = size.height
            val topPad = 10.dp.toPx()
            val usableHeight = (height - topPad).coerceAtLeast(1f)

            for (i in 0..3) {
                val y = topPad + (usableHeight / 3f) * i
                drawLine(
                    color = colors.border.copy(alpha = 0.55f),
                    start = Offset(0f, y),
                    end = Offset(width, y),
                    strokeWidth = 1.dp.toPx()
                )
            }

            val groupWidth = width / items.size
            val barWidth = (groupWidth * 0.26f).coerceAtMost(22.dp.toPx())
            val gap = 4.dp.toPx()

            items.forEachIndexed { index, item ->
                val centerX = groupWidth * index + groupWidth / 2f
                val salesRatio = (item.sales.toFloat() / maxVal.toFloat()) * progress
                val paymentRatio = (item.payments.toFloat() / maxVal.toFloat()) * progress

                val salesBarHeight = (usableHeight * salesRatio).coerceAtLeast(4.dp.toPx())
                val paymentBarHeight = (usableHeight * paymentRatio).coerceAtLeast(4.dp.toPx())

                // Sales bar (Turquoise)
                drawRoundRect(
                    color = colors.accentTurquoise,
                    topLeft = Offset(centerX - barWidth - gap / 2f, height - salesBarHeight),
                    size = Size(barWidth, salesBarHeight),
                    cornerRadius = CornerRadius(6.dp.toPx(), 6.dp.toPx())
                )

                // Payments bar (Violet)
                drawRoundRect(
                    color = colors.accentViolet,
                    topLeft = Offset(centerX + gap / 2f, height - paymentBarHeight),
                    size = Size(barWidth, paymentBarHeight),
                    cornerRadius = CornerRadius(6.dp.toPx(), 6.dp.toPx())
                )
            }
        }

        Spacer(modifier = Modifier.height(8.dp))

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceAround
        ) {
            items.forEach { item ->
                Text(
                    text = if (language.isRtl) ShopinoFormatters.toPersianDigits(item.label) else item.label,
                    style = MaterialTheme.typography.labelSmall,
                    color = colors.textMuted
                )
            }
        }
    }
}

@Composable
private fun LegendDot(color: Color, label: String) {
    val colors = ShopinoTheme.colors
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(6.dp)
    ) {
        Box(
            modifier = Modifier
                .size(10.dp)
                .clip(RoundedCornerShape(3.dp))
                .background(color)
        )
        Text(
            text = label,
            style = MaterialTheme.typography.labelMedium,
            color = colors.textSecondary
        )
    }
}
