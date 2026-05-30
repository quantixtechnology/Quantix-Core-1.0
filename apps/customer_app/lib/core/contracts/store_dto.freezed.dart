// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'store_dto.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// dart format off
T _$identity<T>(T value) => value;

/// @nodoc
mixin _$StoreTiming {

 int get day; String get openTime; String get closeTime; bool get isClosed;
/// Create a copy of StoreTiming
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$StoreTimingCopyWith<StoreTiming> get copyWith => _$StoreTimingCopyWithImpl<StoreTiming>(this as StoreTiming, _$identity);

  /// Serializes this StoreTiming to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is StoreTiming&&(identical(other.day, day) || other.day == day)&&(identical(other.openTime, openTime) || other.openTime == openTime)&&(identical(other.closeTime, closeTime) || other.closeTime == closeTime)&&(identical(other.isClosed, isClosed) || other.isClosed == isClosed));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,day,openTime,closeTime,isClosed);

@override
String toString() {
  return 'StoreTiming(day: $day, openTime: $openTime, closeTime: $closeTime, isClosed: $isClosed)';
}


}

/// @nodoc
abstract mixin class $StoreTimingCopyWith<$Res>  {
  factory $StoreTimingCopyWith(StoreTiming value, $Res Function(StoreTiming) _then) = _$StoreTimingCopyWithImpl;
@useResult
$Res call({
 int day, String openTime, String closeTime, bool isClosed
});




}
/// @nodoc
class _$StoreTimingCopyWithImpl<$Res>
    implements $StoreTimingCopyWith<$Res> {
  _$StoreTimingCopyWithImpl(this._self, this._then);

  final StoreTiming _self;
  final $Res Function(StoreTiming) _then;

/// Create a copy of StoreTiming
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? day = null,Object? openTime = null,Object? closeTime = null,Object? isClosed = null,}) {
  return _then(_self.copyWith(
day: null == day ? _self.day : day // ignore: cast_nullable_to_non_nullable
as int,openTime: null == openTime ? _self.openTime : openTime // ignore: cast_nullable_to_non_nullable
as String,closeTime: null == closeTime ? _self.closeTime : closeTime // ignore: cast_nullable_to_non_nullable
as String,isClosed: null == isClosed ? _self.isClosed : isClosed // ignore: cast_nullable_to_non_nullable
as bool,
  ));
}

}


/// Adds pattern-matching-related methods to [StoreTiming].
extension StoreTimingPatterns on StoreTiming {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _StoreTiming value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _StoreTiming() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _StoreTiming value)  $default,){
final _that = this;
switch (_that) {
case _StoreTiming():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _StoreTiming value)?  $default,){
final _that = this;
switch (_that) {
case _StoreTiming() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( int day,  String openTime,  String closeTime,  bool isClosed)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _StoreTiming() when $default != null:
return $default(_that.day,_that.openTime,_that.closeTime,_that.isClosed);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( int day,  String openTime,  String closeTime,  bool isClosed)  $default,) {final _that = this;
switch (_that) {
case _StoreTiming():
return $default(_that.day,_that.openTime,_that.closeTime,_that.isClosed);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( int day,  String openTime,  String closeTime,  bool isClosed)?  $default,) {final _that = this;
switch (_that) {
case _StoreTiming() when $default != null:
return $default(_that.day,_that.openTime,_that.closeTime,_that.isClosed);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _StoreTiming implements StoreTiming {
  const _StoreTiming({required this.day, required this.openTime, required this.closeTime, this.isClosed = false});
  factory _StoreTiming.fromJson(Map<String, dynamic> json) => _$StoreTimingFromJson(json);

@override final  int day;
@override final  String openTime;
@override final  String closeTime;
@override@JsonKey() final  bool isClosed;

/// Create a copy of StoreTiming
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$StoreTimingCopyWith<_StoreTiming> get copyWith => __$StoreTimingCopyWithImpl<_StoreTiming>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$StoreTimingToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _StoreTiming&&(identical(other.day, day) || other.day == day)&&(identical(other.openTime, openTime) || other.openTime == openTime)&&(identical(other.closeTime, closeTime) || other.closeTime == closeTime)&&(identical(other.isClosed, isClosed) || other.isClosed == isClosed));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,day,openTime,closeTime,isClosed);

@override
String toString() {
  return 'StoreTiming(day: $day, openTime: $openTime, closeTime: $closeTime, isClosed: $isClosed)';
}


}

/// @nodoc
abstract mixin class _$StoreTimingCopyWith<$Res> implements $StoreTimingCopyWith<$Res> {
  factory _$StoreTimingCopyWith(_StoreTiming value, $Res Function(_StoreTiming) _then) = __$StoreTimingCopyWithImpl;
@override @useResult
$Res call({
 int day, String openTime, String closeTime, bool isClosed
});




}
/// @nodoc
class __$StoreTimingCopyWithImpl<$Res>
    implements _$StoreTimingCopyWith<$Res> {
  __$StoreTimingCopyWithImpl(this._self, this._then);

  final _StoreTiming _self;
  final $Res Function(_StoreTiming) _then;

/// Create a copy of StoreTiming
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? day = null,Object? openTime = null,Object? closeTime = null,Object? isClosed = null,}) {
  return _then(_StoreTiming(
day: null == day ? _self.day : day // ignore: cast_nullable_to_non_nullable
as int,openTime: null == openTime ? _self.openTime : openTime // ignore: cast_nullable_to_non_nullable
as String,closeTime: null == closeTime ? _self.closeTime : closeTime // ignore: cast_nullable_to_non_nullable
as String,isClosed: null == isClosed ? _self.isClosed : isClosed // ignore: cast_nullable_to_non_nullable
as bool,
  ));
}


}


/// @nodoc
mixin _$StoreDTO {

 String get id; String get name; String get slug; String? get address; String? get city; String? get state; String? get pincode; String? get phone; String? get email; double? get latitude; double? get longitude; double? get deliveryRadius; double? get deliveryFee; double? get freeDeliveryAbove; double? get minOrderAmount; int? get preparationTime; bool get isMainStore; Map<String, dynamic> get operatingHours; List<StoreTiming> get storeTimings;
/// Create a copy of StoreDTO
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$StoreDTOCopyWith<StoreDTO> get copyWith => _$StoreDTOCopyWithImpl<StoreDTO>(this as StoreDTO, _$identity);

  /// Serializes this StoreDTO to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is StoreDTO&&(identical(other.id, id) || other.id == id)&&(identical(other.name, name) || other.name == name)&&(identical(other.slug, slug) || other.slug == slug)&&(identical(other.address, address) || other.address == address)&&(identical(other.city, city) || other.city == city)&&(identical(other.state, state) || other.state == state)&&(identical(other.pincode, pincode) || other.pincode == pincode)&&(identical(other.phone, phone) || other.phone == phone)&&(identical(other.email, email) || other.email == email)&&(identical(other.latitude, latitude) || other.latitude == latitude)&&(identical(other.longitude, longitude) || other.longitude == longitude)&&(identical(other.deliveryRadius, deliveryRadius) || other.deliveryRadius == deliveryRadius)&&(identical(other.deliveryFee, deliveryFee) || other.deliveryFee == deliveryFee)&&(identical(other.freeDeliveryAbove, freeDeliveryAbove) || other.freeDeliveryAbove == freeDeliveryAbove)&&(identical(other.minOrderAmount, minOrderAmount) || other.minOrderAmount == minOrderAmount)&&(identical(other.preparationTime, preparationTime) || other.preparationTime == preparationTime)&&(identical(other.isMainStore, isMainStore) || other.isMainStore == isMainStore)&&const DeepCollectionEquality().equals(other.operatingHours, operatingHours)&&const DeepCollectionEquality().equals(other.storeTimings, storeTimings));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hashAll([runtimeType,id,name,slug,address,city,state,pincode,phone,email,latitude,longitude,deliveryRadius,deliveryFee,freeDeliveryAbove,minOrderAmount,preparationTime,isMainStore,const DeepCollectionEquality().hash(operatingHours),const DeepCollectionEquality().hash(storeTimings)]);

@override
String toString() {
  return 'StoreDTO(id: $id, name: $name, slug: $slug, address: $address, city: $city, state: $state, pincode: $pincode, phone: $phone, email: $email, latitude: $latitude, longitude: $longitude, deliveryRadius: $deliveryRadius, deliveryFee: $deliveryFee, freeDeliveryAbove: $freeDeliveryAbove, minOrderAmount: $minOrderAmount, preparationTime: $preparationTime, isMainStore: $isMainStore, operatingHours: $operatingHours, storeTimings: $storeTimings)';
}


}

