// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'websocket_payloads.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// dart format off
T _$identity<T>(T value) => value;

/// @nodoc
mixin _$WsOrderStatusChanged {

 String get orderId; String get orderNumber; String get previousStatus; String get newStatus; String get businessId; String get timestamp; String? get storeId; String? get customerId; String? get note;
/// Create a copy of WsOrderStatusChanged
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$WsOrderStatusChangedCopyWith<WsOrderStatusChanged> get copyWith => _$WsOrderStatusChangedCopyWithImpl<WsOrderStatusChanged>(this as WsOrderStatusChanged, _$identity);

  /// Serializes this WsOrderStatusChanged to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is WsOrderStatusChanged&&(identical(other.orderId, orderId) || other.orderId == orderId)&&(identical(other.orderNumber, orderNumber) || other.orderNumber == orderNumber)&&(identical(other.previousStatus, previousStatus) || other.previousStatus == previousStatus)&&(identical(other.newStatus, newStatus) || other.newStatus == newStatus)&&(identical(other.businessId, businessId) || other.businessId == businessId)&&(identical(other.timestamp, timestamp) || other.timestamp == timestamp)&&(identical(other.storeId, storeId) || other.storeId == storeId)&&(identical(other.customerId, customerId) || other.customerId == customerId)&&(identical(other.note, note) || other.note == note));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,orderId,orderNumber,previousStatus,newStatus,businessId,timestamp,storeId,customerId,note);

@override
String toString() {
  return 'WsOrderStatusChanged(orderId: $orderId, orderNumber: $orderNumber, previousStatus: $previousStatus, newStatus: $newStatus, businessId: $businessId, timestamp: $timestamp, storeId: $storeId, customerId: $customerId, note: $note)';
}


}

/// @nodoc
abstract mixin class $WsOrderStatusChangedCopyWith<$Res>  {
  factory $WsOrderStatusChangedCopyWith(WsOrderStatusChanged value, $Res Function(WsOrderStatusChanged) _then) = _$WsOrderStatusChangedCopyWithImpl;
@useResult
$Res call({
 String orderId, String orderNumber, String previousStatus, String newStatus, String businessId, String timestamp, String? storeId, String? customerId, String? note
});




}
/// @nodoc
class _$WsOrderStatusChangedCopyWithImpl<$Res>
    implements $WsOrderStatusChangedCopyWith<$Res> {
  _$WsOrderStatusChangedCopyWithImpl(this._self, this._then);

  final WsOrderStatusChanged _self;
  final $Res Function(WsOrderStatusChanged) _then;

/// Create a copy of WsOrderStatusChanged
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? orderId = null,Object? orderNumber = null,Object? previousStatus = null,Object? newStatus = null,Object? businessId = null,Object? timestamp = null,Object? storeId = freezed,Object? customerId = freezed,Object? note = freezed,}) {
  return _then(_self.copyWith(
orderId: null == orderId ? _self.orderId : orderId // ignore: cast_nullable_to_non_nullable
as String,orderNumber: null == orderNumber ? _self.orderNumber : orderNumber // ignore: cast_nullable_to_non_nullable
as String,previousStatus: null == previousStatus ? _self.previousStatus : previousStatus // ignore: cast_nullable_to_non_nullable
as String,newStatus: null == newStatus ? _self.newStatus : newStatus // ignore: cast_nullable_to_non_nullable
as String,businessId: null == businessId ? _self.businessId : businessId // ignore: cast_nullable_to_non_nullable
as String,timestamp: null == timestamp ? _self.timestamp : timestamp // ignore: cast_nullable_to_non_nullable
as String,storeId: freezed == storeId ? _self.storeId : storeId // ignore: cast_nullable_to_non_nullable
as String?,customerId: freezed == customerId ? _self.customerId : customerId // ignore: cast_nullable_to_non_nullable
as String?,note: freezed == note ? _self.note : note // ignore: cast_nullable_to_non_nullable
as String?,
  ));
}

}


/// Adds pattern-matching-related methods to [WsOrderStatusChanged].
extension WsOrderStatusChangedPatterns on WsOrderStatusChanged {
/// A variant of `map` that fallback to returning `orElse`.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case _:
///     return orElse();
/// }
/// ```

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _WsOrderStatusChanged value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _WsOrderStatusChanged() when $default != null:
return $default(_that);case _:
  return orElse();

}
}
/// A `switch`-like method, using callbacks.
///
/// Callbacks receives the raw object, upcasted.
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case final Subclass2 value:
///     return ...;
/// }
/// ```

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _WsOrderStatusChanged value)  $default,){
final _that = this;
switch (_that) {
case _WsOrderStatusChanged():
return $default(_that);case _:
  throw StateError('Unexpected subclass');

}
}
/// A variant of `map` that fallback to returning `null`.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case _:
///     return null;
/// }
/// ```

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _WsOrderStatusChanged value)?  $default,){
final _that = this;
switch (_that) {
case _WsOrderStatusChanged() when $default != null:
return $default(_that);case _:
  return null;

}
}
/// A variant of `when` that fallback to an `orElse` callback.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case _:
///     return orElse();
/// }
/// ```

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String orderId,  String orderNumber,  String previousStatus,  String newStatus,  String businessId,  String timestamp,  String? storeId,  String? customerId,  String? note)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _WsOrderStatusChanged() when $default != null:
return $default(_that.orderId,_that.orderNumber,_that.previousStatus,_that.newStatus,_that.businessId,_that.timestamp,_that.storeId,_that.customerId,_that.note);case _:
  return orElse();

}
}
/// A `switch`-like method, using callbacks.
///
/// As opposed to `map`, this offers destructuring.
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case Subclass2(:final field2):
///     return ...;
/// }
/// ```

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String orderId,  String orderNumber,  String previousStatus,  String newStatus,  String businessId,  String timestamp,  String? storeId,  String? customerId,  String? note)  $default,) {final _that = this;
switch (_that) {
case _WsOrderStatusChanged():
return $default(_that.orderId,_that.orderNumber,_that.previousStatus,_that.newStatus,_that.businessId,_that.timestamp,_that.storeId,_that.customerId,_that.note);case _:
  throw StateError('Unexpected subclass');

}
}
/// A variant of `when` that fallback to returning `null`
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case _:
///     return null;
/// }
/// ```

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String orderId,  String orderNumber,  String previousStatus,  String newStatus,  String businessId,  String timestamp,  String? storeId,  String? customerId,  String? note)?  $default,) {final _that = this;
switch (_that) {
case _WsOrderStatusChanged() when $default != null:
return $default(_that.orderId,_that.orderNumber,_that.previousStatus,_that.newStatus,_that.businessId,_that.timestamp,_that.storeId,_that.customerId,_that.note);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _WsOrderStatusChanged implements WsOrderStatusChanged {
  const _WsOrderStatusChanged({required this.orderId, required this.orderNumber, required this.previousStatus, required this.newStatus, required this.businessId, required this.timestamp, this.storeId, this.customerId, this.note});
  factory _WsOrderStatusChanged.fromJson(Map<String, dynamic> json) => _$WsOrderStatusChangedFromJson(json);

@override final  String orderId;
@override final  String orderNumber;
@override final  String previousStatus;
@override final  String newStatus;
@override final  String businessId;
@override final  String timestamp;
@override final  String? storeId;
@override final  String? customerId;
@override final  String? note;

/// Create a copy of WsOrderStatusChanged
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$WsOrderStatusChangedCopyWith<_WsOrderStatusChanged> get copyWith => __$WsOrderStatusChangedCopyWithImpl<_WsOrderStatusChanged>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$WsOrderStatusChangedToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _WsOrderStatusChanged&&(identical(other.orderId, orderId) || other.orderId == orderId)&&(identical(other.orderNumber, orderNumber) || other.orderNumber == orderNumber)&&(identical(other.previousStatus, previousStatus) || other.previousStatus == previousStatus)&&(identical(other.newStatus, newStatus) || other.newStatus == newStatus)&&(identical(other.businessId, businessId) || other.businessId == businessId)&&(identical(other.timestamp, timestamp) || other.timestamp == timestamp)&&(identical(other.storeId, storeId) || other.storeId == storeId)&&(identical(other.customerId, customerId) || other.customerId == customerId)&&(identical(other.note, note) || other.note == note));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,orderId,orderNumber,previousStatus,newStatus,businessId,timestamp,storeId,customerId,note);

@override
String toString() {
  return 'WsOrderStatusChanged(orderId: $orderId, orderNumber: $orderNumber, previousStatus: $previousStatus, newStatus: $newStatus, businessId: $businessId, timestamp: $timestamp, storeId: $storeId, customerId: $customerId, note: $note)';
}


}

