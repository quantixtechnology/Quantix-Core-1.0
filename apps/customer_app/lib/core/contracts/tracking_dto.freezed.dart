// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'tracking_dto.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// dart format off
T _$identity<T>(T value) => value;

/// @nodoc
mixin _$PartnerTrackingSummary {

 String get id; String get name; String? get phone; String? get avatar; String? get vehicleType; double? get rating;
/// Create a copy of PartnerTrackingSummary
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$PartnerTrackingSummaryCopyWith<PartnerTrackingSummary> get copyWith => _$PartnerTrackingSummaryCopyWithImpl<PartnerTrackingSummary>(this as PartnerTrackingSummary, _$identity);

  /// Serializes this PartnerTrackingSummary to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is PartnerTrackingSummary&&(identical(other.id, id) || other.id == id)&&(identical(other.name, name) || other.name == name)&&(identical(other.phone, phone) || other.phone == phone)&&(identical(other.avatar, avatar) || other.avatar == avatar)&&(identical(other.vehicleType, vehicleType) || other.vehicleType == vehicleType)&&(identical(other.rating, rating) || other.rating == rating));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,name,phone,avatar,vehicleType,rating);

@override
String toString() {
  return 'PartnerTrackingSummary(id: $id, name: $name, phone: $phone, avatar: $avatar, vehicleType: $vehicleType, rating: $rating)';
}


}

/// @nodoc
abstract mixin class $PartnerTrackingSummaryCopyWith<$Res>  {
  factory $PartnerTrackingSummaryCopyWith(PartnerTrackingSummary value, $Res Function(PartnerTrackingSummary) _then) = _$PartnerTrackingSummaryCopyWithImpl;
@useResult
$Res call({
 String id, String name, String? phone, String? avatar, String? vehicleType, double? rating
});




}
/// @nodoc
class _$PartnerTrackingSummaryCopyWithImpl<$Res>
    implements $PartnerTrackingSummaryCopyWith<$Res> {
  _$PartnerTrackingSummaryCopyWithImpl(this._self, this._then);

  final PartnerTrackingSummary _self;
  final $Res Function(PartnerTrackingSummary) _then;

/// Create a copy of PartnerTrackingSummary
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? id = null,Object? name = null,Object? phone = freezed,Object? avatar = freezed,Object? vehicleType = freezed,Object? rating = freezed,}) {
  return _then(_self.copyWith(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,name: null == name ? _self.name : name // ignore: cast_nullable_to_non_nullable
as String,phone: freezed == phone ? _self.phone : phone // ignore: cast_nullable_to_non_nullable
as String?,avatar: freezed == avatar ? _self.avatar : avatar // ignore: cast_nullable_to_non_nullable
as String?,vehicleType: freezed == vehicleType ? _self.vehicleType : vehicleType // ignore: cast_nullable_to_non_nullable
as String?,rating: freezed == rating ? _self.rating : rating // ignore: cast_nullable_to_non_nullable
as double?,
  ));
}

}


/// Adds pattern-matching-related methods to [PartnerTrackingSummary].
extension PartnerTrackingSummaryPatterns on PartnerTrackingSummary {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _PartnerTrackingSummary value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _PartnerTrackingSummary() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _PartnerTrackingSummary value)  $default,){
final _that = this;
switch (_that) {
case _PartnerTrackingSummary():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _PartnerTrackingSummary value)?  $default,){
final _that = this;
switch (_that) {
case _PartnerTrackingSummary() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String id,  String name,  String? phone,  String? avatar,  String? vehicleType,  double? rating)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _PartnerTrackingSummary() when $default != null:
return $default(_that.id,_that.name,_that.phone,_that.avatar,_that.vehicleType,_that.rating);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String id,  String name,  String? phone,  String? avatar,  String? vehicleType,  double? rating)  $default,) {final _that = this;
switch (_that) {
case _PartnerTrackingSummary():
return $default(_that.id,_that.name,_that.phone,_that.avatar,_that.vehicleType,_that.rating);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String id,  String name,  String? phone,  String? avatar,  String? vehicleType,  double? rating)?  $default,) {final _that = this;
switch (_that) {
case _PartnerTrackingSummary() when $default != null:
return $default(_that.id,_that.name,_that.phone,_that.avatar,_that.vehicleType,_that.rating);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _PartnerTrackingSummary implements PartnerTrackingSummary {
  const _PartnerTrackingSummary({required this.id, required this.name, this.phone, this.avatar, this.vehicleType, this.rating});
  factory _PartnerTrackingSummary.fromJson(Map<String, dynamic> json) => _$PartnerTrackingSummaryFromJson(json);

@override final  String id;
@override final  String name;
@override final  String? phone;
@override final  String? avatar;
@override final  String? vehicleType;
@override final  double? rating;

/// Create a copy of PartnerTrackingSummary
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$PartnerTrackingSummaryCopyWith<_PartnerTrackingSummary> get copyWith => __$PartnerTrackingSummaryCopyWithImpl<_PartnerTrackingSummary>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$PartnerTrackingSummaryToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _PartnerTrackingSummary&&(identical(other.id, id) || other.id == id)&&(identical(other.name, name) || other.name == name)&&(identical(other.phone, phone) || other.phone == phone)&&(identical(other.avatar, avatar) || other.avatar == avatar)&&(identical(other.vehicleType, vehicleType) || other.vehicleType == vehicleType)&&(identical(other.rating, rating) || other.rating == rating));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,name,phone,avatar,vehicleType,rating);

@override
String toString() {
  return 'PartnerTrackingSummary(id: $id, name: $name, phone: $phone, avatar: $avatar, vehicleType: $vehicleType, rating: $rating)';
}


}

/// @nodoc
abstract mixin class _$PartnerTrackingSummaryCopyWith<$Res> implements $PartnerTrackingSummaryCopyWith<$Res> {
  factory _$PartnerTrackingSummaryCopyWith(_PartnerTrackingSummary value, $Res Function(_PartnerTrackingSummary) _then) = __$PartnerTrackingSummaryCopyWithImpl;
@override @useResult
$Res call({
 String id, String name, String? phone, String? avatar, String? vehicleType, double? rating
});




}
/// @nodoc
class __$PartnerTrackingSummaryCopyWithImpl<$Res>
    implements _$PartnerTrackingSummaryCopyWith<$Res> {
  __$PartnerTrackingSummaryCopyWithImpl(this._self, this._then);

  final _PartnerTrackingSummary _self;
  final $Res Function(_PartnerTrackingSummary) _then;

/// Create a copy of PartnerTrackingSummary
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? id = null,Object? name = null,Object? phone = freezed,Object? avatar = freezed,Object? vehicleType = freezed,Object? rating = freezed,}) {
  return _then(_PartnerTrackingSummary(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,name: null == name ? _self.name : name // ignore: cast_nullable_to_non_nullable
as String,phone: freezed == phone ? _self.phone : phone // ignore: cast_nullable_to_non_nullable
as String?,avatar: freezed == avatar ? _self.avatar : avatar // ignore: cast_nullable_to_non_nullable
as String?,vehicleType: freezed == vehicleType ? _self.vehicleType : vehicleType // ignore: cast_nullable_to_non_nullable
as String?,rating: freezed == rating ? _self.rating : rating // ignore: cast_nullable_to_non_nullable
as double?,
  ));
}


}


/// @nodoc
mixin _$LocationPoint {

 double get lat; double get lng; String? get timestamp;
/// Create a copy of LocationPoint
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$LocationPointCopyWith<LocationPoint> get copyWith => _$LocationPointCopyWithImpl<LocationPoint>(this as LocationPoint, _$identity);

  /// Serializes this LocationPoint to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is LocationPoint&&(identical(other.lat, lat) || other.lat == lat)&&(identical(other.lng, lng) || other.lng == lng)&&(identical(other.timestamp, timestamp) || other.timestamp == timestamp));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,lat,lng,timestamp);

@override
String toString() {
  return 'LocationPoint(lat: $lat, lng: $lng, timestamp: $timestamp)';
}


}