/// @nodoc
abstract mixin class $StoreDTOCopyWith<$Res>  {
  factory $StoreDTOCopyWith(StoreDTO value, $Res Function(StoreDTO) _then) = _$StoreDTOCopyWithImpl;
@useResult
$Res call({
 String id, String name, String slug, String? address, String? city, String? state, String? pincode, String? phone, String? email, double? latitude, double? longitude, double? deliveryRadius, double? deliveryFee, double? freeDeliveryAbove, double? minOrderAmount, int? preparationTime, bool isMainStore, Map<String, dynamic> operatingHours, List<StoreTiming> storeTimings
});




}
/// @nodoc
class _$StoreDTOCopyWithImpl<$Res>
    implements $StoreDTOCopyWith<$Res> {
  _$StoreDTOCopyWithImpl(this._self, this._then);

  final StoreDTO _self;
  final $Res Function(StoreDTO) _then;

/// Create a copy of StoreDTO
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? id = null,Object? name = null,Object? slug = null,Object? address = freezed,Object? city = freezed,Object? state = freezed,Object? pincode = freezed,Object? phone = freezed,Object? email = freezed,Object? latitude = freezed,Object? longitude = freezed,Object? deliveryRadius = freezed,Object? deliveryFee = freezed,Object? freeDeliveryAbove = freezed,Object? minOrderAmount = freezed,Object? preparationTime = freezed,Object? isMainStore = null,Object? operatingHours = null,Object? storeTimings = null,}) {
  return _then(_self.copyWith(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,name: null == name ? _self.name : name // ignore: cast_nullable_to_non_nullable
as String,slug: null == slug ? _self.slug : slug // ignore: cast_nullable_to_non_nullable
as String,address: freezed == address ? _self.address : address // ignore: cast_nullable_to_non_nullable
as String?,city: freezed == city ? _self.city : city // ignore: cast_nullable_to_non_nullable
as String?,state: freezed == state ? _self.state : state // ignore: cast_nullable_to_non_nullable
as String?,pincode: freezed == pincode ? _self.pincode : pincode // ignore: cast_nullable_to_non_nullable
as String?,phone: freezed == phone ? _self.phone : phone // ignore: cast_nullable_to_non_nullable
as String?,email: freezed == email ? _self.email : email // ignore: cast_nullable_to_non_nullable
as String?,latitude: freezed == latitude ? _self.latitude : latitude // ignore: cast_nullable_to_non_nullable
as double?,longitude: freezed == longitude ? _self.longitude : longitude // ignore: cast_nullable_to_non_nullable
as double?,deliveryRadius: freezed == deliveryRadius ? _self.deliveryRadius : deliveryRadius // ignore: cast_nullable_to_non_nullable
as double?,deliveryFee: freezed == deliveryFee ? _self.deliveryFee : deliveryFee // ignore: cast_nullable_to_non_nullable
as double?,freeDeliveryAbove: freezed == freeDeliveryAbove ? _self.freeDeliveryAbove : freeDeliveryAbove // ignore: cast_nullable_to_non_nullable
as double?,minOrderAmount: freezed == minOrderAmount ? _self.minOrderAmount : minOrderAmount // ignore: cast_nullable_to_non_nullable
as double?,preparationTime: freezed == preparationTime ? _self.preparationTime : preparationTime // ignore: cast_nullable_to_non_nullable
as int?,isMainStore: null == isMainStore ? _self.isMainStore : isMainStore // ignore: cast_nullable_to_non_nullable
as bool,operatingHours: null == operatingHours ? _self.operatingHours : operatingHours // ignore: cast_nullable_to_non_nullable
as Map<String, dynamic>,storeTimings: null == storeTimings ? _self.storeTimings : storeTimings // ignore: cast_nullable_to_non_nullable
as List<StoreTiming>,
  ));
}

}