/// @nodoc
abstract mixin class _$WsOrderStatusChangedCopyWith<$Res> implements $WsOrderStatusChangedCopyWith<$Res> {
  factory _$WsOrderStatusChangedCopyWith(_WsOrderStatusChanged value, $Res Function(_WsOrderStatusChanged) _then) = __$WsOrderStatusChangedCopyWithImpl;
@override @useResult
$Res call({
 String orderId, String orderNumber, String previousStatus, String newStatus, String businessId, String timestamp, String? storeId, String? customerId, String? note
});




}
/// @nodoc
class __$WsOrderStatusChangedCopyWithImpl<$Res>
    implements _$WsOrderStatusChangedCopyWith<$Res> {
  __$WsOrderStatusChangedCopyWithImpl(this._self, this._then);

  final _WsOrderStatusChanged _self;
  final $Res Function(_WsOrderStatusChanged) _then;

/// Create a copy of WsOrderStatusChanged
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? orderId = null,Object? orderNumber = null,Object? previousStatus = null,Object? newStatus = null,Object? businessId = null,Object? timestamp = null,Object? storeId = freezed,Object? customerId = freezed,Object? note = freezed,}) {
  return _then(_WsOrderStatusChanged(
orderId: null == orderId ? _self.orderId : orderId // ignore: cast_nullable_to_non_nullable
as String,orderNumber: null == orderNumber ? _self.orderNumber : orderNumber // ignore: cast_nullable_to_non_nullable
as String,previousStatus: null == previousStatus ? _self.previousStatus : previousStatus // ignore: cast_nullable_to_non_nullable
as String,newStatus: null == newStatus ? _self.newStatus : newStatus // ignore: cast_nullable_to_non_nullable
as String,businessId: null == businessId ? _self.businessId : businessId // ignore: cast_nullable_to_non_nullable
as String,timestamp: null == timestamp ? _self.timestamp : timestamp // ignore: cast_nullable_to_non_nullable
as String,storeId: freezed == storeId ? _self.storeId : storeId // ignore: cast_nullable_to_non_nullable
as String?,customerId: freezed == customerId ? _self.customerId : customerId // ignore: cast_nullable_to_non_nullable
as String?,note: freezed == note ? _self.note : note // ignore: cast_nullable_to_non_nullable
as String?,
  ));
}


}


/// @nodoc
mixin _$WsDeliveryLocationUpdated {

 String get orderId; String get partnerId; String get partnerName; double get lat; double get lng; String get businessId; String get timestamp; double? get accuracy; double? get heading; double? get speed; int? get etaMinutes; double? get distanceKm;
/// Create a copy of WsDeliveryLocationUpdated
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$WsDeliveryLocationUpdatedCopyWith<WsDeliveryLocationUpdated> get copyWith => _$WsDeliveryLocationUpdatedCopyWithImpl<WsDeliveryLocationUpdated>(this as WsDeliveryLocationUpdated, _$identity);

  /// Serializes this WsDeliveryLocationUpdated to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is WsDeliveryLocationUpdated&&(identical(other.orderId, orderId) || other.orderId == orderId)&&(identical(other.partnerId, partnerId) || other.partnerId == partnerId)&&(identical(other.partnerName, partnerName) || other.partnerName == partnerName)&&(identical(other.lat, lat) || other.lat == lat)&&(identical(other.lng, lng) || other.lng == lng)&&(identical(other.businessId, businessId) || other.businessId == businessId)&&(identical(other.timestamp, timestamp) || other.timestamp == timestamp)&&(identical(other.accuracy, accuracy) || other.accuracy == accuracy)&&(identical(other.heading, heading) || other.heading == heading)&&(identical(other.speed, speed) || other.speed == speed)&&(identical(other.etaMinutes, etaMinutes) || other.etaMinutes == etaMinutes)&&(identical(other.distanceKm, distanceKm) || other.distanceKm == distanceKm));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,orderId,partnerId,partnerName,lat,lng,businessId,timestamp,accuracy,heading,speed,etaMinutes,distanceKm);

@override
String toString() {
  return 'WsDeliveryLocationUpdated(orderId: $orderId, partnerId: $partnerId, partnerName: $partnerName, lat: $lat, lng: $lng, businessId: $businessId, timestamp: $timestamp, accuracy: $accuracy, heading: $heading, speed: $speed, etaMinutes: $etaMinutes, distanceKm: $distanceKm)';
}


}

