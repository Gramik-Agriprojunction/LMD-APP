package com.app.lmd

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule

class AppVersionModule(private val reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  override fun getName() = "AppVersion"

  override fun getConstants(): Map<String, Any> {
    val constants = HashMap<String, Any>()
    try {
      val pm = reactContext.packageManager
      val info = pm.getPackageInfo(reactContext.packageName, 0)
      constants["versionName"] = info.versionName ?: ""
      val code: Long = try {
        info.longVersionCode
      } catch (_: Throwable) {
        @Suppress("DEPRECATION")
        info.versionCode.toLong()
      }
      constants["versionCode"] = code
      constants["packageName"] = reactContext.packageName ?: ""
    } catch (e: Exception) {
      constants["versionName"] = ""
      constants["versionCode"] = 0L
      constants["packageName"] = ""
    }
    return constants
  }
}
