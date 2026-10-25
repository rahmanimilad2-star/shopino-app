package ir.shopino.app

import ir.shopino.app.util.AppLanguage
import ir.shopino.app.util.ShopinoFormatters
import org.junit.Assert.assertEquals
import org.junit.Test

class ShopinoFormattersTest {

    @Test
    fun `converts ASCII digits to Persian numerals accurately`() {
        assertEquals("۰۱۲۳۴۵۶۷۸۹", ShopinoFormatters.toPersianDigits("0123456789"))
        assertEquals("۱,۲۵۰,۰۰۰", ShopinoFormatters.formatNumber(1_250_000L, AppLanguage.FA))
        assertEquals("1,250,000", ShopinoFormatters.formatNumber(1_250_000L, AppLanguage.EN))
    }

    @Test
    fun `formats integer Toman 1 to 1 without dividing by 10 or 100`() {
        assertEquals(
            "۱,۳۸۰,۰۰۰ تومان",
            ShopinoFormatters.formatCurrency(1_380_000L, AppLanguage.FA)
        )
        assertEquals(
            "1,380,000 Toman",
            ShopinoFormatters.formatCurrency(1_380_000L, AppLanguage.EN)
        )
    }

    @Test
    fun `converts Gregorian dates to Jalali Solar Hijri accurately`() {
        // 2026-03-21 is 1 Farvardin 1405 (1405/01/01)
        val jalali = ShopinoFormatters.gregorianToJalali(2026, 3, 21)
        assertEquals(Triple(1405, 1, 1), jalali)
        assertEquals("۱۴۰۵/۰۱/۰۱", ShopinoFormatters.formatDate("2026-03-21", AppLanguage.FA))
        assertEquals("Mar 21, 2026", ShopinoFormatters.formatDate("2026-03-21", AppLanguage.EN))
    }
}