/// @nodoc
abstract mixin class $WsDeliveryLocationUpdatedCopyWith<$Res>  {
  factory $WsDeliveryLocationUpdatedCopyWith(WsDeliveryLocationUpdated value, $Res Function(WsDeliveryLocationUpdated) _then) = _$WsDeliveryLocationUpdatedCopyWithImpl;
@useResult
$Res call({
 String orderId, String partnerId, String partnerName, double lat, double lng, String businessId, String timestamp, double? accuracy, double? heading, double? speed, int? etaMinutes, double? distanceKm
});




}
/// @nodoc
class _$WsDeliveryLocationUpdatedCopyWithImpl<$Res>
    implements $WsDeliveryLocationUpdatedCopyWith<$Res> {
  _$WsDeliveryLocationUpdatedCopyWithImpl(this._self, this._then);

  final WsDeliveryLocationUpdated _self;
  final $Res Function(WsDeliveryLocationUpdated) _then;

/// Create a copy of WsDeliveryLocationUpdated
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? orderId = null,Object? partnerId = null,Object? partnerName = null,Object? lat = null,Object? lng = null,Object? businessId = null,Object? timestamp = null,Object? accuracy = freezed,Object? heading = freezed,Object? speed = freezed,Object? etaMinutes = freezed,Object? distanceKm = freezed,}) {
  return _then(_self.copyWith(
orderId: null == orderId ? _self.orderId : orderId // ignore: cast_nullable_to_non_nullable
as String,partnerId: null == partnerId ? _self.partnerId : partnerId // ignore: cast_nullable_to_non_nullable
as String,partnerName: null == partnerName ? _self.partnerName : partnerName // ignore: cast_nullable_to_non_nullable
as String,lat: null == lat ? _self.lat : lat // ignore: cast_nullable_to_non_nullable
as double,lng: null == lng ? _self.lng : lng // ignore: cast_nullable_to_non_nullable
as double,businessId: null == businessId ? _self.businessId : businessId // ignore: cast_nullable_to_non_nullable
as String,timestamp: null == timestamp ? _self.timestamp : timestamp // ignore: cast_nullable_to_non_nullable
as String,accuracy: freezed == accuracy ? _self.accuracy : accuracy // ignore: cast_nullable_to_non_nullable
as double?,heading: freezed == heading ? _self.heading : heading // ignore: cast_nullable_to_non_nullable
as double?,speed: freezed == speed ? _self.speed : speed // ignore: cast_nullable_to_non_nullable
as double?,etaMinutes: freezed == etaMinutes ? _self.etaMinutes : etaMinutes // ignore: cast_nullable_to_non_nullable
as int?,distanceKm: freezed == distanceKm ? _self.distanceKm : distanceKm // ignore: cast_nullable_to_non_nullable
as double?,
  ));
}

}


/// Adds pattern-matching-related methods to [WsDeliveryLocationUpdated].
extension WsDeliveryLocationUpdatedPatterns on WsDeliveryLocationUpdated {
/// A variant of `map` that fallback to returning `orElse`.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case _:
///     return orElse();
/// }
/// ```

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _WsDeliveryLocationUpdated value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _WsDeliveryLocationUpdated() when $default != null:
return $default(_that);case _:
  return orElse();

}
}
/// A `switch`-like method, using callbacks.
///
/// Callbacks receives the raw object, upcasted.
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case final Subclass2 value:
///     return ...;
/// }
/// ```

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _WsDeliveryLocationUpdated value)  $default,){
final _that = this;
switch (_that) {
case _WsDeliveryLocationUpdated():
return $default(_that);case _:
  throw StateError('Unexpected subclass');

}
}
/// A variant of `map` that fallback to returning `null`.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case _:
///     return null;
/// }
/// ```

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _WsDeliveryLocationUpdated value)?  $default,){
final _that = this;
switch (_that) {
case _WsDeliveryLocationUpdated() when $default != null:
return $default(_that);case _:
  return null;

}
}
/// A variant of `when` that fallback to an `orElse` callback.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case _:
///     return orElse();
/// }
/// ```

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String orderId,  String partnerId,  String partnerName,  double lat,  double lng,  String businessId,  String timestamp,  double? accuracy,  double? heading,  double? speed,  int? etaMinutes,  double? distanceKm)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _WsDeliveryLocationUpdated() when $default != null:
return $default(_that.orderId,_that.partnerId,_that.partnerName,_that.lat,_that.lng,_that.businessId,_that.timestamp,_that.accuracy,_that.heading,_that.speed,_that.etaMinutes,_that.distanceKm);case _:
  return orElse();

}
}
/// A `switch`-like method, using callbacks.
///
/// As opposed to `map`, this offers destructuring.
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case Subclass2(:final field2):
///     return ...;
/// }
/// ```

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String orderId,  String partnerId,  String partnerName,  double lat,  double lng,  String businessId,  String timestamp,  double? accuracy,  double? heading,  double? speed,  int? etaMinutes,  double? distanceKm)  $default,) {final _that = this;
switch (_that) {
case _WsDeliveryLocationUpdated():
return $default(_that.orderId,_that.partnerId,_that.partnerName,_that.lat,_that.lng,_that.businessId,_that.timestamp,_that.accuracy,_that.heading,_that.speed,_that.etaMinutes,_that.distanceKm);case _:
  throw StateError('Unexpected subclass');

}
}
/// A variant of `when` that fallback to returning `null`
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case _:
///     return null;
/// }
/// ```

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String orderId,  String partnerId,  String partnerName,  double lat,  double lng,  String businessId,  String timestamp,  double? accuracy,  double? heading,  double? speed,  int? etaMinutes,  double? distanceKm)?  $default,) {final _that = this;
switch (_that) {
case _WsDeliveryLocationUpdated() when $default != null:
return $default(_that.orderId,_that.partnerId,_that.partnerName,_that.lat,_that.lng,_that.businessId,_that.timestamp,_that.accuracy,_that.heading,_that.speed,_that.etaMinutes,_that.distanceKm);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _WsDeliveryLocationUpdated implements WsDeliveryLocationUpdated {
  const _WsDeliveryLocationUpdated({required this.orderId, required this.partnerId, required this.partnerName, required this.lat, required this.lng, required this.businessId, required this.timestamp, this.accuracy, this.heading, this.speed, this.etaMinutes, this.distanceKm});
  factory _WsDeliveryLocationUpdated.fromJson(Map<String, dynamic> json) => _$WsDeliveryLocationUpdatedFromJson(json);

@override final  String orderId;
@override final  String partnerId;
@override final  String partnerName;
@override final  double lat;
@override final  double lng;
@override final  String businessId;
@override final  String timestamp;
@override final  double? accuracy;
@override final  double? heading;
@override final  double? speed;
@override final  int? etaMinutes;
@override final  double? distanceKm;

/// Create a copy of WsDeliveryLocationUpdated
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$WsDeliveryLocationUpdatedCopyWith<_WsDeliveryLocationUpdated> get copyWith => __$WsDeliveryLocationUpdatedCopyWithImpl<_WsDeliveryLocationUpdated>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$WsDeliveryLocationUpdatedToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _WsDeliveryLocationUpdated&&(identical(other.orderId, orderId) || other.orderId == orderId)&&(identical(other.partnerId, partnerId) || other.partnerId == partnerId)&&(identical(other.partnerName, partnerName) || other.partnerName == partnerName)&&(identical(other.lat, lat) || other.lat == lat)&&(identical(other.lng, lng) || other.lng == lng)&&(identical(other.businessId, businessId) || other.businessId == businessId)&&(identical(other.timestamp, timestamp) || other.timestamp == timestamp)&&(identical(other.accuracy, accuracy) || other.accuracy == accuracy)&&(identical(other.heading, heading) || other.heading == heading)&&(identical(other.speed, speed) || other.speed == speed)&&(identical(other.etaMinutes, etaMinutes) || other.etaMinutes == etaMinutes)&&(identical(other.distanceKm, distanceKm) || other.distanceKm == distanceKm));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,orderId,partnerId,partnerName,lat,lng,businessId,timestamp,accuracy,heading,speed,etaMinutes,distanceKm);

@override
String toString() {
  return 'WsDeliveryLocationUpdated(orderId: $orderId, partnerId: $partnerId, partnerName: $partnerName, lat: $lat, lng: $lng, businessId: $businessId, timestamp: $timestamp, accuracy: $accuracy, heading: $heading, speed: $speed, etaMinutes: $etaMinutes, distanceKm: $distanceKm)';
}


}

