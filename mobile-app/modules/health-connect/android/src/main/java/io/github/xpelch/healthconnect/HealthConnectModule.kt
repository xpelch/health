package io.github.xpelch.healthconnect

import android.content.Intent
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.ExerciseSessionRecord
import androidx.health.connect.client.records.HeartRateRecord
import androidx.health.connect.client.records.metadata.Metadata
import androidx.health.connect.client.records.SleepSessionRecord
import androidx.health.connect.client.records.StepsRecord
import androidx.health.connect.client.request.ReadRecordsRequest
import androidx.health.connect.client.time.TimeRangeFilter
import expo.modules.kotlin.activityresult.AppContextActivityResultLauncher
import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.time.Instant
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

class HealthConnectModule : Module() {
  private lateinit var permissionLauncher:
    AppContextActivityResultLauncher<HealthConnectPermissionRequest, Set<String>>

  override fun definition() = ModuleDefinition {
    Name("HealthConnect")

    RegisterActivityContracts {
      permissionLauncher = registerForActivityResult(
        HealthConnectPermissionContract()
      )
    }

    AsyncFunction("getSdkStatusAsync") {
      when (HealthConnectClient.getSdkStatus(requireContext())) {
        HealthConnectClient.SDK_AVAILABLE -> "available"
        HealthConnectClient.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED ->
          "update-required"
        else -> "unavailable"
      }
    }

    AsyncFunction("getGrantedMetricsAsync") Coroutine { ->
      val granted = requireClient()
        .permissionController
        .getGrantedPermissions()
      metricPermissions()
        .filterValues { it in granted }
        .keys
        .toList()
    }

    AsyncFunction("requestPermissionsAsync") Coroutine {
        metrics: List<String> ->
      val requestedPermissions = metrics
        .distinct()
        .map { metric ->
          metricPermissions()[metric]
            ?: throw IllegalArgumentException("Unsupported health metric.")
        }
      requireClient()
      val granted = permissionLauncher.launch(
        HealthConnectPermissionRequest(requestedPermissions)
      )
      metricPermissions()
        .filterValues { it in granted }
        .keys
        .toList()
    }

    AsyncFunction("readRecordsAsync") Coroutine {
        metric: String,
        startTime: String,
        endTime: String,
        pageToken: String?,
        pageSize: Int ->
      val safePageSize = pageSize.coerceIn(1, 1000)
      val start = Instant.parse(startTime)
      val end = Instant.parse(endTime)
      require(start < end) { "The health data time range is invalid." }

      withContext(Dispatchers.IO) {
        readPage(metric, start, end, pageToken, safePageSize)
      }
    }

    Function("openSettings") {
      val context = requireContext()
      val intent = Intent(
        HealthConnectClient.ACTION_HEALTH_CONNECT_SETTINGS
      ).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      context.startActivity(intent)
    }
  }

  private fun requireContext() =
    appContext.reactContext
      ?: throw IllegalStateException("Android context is unavailable.")

  private fun requireClient(): HealthConnectClient {
    val context = requireContext()
    check(
      HealthConnectClient.getSdkStatus(context) ==
        HealthConnectClient.SDK_AVAILABLE
    ) {
      "Health Connect is unavailable."
    }
    return HealthConnectClient.getOrCreate(context)
  }

  private fun metricPermissions(): Map<String, String> = mapOf(
    "steps" to HealthPermission.getReadPermission(StepsRecord::class),
    "heartRate" to HealthPermission.getReadPermission(
      HeartRateRecord::class
    ),
    "sleep" to HealthPermission.getReadPermission(
      SleepSessionRecord::class
    ),
    "workout" to HealthPermission.getReadPermission(
      ExerciseSessionRecord::class
    )
  )