/// Adds pattern-matching-related methods to [StoreDTO].
extension StoreDTOPatterns on StoreDTO {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _StoreDTO value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _StoreDTO() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _StoreDTO value)  $default,){
final _that = this;
switch (_that) {
case _StoreDTO():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _StoreDTO value)?  $default,){
final _that = this;
switch (_that) {
case _StoreDTO() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String id,  String name,  String slug,  String? address,  String? city,  String? state,  String? pincode,  String? phone,  String? email,  double? latitude,  double? longitude,  double? deliveryRadius,  double? deliveryFee,  double? freeDeliveryAbove,  double? minOrderAmount,  int? preparationTime,  bool isMainStore,  Map<String, dynamic> operatingHours,  List<StoreTiming> storeTimings)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _StoreDTO() when $default != null:
return $default(_that.id,_that.name,_that.slug,_that.address,_that.city,_that.state,_that.pincode,_that.phone,_that.email,_that.latitude,_that.longitude,_that.deliveryRadius,_that.deliveryFee,_that.freeDeliveryAbove,_that.minOrderAmount,_that.preparationTime,_that.isMainStore,_that.operatingHours,_that.storeTimings);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String id,  String name,  String slug,  String? address,  String? city,  String? state,  String? pincode,  String? phone,  String? email,  double? latitude,  double? longitude,  double? deliveryRadius,  double? deliveryFee,  double? freeDeliveryAbove,  double? minOrderAmount,  int? preparationTime,  bool isMainStore,  Map<String, dynamic> operatingHours,  List<StoreTiming> storeTimings)  $default,) {final _that = this;
switch (_that) {
case _StoreDTO():
return $default(_that.id,_that.name,_that.slug,_that.address,_that.city,_that.state,_that.pincode,_that.phone,_that.email,_that.latitude,_that.longitude,_that.deliveryRadius,_that.deliveryFee,_that.freeDeliveryAbove,_that.minOrderAmount,_that.preparationTime,_that.isMainStore,_that.operatingHours,_that.storeTimings);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String id,  String name,  String slug,  String? address,  String? city,  String? state,  String? pincode,  String? phone,  String? email,  double? latitude,  double? longitude,  double? deliveryRadius,  double? deliveryFee,  double? freeDeliveryAbove,  double? minOrderAmount,  int? preparationTime,  bool isMainStore,  Map<String, dynamic> operatingHours,  List<StoreTiming> storeTimings)?  $default,) {final _that = this;
switch (_that) {
case _StoreDTO() when $default != null:
return $default(_that.id,_that.name,_that.slug,_that.address,_that.city,_that.state,_that.pincode,_that.phone,_that.email,_that.latitude,_that.longitude,_that.deliveryRadius,_that.deliveryFee,_that.freeDeliveryAbove,_that.minOrderAmount,_that.preparationTime,_that.isMainStore,_that.operatingHours,_that.storeTimings);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _StoreDTO implements StoreDTO {
  const _StoreDTO({required this.id, required this.name, required this.slug, this.address, this.city, this.state, this.pincode, this.phone, this.email, this.latitude, this.longitude, this.deliveryRadius, this.deliveryFee, this.freeDeliveryAbove, this.minOrderAmount, this.preparationTime, this.isMainStore = false, final  Map<String, dynamic> operatingHours = const {}, final  List<StoreTiming> storeTimings = const []}): _operatingHours = operatingHours,_storeTimings = storeTimings;
  factory _StoreDTO.fromJson(Map<String, dynamic> json) => _$StoreDTOFromJson(json);

@override final  String id;
@override final  String name;
@override final  String slug;
@override final  String? address;
@override final  String? city;
@override final  String? state;
@override final  String? pincode;
@override final  String? phone;
@override final  String? email;
@override final  double? latitude;
@override final  double? longitude;
@override final  double? deliveryRadius;
@override final  double? deliveryFee;
@override final  double? freeDeliveryAbove;
@override final  double? minOrderAmount;
@override final  int? preparationTime;
@override@JsonKey() final  bool isMainStore;
 final  Map<String, dynamic> _operatingHours;
@override@JsonKey() Map<String, dynamic> get operatingHours {
  if (_operatingHours is EqualUnmodifiableMapView) return _operatingHours;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableMapView(_operatingHours);
}

 final  List<StoreTiming> _storeTimings;
@override@JsonKey() List<StoreTiming> get storeTimings {
  if (_storeTimings is EqualUnmodifiableListView) return _storeTimings;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_storeTimings);
}


/// Create a copy of StoreDTO
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$StoreDTOCopyWith<_StoreDTO> get copyWith => __$StoreDTOCopyWithImpl<_StoreDTO>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$StoreDTOToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _StoreDTO&&(identical(other.id, id) || other.id == id)&&(identical(other.name, name) || other.name == name)&&(identical(other.slug, slug) || other.slug == slug)&&(identical(other.address, address) || other.address == address)&&(identical(other.city, city) || other.city == city)&&(identical(other.state, state) || other.state == state)&&(identical(other.pincode, pincode) || other.pincode == pincode)&&(identical(other.phone, phone) || other.phone == phone)&&(identical(other.email, email) || other.email == email)&&(identical(other.latitude, latitude) || other.latitude == latitude)&&(identical(other.longitude, longitude) || other.longitude == longitude)&&(identical(other.deliveryRadius, deliveryRadius) || other.deliveryRadius == deliveryRadius)&&(identical(other.deliveryFee, deliveryFee) || other.deliveryFee == deliveryFee)&&(identical(other.freeDeliveryAbove, freeDeliveryAbove) || other.freeDeliveryAbove == freeDeliveryAbove)&&(identical(other.minOrderAmount, minOrderAmount) || other.minOrderAmount == minOrderAmount)&&(identical(other.preparationTime, preparationTime) || other.preparationTime == preparationTime)&&(identical(other.isMainStore, isMainStore) || other.isMainStore == isMainStore)&&const DeepCollectionEquality().equals(other._operatingHours, _operatingHours)&&const DeepCollectionEquality().equals(other._storeTimings, _storeTimings));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hashAll([runtimeType,id,name,slug,address,city,state,pincode,phone,email,latitude,longitude,deliveryRadius,deliveryFee,freeDeliveryAbove,minOrderAmount,preparationTime,isMainStore,const DeepCollectionEquality().hash(_operatingHours),const DeepCollectionEquality().hash(_storeTimings)]);

@override
String toString() {
  return 'StoreDTO(id: $id, name: $name, slug: $slug, address: $address, city: $city, state: $state, pincode: $pincode, phone: $phone, email: $email, latitude: $latitude, longitude: $longitude, deliveryRadius: $deliveryRadius, deliveryFee: $deliveryFee, freeDeliveryAbove: $freeDeliveryAbove, minOrderAmount: $minOrderAmount, preparationTime: $preparationTime, isMainStore: $isMainStore, operatingHours: $operatingHours, storeTimings: $storeTimings)';
}


}

/// @nodoc
abstract mixin class _$StoreDTOCopyWith<$Res> implements $StoreDTOCopyWith<$Res> {
  factory _$StoreDTOCopyWith(_StoreDTO value, $Res Function(_StoreDTO) _then) = __$StoreDTOCopyWithImpl;
@override @useResult
$Res call({
 String id, String name, String slug, String? address, String? city, String? state, String? pincode, String? phone, String? email, double? latitude, double? longitude, double? deliveryRadius, double? deliveryFee, double? freeDeliveryAbove, double? minOrderAmount, int? preparationTime, bool isMainStore, Map<String, dynamic> operatingHours, List<StoreTiming> storeTimings
});




}
/// @nodoc
class __$StoreDTOCopyWithImpl<$Res>
    implements _$StoreDTOCopyWith<$Res> {
  __$StoreDTOCopyWithImpl(this._self, this._then);

  final _StoreDTO _self;
  final $Res Function(_StoreDTO) _then;

/// Create a copy of StoreDTO
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? id = null,Object? name = null,Object? slug = null,Object? address = freezed,Object? city = freezed,Object? state = freezed,Object? pincode = freezed,Object? phone = freezed,Object? email = freezed,Object? latitude = freezed,Object? longitude = freezed,Object? deliveryRadius = freezed,Object? deliveryFee = freezed,Object? freeDeliveryAbove = freezed,Object? minOrderAmount = freezed,Object? preparationTime = freezed,Object? isMainStore = null,Object? operatingHours = null,Object? storeTimings = null,}) {
  return _then(_StoreDTO(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,name: null == name ? _self.name : name // ignore: cast_nullable_to_non_nullable
as String,slug: null == slug ? _self.slug : slug // ignore: cast_nullable_to_non_nullable
as String,address: freezed == address ? _self.address : address // ignore: cast_nullable_to_non_nullable
as String?,city: freezed == city ? _self.city : city // ignore: cast_nullable_to_non_nullable
as String?,state: freezed == state ? _self.state : state // ignore: cast_nullable_to_non_nullable
as String?,pincode: freezed == pincode ? _self.pincode : pincode // ignore: cast_nullable_to_non_nullable
as String?,phone: freezed == phone ? _self.phone : phone // ignore: cast_nullable_to_non_nullable
as String?,email: freezed == email ? _self.email : email // ignore: cast_nullable_to_non_nullable
as String?,latitude: freezed == latitude ? _self.latitude : latitude // ignore: cast_nullable_to_non_nullable
as double?,longitude: freezed == longitude ? _self.longitude : longitude // ignore: cast_nullable_to_non_nullable
as double?,deliveryRadius: freezed == deliveryRadius ? _self.deliveryRadius : deliveryRadius // ignore: cast_nullable_to_non_nullable
as double?,deliveryFee: freezed == deliveryFee ? _self.deliveryFee : deliveryFee // ignore: cast_nullable_to_non_nullable
as double?,freeDeliveryAbove: freezed == freeDeliveryAbove ? _self.freeDeliveryAbove : freeDeliveryAbove // ignore: cast_nullable_to_non_nullable
as double?,minOrderAmount: freezed == minOrderAmount ? _self.minOrderAmount : minOrderAmount // ignore: cast_nullable_to_non_nullable
as double?,preparationTime: freezed == preparationTime ? _self.preparationTime : preparationTime // ignore: cast_nullable_to_non_nullable
as int?,isMainStore: null == isMainStore ? _self.isMainStore : isMainStore // ignore: cast_nullable_to_non_nullable
as bool,operatingHours: null == operatingHours ? _self._operatingHours : operatingHours // ignore: cast_nullable_to_non_nullable
as Map<String, dynamic>,storeTimings: null == storeTimings ? _self._storeTimings : storeTimings // ignore: cast_nullable_to_non_nullable
as List<StoreTiming>,
  ));
}


}


