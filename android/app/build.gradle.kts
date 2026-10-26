import java.net.URI

plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.kotlin.serialization)
}

// ---- API origin configuration (single source of truth: android/gradle.properties) ----
val retiredApiHosts = listOf("ais-pre-ak3ludbj3fwi2bggcjwafc-225659912425.europe-west3.run.app")
val developmentOnlyHosts = listOf("localhost", "127.0.0.1", "10.0.2.2", "0.0.0.0", "::1")

fun parseOrigin(name: String, raw: String): URI {
    val uri = try { URI(raw.trim()) } catch (e: Exception) {
        throw GradleException("$name is not a valid URL: '$raw'")
    }
    if (uri.scheme !in listOf("http", "https") || uri.host.isNullOrBlank()) {
        throw GradleException("$name must be an absolute http(s) URL with a host: '$raw'")
    }
    if (uri.userInfo != null || uri.query != null || uri.fragment != null) {
        throw GradleException("$name must not contain credentials, query or fragment: '$raw'")
    }
    return uri
}

fun normalizedOrigin(uri: URI): String {
    val port = if (uri.port != -1) ":${uri.port}" else ""
    val path = (uri.path ?: "").trimEnd('/') + "/"
    return "${uri.scheme.lowercase()}://${uri.host.lowercase()}$port$path"
}

fun validatedReleaseOrigin(name: String, raw: String): String {
    val uri = parseOrigin(name, raw)
    val host = uri.host.lowercase()
    if (uri.scheme != "https") throw GradleException("$name must use https for release builds: '$raw'")
    if (host in developmentOnlyHosts) throw GradleException("$name must not point at a local/development host: '$raw'")
    if (host in retiredApiHosts) throw GradleException("$name points at a retired host ($host)")
    return normalizedOrigin(uri)
}

val productionApiOrigin: String = validatedReleaseOrigin(
    "shopino.apiOrigin",
    (findProperty("shopino.apiOrigin") as String?)
        ?: throw GradleException("shopino.apiOrigin is missing from android/gradle.properties")
)
// Debug builds may be redirected to a dev server; otherwise they use the production origin.
val debugApiOrigin: String = (findProperty("shopino.devApiOrigin") as String?)
    ?.takeIf { it.isNotBlank() }
    ?.let { normalizedOrigin(parseOrigin("shopino.devApiOrigin", it)) }
    ?.also { origin ->
        if (URI(origin).host.lowercase() in retiredApiHosts) {
            throw GradleException("shopino.devApiOrigin points at a retired host")
        }
    }
    ?: productionApiOrigin

android {
    namespace = "ir.shopino.app"
    compileSdk = 35

    defaultConfig {
        applicationId = "ir.shopino.app"
        minSdk = 26
        targetSdk = 35
        versionCode = 1
        versionName = "1.0.0"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
        vectorDrawables {
            useSupportLibrary = true
        }
    }

    signingConfigs {
        create("release") {
            val keystorePath = System.getenv("ANDROID_KEYSTORE_PATH")
            if (!keystorePath.isNullOrBlank() && file(keystorePath).exists()) {
                storeFile = file(keystorePath)
                storePassword = System.getenv("ANDROID_KEYSTORE_PASSWORD")
                keyAlias = System.getenv("ANDROID_KEY_ALIAS")
                keyPassword = System.getenv("ANDROID_KEY_PASSWORD")
            }
        }
    }

    buildTypes {
        debug {
            isMinifyEnabled = false
            buildConfigField("String", "DEFAULT_BASE_URL", "\"$debugApiOrigin\"")
        }
        release {
            buildConfigField("String", "DEFAULT_BASE_URL", "\"$productionApiOrigin\"")
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
            val releaseSigning = signingConfigs.findByName("release")
            if (releaseSigning?.storeFile != null) {
                signingConfig = releaseSigning
            }
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }

    buildFeatures {
        compose = true
        buildConfig = true
    }

    packaging {
        resources {
            excludes += "/META-INF/{AL2.0,LGPL2.1}"
        }
    }
}

dependencies {
    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.lifecycle.runtime.ktx)
    implementation(libs.androidx.lifecycle.viewmodel.compose)
    implementation(libs.androidx.activity.compose)
    implementation(platform(libs.androidx.compose.bom))
    implementation(libs.androidx.ui)
    implementation(libs.androidx.ui.graphics)
    implementation(libs.androidx.ui.tooling.preview)
    implementation(libs.androidx.material3)
    implementation(libs.androidx.material.icons.extended)
    implementation(libs.androidx.navigation.compose)
    implementation(libs.androidx.security.crypto)

    implementation(libs.retrofit.core)
    implementation(libs.retrofit.kotlin.serialization)
    implementation(libs.okhttp.core)
    implementation(libs.okhttp.logging)
    implementation(libs.kotlinx.serialization.json)
    implementation(libs.kotlinx.coroutines.android)

    testImplementation(libs.junit)
    debugImplementation(libs.androidx.ui.tooling)
}