/// @nodoc
abstract mixin class $LocationPointCopyWith<$Res>  {
  factory $LocationPointCopyWith(LocationPoint value, $Res Function(LocationPoint) _then) = _$LocationPointCopyWithImpl;
@useResult
$Res call({
 double lat, double lng, String? timestamp
});




}
/// @nodoc
class _$LocationPointCopyWithImpl<$Res>
    implements $LocationPointCopyWith<$Res> {
  _$LocationPointCopyWithImpl(this._self, this._then);

  final LocationPoint _self;
  final $Res Function(LocationPoint) _then;

/// Create a copy of LocationPoint
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? lat = null,Object? lng = null,Object? timestamp = freezed,}) {
  return _then(_self.copyWith(
lat: null == lat ? _self.lat : lat // ignore: cast_nullable_to_non_nullable
as double,lng: null == lng ? _self.lng : lng // ignore: cast_nullable_to_non_nullable
as double,timestamp: freezed == timestamp ? _self.timestamp : timestamp // ignore: cast_nullable_to_non_nullable
as String?,
  ));
}

}


/// Adds pattern-matching-related methods to [LocationPoint].
extension LocationPointPatterns on LocationPoint {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _LocationPoint value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _LocationPoint() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _LocationPoint value)  $default,){
final _that = this;
switch (_that) {
case _LocationPoint():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _LocationPoint value)?  $default,){
final _that = this;
switch (_that) {
case _LocationPoint() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( double lat,  double lng,  String? timestamp)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _LocationPoint() when $default != null:
return $default(_that.lat,_that.lng,_that.timestamp);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( double lat,  double lng,  String? timestamp)  $default,) {final _that = this;
switch (_that) {
case _LocationPoint():
return $default(_that.lat,_that.lng,_that.timestamp);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( double lat,  double lng,  String? timestamp)?  $default,) {final _that = this;
switch (_that) {
case _LocationPoint() when $default != null:
return $default(_that.lat,_that.lng,_that.timestamp);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _LocationPoint implements LocationPoint {
  const _LocationPoint({required this.lat, required this.lng, this.timestamp});
  factory _LocationPoint.fromJson(Map<String, dynamic> json) => _$LocationPointFromJson(json);

@override final  double lat;
@override final  double lng;
@override final  String? timestamp;

/// Create a copy of LocationPoint
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$LocationPointCopyWith<_LocationPoint> get copyWith => __$LocationPointCopyWithImpl<_LocationPoint>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$LocationPointToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _LocationPoint&&(identical(other.lat, lat) || other.lat == lat)&&(identical(other.lng, lng) || other.lng == lng)&&(identical(other.timestamp, timestamp) || other.timestamp == timestamp));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,lat,lng,timestamp);

@override
String toString() {
  return 'LocationPoint(lat: $lat, lng: $lng, timestamp: $timestamp)';
}


}

/// @nodoc
abstract mixin class _$LocationPointCopyWith<$Res> implements $LocationPointCopyWith<$Res> {
  factory _$LocationPointCopyWith(_LocationPoint value, $Res Function(_LocationPoint) _then) = __$LocationPointCopyWithImpl;
@override @useResult
$Res call({
 double lat, double lng, String? timestamp
});




}
/// @nodoc
class __$LocationPointCopyWithImpl<$Res>
    implements _$LocationPointCopyWith<$Res> {
  __$LocationPointCopyWithImpl(this._self, this._then);

  final _LocationPoint _self;
  final $Res Function(_LocationPoint) _then;

/// Create a copy of LocationPoint
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? lat = null,Object? lng = null,Object? timestamp = freezed,}) {
  return _then(_LocationPoint(
lat: null == lat ? _self.lat : lat // ignore: cast_nullable_to_non_nullable
as double,lng: null == lng ? _self.lng : lng // ignore: cast_nullable_to_non_nullable
as double,timestamp: freezed == timestamp ? _self.timestamp : timestamp // ignore: cast_nullable_to_non_nullable
as String?,
  ));
}


}


/// @nodoc
mixin _$LiveTrackingDTO {

 Map<String, dynamic> get order; bool get isLive; PartnerTrackingSummary? get partner; LocationPoint? get location; String? get eta; String? get estimatedArrival; String? get deliveryStatus; int? get etaMinutes; double? get distanceKm;
/// Create a copy of LiveTrackingDTO
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$LiveTrackingDTOCopyWith<LiveTrackingDTO> get copyWith => _$LiveTrackingDTOCopyWithImpl<LiveTrackingDTO>(this as LiveTrackingDTO, _$identity);

  /// Serializes this LiveTrackingDTO to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is LiveTrackingDTO&&const DeepCollectionEquality().equals(other.order, order)&&(identical(other.isLive, isLive) || other.isLive == isLive)&&(identical(other.partner, partner) || other.partner == partner)&&(identical(other.location, location) || other.location == location)&&(identical(other.eta, eta) || other.eta == eta)&&(identical(other.estimatedArrival, estimatedArrival) || other.estimatedArrival == estimatedArrival)&&(identical(other.deliveryStatus, deliveryStatus) || other.deliveryStatus == deliveryStatus)&&(identical(other.etaMinutes, etaMinutes) || other.etaMinutes == etaMinutes)&&(identical(other.distanceKm, distanceKm) || other.distanceKm == distanceKm));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,const DeepCollectionEquality().hash(order),isLive,partner,location,eta,estimatedArrival,deliveryStatus,etaMinutes,distanceKm);

@override
String toString() {
  return 'LiveTrackingDTO(order: $order, isLive: $isLive, partner: $partner, location: $location, eta: $eta, estimatedArrival: $estimatedArrival, deliveryStatus: $deliveryStatus, etaMinutes: $etaMinutes, distanceKm: $distanceKm)';
}


}

/// @nodoc
abstract mixin class $LiveTrackingDTOCopyWith<$Res>  {
  factory $LiveTrackingDTOCopyWith(LiveTrackingDTO value, $Res Function(LiveTrackingDTO) _then) = _$LiveTrackingDTOCopyWithImpl;
@useResult
$Res call({
 Map<String, dynamic> order, bool isLive, PartnerTrackingSummary? partner, LocationPoint? location, String? eta, String? estimatedArrival, String? deliveryStatus, int? etaMinutes, double? distanceKm
});


$PartnerTrackingSummaryCopyWith<$Res>? get partner;$LocationPointCopyWith<$Res>? get location;

}
/// @nodoc
class _$LiveTrackingDTOCopyWithImpl<$Res>
    implements $LiveTrackingDTOCopyWith<$Res> {
  _$LiveTrackingDTOCopyWithImpl(this._self, this._then);

  final LiveTrackingDTO _self;
  final $Res Function(LiveTrackingDTO) _then;

/// Create a copy of LiveTrackingDTO
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? order = null,Object? isLive = null,Object? partner = freezed,Object? location = freezed,Object? eta = freezed,Object? estimatedArrival = freezed,Object? deliveryStatus = freezed,Object? etaMinutes = freezed,Object? distanceKm = freezed,}) {
  return _then(_self.copyWith(
order: null == order ? _self.order : order // ignore: cast_nullable_to_non_nullable
as Map<String, dynamic>,isLive: null == isLive ? _self.isLive : isLive // ignore: cast_nullable_to_non_nullable
as bool,partner: freezed == partner ? _self.partner : partner // ignore: cast_nullable_to_non_nullable
as PartnerTrackingSummary?,location: freezed == location ? _self.location : location // ignore: cast_nullable_to_non_nullable
as LocationPoint?,eta: freezed == eta ? _self.eta : eta // ignore: cast_nullable_to_non_nullable
as String?,estimatedArrival: freezed == estimatedArrival ? _self.estimatedArrival : estimatedArrival // ignore: cast_nullable_to_non_nullable
as String?,deliveryStatus: freezed == deliveryStatus ? _self.deliveryStatus : deliveryStatus // ignore: cast_nullable_to_non_nullable
as String?,etaMinutes: freezed == etaMinutes ? _self.etaMinutes : etaMinutes // ignore: cast_nullable_to_non_nullable
as int?,distanceKm: freezed == distanceKm ? _self.distanceKm : distanceKm // ignore: cast_nullable_to_non_nullable
as double?,
  ));
}
/// Create a copy of LiveTrackingDTO
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$PartnerTrackingSummaryCopyWith<$Res>? get partner {
    if (_self.partner == null) {
    return null;
  }

  return $PartnerTrackingSummaryCopyWith<$Res>(_self.partner!, (value) {
    return _then(_self.copyWith(partner: value));
  });
}/// Create a copy of LiveTrackingDTO
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$LocationPointCopyWith<$Res>? get location {
    if (_self.location == null) {
    return null;
  }

  return $LocationPointCopyWith<$Res>(_self.location!, (value) {
    return _then(_self.copyWith(location: value));
  });
}
}