/// @nodoc
mixin _$PaymentGatewayDTO {

 String get id; String get name; String get gateway; bool get isTestMode;
/// Create a copy of PaymentGatewayDTO
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$PaymentGatewayDTOCopyWith<PaymentGatewayDTO> get copyWith => _$PaymentGatewayDTOCopyWithImpl<PaymentGatewayDTO>(this as PaymentGatewayDTO, _$identity);

  /// Serializes this PaymentGatewayDTO to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is PaymentGatewayDTO&&(identical(other.id, id) || other.id == id)&&(identical(other.name, name) || other.name == name)&&(identical(other.gateway, gateway) || other.gateway == gateway)&&(identical(other.isTestMode, isTestMode) || other.isTestMode == isTestMode));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,name,gateway,isTestMode);

@override
String toString() {
  return 'PaymentGatewayDTO(id: $id, name: $name, gateway: $gateway, isTestMode: $isTestMode)';
}


}

/// @nodoc
abstract mixin class $PaymentGatewayDTOCopyWith<$Res>  {
  factory $PaymentGatewayDTOCopyWith(PaymentGatewayDTO value, $Res Function(PaymentGatewayDTO) _then) = _$PaymentGatewayDTOCopyWithImpl;
@useResult
$Res call({
 String id, String name, String gateway, bool isTestMode
});




}
/// @nodoc
class _$PaymentGatewayDTOCopyWithImpl<$Res>
    implements $PaymentGatewayDTOCopyWith<$Res> {
  _$PaymentGatewayDTOCopyWithImpl(this._self, this._then);

  final PaymentGatewayDTO _self;
  final $Res Function(PaymentGatewayDTO) _then;

/// Create a copy of PaymentGatewayDTO
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? id = null,Object? name = null,Object? gateway = null,Object? isTestMode = null,}) {
  return _then(_self.copyWith(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,name: null == name ? _self.name : name // ignore: cast_nullable_to_non_nullable
as String,gateway: null == gateway ? _self.gateway : gateway // ignore: cast_nullable_to_non_nullable
as String,isTestMode: null == isTestMode ? _self.isTestMode : isTestMode // ignore: cast_nullable_to_non_nullable
as bool,
  ));
}

}


/// Adds pattern-matching-related methods to [PaymentGatewayDTO].
extension PaymentGatewayDTOPatterns on PaymentGatewayDTO {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _PaymentGatewayDTO value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _PaymentGatewayDTO() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _PaymentGatewayDTO value)  $default,){
final _that = this;
switch (_that) {
case _PaymentGatewayDTO():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _PaymentGatewayDTO value)?  $default,){
final _that = this;
switch (_that) {
case _PaymentGatewayDTO() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String id,  String name,  String gateway,  bool isTestMode)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _PaymentGatewayDTO() when $default != null:
return $default(_that.id,_that.name,_that.gateway,_that.isTestMode);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String id,  String name,  String gateway,  bool isTestMode)  $default,) {final _that = this;
switch (_that) {
case _PaymentGatewayDTO():
return $default(_that.id,_that.name,_that.gateway,_that.isTestMode);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String id,  String name,  String gateway,  bool isTestMode)?  $default,) {final _that = this;
switch (_that) {
case _PaymentGatewayDTO() when $default != null:
return $default(_that.id,_that.name,_that.gateway,_that.isTestMode);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _PaymentGatewayDTO implements PaymentGatewayDTO {
  const _PaymentGatewayDTO({required this.id, required this.name, required this.gateway, this.isTestMode = false});
  factory _PaymentGatewayDTO.fromJson(Map<String, dynamic> json) => _$PaymentGatewayDTOFromJson(json);

@override final  String id;
@override final  String name;
@override final  String gateway;
@override@JsonKey() final  bool isTestMode;

/// Create a copy of PaymentGatewayDTO
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$PaymentGatewayDTOCopyWith<_PaymentGatewayDTO> get copyWith => __$PaymentGatewayDTOCopyWithImpl<_PaymentGatewayDTO>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$PaymentGatewayDTOToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _PaymentGatewayDTO&&(identical(other.id, id) || other.id == id)&&(identical(other.name, name) || other.name == name)&&(identical(other.gateway, gateway) || other.gateway == gateway)&&(identical(other.isTestMode, isTestMode) || other.isTestMode == isTestMode));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,name,gateway,isTestMode);

@override
String toString() {
  return 'PaymentGatewayDTO(id: $id, name: $name, gateway: $gateway, isTestMode: $isTestMode)';
}


}

/// @nodoc
abstract mixin class _$PaymentGatewayDTOCopyWith<$Res> implements $PaymentGatewayDTOCopyWith<$Res> {
  factory _$PaymentGatewayDTOCopyWith(_PaymentGatewayDTO value, $Res Function(_PaymentGatewayDTO) _then) = __$PaymentGatewayDTOCopyWithImpl;
@override @useResult
$Res call({
 String id, String name, String gateway, bool isTestMode
});




}
/// @nodoc
class __$PaymentGatewayDTOCopyWithImpl<$Res>
    implements _$PaymentGatewayDTOCopyWith<$Res> {
  __$PaymentGatewayDTOCopyWithImpl(this._self, this._then);

  final _PaymentGatewayDTO _self;
  final $Res Function(_PaymentGatewayDTO) _then;

/// Create a copy of PaymentGatewayDTO
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? id = null,Object? name = null,Object? gateway = null,Object? isTestMode = null,}) {
  return _then(_PaymentGatewayDTO(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,name: null == name ? _self.name : name // ignore: cast_nullable_to_non_nullable
as String,gateway: null == gateway ? _self.gateway : gateway // ignore: cast_nullable_to_non_nullable
as String,isTestMode: null == isTestMode ? _self.isTestMode : isTestMode // ignore: cast_nullable_to_non_nullable
as bool,
  ));
}


}


/// @nodoc
mixin _$BusinessBranding {

 String get id; String get name; String get slug; String get businessType; bool get isOnline; String? get logo; String? get favicon; String? get primaryColor; String? get secondaryColor; bool get darkMode; String? get tagline; String? get description; String? get contactEmail; String? get contactPhone; String? get supportEmail; String? get supportPhone;
/// Create a copy of BusinessBranding
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$BusinessBrandingCopyWith<BusinessBranding> get copyWith => _$BusinessBrandingCopyWithImpl<BusinessBranding>(this as BusinessBranding, _$identity);

  /// Serializes this BusinessBranding to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is BusinessBranding&&(identical(other.id, id) || other.id == id)&&(identical(other.name, name) || other.name == name)&&(identical(other.slug, slug) || other.slug == slug)&&(identical(other.businessType, businessType) || other.businessType == businessType)&&(identical(other.isOnline, isOnline) || other.isOnline == isOnline)&&(identical(other.logo, logo) || other.logo == logo)&&(identical(other.favicon, favicon) || other.favicon == favicon)&&(identical(other.primaryColor, primaryColor) || other.primaryColor == primaryColor)&&(identical(other.secondaryColor, secondaryColor) || other.secondaryColor == secondaryColor)&&(identical(other.darkMode, darkMode) || other.darkMode == darkMode)&&(identical(other.tagline, tagline) || other.tagline == tagline)&&(identical(other.description, description) || other.description == description)&&(identical(other.contactEmail, contactEmail) || other.contactEmail == contactEmail)&&(identical(other.contactPhone, contactPhone) || other.contactPhone == contactPhone)&&(identical(other.supportEmail, supportEmail) || other.supportEmail == supportEmail)&&(identical(other.supportPhone, supportPhone) || other.supportPhone == supportPhone));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,name,slug,businessType,isOnline,logo,favicon,primaryColor,secondaryColor,darkMode,tagline,description,contactEmail,contactPhone,supportEmail,supportPhone);

@override
String toString() {
  return 'BusinessBranding(id: $id, name: $name, slug: $slug, businessType: $businessType, isOnline: $isOnline, logo: $logo, favicon: $favicon, primaryColor: $primaryColor, secondaryColor: $secondaryColor, darkMode: $darkMode, tagline: $tagline, description: $description, contactEmail: $contactEmail, contactPhone: $contactPhone, supportEmail: $supportEmail, supportPhone: $supportPhone)';
}


}