/// @nodoc
abstract mixin class _$WsDeliveryLocationUpdatedCopyWith<$Res> implements $WsDeliveryLocationUpdatedCopyWith<$Res> {
  factory _$WsDeliveryLocationUpdatedCopyWith(_WsDeliveryLocationUpdated value, $Res Function(_WsDeliveryLocationUpdated) _then) = __$WsDeliveryLocationUpdatedCopyWithImpl;
@override @useResult
$Res call({
 String orderId, String partnerId, String partnerName, double lat, double lng, String businessId, String timestamp, double? accuracy, double? heading, double? speed, int? etaMinutes, double? distanceKm
});




}
/// @nodoc
class __$WsDeliveryLocationUpdatedCopyWithImpl<$Res>
    implements _$WsDeliveryLocationUpdatedCopyWith<$Res> {
  __$WsDeliveryLocationUpdatedCopyWithImpl(this._self, this._then);

  final _WsDeliveryLocationUpdated _self;
  final $Res Function(_WsDeliveryLocationUpdated) _then;

/// Create a copy of WsDeliveryLocationUpdated
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? orderId = null,Object? partnerId = null,Object? partnerName = null,Object? lat = null,Object? lng = null,Object? businessId = null,Object? timestamp = null,Object? accuracy = freezed,Object? heading = freezed,Object? speed = freezed,Object? etaMinutes = freezed,Object? distanceKm = freezed,}) {
  return _then(_WsDeliveryLocationUpdated(
orderId: null == orderId ? _self.orderId : orderId // ignore: cast_nullable_to_non_nullable
as String,partnerId: null == partnerId ? _self.partnerId : partnerId // ignore: cast_nullable_to_non_nullable
as String,partnerName: null == partnerName ? _self.partnerName : partnerName // ignore: cast_nullable_to_non_nullable
as String,lat: null == lat ? _self.lat : lat // ignore: cast_nullable_to_non_nullable
as double,lng: null == lng ? _self.lng : lng // ignore: cast_nullable_to_non_nullable
as double,businessId: null == businessId ? _self.businessId : businessId // ignore: cast_nullable_to_non_nullable
as String,timestamp: null == timestamp ? _self.timestamp : timestamp // ignore: cast_nullable_to_non_nullable
as String,accuracy: freezed == accuracy ? _self.accuracy : accuracy // ignore: cast_nullable_to_non_nullable
as double?,heading: freezed == heading ? _self.heading : heading // ignore: cast_nullable_to_non_nullable
as double?,speed: freezed == speed ? _self.speed : speed // ignore: cast_nullable_to_non_nullable
as double?,etaMinutes: freezed == etaMinutes ? _self.etaMinutes : etaMinutes // ignore: cast_nullable_to_non_nullable
as int?,distanceKm: freezed == distanceKm ? _self.distanceKm : distanceKm // ignore: cast_nullable_to_non_nullable
as double?,
  ));
}


}


/// @nodoc
mixin _$WsPartnerAssigned {

 String get orderId; String get orderNumber; String get partnerId; String get partnerName; String get partnerPhone; String get businessId; String get timestamp;
/// Create a copy of WsPartnerAssigned
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$WsPartnerAssignedCopyWith<WsPartnerAssigned> get copyWith => _$WsPartnerAssignedCopyWithImpl<WsPartnerAssigned>(this as WsPartnerAssigned, _$identity);

  /// Serializes this WsPartnerAssigned to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is WsPartnerAssigned&&(identical(other.orderId, orderId) || other.orderId == orderId)&&(identical(other.orderNumber, orderNumber) || other.orderNumber == orderNumber)&&(identical(other.partnerId, partnerId) || other.partnerId == partnerId)&&(identical(other.partnerName, partnerName) || other.partnerName == partnerName)&&(identical(other.partnerPhone, partnerPhone) || other.partnerPhone == partnerPhone)&&(identical(other.businessId, businessId) || other.businessId == businessId)&&(identical(other.timestamp, timestamp) || other.timestamp == timestamp));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,orderId,orderNumber,partnerId,partnerName,partnerPhone,businessId,timestamp);

@override
String toString() {
  return 'WsPartnerAssigned(orderId: $orderId, orderNumber: $orderNumber, partnerId: $partnerId, partnerName: $partnerName, partnerPhone: $partnerPhone, businessId: $businessId, timestamp: $timestamp)';
}


}