/// Adds pattern-matching-related methods to [LiveTrackingDTO].
extension LiveTrackingDTOPatterns on LiveTrackingDTO {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _LiveTrackingDTO value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _LiveTrackingDTO() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _LiveTrackingDTO value)  $default,){
final _that = this;
switch (_that) {
case _LiveTrackingDTO():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _LiveTrackingDTO value)?  $default,){
final _that = this;
switch (_that) {
case _LiveTrackingDTO() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( Map<String, dynamic> order,  bool isLive,  PartnerTrackingSummary? partner,  LocationPoint? location,  String? eta,  String? estimatedArrival,  String? deliveryStatus,  int? etaMinutes,  double? distanceKm)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _LiveTrackingDTO() when $default != null:
return $default(_that.order,_that.isLive,_that.partner,_that.location,_that.eta,_that.estimatedArrival,_that.deliveryStatus,_that.etaMinutes,_that.distanceKm);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( Map<String, dynamic> order,  bool isLive,  PartnerTrackingSummary? partner,  LocationPoint? location,  String? eta,  String? estimatedArrival,  String? deliveryStatus,  int? etaMinutes,  double? distanceKm)  $default,) {final _that = this;
switch (_that) {
case _LiveTrackingDTO():
return $default(_that.order,_that.isLive,_that.partner,_that.location,_that.eta,_that.estimatedArrival,_that.deliveryStatus,_that.etaMinutes,_that.distanceKm);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( Map<String, dynamic> order,  bool isLive,  PartnerTrackingSummary? partner,  LocationPoint? location,  String? eta,  String? estimatedArrival,  String? deliveryStatus,  int? etaMinutes,  double? distanceKm)?  $default,) {final _that = this;
switch (_that) {
case _LiveTrackingDTO() when $default != null:
return $default(_that.order,_that.isLive,_that.partner,_that.location,_that.eta,_that.estimatedArrival,_that.deliveryStatus,_that.etaMinutes,_that.distanceKm);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _LiveTrackingDTO implements LiveTrackingDTO {
  const _LiveTrackingDTO({required final  Map<String, dynamic> order, required this.isLive, this.partner, this.location, this.eta, this.estimatedArrival, this.deliveryStatus, this.etaMinutes, this.distanceKm}): _order = order;
  factory _LiveTrackingDTO.fromJson(Map<String, dynamic> json) => _$LiveTrackingDTOFromJson(json);

 final  Map<String, dynamic> _order;
@override Map<String, dynamic> get order {
  if (_order is EqualUnmodifiableMapView) return _order;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableMapView(_order);
}

@override final  bool isLive;
@override final  PartnerTrackingSummary? partner;
@override final  LocationPoint? location;
@override final  String? eta;
@override final  String? estimatedArrival;
@override final  String? deliveryStatus;
@override final  int? etaMinutes;
@override final  double? distanceKm;

/// Create a copy of LiveTrackingDTO
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$LiveTrackingDTOCopyWith<_LiveTrackingDTO> get copyWith => __$LiveTrackingDTOCopyWithImpl<_LiveTrackingDTO>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$LiveTrackingDTOToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _LiveTrackingDTO&&const DeepCollectionEquality().equals(other._order, _order)&&(identical(other.isLive, isLive) || other.isLive == isLive)&&(identical(other.partner, partner) || other.partner == partner)&&(identical(other.location, location) || other.location == location)&&(identical(other.eta, eta) || other.eta == eta)&&(identical(other.estimatedArrival, estimatedArrival) || other.estimatedArrival == estimatedArrival)&&(identical(other.deliveryStatus, deliveryStatus) || other.deliveryStatus == deliveryStatus)&&(identical(other.etaMinutes, etaMinutes) || other.etaMinutes == etaMinutes)&&(identical(other.distanceKm, distanceKm) || other.distanceKm == distanceKm));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,const DeepCollectionEquality().hash(_order),isLive,partner,location,eta,estimatedArrival,deliveryStatus,etaMinutes,distanceKm);

@override
String toString() {
  return 'LiveTrackingDTO(order: $order, isLive: $isLive, partner: $partner, location: $location, eta: $eta, estimatedArrival: $estimatedArrival, deliveryStatus: $deliveryStatus, etaMinutes: $etaMinutes, distanceKm: $distanceKm)';
}


}

/// @nodoc
abstract mixin class _$LiveTrackingDTOCopyWith<$Res> implements $LiveTrackingDTOCopyWith<$Res> {
  factory _$LiveTrackingDTOCopyWith(_LiveTrackingDTO value, $Res Function(_LiveTrackingDTO) _then) = __$LiveTrackingDTOCopyWithImpl;
@override @useResult
$Res call({
 Map<String, dynamic> order, bool isLive, PartnerTrackingSummary? partner, LocationPoint? location, String? eta, String? estimatedArrival, String? deliveryStatus, int? etaMinutes, double? distanceKm
});


@override $PartnerTrackingSummaryCopyWith<$Res>? get partner;@override $LocationPointCopyWith<$Res>? get location;

}
/// @nodoc
class __$LiveTrackingDTOCopyWithImpl<$Res>
    implements _$LiveTrackingDTOCopyWith<$Res> {
  __$LiveTrackingDTOCopyWithImpl(this._self, this._then);

  final _LiveTrackingDTO _self;
  final $Res Function(_LiveTrackingDTO) _then;

/// Create a copy of LiveTrackingDTO
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? order = null,Object? isLive = null,Object? partner = freezed,Object? location = freezed,Object? eta = freezed,Object? estimatedArrival = freezed,Object? deliveryStatus = freezed,Object? etaMinutes = freezed,Object? distanceKm = freezed,}) {
  return _then(_LiveTrackingDTO(
order: null == order ? _self._order : order // ignore: cast_nullable_to_non_nullable
as Map<String, dynamic>,isLive: null == isLive ? _self.isLive : isLive // ignore: cast_nullable_to_non_nullable
as bool,partner: freezed == partner ? _self.partner : partner // ignore: cast_nullable_to_non_nullable
as PartnerTrackingSummary?,location: freezed == location ? _self.location : location // ignore: cast_nullable_to_non_nullable
as LocationPoint?,eta: freezed == eta ? _self.eta : eta // ignore: cast_nullable_to_non_nullable
as String?,estimatedArrival: freezed == estimatedArrival ? _self.estimatedArrival : estimatedArrival // ignore: cast_nullable_to_non_nullable
as String?,deliveryStatus: freezed == deliveryStatus ? _self.deliveryStatus : deliveryStatus // ignore: cast_nullable_to_non_nullable
as String?,etaMinutes: freezed == etaMinutes ? _self.etaMinutes : etaMinutes // ignore: cast_nullable_to_non_nullable
as int?,distanceKm: freezed == distanceKm ? _self.distanceKm : distanceKm // ignore: cast_nullable_to_non_nullable
as double?,
  ));
}

/// Create a copy of LiveTrackingDTO
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$PartnerTrackingSummaryCopyWith<$Res>? get partner {
    if (_self.partner == null) {
    return null;
  }

  return $PartnerTrackingSummaryCopyWith<$Res>(_self.partner!, (value) {
    return _then(_self.copyWith(partner: value));
  });
}/// Create a copy of LiveTrackingDTO
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$LocationPointCopyWith<$Res>? get location {
    if (_self.location == null) {
    return null;
  }

  return $LocationPointCopyWith<$Res>(_self.location!, (value) {
    return _then(_self.copyWith(location: value));
  });
}
}


/// @nodoc
mixin _$EtaDTO {

 int? get etaMinutes; double? get distanceKm; String? get estimatedArrival; String? get eta; String? get lastLocationUpdate;
/// Create a copy of EtaDTO
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$EtaDTOCopyWith<EtaDTO> get copyWith => _$EtaDTOCopyWithImpl<EtaDTO>(this as EtaDTO, _$identity);

  /// Serializes this EtaDTO to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is EtaDTO&&(identical(other.etaMinutes, etaMinutes) || other.etaMinutes == etaMinutes)&&(identical(other.distanceKm, distanceKm) || other.distanceKm == distanceKm)&&(identical(other.estimatedArrival, estimatedArrival) || other.estimatedArrival == estimatedArrival)&&(identical(other.eta, eta) || other.eta == eta)&&(identical(other.lastLocationUpdate, lastLocationUpdate) || other.lastLocationUpdate == lastLocationUpdate));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,etaMinutes,distanceKm,estimatedArrival,eta,lastLocationUpdate);

@override
String toString() {
  return 'EtaDTO(etaMinutes: $etaMinutes, distanceKm: $distanceKm, estimatedArrival: $estimatedArrival, eta: $eta, lastLocationUpdate: $lastLocationUpdate)';
}


}