/// @nodoc
abstract mixin class $BusinessBrandingCopyWith<$Res>  {
  factory $BusinessBrandingCopyWith(BusinessBranding value, $Res Function(BusinessBranding) _then) = _$BusinessBrandingCopyWithImpl;
@useResult
$Res call({
 String id, String name, String slug, String businessType, bool isOnline, String? logo, String? favicon, String? primaryColor, String? secondaryColor, bool darkMode, String? tagline, String? description, String? contactEmail, String? contactPhone, String? supportEmail, String? supportPhone
});




}
/// @nodoc
class _$BusinessBrandingCopyWithImpl<$Res>
    implements $BusinessBrandingCopyWith<$Res> {
  _$BusinessBrandingCopyWithImpl(this._self, this._then);

  final BusinessBranding _self;
  final $Res Function(BusinessBranding) _then;

/// Create a copy of BusinessBranding
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? id = null,Object? name = null,Object? slug = null,Object? businessType = null,Object? isOnline = null,Object? logo = freezed,Object? favicon = freezed,Object? primaryColor = freezed,Object? secondaryColor = freezed,Object? darkMode = null,Object? tagline = freezed,Object? description = freezed,Object? contactEmail = freezed,Object? contactPhone = freezed,Object? supportEmail = freezed,Object? supportPhone = freezed,}) {
  return _then(_self.copyWith(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,name: null == name ? _self.name : name // ignore: cast_nullable_to_non_nullable
as String,slug: null == slug ? _self.slug : slug // ignore: cast_nullable_to_non_nullable
as String,businessType: null == businessType ? _self.businessType : businessType // ignore: cast_nullable_to_non_nullable
as String,isOnline: null == isOnline ? _self.isOnline : isOnline // ignore: cast_nullable_to_non_nullable
as bool,logo: freezed == logo ? _self.logo : logo // ignore: cast_nullable_to_non_nullable
as String?,favicon: freezed == favicon ? _self.favicon : favicon // ignore: cast_nullable_to_non_nullable
as String?,primaryColor: freezed == primaryColor ? _self.primaryColor : primaryColor // ignore: cast_nullable_to_non_nullable
as String?,secondaryColor: freezed == secondaryColor ? _self.secondaryColor : secondaryColor // ignore: cast_nullable_to_non_nullable
as String?,darkMode: null == darkMode ? _self.darkMode : darkMode // ignore: cast_nullable_to_non_nullable
as bool,tagline: freezed == tagline ? _self.tagline : tagline // ignore: cast_nullable_to_non_nullable
as String?,description: freezed == description ? _self.description : description // ignore: cast_nullable_to_non_nullable
as String?,contactEmail: freezed == contactEmail ? _self.contactEmail : contactEmail // ignore: cast_nullable_to_non_nullable
as String?,contactPhone: freezed == contactPhone ? _self.contactPhone : contactPhone // ignore: cast_nullable_to_non_nullable
as String?,supportEmail: freezed == supportEmail ? _self.supportEmail : supportEmail // ignore: cast_nullable_to_non_nullable
as String?,supportPhone: freezed == supportPhone ? _self.supportPhone : supportPhone // ignore: cast_nullable_to_non_nullable
as String?,
  ));
}

}


/// Adds pattern-matching-related methods to [BusinessBranding].
extension BusinessBrandingPatterns on BusinessBranding {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _BusinessBranding value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _BusinessBranding() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _BusinessBranding value)  $default,){
final _that = this;
switch (_that) {
case _BusinessBranding():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _BusinessBranding value)?  $default,){
final _that = this;
switch (_that) {
case _BusinessBranding() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String id,  String name,  String slug,  String businessType,  bool isOnline,  String? logo,  String? favicon,  String? primaryColor,  String? secondaryColor,  bool darkMode,  String? tagline,  String? description,  String? contactEmail,  String? contactPhone,  String? supportEmail,  String? supportPhone)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _BusinessBranding() when $default != null:
return $default(_that.id,_that.name,_that.slug,_that.businessType,_that.isOnline,_that.logo,_that.favicon,_that.primaryColor,_that.secondaryColor,_that.darkMode,_that.tagline,_that.description,_that.contactEmail,_that.contactPhone,_that.supportEmail,_that.supportPhone);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String id,  String name,  String slug,  String businessType,  bool isOnline,  String? logo,  String? favicon,  String? primaryColor,  String? secondaryColor,  bool darkMode,  String? tagline,  String? description,  String? contactEmail,  String? contactPhone,  String? supportEmail,  String? supportPhone)  $default,) {final _that = this;
switch (_that) {
case _BusinessBranding():
return $default(_that.id,_that.name,_that.slug,_that.businessType,_that.isOnline,_that.logo,_that.favicon,_that.primaryColor,_that.secondaryColor,_that.darkMode,_that.tagline,_that.description,_that.contactEmail,_that.contactPhone,_that.supportEmail,_that.supportPhone);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String id,  String name,  String slug,  String businessType,  bool isOnline,  String? logo,  String? favicon,  String? primaryColor,  String? secondaryColor,  bool darkMode,  String? tagline,  String? description,  String? contactEmail,  String? contactPhone,  String? supportEmail,  String? supportPhone)?  $default,) {final _that = this;
switch (_that) {
case _BusinessBranding() when $default != null:
return $default(_that.id,_that.name,_that.slug,_that.businessType,_that.isOnline,_that.logo,_that.favicon,_that.primaryColor,_that.secondaryColor,_that.darkMode,_that.tagline,_that.description,_that.contactEmail,_that.contactPhone,_that.supportEmail,_that.supportPhone);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _BusinessBranding implements BusinessBranding {
  const _BusinessBranding({required this.id, required this.name, required this.slug, required this.businessType, this.isOnline = true, this.logo, this.favicon, this.primaryColor, this.secondaryColor, this.darkMode = false, this.tagline, this.description, this.contactEmail, this.contactPhone, this.supportEmail, this.supportPhone});
  factory _BusinessBranding.fromJson(Map<String, dynamic> json) => _$BusinessBrandingFromJson(json);

@override final  String id;
@override final  String name;
@override final  String slug;
@override final  String businessType;
@override@JsonKey() final  bool isOnline;
@override final  String? logo;
@override final  String? favicon;
@override final  String? primaryColor;
@override final  String? secondaryColor;
@override@JsonKey() final  bool darkMode;
@override final  String? tagline;
@override final  String? description;
@override final  String? contactEmail;
@override final  String? contactPhone;
@override final  String? supportEmail;
@override final  String? supportPhone;

/// Create a copy of BusinessBranding
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$BusinessBrandingCopyWith<_BusinessBranding> get copyWith => __$BusinessBrandingCopyWithImpl<_BusinessBranding>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$BusinessBrandingToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _BusinessBranding&&(identical(other.id, id) || other.id == id)&&(identical(other.name, name) || other.name == name)&&(identical(other.slug, slug) || other.slug == slug)&&(identical(other.businessType, businessType) || other.businessType == businessType)&&(identical(other.isOnline, isOnline) || other.isOnline == isOnline)&&(identical(other.logo, logo) || other.logo == logo)&&(identical(other.favicon, favicon) || other.favicon == favicon)&&(identical(other.primaryColor, primaryColor) || other.primaryColor == primaryColor)&&(identical(other.secondaryColor, secondaryColor) || other.secondaryColor == secondaryColor)&&(identical(other.darkMode, darkMode) || other.darkMode == darkMode)&&(identical(other.tagline, tagline) || other.tagline == tagline)&&(identical(other.description, description) || other.description == description)&&(identical(other.contactEmail, contactEmail) || other.contactEmail == contactEmail)&&(identical(other.contactPhone, contactPhone) || other.contactPhone == contactPhone)&&(identical(other.supportEmail, supportEmail) || other.supportEmail == supportEmail)&&(identical(other.supportPhone, supportPhone) || other.supportPhone == supportPhone));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,name,slug,businessType,isOnline,logo,favicon,primaryColor,secondaryColor,darkMode,tagline,description,contactEmail,contactPhone,supportEmail,supportPhone);

@override
String toString() {
  return 'BusinessBranding(id: $id, name: $name, slug: $slug, businessType: $businessType, isOnline: $isOnline, logo: $logo, favicon: $favicon, primaryColor: $primaryColor, secondaryColor: $secondaryColor, darkMode: $darkMode, tagline: $tagline, description: $description, contactEmail: $contactEmail, contactPhone: $contactPhone, supportEmail: $supportEmail, supportPhone: $supportPhone)';
}


}