  private suspend fun readPage(
    metric: String,
    startTime: Instant,
    endTime: Instant,
    pageToken: String?,
    pageSize: Int
  ): Map<String, Any?> {
    val client = requireClient()
    val timeRange = TimeRangeFilter.between(startTime, endTime)

    return when (metric) {
      "steps" -> {
        val response = client.readRecords(
          ReadRecordsRequest(
            recordType = StepsRecord::class,
            timeRangeFilter = timeRange,
            ascendingOrder = true,
            pageSize = pageSize,
            pageToken = pageToken
          )
        )
        page(response.records.map(::mapSteps), response.pageToken)
      }
      "heartRate" -> {
        val response = client.readRecords(
          ReadRecordsRequest(
            recordType = HeartRateRecord::class,
            timeRangeFilter = timeRange,
            ascendingOrder = true,
            pageSize = pageSize,
            pageToken = pageToken
          )
        )
        page(response.records.map(::mapHeartRate), response.pageToken)
      }
      "sleep" -> {
        val response = client.readRecords(
          ReadRecordsRequest(
            recordType = SleepSessionRecord::class,
            timeRangeFilter = timeRange,
            ascendingOrder = true,
            pageSize = pageSize,
            pageToken = pageToken
          )
        )
        page(response.records.map(::mapSleep), response.pageToken)
      }
      "workout" -> {
        val response = client.readRecords(
          ReadRecordsRequest(
            recordType = ExerciseSessionRecord::class,
            timeRangeFilter = timeRange,
            ascendingOrder = true,
            pageSize = pageSize,
            pageToken = pageToken
          )
        )
        page(response.records.map(::mapWorkout), response.pageToken)
      }
      else -> throw IllegalArgumentException("Unsupported health metric.")
    }
  }

  private fun page(
    records: List<Map<String, Any?>>,
    pageToken: String?
  ): Map<String, Any?> = mapOf(
    "records" to records,
    "pageToken" to pageToken
  )

  private fun mapSteps(record: StepsRecord): Map<String, Any?> =
    intervalFields(
      record.metadata,
      record.startTime,
      record.endTime,
      record.startZoneOffset?.id,
      record.endZoneOffset?.id
    ) + mapOf(
      "recordType" to "steps",
      "count" to record.count.toDouble()
    )

  private fun mapHeartRate(
    record: HeartRateRecord
  ): Map<String, Any?> =
    intervalFields(
      record.metadata,
      record.startTime,
      record.endTime,
      record.startZoneOffset?.id,
      record.endZoneOffset?.id
    ) + mapOf(
      "recordType" to "heartRate",
      "samples" to record.samples.map { sample ->
        mapOf(
          "timestamp" to sample.time.toString(),
          "beatsPerMinute" to sample.beatsPerMinute.toDouble()
        )
      }
    )

  private fun mapSleep(record: SleepSessionRecord): Map<String, Any?> =
    intervalFields(
      record.metadata,
      record.startTime,
      record.endTime,
      record.startZoneOffset?.id,
      record.endZoneOffset?.id
    ) + mapOf(
      "recordType" to "sleep",
      "stages" to record.stages.map { stage ->
        mapOf(
          "startTime" to stage.startTime.toString(),
          "endTime" to stage.endTime.toString(),
          "stageType" to stage.stage
        )
      }
    )

  private fun mapWorkout(
    record: ExerciseSessionRecord
  ): Map<String, Any?> =
    intervalFields(
      record.metadata,
      record.startTime,
      record.endTime,
      record.startZoneOffset?.id,
      record.endZoneOffset?.id
    ) + mapOf(
      "recordType" to "workout",
      "exerciseType" to record.exerciseType,
      "title" to record.title
    )

  private fun intervalFields(
    metadata: Metadata,
    startTime: Instant,
    endTime: Instant,
    startZoneOffset: String?,
    endZoneOffset: String?
  ): Map<String, Any?> = metadataFields(metadata) + mapOf(
    "startTime" to startTime.toString(),
    "endTime" to endTime.toString(),
    "startZoneOffset" to startZoneOffset,
    "endZoneOffset" to endZoneOffset
  )

  private fun metadataFields(metadata: Metadata): Map<String, Any?> =
    mapOf(
      "sourceRecordId" to metadata.id,
      "originId" to metadata.dataOrigin.packageName,
      "updatedAt" to metadata.lastModifiedTime.toString(),
      "deviceManufacturer" to metadata.device?.manufacturer,
      "deviceModel" to metadata.device?.model
    )
}