/// @nodoc
abstract mixin class $EtaDTOCopyWith<$Res>  {
  factory $EtaDTOCopyWith(EtaDTO value, $Res Function(EtaDTO) _then) = _$EtaDTOCopyWithImpl;
@useResult
$Res call({
 int? etaMinutes, double? distanceKm, String? estimatedArrival, String? eta, String? lastLocationUpdate
});




}
/// @nodoc
class _$EtaDTOCopyWithImpl<$Res>
    implements $EtaDTOCopyWith<$Res> {
  _$EtaDTOCopyWithImpl(this._self, this._then);

  final EtaDTO _self;
  final $Res Function(EtaDTO) _then;

/// Create a copy of EtaDTO
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? etaMinutes = freezed,Object? distanceKm = freezed,Object? estimatedArrival = freezed,Object? eta = freezed,Object? lastLocationUpdate = freezed,}) {
  return _then(_self.copyWith(
etaMinutes: freezed == etaMinutes ? _self.etaMinutes : etaMinutes // ignore: cast_nullable_to_non_nullable
as int?,distanceKm: freezed == distanceKm ? _self.distanceKm : distanceKm // ignore: cast_nullable_to_non_nullable
as double?,estimatedArrival: freezed == estimatedArrival ? _self.estimatedArrival : estimatedArrival // ignore: cast_nullable_to_non_nullable
as String?,eta: freezed == eta ? _self.eta : eta // ignore: cast_nullable_to_non_nullable
as String?,lastLocationUpdate: freezed == lastLocationUpdate ? _self.lastLocationUpdate : lastLocationUpdate // ignore: cast_nullable_to_non_nullable
as String?,
  ));
}

}


/// Adds pattern-matching-related methods to [EtaDTO].
extension EtaDTOPatterns on EtaDTO {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _EtaDTO value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _EtaDTO() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _EtaDTO value)  $default,){
final _that = this;
switch (_that) {
case _EtaDTO():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _EtaDTO value)?  $default,){
final _that = this;
switch (_that) {
case _EtaDTO() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( int? etaMinutes,  double? distanceKm,  String? estimatedArrival,  String? eta,  String? lastLocationUpdate)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _EtaDTO() when $default != null:
return $default(_that.etaMinutes,_that.distanceKm,_that.estimatedArrival,_that.eta,_that.lastLocationUpdate);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( int? etaMinutes,  double? distanceKm,  String? estimatedArrival,  String? eta,  String? lastLocationUpdate)  $default,) {final _that = this;
switch (_that) {
case _EtaDTO():
return $default(_that.etaMinutes,_that.distanceKm,_that.estimatedArrival,_that.eta,_that.lastLocationUpdate);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( int? etaMinutes,  double? distanceKm,  String? estimatedArrival,  String? eta,  String? lastLocationUpdate)?  $default,) {final _that = this;
switch (_that) {
case _EtaDTO() when $default != null:
return $default(_that.etaMinutes,_that.distanceKm,_that.estimatedArrival,_that.eta,_that.lastLocationUpdate);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _EtaDTO implements EtaDTO {
  const _EtaDTO({this.etaMinutes, this.distanceKm, this.estimatedArrival, this.eta, this.lastLocationUpdate});
  factory _EtaDTO.fromJson(Map<String, dynamic> json) => _$EtaDTOFromJson(json);

@override final  int? etaMinutes;
@override final  double? distanceKm;
@override final  String? estimatedArrival;
@override final  String? eta;
@override final  String? lastLocationUpdate;

/// Create a copy of EtaDTO
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$EtaDTOCopyWith<_EtaDTO> get copyWith => __$EtaDTOCopyWithImpl<_EtaDTO>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$EtaDTOToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _EtaDTO&&(identical(other.etaMinutes, etaMinutes) || other.etaMinutes == etaMinutes)&&(identical(other.distanceKm, distanceKm) || other.distanceKm == distanceKm)&&(identical(other.estimatedArrival, estimatedArrival) || other.estimatedArrival == estimatedArrival)&&(identical(other.eta, eta) || other.eta == eta)&&(identical(other.lastLocationUpdate, lastLocationUpdate) || other.lastLocationUpdate == lastLocationUpdate));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,etaMinutes,distanceKm,estimatedArrival,eta,lastLocationUpdate);

@override
String toString() {
  return 'EtaDTO(etaMinutes: $etaMinutes, distanceKm: $distanceKm, estimatedArrival: $estimatedArrival, eta: $eta, lastLocationUpdate: $lastLocationUpdate)';
}


}

/// @nodoc
abstract mixin class _$EtaDTOCopyWith<$Res> implements $EtaDTOCopyWith<$Res> {
  factory _$EtaDTOCopyWith(_EtaDTO value, $Res Function(_EtaDTO) _then) = __$EtaDTOCopyWithImpl;
@override @useResult
$Res call({
 int? etaMinutes, double? distanceKm, String? estimatedArrival, String? eta, String? lastLocationUpdate
});




}
/// @nodoc
class __$EtaDTOCopyWithImpl<$Res>
    implements _$EtaDTOCopyWith<$Res> {
  __$EtaDTOCopyWithImpl(this._self, this._then);

  final _EtaDTO _self;
  final $Res Function(_EtaDTO) _then;

/// Create a copy of EtaDTO
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? etaMinutes = freezed,Object? distanceKm = freezed,Object? estimatedArrival = freezed,Object? eta = freezed,Object? lastLocationUpdate = freezed,}) {
  return _then(_EtaDTO(
etaMinutes: freezed == etaMinutes ? _self.etaMinutes : etaMinutes // ignore: cast_nullable_to_non_nullable
as int?,distanceKm: freezed == distanceKm ? _self.distanceKm : distanceKm // ignore: cast_nullable_to_non_nullable
as double?,estimatedArrival: freezed == estimatedArrival ? _self.estimatedArrival : estimatedArrival // ignore: cast_nullable_to_non_nullable
as String?,eta: freezed == eta ? _self.eta : eta // ignore: cast_nullable_to_non_nullable
as String?,lastLocationUpdate: freezed == lastLocationUpdate ? _self.lastLocationUpdate : lastLocationUpdate // ignore: cast_nullable_to_non_nullable
as String?,
  ));
}


}


/// @nodoc
mixin _$StatusHistoryItem {

 String get status; String get timestamp; String? get note;
/// Create a copy of StatusHistoryItem
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$StatusHistoryItemCopyWith<StatusHistoryItem> get copyWith => _$StatusHistoryItemCopyWithImpl<StatusHistoryItem>(this as StatusHistoryItem, _$identity);

  /// Serializes this StatusHistoryItem to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is StatusHistoryItem&&(identical(other.status, status) || other.status == status)&&(identical(other.timestamp, timestamp) || other.timestamp == timestamp)&&(identical(other.note, note) || other.note == note));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,status,timestamp,note);

@override
String toString() {
  return 'StatusHistoryItem(status: $status, timestamp: $timestamp, note: $note)';
}


}

/// @nodoc
abstract mixin class $StatusHistoryItemCopyWith<$Res>  {
  factory $StatusHistoryItemCopyWith(StatusHistoryItem value, $Res Function(StatusHistoryItem) _then) = _$StatusHistoryItemCopyWithImpl;
@useResult
$Res call({
 String status, String timestamp, String? note
});




}
/// @nodoc
class _$StatusHistoryItemCopyWithImpl<$Res>
    implements $StatusHistoryItemCopyWith<$Res> {
  _$StatusHistoryItemCopyWithImpl(this._self, this._then);

  final StatusHistoryItem _self;
  final $Res Function(StatusHistoryItem) _then;

/// Create a copy of StatusHistoryItem
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? status = null,Object? timestamp = null,Object? note = freezed,}) {
  return _then(_self.copyWith(
status: null == status ? _self.status : status // ignore: cast_nullable_to_non_nullable
as String,timestamp: null == timestamp ? _self.timestamp : timestamp // ignore: cast_nullable_to_non_nullable
as String,note: freezed == note ? _self.note : note // ignore: cast_nullable_to_non_nullable
as String?,
  ));
}

}


