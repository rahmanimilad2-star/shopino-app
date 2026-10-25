package ir.shopino.app.ui.model

/**
 * UI-only sample models for Stage 2.
 * These are not API DTOs and must not be used for backend requests.
 */
data class PreviewDailySalesPoint(
    val date: String,
    val sales: Long,
    val received: Long
)

data class PreviewSalesVsPaymentPoint(
    val label: String,
    val sales: Long,
    val payments: Long
)

data class PreviewProduct(
    val id: Long,
    val name: String,
    val sku: String?,
    val category: String?,
    val unit: String,
    val buyPriceCents: Long,
    val sellPriceCents: Long,
    val stockQuantity: Int,
    val minStockLevel: Int
)

data class PreviewCustomer(
    val id: Long,
    val name: String,
    val phone: String?,
    val type: String,
    val creditLimitCents: Long,
    val totalBought: Long,
    val totalPaid: Long,
    val currentBalance: Long
)
