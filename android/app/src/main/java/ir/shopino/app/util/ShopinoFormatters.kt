package ir.shopino.app.util

import java.text.NumberFormat
import java.time.Instant
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale

enum class AppLanguage(val code: String, val isRtl: Boolean) {
    FA("fa", true),
    EN("en", false);

    companion object {
        fun fromCode(code: String?): AppLanguage =
            if (code?.lowercase(Locale.ROOT) == "en") EN else FA
    }
}

/**
 * Authoritative formatting utilities for Shopino Android.
 * Matches `src/utils/format.ts` in the web application:
 * - 1:1 integer Toman rule (never divide or multiply `_cents` columns by 10 or 100)
 * - Persian numeral conversion (`۰۱۲۳۴۵۶۷۸۹`) when language is FA
 * - Accurate Gregorian-to-Jalali (Solar Hijri) date conversion for Persian dates
 */
object ShopinoFormatters {

    private val persianDigits = charArrayOf('۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹')

    private val jalaliMonthNamesFa = arrayOf(
        "فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور",
        "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند"
    )

    private val gregorianMonthNamesEn = arrayOf(
        "Jan", "Feb", "Mar", "Apr", "May", "Jun",
        "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
    )

    /**
     * Converts ASCII digits ('0'-'9') in a string to Persian digits ('۰'-'۹').
     */
    fun toPersianDigits(input: String): String {
        val sb = StringBuilder(input.length)
        for (ch in input) {
            if (ch in '0'..'9') {
                sb.append(persianDigits[ch - '0'])
            } else {
                sb.append(ch)
            }
        }
        return sb.toString()
    }

    /**
     * Converts Persian/Arabic-Indic digits back to ASCII digits for safe numeric parsing.
     */
    fun toAsciiDigits(input: String): String {
        val sb = StringBuilder(input.length)
        for (ch in input) {
            when (ch) {
                in '۰'..'۹' -> sb.append(('0'.code + (ch.code - '۰'.code)).toChar())
                in '٠'..'٩' -> sb.append(('0'.code + (ch.code - '٠'.code)).toChar())
                else -> sb.append(ch)
            }
        }
        return sb.toString()
    }

    /**
     * Formats an integer/long number with thousands separators and localized digits.
     */
    fun formatNumber(value: Long, language: AppLanguage = AppLanguage.FA): String {
        val usFormatted = NumberFormat.getNumberInstance(Locale.US).format(value)
        return if (language == AppLanguage.FA) {
            toPersianDigits(usFormatted)
        } else {
            usFormatted
        }
    }

    fun formatNumber(value: Int, language: AppLanguage = AppLanguage.FA): String =
        formatNumber(value.toLong(), language)

    /**
     * Formats integer Toman amounts (stored 1:1 in `*_cents` fields in Shopino's SQLite database).
     * Example FA: `۱,۲۵۰,۰۰۰ تومان`
     * Example EN: `1,250,000 Toman`
     */
    fun formatCurrency(tomanAmount: Long, language: AppLanguage = AppLanguage.FA): String {
        val formattedNumber = formatNumber(tomanAmount, language)
        val unit = if (language == AppLanguage.FA) "تومان" else "Toman"
        return "$formattedNumber $unit"
    }

    /**
     * Compact currency formatter for chart axes (e.g., ۱۲.۵M or 12.5M).
     */
    fun formatCompactCurrency(tomanAmount: Long, language: AppLanguage = AppLanguage.FA): String {
        val absVal = kotlin.math.abs(tomanAmount)
        val sign = if (tomanAmount < 0) "-" else ""
        val raw = when {
            absVal >= 1_000_000_000L -> String.format(Locale.US, "%s%.1fB", sign, absVal / 1_000_000_000.0)
            absVal >= 1_000_000L -> String.format(Locale.US, "%s%.1fM", sign, absVal / 1_000_000.0)
            absVal >= 1_000L -> String.format(Locale.US, "%s%.0fK", sign, absVal / 1_000.0)
            else -> "$sign$absVal"
        }.replace(".0", "")
        return if (language == AppLanguage.FA) toPersianDigits(raw) else raw
    }