/// @nodoc
abstract mixin class $WsPartnerAssignedCopyWith<$Res>  {
  factory $WsPartnerAssignedCopyWith(WsPartnerAssigned value, $Res Function(WsPartnerAssigned) _then) = _$WsPartnerAssignedCopyWithImpl;
@useResult
$Res call({
 String orderId, String orderNumber, String partnerId, String partnerName, String partnerPhone, String businessId, String timestamp
});




}
/// @nodoc
class _$WsPartnerAssignedCopyWithImpl<$Res>
    implements $WsPartnerAssignedCopyWith<$Res> {
  _$WsPartnerAssignedCopyWithImpl(this._self, this._then);

  final WsPartnerAssigned _self;
  final $Res Function(WsPartnerAssigned) _then;

/// Create a copy of WsPartnerAssigned
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? orderId = null,Object? orderNumber = null,Object? partnerId = null,Object? partnerName = null,Object? partnerPhone = null,Object? businessId = null,Object? timestamp = null,}) {
  return _then(_self.copyWith(
orderId: null == orderId ? _self.orderId : orderId // ignore: cast_nullable_to_non_nullable
as String,orderNumber: null == orderNumber ? _self.orderNumber : orderNumber // ignore: cast_nullable_to_non_nullable
as String,partnerId: null == partnerId ? _self.partnerId : partnerId // ignore: cast_nullable_to_non_nullable
as String,partnerName: null == partnerName ? _self.partnerName : partnerName // ignore: cast_nullable_to_non_nullable
as String,partnerPhone: null == partnerPhone ? _self.partnerPhone : partnerPhone // ignore: cast_nullable_to_non_nullable
as String,businessId: null == businessId ? _self.businessId : businessId // ignore: cast_nullable_to_non_nullable
as String,timestamp: null == timestamp ? _self.timestamp : timestamp // ignore: cast_nullable_to_non_nullable
as String,
  ));
}

}


/// Adds pattern-matching-related methods to [WsPartnerAssigned].
extension WsPartnerAssignedPatterns on WsPartnerAssigned {
/// A variant of `map` that fallback to returning `orElse`.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case _:
///     return orElse();
/// }
/// ```

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _WsPartnerAssigned value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _WsPartnerAssigned() when $default != null:
return $default(_that);case _:
  return orElse();

}
}
/// A `switch`-like method, using callbacks.
///
/// Callbacks receives the raw object, upcasted.
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case final Subclass2 value:
///     return ...;
/// }
/// ```

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _WsPartnerAssigned value)  $default,){
final _that = this;
switch (_that) {
case _WsPartnerAssigned():
return $default(_that);case _:
  throw StateError('Unexpected subclass');

}
}
/// A variant of `map` that fallback to returning `null`.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case _:
///     return null;
/// }
/// ```

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _WsPartnerAssigned value)?  $default,){
final _that = this;
switch (_that) {
case _WsPartnerAssigned() when $default != null:
return $default(_that);case _:
  return null;

}
}
/// A variant of `when` that fallback to an `orElse` callback.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case _:
///     return orElse();
/// }
/// ```

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String orderId,  String orderNumber,  String partnerId,  String partnerName,  String partnerPhone,  String businessId,  String timestamp)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _WsPartnerAssigned() when $default != null:
return $default(_that.orderId,_that.orderNumber,_that.partnerId,_that.partnerName,_that.partnerPhone,_that.businessId,_that.timestamp);case _:
  return orElse();

}
}
/// A `switch`-like method, using callbacks.
///
/// As opposed to `map`, this offers destructuring.
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case Subclass2(:final field2):
///     return ...;
/// }
/// ```

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String orderId,  String orderNumber,  String partnerId,  String partnerName,  String partnerPhone,  String businessId,  String timestamp)  $default,) {final _that = this;
switch (_that) {
case _WsPartnerAssigned():
return $default(_that.orderId,_that.orderNumber,_that.partnerId,_that.partnerName,_that.partnerPhone,_that.businessId,_that.timestamp);case _:
  throw StateError('Unexpected subclass');

}
}
/// A variant of `when` that fallback to returning `null`
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case _:
///     return null;
/// }
/// ```

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String orderId,  String orderNumber,  String partnerId,  String partnerName,  String partnerPhone,  String businessId,  String timestamp)?  $default,) {final _that = this;
switch (_that) {
case _WsPartnerAssigned() when $default != null:
return $default(_that.orderId,_that.orderNumber,_that.partnerId,_that.partnerName,_that.partnerPhone,_that.businessId,_that.timestamp);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _WsPartnerAssigned implements WsPartnerAssigned {
  const _WsPartnerAssigned({required this.orderId, required this.orderNumber, required this.partnerId, required this.partnerName, required this.partnerPhone, required this.businessId, required this.timestamp});
  factory _WsPartnerAssigned.fromJson(Map<String, dynamic> json) => _$WsPartnerAssignedFromJson(json);

@override final  String orderId;
@override final  String orderNumber;
@override final  String partnerId;
@override final  String partnerName;
@override final  String partnerPhone;
@override final  String businessId;
@override final  String timestamp;

/// Create a copy of WsPartnerAssigned
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$WsPartnerAssignedCopyWith<_WsPartnerAssigned> get copyWith => __$WsPartnerAssignedCopyWithImpl<_WsPartnerAssigned>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$WsPartnerAssignedToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _WsPartnerAssigned&&(identical(other.orderId, orderId) || other.orderId == orderId)&&(identical(other.orderNumber, orderNumber) || other.orderNumber == orderNumber)&&(identical(other.partnerId, partnerId) || other.partnerId == partnerId)&&(identical(other.partnerName, partnerName) || other.partnerName == partnerName)&&(identical(other.partnerPhone, partnerPhone) || other.partnerPhone == partnerPhone)&&(identical(other.businessId, businessId) || other.businessId == businessId)&&(identical(other.timestamp, timestamp) || other.timestamp == timestamp));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,orderId,orderNumber,partnerId,partnerName,partnerPhone,businessId,timestamp);

@override
String toString() {
  return 'WsPartnerAssigned(orderId: $orderId, orderNumber: $orderNumber, partnerId: $partnerId, partnerName: $partnerName, partnerPhone: $partnerPhone, businessId: $businessId, timestamp: $timestamp)';
}


}

