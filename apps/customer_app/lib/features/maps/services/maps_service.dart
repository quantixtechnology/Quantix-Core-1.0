import 'dart:async';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';
import '../../../core/api/dio_client.dart';
import '../../../core/config/app_config.dart';
import '../../../core/constants/api_endpoints.dart';
import '../../../core/contracts/store_dto.dart';
import '../../../core/exceptions/app_exception.dart';

final mapsServiceProvider = Provider<MapsService>((ref) {
  return MapsService(ref.read(dioClientProvider));
});

class NearestStoreResult {
  const NearestStoreResult({
    required this.serviceable,
    this.store,
    this.distance,
    this.deliveryFee,
    this.estimatedTime,
    this.reason,
  });

  final bool serviceable;
  final StoreDTO? store;
  final double? distance;
  final double? deliveryFee;
  final int? estimatedTime;
  final String? reason;
}

class MapsService {
  MapsService(this._dio);

  final DioClient _dio;

  // ── Device GPS ────────────────────────────────────────────────────────────

  Future<Position> getCurrentPosition() async {
    bool serviceEnabled = await Geolocator.isLocationServiceEnabled();
    if (!serviceEnabled) throw const LocationException('Location services disabled.');

    LocationPermission permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
      if (permission == LocationPermission.denied) {
        throw const LocationException('Location permission denied.');
      }
    }
    if (permission == LocationPermission.deniedForever) {
      throw const LocationException('Location permission permanently denied.');
    }

    return Geolocator.getCurrentPosition(
      desiredAccuracy: LocationAccuracy.high,
    );
  }

  Stream<Position> positionStream() => Geolocator.getPositionStream(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.high,
          distanceFilter: 10, // update every 10 metres
        ),
      );

  // ── Nearest store ─────────────────────────────────────────────────────────

  Future<NearestStoreResult> findNearestStore({
    required double lat,
    required double lng,
  }) async {
    final response = await _dio.dio.get<Map<String, dynamic>>(
      ApiEndpoints.storesNearest,
      queryParameters: {
        'businessId': AppConfig.businessId,
        'lat': lat,
        'lng': lng,
      },
    );

    final body = response.data!;
    final serviceable = body['serviceable'] as bool? ?? false;

    if (!serviceable) {
      return NearestStoreResult(
        serviceable: false,
        reason: body['reason'] as String?,
      );
    }

    final data = body['data'] as Map<String, dynamic>;
    return NearestStoreResult(
      serviceable: true,
      store: StoreDTO.fromJson(data['store'] as Map<String, dynamic>),
      distance: (data['distance'] as num?)?.toDouble(),
      deliveryFee: (data['deliveryFee'] as num?)?.toDouble(),
      estimatedTime: data['estimatedTime'] as int?,
    );
  }

  // ── Marker helpers ────────────────────────────────────────────────────────

  static Marker partnerMarker(LatLng position, {String? title}) => Marker(
        markerId: const MarkerId('partner'),
        position: position,
        infoWindow: InfoWindow(title: title ?? 'Delivery Partner'),
        icon: BitmapDescriptor.defaultMarkerWithHue(BitmapDescriptor.hueOrange),
      );

  static Marker customerMarker(LatLng position) => Marker(
        markerId: const MarkerId('customer'),
        position: position,
        infoWindow: const InfoWindow(title: 'You'),
        icon: BitmapDescriptor.defaultMarkerWithHue(BitmapDescriptor.hueBlue),
      );

  static Marker storeMarker(LatLng position, String name) => Marker(
        markerId: const MarkerId('store'),
        position: position,
        infoWindow: InfoWindow(title: name),
        icon: BitmapDescriptor.defaultMarkerWithHue(BitmapDescriptor.hueGreen),
      );

  // ── Distance ──────────────────────────────────────────────────────────────

  static double haversineKm(LatLng a, LatLng b) {
    return Geolocator.distanceBetween(
          a.latitude, a.longitude, b.latitude, b.longitude,
        ) /
        1000;
  }
}