/// @nodoc
abstract mixin class _$BusinessBrandingCopyWith<$Res> implements $BusinessBrandingCopyWith<$Res> {
  factory _$BusinessBrandingCopyWith(_BusinessBranding value, $Res Function(_BusinessBranding) _then) = __$BusinessBrandingCopyWithImpl;
@override @useResult
$Res call({
 String id, String name, String slug, String businessType, bool isOnline, String? logo, String? favicon, String? primaryColor, String? secondaryColor, bool darkMode, String? tagline, String? description, String? contactEmail, String? contactPhone, String? supportEmail, String? supportPhone
});




}
/// @nodoc
class __$BusinessBrandingCopyWithImpl<$Res>
    implements _$BusinessBrandingCopyWith<$Res> {
  __$BusinessBrandingCopyWithImpl(this._self, this._then);

  final _BusinessBranding _self;
  final $Res Function(_BusinessBranding) _then;

/// Create a copy of BusinessBranding
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? id = null,Object? name = null,Object? slug = null,Object? businessType = null,Object? isOnline = null,Object? logo = freezed,Object? favicon = freezed,Object? primaryColor = freezed,Object? secondaryColor = freezed,Object? darkMode = null,Object? tagline = freezed,Object? description = freezed,Object? contactEmail = freezed,Object? contactPhone = freezed,Object? supportEmail = freezed,Object? supportPhone = freezed,}) {
  return _then(_BusinessBranding(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,name: null == name ? _self.name : name // ignore: cast_nullable_to_non_nullable
as String,slug: null == slug ? _self.slug : slug // ignore: cast_nullable_to_non_nullable
as String,businessType: null == businessType ? _self.businessType : businessType // ignore: cast_nullable_to_non_nullable
as String,isOnline: null == isOnline ? _self.isOnline : isOnline // ignore: cast_nullable_to_non_nullable
as bool,logo: freezed == logo ? _self.logo : logo // ignore: cast_nullable_to_non_nullable
as String?,favicon: freezed == favicon ? _self.favicon : favicon // ignore: cast_nullable_to_non_nullable
as String?,primaryColor: freezed == primaryColor ? _self.primaryColor : primaryColor // ignore: cast_nullable_to_non_nullable
as String?,secondaryColor: freezed == secondaryColor ? _self.secondaryColor : secondaryColor // ignore: cast_nullable_to_non_nullable
as String?,darkMode: null == darkMode ? _self.darkMode : darkMode // ignore: cast_nullable_to_non_nullable
as bool,tagline: freezed == tagline ? _self.tagline : tagline // ignore: cast_nullable_to_non_nullable
as String?,description: freezed == description ? _self.description : description // ignore: cast_nullable_to_non_nullable
as String?,contactEmail: freezed == contactEmail ? _self.contactEmail : contactEmail // ignore: cast_nullable_to_non_nullable
as String?,contactPhone: freezed == contactPhone ? _self.contactPhone : contactPhone // ignore: cast_nullable_to_non_nullable
as String?,supportEmail: freezed == supportEmail ? _self.supportEmail : supportEmail // ignore: cast_nullable_to_non_nullable
as String?,supportPhone: freezed == supportPhone ? _self.supportPhone : supportPhone // ignore: cast_nullable_to_non_nullable
as String?,
  ));
}


}


/// @nodoc
mixin _$StoreContextDTO {

 BusinessBranding get business; StoreDTO? get store; Map<String, dynamic> get ecommerceConfig; bool get allowGuestCheckout; List<Map<String, dynamic>> get orderStages; List<PaymentGatewayDTO> get paymentGateways;
/// Create a copy of StoreContextDTO
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$StoreContextDTOCopyWith<StoreContextDTO> get copyWith => _$StoreContextDTOCopyWithImpl<StoreContextDTO>(this as StoreContextDTO, _$identity);

  /// Serializes this StoreContextDTO to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is StoreContextDTO&&(identical(other.business, business) || other.business == business)&&(identical(other.store, store) || other.store == store)&&const DeepCollectionEquality().equals(other.ecommerceConfig, ecommerceConfig)&&(identical(other.allowGuestCheckout, allowGuestCheckout) || other.allowGuestCheckout == allowGuestCheckout)&&const DeepCollectionEquality().equals(other.orderStages, orderStages)&&const DeepCollectionEquality().equals(other.paymentGateways, paymentGateways));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,business,store,const DeepCollectionEquality().hash(ecommerceConfig),allowGuestCheckout,const DeepCollectionEquality().hash(orderStages),const DeepCollectionEquality().hash(paymentGateways));

@override
String toString() {
  return 'StoreContextDTO(business: $business, store: $store, ecommerceConfig: $ecommerceConfig, allowGuestCheckout: $allowGuestCheckout, orderStages: $orderStages, paymentGateways: $paymentGateways)';
}


}

/// @nodoc
abstract mixin class $StoreContextDTOCopyWith<$Res>  {
  factory $StoreContextDTOCopyWith(StoreContextDTO value, $Res Function(StoreContextDTO) _then) = _$StoreContextDTOCopyWithImpl;
@useResult
$Res call({
 BusinessBranding business, StoreDTO? store, Map<String, dynamic> ecommerceConfig, bool allowGuestCheckout, List<Map<String, dynamic>> orderStages, List<PaymentGatewayDTO> paymentGateways
});


$BusinessBrandingCopyWith<$Res> get business;$StoreDTOCopyWith<$Res>? get store;

}
/// @nodoc
class _$StoreContextDTOCopyWithImpl<$Res>
    implements $StoreContextDTOCopyWith<$Res> {
  _$StoreContextDTOCopyWithImpl(this._self, this._then);

  final StoreContextDTO _self;
  final $Res Function(StoreContextDTO) _then;

/// Create a copy of StoreContextDTO
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? business = null,Object? store = freezed,Object? ecommerceConfig = null,Object? allowGuestCheckout = null,Object? orderStages = null,Object? paymentGateways = null,}) {
  return _then(_self.copyWith(
business: null == business ? _self.business : business // ignore: cast_nullable_to_non_nullable
as BusinessBranding,store: freezed == store ? _self.store : store // ignore: cast_nullable_to_non_nullable
as StoreDTO?,ecommerceConfig: null == ecommerceConfig ? _self.ecommerceConfig : ecommerceConfig // ignore: cast_nullable_to_non_nullable
as Map<String, dynamic>,allowGuestCheckout: null == allowGuestCheckout ? _self.allowGuestCheckout : allowGuestCheckout // ignore: cast_nullable_to_non_nullable
as bool,orderStages: null == orderStages ? _self.orderStages : orderStages // ignore: cast_nullable_to_non_nullable
as List<Map<String, dynamic>>,paymentGateways: null == paymentGateways ? _self.paymentGateways : paymentGateways // ignore: cast_nullable_to_non_nullable
as List<PaymentGatewayDTO>,
  ));
}
/// Create a copy of StoreContextDTO
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$BusinessBrandingCopyWith<$Res> get business {
  
  return $BusinessBrandingCopyWith<$Res>(_self.business, (value) {
    return _then(_self.copyWith(business: value));
  });
}/// Create a copy of StoreContextDTO
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$StoreDTOCopyWith<$Res>? get store {
    if (_self.store == null) {
    return null;
  }

  return $StoreDTOCopyWith<$Res>(_self.store!, (value) {
    return _then(_self.copyWith(store: value));
  });
}
}