/// @nodoc
abstract mixin class _$WsPartnerAssignedCopyWith<$Res> implements $WsPartnerAssignedCopyWith<$Res> {
  factory _$WsPartnerAssignedCopyWith(_WsPartnerAssigned value, $Res Function(_WsPartnerAssigned) _then) = __$WsPartnerAssignedCopyWithImpl;
@override @useResult
$Res call({
 String orderId, String orderNumber, String partnerId, String partnerName, String partnerPhone, String businessId, String timestamp
});




}
/// @nodoc
class __$WsPartnerAssignedCopyWithImpl<$Res>
    implements _$WsPartnerAssignedCopyWith<$Res> {
  __$WsPartnerAssignedCopyWithImpl(this._self, this._then);

  final _WsPartnerAssigned _self;
  final $Res Function(_WsPartnerAssigned) _then;

/// Create a copy of WsPartnerAssigned
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? orderId = null,Object? orderNumber = null,Object? partnerId = null,Object? partnerName = null,Object? partnerPhone = null,Object? businessId = null,Object? timestamp = null,}) {
  return _then(_WsPartnerAssigned(
orderId: null == orderId ? _self.orderId : orderId // ignore: cast_nullable_to_non_nullable
as String,orderNumber: null == orderNumber ? _self.orderNumber : orderNumber // ignore: cast_nullable_to_non_nullable
as String,partnerId: null == partnerId ? _self.partnerId : partnerId // ignore: cast_nullable_to_non_nullable
as String,partnerName: null == partnerName ? _self.partnerName : partnerName // ignore: cast_nullable_to_non_nullable
as String,partnerPhone: null == partnerPhone ? _self.partnerPhone : partnerPhone // ignore: cast_nullable_to_non_nullable
as String,businessId: null == businessId ? _self.businessId : businessId // ignore: cast_nullable_to_non_nullable
as String,timestamp: null == timestamp ? _self.timestamp : timestamp // ignore: cast_nullable_to_non_nullable
as String,
  ));
}


}


/// @nodoc
mixin _$WsTrackingEtaUpdated {

 String get orderId; int get etaMinutes; double get distanceKm; String get estimatedArrival; String get timestamp;
/// Create a copy of WsTrackingEtaUpdated
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$WsTrackingEtaUpdatedCopyWith<WsTrackingEtaUpdated> get copyWith => _$WsTrackingEtaUpdatedCopyWithImpl<WsTrackingEtaUpdated>(this as WsTrackingEtaUpdated, _$identity);

  /// Serializes this WsTrackingEtaUpdated to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is WsTrackingEtaUpdated&&(identical(other.orderId, orderId) || other.orderId == orderId)&&(identical(other.etaMinutes, etaMinutes) || other.etaMinutes == etaMinutes)&&(identical(other.distanceKm, distanceKm) || other.distanceKm == distanceKm)&&(identical(other.estimatedArrival, estimatedArrival) || other.estimatedArrival == estimatedArrival)&&(identical(other.timestamp, timestamp) || other.timestamp == timestamp));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,orderId,etaMinutes,distanceKm,estimatedArrival,timestamp);

@override
String toString() {
  return 'WsTrackingEtaUpdated(orderId: $orderId, etaMinutes: $etaMinutes, distanceKm: $distanceKm, estimatedArrival: $estimatedArrival, timestamp: $timestamp)';
}


}

/// @nodoc
abstract mixin class $WsTrackingEtaUpdatedCopyWith<$Res>  {
  factory $WsTrackingEtaUpdatedCopyWith(WsTrackingEtaUpdated value, $Res Function(WsTrackingEtaUpdated) _then) = _$WsTrackingEtaUpdatedCopyWithImpl;
@useResult
$Res call({
 String orderId, int etaMinutes, double distanceKm, String estimatedArrival, String timestamp
});




}
/// @nodoc
class _$WsTrackingEtaUpdatedCopyWithImpl<$Res>
    implements $WsTrackingEtaUpdatedCopyWith<$Res> {
  _$WsTrackingEtaUpdatedCopyWithImpl(this._self, this._then);

  final WsTrackingEtaUpdated _self;
  final $Res Function(WsTrackingEtaUpdated) _then;

/// Create a copy of WsTrackingEtaUpdated
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? orderId = null,Object? etaMinutes = null,Object? distanceKm = null,Object? estimatedArrival = null,Object? timestamp = null,}) {
  return _then(_self.copyWith(
orderId: null == orderId ? _self.orderId : orderId // ignore: cast_nullable_to_non_nullable
as String,etaMinutes: null == etaMinutes ? _self.etaMinutes : etaMinutes // ignore: cast_nullable_to_non_nullable
as int,distanceKm: null == distanceKm ? _self.distanceKm : distanceKm // ignore: cast_nullable_to_non_nullable
as double,estimatedArrival: null == estimatedArrival ? _self.estimatedArrival : estimatedArrival // ignore: cast_nullable_to_non_nullable
as String,timestamp: null == timestamp ? _self.timestamp : timestamp // ignore: cast_nullable_to_non_nullable
as String,
  ));
}

}