/// Adds pattern-matching-related methods to [StatusHistoryItem].
extension StatusHistoryItemPatterns on StatusHistoryItem {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _StatusHistoryItem value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _StatusHistoryItem() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _StatusHistoryItem value)  $default,){
final _that = this;
switch (_that) {
case _StatusHistoryItem():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _StatusHistoryItem value)?  $default,){
final _that = this;
switch (_that) {
case _StatusHistoryItem() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String status,  String timestamp,  String? note)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _StatusHistoryItem() when $default != null:
return $default(_that.status,_that.timestamp,_that.note);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String status,  String timestamp,  String? note)  $default,) {final _that = this;
switch (_that) {
case _StatusHistoryItem():
return $default(_that.status,_that.timestamp,_that.note);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String status,  String timestamp,  String? note)?  $default,) {final _that = this;
switch (_that) {
case _StatusHistoryItem() when $default != null:
return $default(_that.status,_that.timestamp,_that.note);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _StatusHistoryItem implements StatusHistoryItem {
  const _StatusHistoryItem({required this.status, required this.timestamp, this.note});
  factory _StatusHistoryItem.fromJson(Map<String, dynamic> json) => _$StatusHistoryItemFromJson(json);

@override final  String status;
@override final  String timestamp;
@override final  String? note;

/// Create a copy of StatusHistoryItem
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$StatusHistoryItemCopyWith<_StatusHistoryItem> get copyWith => __$StatusHistoryItemCopyWithImpl<_StatusHistoryItem>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$StatusHistoryItemToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _StatusHistoryItem&&(identical(other.status, status) || other.status == status)&&(identical(other.timestamp, timestamp) || other.timestamp == timestamp)&&(identical(other.note, note) || other.note == note));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,status,timestamp,note);

@override
String toString() {
  return 'StatusHistoryItem(status: $status, timestamp: $timestamp, note: $note)';
}


}

/// @nodoc
abstract mixin class _$StatusHistoryItemCopyWith<$Res> implements $StatusHistoryItemCopyWith<$Res> {
  factory _$StatusHistoryItemCopyWith(_StatusHistoryItem value, $Res Function(_StatusHistoryItem) _then) = __$StatusHistoryItemCopyWithImpl;
@override @useResult
$Res call({
 String status, String timestamp, String? note
});




}
/// @nodoc
class __$StatusHistoryItemCopyWithImpl<$Res>
    implements _$StatusHistoryItemCopyWith<$Res> {
  __$StatusHistoryItemCopyWithImpl(this._self, this._then);

  final _StatusHistoryItem _self;
  final $Res Function(_StatusHistoryItem) _then;

/// Create a copy of StatusHistoryItem
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? status = null,Object? timestamp = null,Object? note = freezed,}) {
  return _then(_StatusHistoryItem(
status: null == status ? _self.status : status // ignore: cast_nullable_to_non_nullable
as String,timestamp: null == timestamp ? _self.timestamp : timestamp // ignore: cast_nullable_to_non_nullable
as String,note: freezed == note ? _self.note : note // ignore: cast_nullable_to_non_nullable
as String?,
  ));
}


}


/// @nodoc
mixin _$DeliveryInfo {

 String get status; List<LocationPoint> get liveTracking; String? get estimatedDeliveryTime; String? get actualDeliveryTime; String? get actualPickupTime; double? get distance; PartnerTrackingSummary? get partner;
/// Create a copy of DeliveryInfo
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$DeliveryInfoCopyWith<DeliveryInfo> get copyWith => _$DeliveryInfoCopyWithImpl<DeliveryInfo>(this as DeliveryInfo, _$identity);

  /// Serializes this DeliveryInfo to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is DeliveryInfo&&(identical(other.status, status) || other.status == status)&&const DeepCollectionEquality().equals(other.liveTracking, liveTracking)&&(identical(other.estimatedDeliveryTime, estimatedDeliveryTime) || other.estimatedDeliveryTime == estimatedDeliveryTime)&&(identical(other.actualDeliveryTime, actualDeliveryTime) || other.actualDeliveryTime == actualDeliveryTime)&&(identical(other.actualPickupTime, actualPickupTime) || other.actualPickupTime == actualPickupTime)&&(identical(other.distance, distance) || other.distance == distance)&&(identical(other.partner, partner) || other.partner == partner));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,status,const DeepCollectionEquality().hash(liveTracking),estimatedDeliveryTime,actualDeliveryTime,actualPickupTime,distance,partner);

@override
String toString() {
  return 'DeliveryInfo(status: $status, liveTracking: $liveTracking, estimatedDeliveryTime: $estimatedDeliveryTime, actualDeliveryTime: $actualDeliveryTime, actualPickupTime: $actualPickupTime, distance: $distance, partner: $partner)';
}


}

/// @nodoc
abstract mixin class $DeliveryInfoCopyWith<$Res>  {
  factory $DeliveryInfoCopyWith(DeliveryInfo value, $Res Function(DeliveryInfo) _then) = _$DeliveryInfoCopyWithImpl;
@useResult
$Res call({
 String status, List<LocationPoint> liveTracking, String? estimatedDeliveryTime, String? actualDeliveryTime, String? actualPickupTime, double? distance, PartnerTrackingSummary? partner
});


$PartnerTrackingSummaryCopyWith<$Res>? get partner;

}
/// @nodoc
class _$DeliveryInfoCopyWithImpl<$Res>
    implements $DeliveryInfoCopyWith<$Res> {
  _$DeliveryInfoCopyWithImpl(this._self, this._then);

  final DeliveryInfo _self;
  final $Res Function(DeliveryInfo) _then;

/// Create a copy of DeliveryInfo
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? status = null,Object? liveTracking = null,Object? estimatedDeliveryTime = freezed,Object? actualDeliveryTime = freezed,Object? actualPickupTime = freezed,Object? distance = freezed,Object? partner = freezed,}) {
  return _then(_self.copyWith(
status: null == status ? _self.status : status // ignore: cast_nullable_to_non_nullable
as String,liveTracking: null == liveTracking ? _self.liveTracking : liveTracking // ignore: cast_nullable_to_non_nullable
as List<LocationPoint>,estimatedDeliveryTime: freezed == estimatedDeliveryTime ? _self.estimatedDeliveryTime : estimatedDeliveryTime // ignore: cast_nullable_to_non_nullable
as String?,actualDeliveryTime: freezed == actualDeliveryTime ? _self.actualDeliveryTime : actualDeliveryTime // ignore: cast_nullable_to_non_nullable
as String?,actualPickupTime: freezed == actualPickupTime ? _self.actualPickupTime : actualPickupTime // ignore: cast_nullable_to_non_nullable
as String?,distance: freezed == distance ? _self.distance : distance // ignore: cast_nullable_to_non_nullable
as double?,partner: freezed == partner ? _self.partner : partner // ignore: cast_nullable_to_non_nullable
as PartnerTrackingSummary?,
  ));
}
/// Create a copy of DeliveryInfo
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$PartnerTrackingSummaryCopyWith<$Res>? get partner {
    if (_self.partner == null) {
    return null;
  }

  return $PartnerTrackingSummaryCopyWith<$Res>(_self.partner!, (value) {
    return _then(_self.copyWith(partner: value));
  });
}
}


