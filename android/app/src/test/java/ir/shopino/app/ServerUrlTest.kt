package ir.shopino.app

import ir.shopino.app.data.auth.ServerUrl
import ir.shopino.app.data.auth.ServerUrl.Reason
import ir.shopino.app.data.auth.ServerUrl.Result
import org.junit.Assert.assertEquals
import org.junit.Test

class ServerUrlTest {

    private fun release(raw: String?) = ServerUrl.normalize(raw, allowDevelopmentHosts = false)
    private fun debug(raw: String?) = ServerUrl.normalize(raw, allowDevelopmentHosts = true)

    @Test fun `production origin is accepted and keeps trailing slash`() {
        assertEquals(Result.Valid("https://shopino-cloud.ir/"), release("https://shopino-cloud.ir/"))
        assertEquals(Result.Valid("https://shopino-cloud.ir/"), release("  https://Shopino-Cloud.ir  "))
    }

    @Test fun `path prefix is preserved and normalized`() {
        assertEquals(Result.Valid("https://example.com/shopino/"), release("https://example.com/shopino"))
    }

    @Test fun `explicit port is kept but never invented`() {
        assertEquals(Result.Valid("https://example.com:8443/"), release("https://example.com:8443"))
        assertEquals(Result.Valid("https://shopino-cloud.ir/"), release("https://shopino-cloud.ir"))
    }

    @Test fun `empty and malformed values are rejected`() {
        assertEquals(Result.Invalid(Reason.EMPTY), release("  "))
        assertEquals(Result.Invalid(Reason.EMPTY), release(null))
        assertEquals(Result.Invalid(Reason.MALFORMED), release("shopino-cloud.ir"))
        assertEquals(Result.Invalid(Reason.UNSUPPORTED_SCHEME), release("ftp://shopino-cloud.ir/"))
    }

    @Test fun `credentials query and fragment are rejected`() {
        assertEquals(Result.Invalid(Reason.CREDENTIALS_NOT_ALLOWED), release("https://u:p@shopino-cloud.ir/"))
        assertEquals(Result.Invalid(Reason.QUERY_NOT_ALLOWED), release("https://shopino-cloud.ir/?a=1"))
        assertEquals(Result.Invalid(Reason.QUERY_NOT_ALLOWED), release("https://shopino-cloud.ir/#x"))
    }

    @Test fun `release rejects cleartext and local hosts`() {
        assertEquals(Result.Invalid(Reason.CLEARTEXT_NOT_ALLOWED), release("http://shopino-cloud.ir/"))
        assertEquals(Result.Invalid(Reason.LOCAL_HOST_NOT_ALLOWED), release("https://localhost/"))
        assertEquals(Result.Invalid(Reason.LOCAL_HOST_NOT_ALLOWED), release("https://10.0.2.2/"))
    }

    @Test fun `debug allows development hosts`() {
        assertEquals(Result.Valid("http://10.0.2.2:3000/"), debug("http://10.0.2.2:3000"))
    }

    @Test fun `retired Cloud Run host is rejected in every build type`() {
        val retired = "https://${ServerUrl.RETIRED_HOST}/"
        assertEquals(Result.Invalid(Reason.RETIRED_HOST), release(retired))
        assertEquals(Result.Invalid(Reason.RETIRED_HOST), debug(retired))
    }
}