/// Adds pattern-matching-related methods to [WsTrackingEtaUpdated].
extension WsTrackingEtaUpdatedPatterns on WsTrackingEtaUpdated {
/// A variant of `map` that fallback to returning `orElse`.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case _:
///     return orElse();
/// }
/// ```

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _WsTrackingEtaUpdated value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _WsTrackingEtaUpdated() when $default != null:
return $default(_that);case _:
  return orElse();

}
}
/// A `switch`-like method, using callbacks.
///
/// Callbacks receives the raw object, upcasted.
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case final Subclass2 value:
///     return ...;
/// }
/// ```

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _WsTrackingEtaUpdated value)  $default,){
final _that = this;
switch (_that) {
case _WsTrackingEtaUpdated():
return $default(_that);case _:
  throw StateError('Unexpected subclass');

}
}
/// A variant of `map` that fallback to returning `null`.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case _:
///     return null;
/// }
/// ```

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _WsTrackingEtaUpdated value)?  $default,){
final _that = this;
switch (_that) {
case _WsTrackingEtaUpdated() when $default != null:
return $default(_that);case _:
  return null;

}
}
/// A variant of `when` that fallback to an `orElse` callback.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case _:
///     return orElse();
/// }
/// ```

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String orderId,  int etaMinutes,  double distanceKm,  String estimatedArrival,  String timestamp)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _WsTrackingEtaUpdated() when $default != null:
return $default(_that.orderId,_that.etaMinutes,_that.distanceKm,_that.estimatedArrival,_that.timestamp);case _:
  return orElse();

}
}
/// A `switch`-like method, using callbacks.
///
/// As opposed to `map`, this offers destructuring.
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case Subclass2(:final field2):
///     return ...;
/// }
/// ```

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String orderId,  int etaMinutes,  double distanceKm,  String estimatedArrival,  String timestamp)  $default,) {final _that = this;
switch (_that) {
case _WsTrackingEtaUpdated():
return $default(_that.orderId,_that.etaMinutes,_that.distanceKm,_that.estimatedArrival,_that.timestamp);case _:
  throw StateError('Unexpected subclass');

}
}
/// A variant of `when` that fallback to returning `null`
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case _:
///     return null;
/// }
/// ```

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String orderId,  int etaMinutes,  double distanceKm,  String estimatedArrival,  String timestamp)?  $default,) {final _that = this;
switch (_that) {
case _WsTrackingEtaUpdated() when $default != null:
return $default(_that.orderId,_that.etaMinutes,_that.distanceKm,_that.estimatedArrival,_that.timestamp);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _WsTrackingEtaUpdated implements WsTrackingEtaUpdated {
  const _WsTrackingEtaUpdated({required this.orderId, required this.etaMinutes, required this.distanceKm, required this.estimatedArrival, required this.timestamp});
  factory _WsTrackingEtaUpdated.fromJson(Map<String, dynamic> json) => _$WsTrackingEtaUpdatedFromJson(json);

@override final  String orderId;
@override final  int etaMinutes;
@override final  double distanceKm;
@override final  String estimatedArrival;
@override final  String timestamp;

/// Create a copy of WsTrackingEtaUpdated
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$WsTrackingEtaUpdatedCopyWith<_WsTrackingEtaUpdated> get copyWith => __$WsTrackingEtaUpdatedCopyWithImpl<_WsTrackingEtaUpdated>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$WsTrackingEtaUpdatedToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _WsTrackingEtaUpdated&&(identical(other.orderId, orderId) || other.orderId == orderId)&&(identical(other.etaMinutes, etaMinutes) || other.etaMinutes == etaMinutes)&&(identical(other.distanceKm, distanceKm) || other.distanceKm == distanceKm)&&(identical(other.estimatedArrival, estimatedArrival) || other.estimatedArrival == estimatedArrival)&&(identical(other.timestamp, timestamp) || other.timestamp == timestamp));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,orderId,etaMinutes,distanceKm,estimatedArrival,timestamp);

@override
String toString() {
  return 'WsTrackingEtaUpdated(orderId: $orderId, etaMinutes: $etaMinutes, distanceKm: $distanceKm, estimatedArrival: $estimatedArrival, timestamp: $timestamp)';
}


}

/// @nodoc
abstract mixin class _$WsTrackingEtaUpdatedCopyWith<$Res> implements $WsTrackingEtaUpdatedCopyWith<$Res> {
  factory _$WsTrackingEtaUpdatedCopyWith(_WsTrackingEtaUpdated value, $Res Function(_WsTrackingEtaUpdated) _then) = __$WsTrackingEtaUpdatedCopyWithImpl;
@override @useResult
$Res call({
 String orderId, int etaMinutes, double distanceKm, String estimatedArrival, String timestamp
});




}
/// @nodoc
class __$WsTrackingEtaUpdatedCopyWithImpl<$Res>
    implements _$WsTrackingEtaUpdatedCopyWith<$Res> {
  __$WsTrackingEtaUpdatedCopyWithImpl(this._self, this._then);

  final _WsTrackingEtaUpdated _self;
  final $Res Function(_WsTrackingEtaUpdated) _then;

/// Create a copy of WsTrackingEtaUpdated
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? orderId = null,Object? etaMinutes = null,Object? distanceKm = null,Object? estimatedArrival = null,Object? timestamp = null,}) {
  return _then(_WsTrackingEtaUpdated(
orderId: null == orderId ? _self.orderId : orderId // ignore: cast_nullable_to_non_nullable
as String,etaMinutes: null == etaMinutes ? _self.etaMinutes : etaMinutes // ignore: cast_nullable_to_non_nullable
as int,distanceKm: null == distanceKm ? _self.distanceKm : distanceKm // ignore: cast_nullable_to_non_nullable
as double,estimatedArrival: null == estimatedArrival ? _self.estimatedArrival : estimatedArrival // ignore: cast_nullable_to_non_nullable
as String,timestamp: null == timestamp ? _self.timestamp : timestamp // ignore: cast_nullable_to_non_nullable
as String,
  ));
}


}


/// @nodoc
mixin _$WsNotificationNew {

 String get notificationId; String get type; String get title; String get message; String get userId; String get timestamp; Map<String, dynamic>? get data;
/// Create a copy of WsNotificationNew
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$WsNotificationNewCopyWith<WsNotificationNew> get copyWith => _$WsNotificationNewCopyWithImpl<WsNotificationNew>(this as WsNotificationNew, _$identity);

  /// Serializes this WsNotificationNew to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is WsNotificationNew&&(identical(other.notificationId, notificationId) || other.notificationId == notificationId)&&(identical(other.type, type) || other.type == type)&&(identical(other.title, title) || other.title == title)&&(identical(other.message, message) || other.message == message)&&(identical(other.userId, userId) || other.userId == userId)&&(identical(other.timestamp, timestamp) || other.timestamp == timestamp)&&const DeepCollectionEquality().equals(other.data, data));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,notificationId,type,title,message,userId,timestamp,const DeepCollectionEquality().hash(data));

@override
String toString() {
  return 'WsNotificationNew(notificationId: $notificationId, type: $type, title: $title, message: $message, userId: $userId, timestamp: $timestamp, data: $data)';
}


}

/// @nodoc
abstract mixin class $WsNotificationNewCopyWith<$Res>  {
  factory $WsNotificationNewCopyWith(WsNotificationNew value, $Res Function(WsNotificationNew) _then) = _$WsNotificationNewCopyWithImpl;
@useResult
$Res call({
 String notificationId, String type, String title, String message, String userId, String timestamp, Map<String, dynamic>? data
});




}
/// @nodoc
class _$WsNotificationNewCopyWithImpl<$Res>
    implements $WsNotificationNewCopyWith<$Res> {
  _$WsNotificationNewCopyWithImpl(this._self, this._then);

  final WsNotificationNew _self;
  final $Res Function(WsNotificationNew) _then;

/// Create a copy of WsNotificationNew
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? notificationId = null,Object? type = null,Object? title = null,Object? message = null,Object? userId = null,Object? timestamp = null,Object? data = freezed,}) {
  return _then(_self.copyWith(
notificationId: null == notificationId ? _self.notificationId : notificationId // ignore: cast_nullable_to_non_nullable
as String,type: null == type ? _self.type : type // ignore: cast_nullable_to_non_nullable
as String,title: null == title ? _self.title : title // ignore: cast_nullable_to_non_nullable
as String,message: null == message ? _self.message : message // ignore: cast_nullable_to_non_nullable
as String,userId: null == userId ? _self.userId : userId // ignore: cast_nullable_to_non_nullable
as String,timestamp: null == timestamp ? _self.timestamp : timestamp // ignore: cast_nullable_to_non_nullable
as String,data: freezed == data ? _self.data : data // ignore: cast_nullable_to_non_nullable
as Map<String, dynamic>?,
  ));
}

}


