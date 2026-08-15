package io.github.xpelch.healthconnect

import android.content.Context
import android.content.Intent
import androidx.health.connect.client.PermissionController
import expo.modules.kotlin.activityresult.AppContextActivityResultContract
import java.io.Serializable

data class HealthConnectPermissionRequest(
  val permissions: List<String>
) : Serializable

class HealthConnectPermissionContract :
  AppContextActivityResultContract<HealthConnectPermissionRequest, Set<String>> {
  private val contract =
    PermissionController.createRequestPermissionResultContract()

  override fun createIntent(
    context: Context,
    input: HealthConnectPermissionRequest
  ): Intent = contract.createIntent(context, input.permissions.toSet())

  override fun parseResult(
    input: HealthConnectPermissionRequest,
    resultCode: Int,
    intent: Intent?
  ): Set<String> = contract.parseResult(resultCode, intent)
}