/// Adds pattern-matching-related methods to [DeliveryInfo].
extension DeliveryInfoPatterns on DeliveryInfo {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _DeliveryInfo value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _DeliveryInfo() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _DeliveryInfo value)  $default,){
final _that = this;
switch (_that) {
case _DeliveryInfo():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _DeliveryInfo value)?  $default,){
final _that = this;
switch (_that) {
case _DeliveryInfo() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String status,  List<LocationPoint> liveTracking,  String? estimatedDeliveryTime,  String? actualDeliveryTime,  String? actualPickupTime,  double? distance,  PartnerTrackingSummary? partner)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _DeliveryInfo() when $default != null:
return $default(_that.status,_that.liveTracking,_that.estimatedDeliveryTime,_that.actualDeliveryTime,_that.actualPickupTime,_that.distance,_that.partner);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String status,  List<LocationPoint> liveTracking,  String? estimatedDeliveryTime,  String? actualDeliveryTime,  String? actualPickupTime,  double? distance,  PartnerTrackingSummary? partner)  $default,) {final _that = this;
switch (_that) {
case _DeliveryInfo():
return $default(_that.status,_that.liveTracking,_that.estimatedDeliveryTime,_that.actualDeliveryTime,_that.actualPickupTime,_that.distance,_that.partner);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String status,  List<LocationPoint> liveTracking,  String? estimatedDeliveryTime,  String? actualDeliveryTime,  String? actualPickupTime,  double? distance,  PartnerTrackingSummary? partner)?  $default,) {final _that = this;
switch (_that) {
case _DeliveryInfo() when $default != null:
return $default(_that.status,_that.liveTracking,_that.estimatedDeliveryTime,_that.actualDeliveryTime,_that.actualPickupTime,_that.distance,_that.partner);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _DeliveryInfo implements DeliveryInfo {
  const _DeliveryInfo({required this.status, final  List<LocationPoint> liveTracking = const [], this.estimatedDeliveryTime, this.actualDeliveryTime, this.actualPickupTime, this.distance, this.partner}): _liveTracking = liveTracking;
  factory _DeliveryInfo.fromJson(Map<String, dynamic> json) => _$DeliveryInfoFromJson(json);

@override final  String status;
 final  List<LocationPoint> _liveTracking;
@override@JsonKey() List<LocationPoint> get liveTracking {
  if (_liveTracking is EqualUnmodifiableListView) return _liveTracking;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_liveTracking);
}

@override final  String? estimatedDeliveryTime;
@override final  String? actualDeliveryTime;
@override final  String? actualPickupTime;
@override final  double? distance;
@override final  PartnerTrackingSummary? partner;

/// Create a copy of DeliveryInfo
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$DeliveryInfoCopyWith<_DeliveryInfo> get copyWith => __$DeliveryInfoCopyWithImpl<_DeliveryInfo>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$DeliveryInfoToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _DeliveryInfo&&(identical(other.status, status) || other.status == status)&&const DeepCollectionEquality().equals(other._liveTracking, _liveTracking)&&(identical(other.estimatedDeliveryTime, estimatedDeliveryTime) || other.estimatedDeliveryTime == estimatedDeliveryTime)&&(identical(other.actualDeliveryTime, actualDeliveryTime) || other.actualDeliveryTime == actualDeliveryTime)&&(identical(other.actualPickupTime, actualPickupTime) || other.actualPickupTime == actualPickupTime)&&(identical(other.distance, distance) || other.distance == distance)&&(identical(other.partner, partner) || other.partner == partner));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,status,const DeepCollectionEquality().hash(_liveTracking),estimatedDeliveryTime,actualDeliveryTime,actualPickupTime,distance,partner);

@override
String toString() {
  return 'DeliveryInfo(status: $status, liveTracking: $liveTracking, estimatedDeliveryTime: $estimatedDeliveryTime, actualDeliveryTime: $actualDeliveryTime, actualPickupTime: $actualPickupTime, distance: $distance, partner: $partner)';
}


}

/// @nodoc
abstract mixin class _$DeliveryInfoCopyWith<$Res> implements $DeliveryInfoCopyWith<$Res> {
  factory _$DeliveryInfoCopyWith(_DeliveryInfo value, $Res Function(_DeliveryInfo) _then) = __$DeliveryInfoCopyWithImpl;
@override @useResult
$Res call({
 String status, List<LocationPoint> liveTracking, String? estimatedDeliveryTime, String? actualDeliveryTime, String? actualPickupTime, double? distance, PartnerTrackingSummary? partner
});


@override $PartnerTrackingSummaryCopyWith<$Res>? get partner;

}
/// @nodoc
class __$DeliveryInfoCopyWithImpl<$Res>
    implements _$DeliveryInfoCopyWith<$Res> {
  __$DeliveryInfoCopyWithImpl(this._self, this._then);

  final _DeliveryInfo _self;
  final $Res Function(_DeliveryInfo) _then;

/// Create a copy of DeliveryInfo
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? status = null,Object? liveTracking = null,Object? estimatedDeliveryTime = freezed,Object? actualDeliveryTime = freezed,Object? actualPickupTime = freezed,Object? distance = freezed,Object? partner = freezed,}) {
  return _then(_DeliveryInfo(
status: null == status ? _self.status : status // ignore: cast_nullable_to_non_nullable
as String,liveTracking: null == liveTracking ? _self._liveTracking : liveTracking // ignore: cast_nullable_to_non_nullable
as List<LocationPoint>,estimatedDeliveryTime: freezed == estimatedDeliveryTime ? _self.estimatedDeliveryTime : estimatedDeliveryTime // ignore: cast_nullable_to_non_nullable
as String?,actualDeliveryTime: freezed == actualDeliveryTime ? _self.actualDeliveryTime : actualDeliveryTime // ignore: cast_nullable_to_non_nullable
as String?,actualPickupTime: freezed == actualPickupTime ? _self.actualPickupTime : actualPickupTime // ignore: cast_nullable_to_non_nullable
as String?,distance: freezed == distance ? _self.distance : distance // ignore: cast_nullable_to_non_nullable
as double?,partner: freezed == partner ? _self.partner : partner // ignore: cast_nullable_to_non_nullable
as PartnerTrackingSummary?,
  ));
}

/// Create a copy of DeliveryInfo
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$PartnerTrackingSummaryCopyWith<$Res>? get partner {
    if (_self.partner == null) {
    return null;
  }

  return $PartnerTrackingSummaryCopyWith<$Res>(_self.partner!, (value) {
    return _then(_self.copyWith(partner: value));
  });
}
}


/// @nodoc
mixin _$OrderTrackingDTO {

 String get id; String get orderNumber; String get orderType; String get status; String get paymentStatus; double get totalAmount; double get subtotal; double get deliveryFee; double get totalTax; double get totalDiscount; String get createdAt; List<OrderItemDTO> get items; List<StatusHistoryItem> get statusHistory; Map<String, dynamic>? get store; Map<String, dynamic>? get customer; DeliveryInfo? get delivery; String? get confirmedAt; String? get deliveredAt;
/// Create a copy of OrderTrackingDTO
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$OrderTrackingDTOCopyWith<OrderTrackingDTO> get copyWith => _$OrderTrackingDTOCopyWithImpl<OrderTrackingDTO>(this as OrderTrackingDTO, _$identity);

  /// Serializes this OrderTrackingDTO to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is OrderTrackingDTO&&(identical(other.id, id) || other.id == id)&&(identical(other.orderNumber, orderNumber) || other.orderNumber == orderNumber)&&(identical(other.orderType, orderType) || other.orderType == orderType)&&(identical(other.status, status) || other.status == status)&&(identical(other.paymentStatus, paymentStatus) || other.paymentStatus == paymentStatus)&&(identical(other.totalAmount, totalAmount) || other.totalAmount == totalAmount)&&(identical(other.subtotal, subtotal) || other.subtotal == subtotal)&&(identical(other.deliveryFee, deliveryFee) || other.deliveryFee == deliveryFee)&&(identical(other.totalTax, totalTax) || other.totalTax == totalTax)&&(identical(other.totalDiscount, totalDiscount) || other.totalDiscount == totalDiscount)&&(identical(other.createdAt, createdAt) || other.createdAt == createdAt)&&const DeepCollectionEquality().equals(other.items, items)&&const DeepCollectionEquality().equals(other.statusHistory, statusHistory)&&const DeepCollectionEquality().equals(other.store, store)&&const DeepCollectionEquality().equals(other.customer, customer)&&(identical(other.delivery, delivery) || other.delivery == delivery)&&(identical(other.confirmedAt, confirmedAt) || other.confirmedAt == confirmedAt)&&(identical(other.deliveredAt, deliveredAt) || other.deliveredAt == deliveredAt));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,orderNumber,orderType,status,paymentStatus,totalAmount,subtotal,deliveryFee,totalTax,totalDiscount,createdAt,const DeepCollectionEquality().hash(items),const DeepCollectionEquality().hash(statusHistory),const DeepCollectionEquality().hash(store),const DeepCollectionEquality().hash(customer),delivery,confirmedAt,deliveredAt);

@override
String toString() {
  return 'OrderTrackingDTO(id: $id, orderNumber: $orderNumber, orderType: $orderType, status: $status, paymentStatus: $paymentStatus, totalAmount: $totalAmount, subtotal: $subtotal, deliveryFee: $deliveryFee, totalTax: $totalTax, totalDiscount: $totalDiscount, createdAt: $createdAt, items: $items, statusHistory: $statusHistory, store: $store, customer: $customer, delivery: $delivery, confirmedAt: $confirmedAt, deliveredAt: $deliveredAt)';
}


}