/// Adds pattern-matching-related methods to [WsNotificationNew].
extension WsNotificationNewPatterns on WsNotificationNew {
/// A variant of `map` that fallback to returning `orElse`.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case _:
///     return orElse();
/// }
/// ```

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _WsNotificationNew value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _WsNotificationNew() when $default != null:
return $default(_that);case _:
  return orElse();

}
}
/// A `switch`-like method, using callbacks.
///
/// Callbacks receives the raw object, upcasted.
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case final Subclass2 value:
///     return ...;
/// }
/// ```

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _WsNotificationNew value)  $default,){
final _that = this;
switch (_that) {
case _WsNotificationNew():
return $default(_that);case _:
  throw StateError('Unexpected subclass');

}
}
/// A variant of `map` that fallback to returning `null`.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case _:
///     return null;
/// }
/// ```

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _WsNotificationNew value)?  $default,){
final _that = this;
switch (_that) {
case _WsNotificationNew() when $default != null:
return $default(_that);case _:
  return null;

}
}
/// A variant of `when` that fallback to an `orElse` callback.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case _:
///     return orElse();
/// }
/// ```

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String notificationId,  String type,  String title,  String message,  String userId,  String timestamp,  Map<String, dynamic>? data)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _WsNotificationNew() when $default != null:
return $default(_that.notificationId,_that.type,_that.title,_that.message,_that.userId,_that.timestamp,_that.data);case _:
  return orElse();

}
}
/// A `switch`-like method, using callbacks.
///
/// As opposed to `map`, this offers destructuring.
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case Subclass2(:final field2):
///     return ...;
/// }
/// ```

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String notificationId,  String type,  String title,  String message,  String userId,  String timestamp,  Map<String, dynamic>? data)  $default,) {final _that = this;
switch (_that) {
case _WsNotificationNew():
return $default(_that.notificationId,_that.type,_that.title,_that.message,_that.userId,_that.timestamp,_that.data);case _:
  throw StateError('Unexpected subclass');

}
}
/// A variant of `when` that fallback to returning `null`
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case _:
///     return null;
/// }
/// ```

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String notificationId,  String type,  String title,  String message,  String userId,  String timestamp,  Map<String, dynamic>? data)?  $default,) {final _that = this;
switch (_that) {
case _WsNotificationNew() when $default != null:
return $default(_that.notificationId,_that.type,_that.title,_that.message,_that.userId,_that.timestamp,_that.data);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _WsNotificationNew implements WsNotificationNew {
  const _WsNotificationNew({required this.notificationId, required this.type, required this.title, required this.message, required this.userId, required this.timestamp, final  Map<String, dynamic>? data}): _data = data;
  factory _WsNotificationNew.fromJson(Map<String, dynamic> json) => _$WsNotificationNewFromJson(json);

@override final  String notificationId;
@override final  String type;
@override final  String title;
@override final  String message;
@override final  String userId;
@override final  String timestamp;
 final  Map<String, dynamic>? _data;
@override Map<String, dynamic>? get data {
  final value = _data;
  if (value == null) return null;
  if (_data is EqualUnmodifiableMapView) return _data;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableMapView(value);
}


/// Create a copy of WsNotificationNew
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$WsNotificationNewCopyWith<_WsNotificationNew> get copyWith => __$WsNotificationNewCopyWithImpl<_WsNotificationNew>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$WsNotificationNewToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _WsNotificationNew&&(identical(other.notificationId, notificationId) || other.notificationId == notificationId)&&(identical(other.type, type) || other.type == type)&&(identical(other.title, title) || other.title == title)&&(identical(other.message, message) || other.message == message)&&(identical(other.userId, userId) || other.userId == userId)&&(identical(other.timestamp, timestamp) || other.timestamp == timestamp)&&const DeepCollectionEquality().equals(other._data, _data));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,notificationId,type,title,message,userId,timestamp,const DeepCollectionEquality().hash(_data));

@override
String toString() {
  return 'WsNotificationNew(notificationId: $notificationId, type: $type, title: $title, message: $message, userId: $userId, timestamp: $timestamp, data: $data)';
}


}

/// @nodoc
abstract mixin class _$WsNotificationNewCopyWith<$Res> implements $WsNotificationNewCopyWith<$Res> {
  factory _$WsNotificationNewCopyWith(_WsNotificationNew value, $Res Function(_WsNotificationNew) _then) = __$WsNotificationNewCopyWithImpl;
@override @useResult
$Res call({
 String notificationId, String type, String title, String message, String userId, String timestamp, Map<String, dynamic>? data
});




}
/// @nodoc
class __$WsNotificationNewCopyWithImpl<$Res>
    implements _$WsNotificationNewCopyWith<$Res> {
  __$WsNotificationNewCopyWithImpl(this._self, this._then);

  final _WsNotificationNew _self;
  final $Res Function(_WsNotificationNew) _then;

/// Create a copy of WsNotificationNew
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? notificationId = null,Object? type = null,Object? title = null,Object? message = null,Object? userId = null,Object? timestamp = null,Object? data = freezed,}) {
  return _then(_WsNotificationNew(
notificationId: null == notificationId ? _self.notificationId : notificationId // ignore: cast_nullable_to_non_nullable
as String,type: null == type ? _self.type : type // ignore: cast_nullable_to_non_nullable
as String,title: null == title ? _self.title : title // ignore: cast_nullable_to_non_nullable
as String,message: null == message ? _self.message : message // ignore: cast_nullable_to_non_nullable
as String,userId: null == userId ? _self.userId : userId // ignore: cast_nullable_to_non_nullable
as String,timestamp: null == timestamp ? _self.timestamp : timestamp // ignore: cast_nullable_to_non_nullable
as String,data: freezed == data ? _self._data : data // ignore: cast_nullable_to_non_nullable
as Map<String, dynamic>?,
  ));
}


}

// dart format on