/// Adds pattern-matching-related methods to [StoreContextDTO].
extension StoreContextDTOPatterns on StoreContextDTO {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _StoreContextDTO value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _StoreContextDTO() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _StoreContextDTO value)  $default,){
final _that = this;
switch (_that) {
case _StoreContextDTO():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _StoreContextDTO value)?  $default,){
final _that = this;
switch (_that) {
case _StoreContextDTO() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( BusinessBranding business,  StoreDTO? store,  Map<String, dynamic> ecommerceConfig,  bool allowGuestCheckout,  List<Map<String, dynamic>> orderStages,  List<PaymentGatewayDTO> paymentGateways)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _StoreContextDTO() when $default != null:
return $default(_that.business,_that.store,_that.ecommerceConfig,_that.allowGuestCheckout,_that.orderStages,_that.paymentGateways);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( BusinessBranding business,  StoreDTO? store,  Map<String, dynamic> ecommerceConfig,  bool allowGuestCheckout,  List<Map<String, dynamic>> orderStages,  List<PaymentGatewayDTO> paymentGateways)  $default,) {final _that = this;
switch (_that) {
case _StoreContextDTO():
return $default(_that.business,_that.store,_that.ecommerceConfig,_that.allowGuestCheckout,_that.orderStages,_that.paymentGateways);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( BusinessBranding business,  StoreDTO? store,  Map<String, dynamic> ecommerceConfig,  bool allowGuestCheckout,  List<Map<String, dynamic>> orderStages,  List<PaymentGatewayDTO> paymentGateways)?  $default,) {final _that = this;
switch (_that) {
case _StoreContextDTO() when $default != null:
return $default(_that.business,_that.store,_that.ecommerceConfig,_that.allowGuestCheckout,_that.orderStages,_that.paymentGateways);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _StoreContextDTO implements StoreContextDTO {
  const _StoreContextDTO({required this.business, this.store, final  Map<String, dynamic> ecommerceConfig = const {}, this.allowGuestCheckout = true, final  List<Map<String, dynamic>> orderStages = const [], final  List<PaymentGatewayDTO> paymentGateways = const []}): _ecommerceConfig = ecommerceConfig,_orderStages = orderStages,_paymentGateways = paymentGateways;
  factory _StoreContextDTO.fromJson(Map<String, dynamic> json) => _$StoreContextDTOFromJson(json);

@override final  BusinessBranding business;
@override final  StoreDTO? store;
 final  Map<String, dynamic> _ecommerceConfig;
@override@JsonKey() Map<String, dynamic> get ecommerceConfig {
  if (_ecommerceConfig is EqualUnmodifiableMapView) return _ecommerceConfig;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableMapView(_ecommerceConfig);
}

@override@JsonKey() final  bool allowGuestCheckout;
 final  List<Map<String, dynamic>> _orderStages;
@override@JsonKey() List<Map<String, dynamic>> get orderStages {
  if (_orderStages is EqualUnmodifiableListView) return _orderStages;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_orderStages);
}

 final  List<PaymentGatewayDTO> _paymentGateways;
@override@JsonKey() List<PaymentGatewayDTO> get paymentGateways {
  if (_paymentGateways is EqualUnmodifiableListView) return _paymentGateways;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_paymentGateways);
}


/// Create a copy of StoreContextDTO
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$StoreContextDTOCopyWith<_StoreContextDTO> get copyWith => __$StoreContextDTOCopyWithImpl<_StoreContextDTO>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$StoreContextDTOToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _StoreContextDTO&&(identical(other.business, business) || other.business == business)&&(identical(other.store, store) || other.store == store)&&const DeepCollectionEquality().equals(other._ecommerceConfig, _ecommerceConfig)&&(identical(other.allowGuestCheckout, allowGuestCheckout) || other.allowGuestCheckout == allowGuestCheckout)&&const DeepCollectionEquality().equals(other._orderStages, _orderStages)&&const DeepCollectionEquality().equals(other._paymentGateways, _paymentGateways));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,business,store,const DeepCollectionEquality().hash(_ecommerceConfig),allowGuestCheckout,const DeepCollectionEquality().hash(_orderStages),const DeepCollectionEquality().hash(_paymentGateways));

@override
String toString() {
  return 'StoreContextDTO(business: $business, store: $store, ecommerceConfig: $ecommerceConfig, allowGuestCheckout: $allowGuestCheckout, orderStages: $orderStages, paymentGateways: $paymentGateways)';
}


}

/// @nodoc
abstract mixin class _$StoreContextDTOCopyWith<$Res> implements $StoreContextDTOCopyWith<$Res> {
  factory _$StoreContextDTOCopyWith(_StoreContextDTO value, $Res Function(_StoreContextDTO) _then) = __$StoreContextDTOCopyWithImpl;
@override @useResult
$Res call({
 BusinessBranding business, StoreDTO? store, Map<String, dynamic> ecommerceConfig, bool allowGuestCheckout, List<Map<String, dynamic>> orderStages, List<PaymentGatewayDTO> paymentGateways
});


@override $BusinessBrandingCopyWith<$Res> get business;@override $StoreDTOCopyWith<$Res>? get store;

}
/// @nodoc
class __$StoreContextDTOCopyWithImpl<$Res>
    implements _$StoreContextDTOCopyWith<$Res> {
  __$StoreContextDTOCopyWithImpl(this._self, this._then);

  final _StoreContextDTO _self;
  final $Res Function(_StoreContextDTO) _then;

/// Create a copy of StoreContextDTO
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? business = null,Object? store = freezed,Object? ecommerceConfig = null,Object? allowGuestCheckout = null,Object? orderStages = null,Object? paymentGateways = null,}) {
  return _then(_StoreContextDTO(
business: null == business ? _self.business : business // ignore: cast_nullable_to_non_nullable
as BusinessBranding,store: freezed == store ? _self.store : store // ignore: cast_nullable_to_non_nullable
as StoreDTO?,ecommerceConfig: null == ecommerceConfig ? _self._ecommerceConfig : ecommerceConfig // ignore: cast_nullable_to_non_nullable
as Map<String, dynamic>,allowGuestCheckout: null == allowGuestCheckout ? _self.allowGuestCheckout : allowGuestCheckout // ignore: cast_nullable_to_non_nullable
as bool,orderStages: null == orderStages ? _self._orderStages : orderStages // ignore: cast_nullable_to_non_nullable
as List<Map<String, dynamic>>,paymentGateways: null == paymentGateways ? _self._paymentGateways : paymentGateways // ignore: cast_nullable_to_non_nullable
as List<PaymentGatewayDTO>,
  ));
}

/// Create a copy of StoreContextDTO
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$BusinessBrandingCopyWith<$Res> get business {
  
  return $BusinessBrandingCopyWith<$Res>(_self.business, (value) {
    return _then(_self.copyWith(business: value));
  });
}/// Create a copy of StoreContextDTO
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$StoreDTOCopyWith<$Res>? get store {
    if (_self.store == null) {
    return null;
  }

  return $StoreDTOCopyWith<$Res>(_self.store!, (value) {
    return _then(_self.copyWith(store: value));
  });
}
}