/// @nodoc
abstract mixin class $OrderTrackingDTOCopyWith<$Res>  {
  factory $OrderTrackingDTOCopyWith(OrderTrackingDTO value, $Res Function(OrderTrackingDTO) _then) = _$OrderTrackingDTOCopyWithImpl;
@useResult
$Res call({
 String id, String orderNumber, String orderType, String status, String paymentStatus, double totalAmount, double subtotal, double deliveryFee, double totalTax, double totalDiscount, String createdAt, List<OrderItemDTO> items, List<StatusHistoryItem> statusHistory, Map<String, dynamic>? store, Map<String, dynamic>? customer, DeliveryInfo? delivery, String? confirmedAt, String? deliveredAt
});


$DeliveryInfoCopyWith<$Res>? get delivery;

}
/// @nodoc
class _$OrderTrackingDTOCopyWithImpl<$Res>
    implements $OrderTrackingDTOCopyWith<$Res> {
  _$OrderTrackingDTOCopyWithImpl(this._self, this._then);

  final OrderTrackingDTO _self;
  final $Res Function(OrderTrackingDTO) _then;

/// Create a copy of OrderTrackingDTO
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? id = null,Object? orderNumber = null,Object? orderType = null,Object? status = null,Object? paymentStatus = null,Object? totalAmount = null,Object? subtotal = null,Object? deliveryFee = null,Object? totalTax = null,Object? totalDiscount = null,Object? createdAt = null,Object? items = null,Object? statusHistory = null,Object? store = freezed,Object? customer = freezed,Object? delivery = freezed,Object? confirmedAt = freezed,Object? deliveredAt = freezed,}) {
  return _then(_self.copyWith(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,orderNumber: null == orderNumber ? _self.orderNumber : orderNumber // ignore: cast_nullable_to_non_nullable
as String,orderType: null == orderType ? _self.orderType : orderType // ignore: cast_nullable_to_non_nullable
as String,status: null == status ? _self.status : status // ignore: cast_nullable_to_non_nullable
as String,paymentStatus: null == paymentStatus ? _self.paymentStatus : paymentStatus // ignore: cast_nullable_to_non_nullable
as String,totalAmount: null == totalAmount ? _self.totalAmount : totalAmount // ignore: cast_nullable_to_non_nullable
as double,subtotal: null == subtotal ? _self.subtotal : subtotal // ignore: cast_nullable_to_non_nullable
as double,deliveryFee: null == deliveryFee ? _self.deliveryFee : deliveryFee // ignore: cast_nullable_to_non_nullable
as double,totalTax: null == totalTax ? _self.totalTax : totalTax // ignore: cast_nullable_to_non_nullable
as double,totalDiscount: null == totalDiscount ? _self.totalDiscount : totalDiscount // ignore: cast_nullable_to_non_nullable
as double,createdAt: null == createdAt ? _self.createdAt : createdAt // ignore: cast_nullable_to_non_nullable
as String,items: null == items ? _self.items : items // ignore: cast_nullable_to_non_nullable
as List<OrderItemDTO>,statusHistory: null == statusHistory ? _self.statusHistory : statusHistory // ignore: cast_nullable_to_non_nullable
as List<StatusHistoryItem>,store: freezed == store ? _self.store : store // ignore: cast_nullable_to_non_nullable
as Map<String, dynamic>?,customer: freezed == customer ? _self.customer : customer // ignore: cast_nullable_to_non_nullable
as Map<String, dynamic>?,delivery: freezed == delivery ? _self.delivery : delivery // ignore: cast_nullable_to_non_nullable
as DeliveryInfo?,confirmedAt: freezed == confirmedAt ? _self.confirmedAt : confirmedAt // ignore: cast_nullable_to_non_nullable
as String?,deliveredAt: freezed == deliveredAt ? _self.deliveredAt : deliveredAt // ignore: cast_nullable_to_non_nullable
as String?,
  ));
}
/// Create a copy of OrderTrackingDTO
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$DeliveryInfoCopyWith<$Res>? get delivery {
    if (_self.delivery == null) {
    return null;
  }

  return $DeliveryInfoCopyWith<$Res>(_self.delivery!, (value) {
    return _then(_self.copyWith(delivery: value));
  });
}
}


/// Adds pattern-matching-related methods to [OrderTrackingDTO].
extension OrderTrackingDTOPatterns on OrderTrackingDTO {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _OrderTrackingDTO value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _OrderTrackingDTO() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _OrderTrackingDTO value)  $default,){
final _that = this;
switch (_that) {
case _OrderTrackingDTO():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _OrderTrackingDTO value)?  $default,){
final _that = this;
switch (_that) {
case _OrderTrackingDTO() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String id,  String orderNumber,  String orderType,  String status,  String paymentStatus,  double totalAmount,  double subtotal,  double deliveryFee,  double totalTax,  double totalDiscount,  String createdAt,  List<OrderItemDTO> items,  List<StatusHistoryItem> statusHistory,  Map<String, dynamic>? store,  Map<String, dynamic>? customer,  DeliveryInfo? delivery,  String? confirmedAt,  String? deliveredAt)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _OrderTrackingDTO() when $default != null:
return $default(_that.id,_that.orderNumber,_that.orderType,_that.status,_that.paymentStatus,_that.totalAmount,_that.subtotal,_that.deliveryFee,_that.totalTax,_that.totalDiscount,_that.createdAt,_that.items,_that.statusHistory,_that.store,_that.customer,_that.delivery,_that.confirmedAt,_that.deliveredAt);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String id,  String orderNumber,  String orderType,  String status,  String paymentStatus,  double totalAmount,  double subtotal,  double deliveryFee,  double totalTax,  double totalDiscount,  String createdAt,  List<OrderItemDTO> items,  List<StatusHistoryItem> statusHistory,  Map<String, dynamic>? store,  Map<String, dynamic>? customer,  DeliveryInfo? delivery,  String? confirmedAt,  String? deliveredAt)  $default,) {final _that = this;
switch (_that) {
case _OrderTrackingDTO():
return $default(_that.id,_that.orderNumber,_that.orderType,_that.status,_that.paymentStatus,_that.totalAmount,_that.subtotal,_that.deliveryFee,_that.totalTax,_that.totalDiscount,_that.createdAt,_that.items,_that.statusHistory,_that.store,_that.customer,_that.delivery,_that.confirmedAt,_that.deliveredAt);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String id,  String orderNumber,  String orderType,  String status,  String paymentStatus,  double totalAmount,  double subtotal,  double deliveryFee,  double totalTax,  double totalDiscount,  String createdAt,  List<OrderItemDTO> items,  List<StatusHistoryItem> statusHistory,  Map<String, dynamic>? store,  Map<String, dynamic>? customer,  DeliveryInfo? delivery,  String? confirmedAt,  String? deliveredAt)?  $default,) {final _that = this;
switch (_that) {
case _OrderTrackingDTO() when $default != null:
return $default(_that.id,_that.orderNumber,_that.orderType,_that.status,_that.paymentStatus,_that.totalAmount,_that.subtotal,_that.deliveryFee,_that.totalTax,_that.totalDiscount,_that.createdAt,_that.items,_that.statusHistory,_that.store,_that.customer,_that.delivery,_that.confirmedAt,_that.deliveredAt);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _OrderTrackingDTO implements OrderTrackingDTO {
  const _OrderTrackingDTO({required this.id, required this.orderNumber, required this.orderType, required this.status, required this.paymentStatus, required this.totalAmount, required this.subtotal, required this.deliveryFee, required this.totalTax, required this.totalDiscount, required this.createdAt, required final  List<OrderItemDTO> items, required final  List<StatusHistoryItem> statusHistory, final  Map<String, dynamic>? store, final  Map<String, dynamic>? customer, this.delivery, this.confirmedAt, this.deliveredAt}): _items = items,_statusHistory = statusHistory,_store = store,_customer = customer;
  factory _OrderTrackingDTO.fromJson(Map<String, dynamic> json) => _$OrderTrackingDTOFromJson(json);

@override final  String id;
@override final  String orderNumber;
@override final  String orderType;
@override final  String status;
@override final  String paymentStatus;
@override final  double totalAmount;
@override final  double subtotal;
@override final  double deliveryFee;
@override final  double totalTax;
@override final  double totalDiscount;
@override final  String createdAt;
 final  List<OrderItemDTO> _items;
@override List<OrderItemDTO> get items {
  if (_items is EqualUnmodifiableListView) return _items;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_items);
}

 final  List<StatusHistoryItem> _statusHistory;
@override List<StatusHistoryItem> get statusHistory {
  if (_statusHistory is EqualUnmodifiableListView) return _statusHistory;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_statusHistory);
}

 final  Map<String, dynamic>? _store;
@override Map<String, dynamic>? get store {
  final value = _store;
  if (value == null) return null;
  if (_store is EqualUnmodifiableMapView) return _store;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableMapView(value);
}

 final  Map<String, dynamic>? _customer;
@override Map<String, dynamic>? get customer {
  final value = _customer;
  if (value == null) return null;
  if (_customer is EqualUnmodifiableMapView) return _customer;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableMapView(value);
}

@override final  DeliveryInfo? delivery;
@override final  String? confirmedAt;
@override final  String? deliveredAt;

/// Create a copy of OrderTrackingDTO
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$OrderTrackingDTOCopyWith<_OrderTrackingDTO> get copyWith => __$OrderTrackingDTOCopyWithImpl<_OrderTrackingDTO>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$OrderTrackingDTOToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _OrderTrackingDTO&&(identical(other.id, id) || other.id == id)&&(identical(other.orderNumber, orderNumber) || other.orderNumber == orderNumber)&&(identical(other.orderType, orderType) || other.orderType == orderType)&&(identical(other.status, status) || other.status == status)&&(identical(other.paymentStatus, paymentStatus) || other.paymentStatus == paymentStatus)&&(identical(other.totalAmount, totalAmount) || other.totalAmount == totalAmount)&&(identical(other.subtotal, subtotal) || other.subtotal == subtotal)&&(identical(other.deliveryFee, deliveryFee) || other.deliveryFee == deliveryFee)&&(identical(other.totalTax, totalTax) || other.totalTax == totalTax)&&(identical(other.totalDiscount, totalDiscount) || other.totalDiscount == totalDiscount)&&(identical(other.createdAt, createdAt) || other.createdAt == createdAt)&&const DeepCollectionEquality().equals(other._items, _items)&&const DeepCollectionEquality().equals(other._statusHistory, _statusHistory)&&const DeepCollectionEquality().equals(other._store, _store)&&const DeepCollectionEquality().equals(other._customer, _customer)&&(identical(other.delivery, delivery) || other.delivery == delivery)&&(identical(other.confirmedAt, confirmedAt) || other.confirmedAt == confirmedAt)&&(identical(other.deliveredAt, deliveredAt) || other.deliveredAt == deliveredAt));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,orderNumber,orderType,status,paymentStatus,totalAmount,subtotal,deliveryFee,totalTax,totalDiscount,createdAt,const DeepCollectionEquality().hash(_items),const DeepCollectionEquality().hash(_statusHistory),const DeepCollectionEquality().hash(_store),const DeepCollectionEquality().hash(_customer),delivery,confirmedAt,deliveredAt);

