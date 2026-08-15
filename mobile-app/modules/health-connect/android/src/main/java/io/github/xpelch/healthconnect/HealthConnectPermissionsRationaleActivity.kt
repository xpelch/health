package io.github.xpelch.healthconnect

import android.app.Activity
import android.os.Bundle
import android.text.method.LinkMovementMethod
import android.view.ViewGroup
import android.widget.ScrollView
import android.widget.TextView

class HealthConnectPermissionsRationaleActivity : Activity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)

    val density = resources.displayMetrics.density
    val padding = (24 * density).toInt()
    val content = TextView(this).apply {
      text = """
        Health Connect privacy

        Health reads only the health categories you choose: steps, heart rate,
        sleep, and exercise sessions.

        Imported data remains on this phone during the current preview session.
        Health does not use an account, advertising, analytics, or a backend,
        and does not write data to Health Connect.

        You can change or revoke access at any time in Health Connect settings.
        Health is for fitness and wellness and must not be used for medical
        decisions.
      """.trimIndent()
      textSize = 18f
      setPadding(padding, padding, padding, padding)
      movementMethod = LinkMovementMethod.getInstance()
    }

    setContentView(
      ScrollView(this).apply {
        addView(
          content,
          ViewGroup.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.WRAP_CONTENT
          )
        )
      }
    )
  }
}