    /**
     * Formats an ISO-8601 date or datetime string into Jalali (Solar Hijri) when FA or Gregorian when EN.
     * Supports `YYYY-MM-DD`, `YYYY-MM-DD HH:mm:ss`, and full ISO instants.
     */
    fun formatDate(
        dateString: String?,
        language: AppLanguage = AppLanguage.FA,
        includeTime: Boolean = false,
        shortMonth: Boolean = false
    ): String {
        if (dateString.isNullOrBlank()) return "—"
        val trimmed = dateString.trim()

        val parsedDateTime: LocalDateTime = try {
            when {
                trimmed.endsWith("Z") || trimmed.contains("+") -> {
                    Instant.parse(trimmed).atZone(ZoneId.of("Asia/Tehran")).toLocalDateTime()
                }
                trimmed.length >= 19 && trimmed[10] == 'T' -> {
                    LocalDateTime.parse(trimmed.substring(0, 19))
                }
                trimmed.length >= 19 && trimmed[10] == ' ' -> {
                    LocalDateTime.parse(
                        trimmed.substring(0, 19),
                        DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss")
                    )
                }
                trimmed.length >= 10 -> {
                    LocalDate.parse(trimmed.substring(0, 10)).atStartOfDay()
                }
                else -> return trimmed
            }
        } catch (_: Exception) {
            return trimmed
        }

        val gYear = parsedDateTime.year
        val gMonth = parsedDateTime.monthValue
        val gDay = parsedDateTime.dayOfMonth

        return if (language == AppLanguage.FA) {
            val (jYear, jMonth, jDay) = gregorianToJalali(gYear, gMonth, gDay)
            val datePart = if (shortMonth) {
                val monthName = jalaliMonthNamesFa.getOrElse(jMonth - 1) { "" }
                toPersianDigits("$jDay $monthName")
            } else {
                val yStr = jYear.toString().padStart(4, '0')
                val mStr = jMonth.toString().padStart(2, '0')
                val dStr = jDay.toString().padStart(2, '0')
                toPersianDigits("$yStr/$mStr/$dStr")
            }
            if (includeTime) {
                val hStr = parsedDateTime.hour.toString().padStart(2, '0')
                val minStr = parsedDateTime.minute.toString().padStart(2, '0')
                "$datePart - ${toPersianDigits("$hStr:$minStr")}"
            } else {
                datePart
            }
        } else {
            val monthName = gregorianMonthNamesEn.getOrElse(gMonth - 1) { "" }
            val datePart = if (shortMonth) {
                "$monthName $gDay"
            } else {
                "$monthName $gDay, $gYear"
            }
            if (includeTime) {
                val hStr = parsedDateTime.hour.toString().padStart(2, '0')
                val minStr = parsedDateTime.minute.toString().padStart(2, '0')
                "$datePart, $hStr:$minStr"
            } else {
                datePart
            }
        }
    }

    /**
     * Standard Gregorian to Jalali (Solar Hijri) conversion algorithm.
     * Returns Triple(jalaliYear, jalaliMonth 1..12, jalaliDay 1..31).
     */
    fun gregorianToJalali(gy: Int, gm: Int, gd: Int): Triple<Int, Int, Int> {
        val gDaysInMonth = intArrayOf(0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334)
        val gy2 = if (gm > 2) gy + 1 else gy
        var days = 355666 + (365 * gy) + ((gy2 + 3) / 4) - ((gy2 + 99) / 100) +
            ((gy2 + 399) / 400) + gd + gDaysInMonth[gm - 1]
        var jy = -1595 + (33 * (days / 12053))
        days %= 12053
        jy += 4 * (days / 1461)
        days %= 1461
        if (days > 365) {
            jy += (days - 1) / 365
            days = (days - 1) % 365
        }
        val jm: Int
        val jd: Int
        if (days < 186) {
            jm = 1 + (days / 31)
            jd = 1 + (days % 31)
        } else {
            jm = 7 + ((days - 186) / 30)
            jd = 1 + ((days - 186) % 30)
        }
        return Triple(jy, jm, jd)
    }
}