@override
String toString() {
  return 'OrderTrackingDTO(id: $id, orderNumber: $orderNumber, orderType: $orderType, status: $status, paymentStatus: $paymentStatus, totalAmount: $totalAmount, subtotal: $subtotal, deliveryFee: $deliveryFee, totalTax: $totalTax, totalDiscount: $totalDiscount, createdAt: $createdAt, items: $items, statusHistory: $statusHistory, store: $store, customer: $customer, delivery: $delivery, confirmedAt: $confirmedAt, deliveredAt: $deliveredAt)';
}


}

/// @nodoc
abstract mixin class _$OrderTrackingDTOCopyWith<$Res> implements $OrderTrackingDTOCopyWith<$Res> {
  factory _$OrderTrackingDTOCopyWith(_OrderTrackingDTO value, $Res Function(_OrderTrackingDTO) _then) = __$OrderTrackingDTOCopyWithImpl;
@override @useResult
$Res call({
 String id, String orderNumber, String orderType, String status, String paymentStatus, double totalAmount, double subtotal, double deliveryFee, double totalTax, double totalDiscount, String createdAt, List<OrderItemDTO> items, List<StatusHistoryItem> statusHistory, Map<String, dynamic>? store, Map<String, dynamic>? customer, DeliveryInfo? delivery, String? confirmedAt, String? deliveredAt
});


@override $DeliveryInfoCopyWith<$Res>? get delivery;

}
/// @nodoc
class __$OrderTrackingDTOCopyWithImpl<$Res>
    implements _$OrderTrackingDTOCopyWith<$Res> {
  __$OrderTrackingDTOCopyWithImpl(this._self, this._then);

  final _OrderTrackingDTO _self;
  final $Res Function(_OrderTrackingDTO) _then;

/// Create a copy of OrderTrackingDTO
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? id = null,Object? orderNumber = null,Object? orderType = null,Object? status = null,Object? paymentStatus = null,Object? totalAmount = null,Object? subtotal = null,Object? deliveryFee = null,Object? totalTax = null,Object? totalDiscount = null,Object? createdAt = null,Object? items = null,Object? statusHistory = null,Object? store = freezed,Object? customer = freezed,Object? delivery = freezed,Object? confirmedAt = freezed,Object? deliveredAt = freezed,}) {
  return _then(_OrderTrackingDTO(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,orderNumber: null == orderNumber ? _self.orderNumber : orderNumber // ignore: cast_nullable_to_non_nullable
as String,orderType: null == orderType ? _self.orderType : orderType // ignore: cast_nullable_to_non_nullable
as String,status: null == status ? _self.status : status // ignore: cast_nullable_to_non_nullable
as String,paymentStatus: null == paymentStatus ? _self.paymentStatus : paymentStatus // ignore: cast_nullable_to_non_nullable
as String,totalAmount: null == totalAmount ? _self.totalAmount : totalAmount // ignore: cast_nullable_to_non_nullable
as double,subtotal: null == subtotal ? _self.subtotal : subtotal // ignore: cast_nullable_to_non_nullable
as double,deliveryFee: null == deliveryFee ? _self.deliveryFee : deliveryFee // ignore: cast_nullable_to_non_nullable
as double,totalTax: null == totalTax ? _self.totalTax : totalTax // ignore: cast_nullable_to_non_nullable
as double,totalDiscount: null == totalDiscount ? _self.totalDiscount : totalDiscount // ignore: cast_nullable_to_non_nullable
as double,createdAt: null == createdAt ? _self.createdAt : createdAt // ignore: cast_nullable_to_non_nullable
as String,items: null == items ? _self._items : items // ignore: cast_nullable_to_non_nullable
as List<OrderItemDTO>,statusHistory: null == statusHistory ? _self._statusHistory : statusHistory // ignore: cast_nullable_to_non_nullable
as List<StatusHistoryItem>,store: freezed == store ? _self._store : store // ignore: cast_nullable_to_non_nullable
as Map<String, dynamic>?,customer: freezed == customer ? _self._customer : customer // ignore: cast_nullable_to_non_nullable
as Map<String, dynamic>?,delivery: freezed == delivery ? _self.delivery : delivery // ignore: cast_nullable_to_non_nullable
as DeliveryInfo?,confirmedAt: freezed == confirmedAt ? _self.confirmedAt : confirmedAt // ignore: cast_nullable_to_non_nullable
as String?,deliveredAt: freezed == deliveredAt ? _self.deliveredAt : deliveredAt // ignore: cast_nullable_to_non_nullable
as String?,
  ));
}

/// Create a copy of OrderTrackingDTO
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$DeliveryInfoCopyWith<$Res>? get delivery {
    if (_self.delivery == null) {
    return null;
  }

  return $DeliveryInfoCopyWith<$Res>(_self.delivery!, (value) {
    return _then(_self.copyWith(delivery: value));
  });
}
}

// dart format on