/// @nodoc
mixin _$AppVersionDTO {

 String get platform; String get version; String get minVersion; bool get forceUpdate; String? get changelogUrl; String? get releaseNotes; String get publishedAt;
/// Create a copy of AppVersionDTO
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$AppVersionDTOCopyWith<AppVersionDTO> get copyWith => _$AppVersionDTOCopyWithImpl<AppVersionDTO>(this as AppVersionDTO, _$identity);

  /// Serializes this AppVersionDTO to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is AppVersionDTO&&(identical(other.platform, platform) || other.platform == platform)&&(identical(other.version, version) || other.version == version)&&(identical(other.minVersion, minVersion) || other.minVersion == minVersion)&&(identical(other.forceUpdate, forceUpdate) || other.forceUpdate == forceUpdate)&&(identical(other.changelogUrl, changelogUrl) || other.changelogUrl == changelogUrl)&&(identical(other.releaseNotes, releaseNotes) || other.releaseNotes == releaseNotes)&&(identical(other.publishedAt, publishedAt) || other.publishedAt == publishedAt));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,platform,version,minVersion,forceUpdate,changelogUrl,releaseNotes,publishedAt);

@override
String toString() {
  return 'AppVersionDTO(platform: $platform, version: $version, minVersion: $minVersion, forceUpdate: $forceUpdate, changelogUrl: $changelogUrl, releaseNotes: $releaseNotes, publishedAt: $publishedAt)';
}


}

/// @nodoc
abstract mixin class $AppVersionDTOCopyWith<$Res>  {
  factory $AppVersionDTOCopyWith(AppVersionDTO value, $Res Function(AppVersionDTO) _then) = _$AppVersionDTOCopyWithImpl;
@useResult
$Res call({
 String platform, String version, String minVersion, bool forceUpdate, String? changelogUrl, String? releaseNotes, String publishedAt
});




}
/// @nodoc
class _$AppVersionDTOCopyWithImpl<$Res>
    implements $AppVersionDTOCopyWith<$Res> {
  _$AppVersionDTOCopyWithImpl(this._self, this._then);

  final AppVersionDTO _self;
  final $Res Function(AppVersionDTO) _then;

/// Create a copy of AppVersionDTO
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? platform = null,Object? version = null,Object? minVersion = null,Object? forceUpdate = null,Object? changelogUrl = freezed,Object? releaseNotes = freezed,Object? publishedAt = null,}) {
  return _then(_self.copyWith(
platform: null == platform ? _self.platform : platform // ignore: cast_nullable_to_non_nullable
as String,version: null == version ? _self.version : version // ignore: cast_nullable_to_non_nullable
as String,minVersion: null == minVersion ? _self.minVersion : minVersion // ignore: cast_nullable_to_non_nullable
as String,forceUpdate: null == forceUpdate ? _self.forceUpdate : forceUpdate // ignore: cast_nullable_to_non_nullable
as bool,changelogUrl: freezed == changelogUrl ? _self.changelogUrl : changelogUrl // ignore: cast_nullable_to_non_nullable
as String?,releaseNotes: freezed == releaseNotes ? _self.releaseNotes : releaseNotes // ignore: cast_nullable_to_non_nullable
as String?,publishedAt: null == publishedAt ? _self.publishedAt : publishedAt // ignore: cast_nullable_to_non_nullable
as String,
  ));
}

}


/// Adds pattern-matching-related methods to [AppVersionDTO].
extension AppVersionDTOPatterns on AppVersionDTO {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _AppVersionDTO value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _AppVersionDTO() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _AppVersionDTO value)  $default,){
final _that = this;
switch (_that) {
case _AppVersionDTO():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _AppVersionDTO value)?  $default,){
final _that = this;
switch (_that) {
case _AppVersionDTO() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String platform,  String version,  String minVersion,  bool forceUpdate,  String? changelogUrl,  String? releaseNotes,  String publishedAt)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _AppVersionDTO() when $default != null:
return $default(_that.platform,_that.version,_that.minVersion,_that.forceUpdate,_that.changelogUrl,_that.releaseNotes,_that.publishedAt);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String platform,  String version,  String minVersion,  bool forceUpdate,  String? changelogUrl,  String? releaseNotes,  String publishedAt)  $default,) {final _that = this;
switch (_that) {
case _AppVersionDTO():
return $default(_that.platform,_that.version,_that.minVersion,_that.forceUpdate,_that.changelogUrl,_that.releaseNotes,_that.publishedAt);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String platform,  String version,  String minVersion,  bool forceUpdate,  String? changelogUrl,  String? releaseNotes,  String publishedAt)?  $default,) {final _that = this;
switch (_that) {
case _AppVersionDTO() when $default != null:
return $default(_that.platform,_that.version,_that.minVersion,_that.forceUpdate,_that.changelogUrl,_that.releaseNotes,_that.publishedAt);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _AppVersionDTO implements AppVersionDTO {
  const _AppVersionDTO({required this.platform, required this.version, required this.minVersion, this.forceUpdate = false, this.changelogUrl, this.releaseNotes, required this.publishedAt});
  factory _AppVersionDTO.fromJson(Map<String, dynamic> json) => _$AppVersionDTOFromJson(json);

@override final  String platform;
@override final  String version;
@override final  String minVersion;
@override@JsonKey() final  bool forceUpdate;
@override final  String? changelogUrl;
@override final  String? releaseNotes;
@override final  String publishedAt;

/// Create a copy of AppVersionDTO
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$AppVersionDTOCopyWith<_AppVersionDTO> get copyWith => __$AppVersionDTOCopyWithImpl<_AppVersionDTO>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$AppVersionDTOToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _AppVersionDTO&&(identical(other.platform, platform) || other.platform == platform)&&(identical(other.version, version) || other.version == version)&&(identical(other.minVersion, minVersion) || other.minVersion == minVersion)&&(identical(other.forceUpdate, forceUpdate) || other.forceUpdate == forceUpdate)&&(identical(other.changelogUrl, changelogUrl) || other.changelogUrl == changelogUrl)&&(identical(other.releaseNotes, releaseNotes) || other.releaseNotes == releaseNotes)&&(identical(other.publishedAt, publishedAt) || other.publishedAt == publishedAt));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,platform,version,minVersion,forceUpdate,changelogUrl,releaseNotes,publishedAt);

@override
String toString() {
  return 'AppVersionDTO(platform: $platform, version: $version, minVersion: $minVersion, forceUpdate: $forceUpdate, changelogUrl: $changelogUrl, releaseNotes: $releaseNotes, publishedAt: $publishedAt)';
}


}

/// @nodoc
abstract mixin class _$AppVersionDTOCopyWith<$Res> implements $AppVersionDTOCopyWith<$Res> {
  factory _$AppVersionDTOCopyWith(_AppVersionDTO value, $Res Function(_AppVersionDTO) _then) = __$AppVersionDTOCopyWithImpl;
@override @useResult
$Res call({
 String platform, String version, String minVersion, bool forceUpdate, String? changelogUrl, String? releaseNotes, String publishedAt
});




}
/// @nodoc
class __$AppVersionDTOCopyWithImpl<$Res>
    implements _$AppVersionDTOCopyWith<$Res> {
  __$AppVersionDTOCopyWithImpl(this._self, this._then);

  final _AppVersionDTO _self;
  final $Res Function(_AppVersionDTO) _then;

/// Create a copy of AppVersionDTO
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? platform = null,Object? version = null,Object? minVersion = null,Object? forceUpdate = null,Object? changelogUrl = freezed,Object? releaseNotes = freezed,Object? publishedAt = null,}) {
  return _then(_AppVersionDTO(
platform: null == platform ? _self.platform : platform // ignore: cast_nullable_to_non_nullable
as String,version: null == version ? _self.version : version // ignore: cast_nullable_to_non_nullable
as String,minVersion: null == minVersion ? _self.minVersion : minVersion // ignore: cast_nullable_to_non_nullable
as String,forceUpdate: null == forceUpdate ? _self.forceUpdate : forceUpdate // ignore: cast_nullable_to_non_nullable
as bool,changelogUrl: freezed == changelogUrl ? _self.changelogUrl : changelogUrl // ignore: cast_nullable_to_non_nullable
as String?,releaseNotes: freezed == releaseNotes ? _self.releaseNotes : releaseNotes // ignore: cast_nullable_to_non_nullable
as String?,publishedAt: null == publishedAt ? _self.publishedAt : publishedAt // ignore: cast_nullable_to_non_nullable
as String,
  ));
}


}

// dart format on
