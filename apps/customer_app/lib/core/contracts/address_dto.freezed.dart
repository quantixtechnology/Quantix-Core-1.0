// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'address_dto.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// dart format off
T _$identity<T>(T value) => value;

/// @nodoc
mixin _$AddressDTO {

 String get id; String get customerId; String get addressLine1; String get city; String get pincode; String get country; String get state; bool get isDefault; String get createdAt; String get updatedAt; String? get label; String? get area; String? get addressLine2; String? get landmark; String? get instructions; double? get latitude; double? get longitude; double? get gpsAccuracy;
/// Create a copy of AddressDTO
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$AddressDTOCopyWith<AddressDTO> get copyWith => _$AddressDTOCopyWithImpl<AddressDTO>(this as AddressDTO, _$identity);

  /// Serializes this AddressDTO to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is AddressDTO&&(identical(other.id, id) || other.id == id)&&(identical(other.customerId, customerId) || other.customerId == customerId)&&(identical(other.addressLine1, addressLine1) || other.addressLine1 == addressLine1)&&(identical(other.city, city) || other.city == city)&&(identical(other.pincode, pincode) || other.pincode == pincode)&&(identical(other.country, country) || other.country == country)&&(identical(other.state, state) || other.state == state)&&(identical(other.isDefault, isDefault) || other.isDefault == isDefault)&&(identical(other.createdAt, createdAt) || other.createdAt == createdAt)&&(identical(other.updatedAt, updatedAt) || other.updatedAt == updatedAt)&&(identical(other.label, label) || other.label == label)&&(identical(other.area, area) || other.area == area)&&(identical(other.addressLine2, addressLine2) || other.addressLine2 == addressLine2)&&(identical(other.landmark, landmark) || other.landmark == landmark)&&(identical(other.instructions, instructions) || other.instructions == instructions)&&(identical(other.latitude, latitude) || other.latitude == latitude)&&(identical(other.longitude, longitude) || other.longitude == longitude)&&(identical(other.gpsAccuracy, gpsAccuracy) || other.gpsAccuracy == gpsAccuracy));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,customerId,addressLine1,city,pincode,country,state,isDefault,createdAt,updatedAt,label,area,addressLine2,landmark,instructions,latitude,longitude,gpsAccuracy);

@override
String toString() {
  return 'AddressDTO(id: $id, customerId: $customerId, addressLine1: $addressLine1, city: $city, pincode: $pincode, country: $country, state: $state, isDefault: $isDefault, createdAt: $createdAt, updatedAt: $updatedAt, label: $label, area: $area, addressLine2: $addressLine2, landmark: $landmark, instructions: $instructions, latitude: $latitude, longitude: $longitude, gpsAccuracy: $gpsAccuracy)';
}


}

/// @nodoc
abstract mixin class $AddressDTOCopyWith<$Res>  {
  factory $AddressDTOCopyWith(AddressDTO value, $Res Function(AddressDTO) _then) = _$AddressDTOCopyWithImpl;
@useResult
$Res call({
 String id, String customerId, String addressLine1, String city, String pincode, String country, String state, bool isDefault, String createdAt, String updatedAt, String? label, String? area, String? addressLine2, String? landmark, String? instructions, double? latitude, double? longitude, double? gpsAccuracy
});




}
/// @nodoc
class _$AddressDTOCopyWithImpl<$Res>
    implements $AddressDTOCopyWith<$Res> {
  _$AddressDTOCopyWithImpl(this._self, this._then);

  final AddressDTO _self;
  final $Res Function(AddressDTO) _then;

/// Create a copy of AddressDTO
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? id = null,Object? customerId = null,Object? addressLine1 = null,Object? city = null,Object? pincode = null,Object? country = null,Object? state = null,Object? isDefault = null,Object? createdAt = null,Object? updatedAt = null,Object? label = freezed,Object? area = freezed,Object? addressLine2 = freezed,Object? landmark = freezed,Object? instructions = freezed,Object? latitude = freezed,Object? longitude = freezed,Object? gpsAccuracy = freezed,}) {
  return _then(_self.copyWith(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,customerId: null == customerId ? _self.customerId : customerId // ignore: cast_nullable_to_non_nullable
as String,addressLine1: null == addressLine1 ? _self.addressLine1 : addressLine1 // ignore: cast_nullable_to_non_nullable
as String,city: null == city ? _self.city : city // ignore: cast_nullable_to_non_nullable
as String,pincode: null == pincode ? _self.pincode : pincode // ignore: cast_nullable_to_non_nullable
as String,country: null == country ? _self.country : country // ignore: cast_nullable_to_non_nullable
as String,state: null == state ? _self.state : state // ignore: cast_nullable_to_non_nullable
as String,isDefault: null == isDefault ? _self.isDefault : isDefault // ignore: cast_nullable_to_non_nullable
as bool,createdAt: null == createdAt ? _self.createdAt : createdAt // ignore: cast_nullable_to_non_nullable
as String,updatedAt: null == updatedAt ? _self.updatedAt : updatedAt // ignore: cast_nullable_to_non_nullable
as String,label: freezed == label ? _self.label : label // ignore: cast_nullable_to_non_nullable
as String?,area: freezed == area ? _self.area : area // ignore: cast_nullable_to_non_nullable
as String?,addressLine2: freezed == addressLine2 ? _self.addressLine2 : addressLine2 // ignore: cast_nullable_to_non_nullable
as String?,landmark: freezed == landmark ? _self.landmark : landmark // ignore: cast_nullable_to_non_nullable
as String?,instructions: freezed == instructions ? _self.instructions : instructions // ignore: cast_nullable_to_non_nullable
as String?,latitude: freezed == latitude ? _self.latitude : latitude // ignore: cast_nullable_to_non_nullable
as double?,longitude: freezed == longitude ? _self.longitude : longitude // ignore: cast_nullable_to_non_nullable
as double?,gpsAccuracy: freezed == gpsAccuracy ? _self.gpsAccuracy : gpsAccuracy // ignore: cast_nullable_to_non_nullable
as double?,
  ));
}

}


/// Adds pattern-matching-related methods to [AddressDTO].
extension AddressDTOPatterns on AddressDTO {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _AddressDTO value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _AddressDTO() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _AddressDTO value)  $default,){
final _that = this;
switch (_that) {
case _AddressDTO():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _AddressDTO value)?  $default,){
final _that = this;
switch (_that) {
case _AddressDTO() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String id,  String customerId,  String addressLine1,  String city,  String pincode,  String country,  String state,  bool isDefault,  String createdAt,  String updatedAt,  String? label,  String? area,  String? addressLine2,  String? landmark,  String? instructions,  double? latitude,  double? longitude,  double? gpsAccuracy)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _AddressDTO() when $default != null:
return $default(_that.id,_that.customerId,_that.addressLine1,_that.city,_that.pincode,_that.country,_that.state,_that.isDefault,_that.createdAt,_that.updatedAt,_that.label,_that.area,_that.addressLine2,_that.landmark,_that.instructions,_that.latitude,_that.longitude,_that.gpsAccuracy);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String id,  String customerId,  String addressLine1,  String city,  String pincode,  String country,  String state,  bool isDefault,  String createdAt,  String updatedAt,  String? label,  String? area,  String? addressLine2,  String? landmark,  String? instructions,  double? latitude,  double? longitude,  double? gpsAccuracy)  $default,) {final _that = this;
switch (_that) {
case _AddressDTO():
return $default(_that.id,_that.customerId,_that.addressLine1,_that.city,_that.pincode,_that.country,_that.state,_that.isDefault,_that.createdAt,_that.updatedAt,_that.label,_that.area,_that.addressLine2,_that.landmark,_that.instructions,_that.latitude,_that.longitude,_that.gpsAccuracy);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String id,  String customerId,  String addressLine1,  String city,  String pincode,  String country,  String state,  bool isDefault,  String createdAt,  String updatedAt,  String? label,  String? area,  String? addressLine2,  String? landmark,  String? instructions,  double? latitude,  double? longitude,  double? gpsAccuracy)?  $default,) {final _that = this;
switch (_that) {
case _AddressDTO() when $default != null:
return $default(_that.id,_that.customerId,_that.addressLine1,_that.city,_that.pincode,_that.country,_that.state,_that.isDefault,_that.createdAt,_that.updatedAt,_that.label,_that.area,_that.addressLine2,_that.landmark,_that.instructions,_that.latitude,_that.longitude,_that.gpsAccuracy);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _AddressDTO implements AddressDTO {
  const _AddressDTO({required this.id, required this.customerId, required this.addressLine1, required this.city, required this.pincode, required this.country, required this.state, required this.isDefault, required this.createdAt, required this.updatedAt, this.label, this.area, this.addressLine2, this.landmark, this.instructions, this.latitude, this.longitude, this.gpsAccuracy});
  factory _AddressDTO.fromJson(Map<String, dynamic> json) => _$AddressDTOFromJson(json);

@override final  String id;
@override final  String customerId;
@override final  String addressLine1;
@override final  String city;
@override final  String pincode;
@override final  String country;
@override final  String state;
@override final  bool isDefault;
@override final  String createdAt;
@override final  String updatedAt;
@override final  String? label;
@override final  String? area;
@override final  String? addressLine2;
@override final  String? landmark;
@override final  String? instructions;
@override final  double? latitude;
@override final  double? longitude;
@override final  double? gpsAccuracy;

/// Create a copy of AddressDTO
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$AddressDTOCopyWith<_AddressDTO> get copyWith => __$AddressDTOCopyWithImpl<_AddressDTO>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$AddressDTOToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _AddressDTO&&(identical(other.id, id) || other.id == id)&&(identical(other.customerId, customerId) || other.customerId == customerId)&&(identical(other.addressLine1, addressLine1) || other.addressLine1 == addressLine1)&&(identical(other.city, city) || other.city == city)&&(identical(other.pincode, pincode) || other.pincode == pincode)&&(identical(other.country, country) || other.country == country)&&(identical(other.state, state) || other.state == state)&&(identical(other.isDefault, isDefault) || other.isDefault == isDefault)&&(identical(other.createdAt, createdAt) || other.createdAt == createdAt)&&(identical(other.updatedAt, updatedAt) || other.updatedAt == updatedAt)&&(identical(other.label, label) || other.label == label)&&(identical(other.area, area) || other.area == area)&&(identical(other.addressLine2, addressLine2) || other.addressLine2 == addressLine2)&&(identical(other.landmark, landmark) || other.landmark == landmark)&&(identical(other.instructions, instructions) || other.instructions == instructions)&&(identical(other.latitude, latitude) || other.latitude == latitude)&&(identical(other.longitude, longitude) || other.longitude == longitude)&&(identical(other.gpsAccuracy, gpsAccuracy) || other.gpsAccuracy == gpsAccuracy));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,customerId,addressLine1,city,pincode,country,state,isDefault,createdAt,updatedAt,label,area,addressLine2,landmark,instructions,latitude,longitude,gpsAccuracy);

@override
String toString() {
  return 'AddressDTO(id: $id, customerId: $customerId, addressLine1: $addressLine1, city: $city, pincode: $pincode, country: $country, state: $state, isDefault: $isDefault, createdAt: $createdAt, updatedAt: $updatedAt, label: $label, area: $area, addressLine2: $addressLine2, landmark: $landmark, instructions: $instructions, latitude: $latitude, longitude: $longitude, gpsAccuracy: $gpsAccuracy)';
}


}

/// @nodoc
abstract mixin class _$AddressDTOCopyWith<$Res> implements $AddressDTOCopyWith<$Res> {
  factory _$AddressDTOCopyWith(_AddressDTO value, $Res Function(_AddressDTO) _then) = __$AddressDTOCopyWithImpl;
@override @useResult
$Res call({
 String id, String customerId, String addressLine1, String city, String pincode, String country, String state, bool isDefault, String createdAt, String updatedAt, String? label, String? area, String? addressLine2, String? landmark, String? instructions, double? latitude, double? longitude, double? gpsAccuracy
});




}
/// @nodoc
class __$AddressDTOCopyWithImpl<$Res>
    implements _$AddressDTOCopyWith<$Res> {
  __$AddressDTOCopyWithImpl(this._self, this._then);

  final _AddressDTO _self;
  final $Res Function(_AddressDTO) _then;

/// Create a copy of AddressDTO
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? id = null,Object? customerId = null,Object? addressLine1 = null,Object? city = null,Object? pincode = null,Object? country = null,Object? state = null,Object? isDefault = null,Object? createdAt = null,Object? updatedAt = null,Object? label = freezed,Object? area = freezed,Object? addressLine2 = freezed,Object? landmark = freezed,Object? instructions = freezed,Object? latitude = freezed,Object? longitude = freezed,Object? gpsAccuracy = freezed,}) {
  return _then(_AddressDTO(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,customerId: null == customerId ? _self.customerId : customerId // ignore: cast_nullable_to_non_nullable
as String,addressLine1: null == addressLine1 ? _self.addressLine1 : addressLine1 // ignore: cast_nullable_to_non_nullable
as String,city: null == city ? _self.city : city // ignore: cast_nullable_to_non_nullable
as String,pincode: null == pincode ? _self.pincode : pincode // ignore: cast_nullable_to_non_nullable
as String,country: null == country ? _self.country : country // ignore: cast_nullable_to_non_nullable
as String,state: null == state ? _self.state : state // ignore: cast_nullable_to_non_nullable
as String,isDefault: null == isDefault ? _self.isDefault : isDefault // ignore: cast_nullable_to_non_nullable
as bool,createdAt: null == createdAt ? _self.createdAt : createdAt // ignore: cast_nullable_to_non_nullable
as String,updatedAt: null == updatedAt ? _self.updatedAt : updatedAt // ignore: cast_nullable_to_non_nullable
as String,label: freezed == label ? _self.label : label // ignore: cast_nullable_to_non_nullable
as String?,area: freezed == area ? _self.area : area // ignore: cast_nullable_to_non_nullable
as String?,addressLine2: freezed == addressLine2 ? _self.addressLine2 : addressLine2 // ignore: cast_nullable_to_non_nullable
as String?,landmark: freezed == landmark ? _self.landmark : landmark // ignore: cast_nullable_to_non_nullable
as String?,instructions: freezed == instructions ? _self.instructions : instructions // ignore: cast_nullable_to_non_nullable
as String?,latitude: freezed == latitude ? _self.latitude : latitude // ignore: cast_nullable_to_non_nullable
as double?,longitude: freezed == longitude ? _self.longitude : longitude // ignore: cast_nullable_to_non_nullable
as double?,gpsAccuracy: freezed == gpsAccuracy ? _self.gpsAccuracy : gpsAccuracy // ignore: cast_nullable_to_non_nullable
as double?,
  ));
}


}


/// @nodoc
mixin _$CreateAddressRequest {

 String get line1; String get city; String get pincode; String? get label; String? get area; String? get line2; String? get landmark; String? get state; String? get instructions; double? get latitude; double? get longitude; double? get gpsAccuracy; bool? get isDefault;
/// Create a copy of CreateAddressRequest
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$CreateAddressRequestCopyWith<CreateAddressRequest> get copyWith => _$CreateAddressRequestCopyWithImpl<CreateAddressRequest>(this as CreateAddressRequest, _$identity);

  /// Serializes this CreateAddressRequest to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is CreateAddressRequest&&(identical(other.line1, line1) || other.line1 == line1)&&(identical(other.city, city) || other.city == city)&&(identical(other.pincode, pincode) || other.pincode == pincode)&&(identical(other.label, label) || other.label == label)&&(identical(other.area, area) || other.area == area)&&(identical(other.line2, line2) || other.line2 == line2)&&(identical(other.landmark, landmark) || other.landmark == landmark)&&(identical(other.state, state) || other.state == state)&&(identical(other.instructions, instructions) || other.instructions == instructions)&&(identical(other.latitude, latitude) || other.latitude == latitude)&&(identical(other.longitude, longitude) || other.longitude == longitude)&&(identical(other.gpsAccuracy, gpsAccuracy) || other.gpsAccuracy == gpsAccuracy)&&(identical(other.isDefault, isDefault) || other.isDefault == isDefault));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,line1,city,pincode,label,area,line2,landmark,state,instructions,latitude,longitude,gpsAccuracy,isDefault);

@override
String toString() {
  return 'CreateAddressRequest(line1: $line1, city: $city, pincode: $pincode, label: $label, area: $area, line2: $line2, landmark: $landmark, state: $state, instructions: $instructions, latitude: $latitude, longitude: $longitude, gpsAccuracy: $gpsAccuracy, isDefault: $isDefault)';
}


}

/// @nodoc
abstract mixin class $CreateAddressRequestCopyWith<$Res>  {
  factory $CreateAddressRequestCopyWith(CreateAddressRequest value, $Res Function(CreateAddressRequest) _then) = _$CreateAddressRequestCopyWithImpl;
@useResult
$Res call({
 String line1, String city, String pincode, String? label, String? area, String? line2, String? landmark, String? state, String? instructions, double? latitude, double? longitude, double? gpsAccuracy, bool? isDefault
});




}
/// @nodoc
class _$CreateAddressRequestCopyWithImpl<$Res>
    implements $CreateAddressRequestCopyWith<$Res> {
  _$CreateAddressRequestCopyWithImpl(this._self, this._then);

  final CreateAddressRequest _self;
  final $Res Function(CreateAddressRequest) _then;

/// Create a copy of CreateAddressRequest
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? line1 = null,Object? city = null,Object? pincode = null,Object? label = freezed,Object? area = freezed,Object? line2 = freezed,Object? landmark = freezed,Object? state = freezed,Object? instructions = freezed,Object? latitude = freezed,Object? longitude = freezed,Object? gpsAccuracy = freezed,Object? isDefault = freezed,}) {
  return _then(_self.copyWith(
line1: null == line1 ? _self.line1 : line1 // ignore: cast_nullable_to_non_nullable
as String,city: null == city ? _self.city : city // ignore: cast_nullable_to_non_nullable
as String,pincode: null == pincode ? _self.pincode : pincode // ignore: cast_nullable_to_non_nullable
as String,label: freezed == label ? _self.label : label // ignore: cast_nullable_to_non_nullable
as String?,area: freezed == area ? _self.area : area // ignore: cast_nullable_to_non_nullable
as String?,line2: freezed == line2 ? _self.line2 : line2 // ignore: cast_nullable_to_non_nullable
as String?,landmark: freezed == landmark ? _self.landmark : landmark // ignore: cast_nullable_to_non_nullable
as String?,state: freezed == state ? _self.state : state // ignore: cast_nullable_to_non_nullable
as String?,instructions: freezed == instructions ? _self.instructions : instructions // ignore: cast_nullable_to_non_nullable
as String?,latitude: freezed == latitude ? _self.latitude : latitude // ignore: cast_nullable_to_non_nullable
as double?,longitude: freezed == longitude ? _self.longitude : longitude // ignore: cast_nullable_to_non_nullable
as double?,gpsAccuracy: freezed == gpsAccuracy ? _self.gpsAccuracy : gpsAccuracy // ignore: cast_nullable_to_non_nullable
as double?,isDefault: freezed == isDefault ? _self.isDefault : isDefault // ignore: cast_nullable_to_non_nullable
as bool?,
  ));
}

}


/// Adds pattern-matching-related methods to [CreateAddressRequest].
extension CreateAddressRequestPatterns on CreateAddressRequest {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _CreateAddressRequest value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _CreateAddressRequest() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _CreateAddressRequest value)  $default,){
final _that = this;
switch (_that) {
case _CreateAddressRequest():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _CreateAddressRequest value)?  $default,){
final _that = this;
switch (_that) {
case _CreateAddressRequest() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String line1,  String city,  String pincode,  String? label,  String? area,  String? line2,  String? landmark,  String? state,  String? instructions,  double? latitude,  double? longitude,  double? gpsAccuracy,  bool? isDefault)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _CreateAddressRequest() when $default != null:
return $default(_that.line1,_that.city,_that.pincode,_that.label,_that.area,_that.line2,_that.landmark,_that.state,_that.instructions,_that.latitude,_that.longitude,_that.gpsAccuracy,_that.isDefault);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String line1,  String city,  String pincode,  String? label,  String? area,  String? line2,  String? landmark,  String? state,  String? instructions,  double? latitude,  double? longitude,  double? gpsAccuracy,  bool? isDefault)  $default,) {final _that = this;
switch (_that) {
case _CreateAddressRequest():
return $default(_that.line1,_that.city,_that.pincode,_that.label,_that.area,_that.line2,_that.landmark,_that.state,_that.instructions,_that.latitude,_that.longitude,_that.gpsAccuracy,_that.isDefault);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String line1,  String city,  String pincode,  String? label,  String? area,  String? line2,  String? landmark,  String? state,  String? instructions,  double? latitude,  double? longitude,  double? gpsAccuracy,  bool? isDefault)?  $default,) {final _that = this;
switch (_that) {
case _CreateAddressRequest() when $default != null:
return $default(_that.line1,_that.city,_that.pincode,_that.label,_that.area,_that.line2,_that.landmark,_that.state,_that.instructions,_that.latitude,_that.longitude,_that.gpsAccuracy,_that.isDefault);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _CreateAddressRequest implements CreateAddressRequest {
  const _CreateAddressRequest({required this.line1, required this.city, required this.pincode, this.label, this.area, this.line2, this.landmark, this.state, this.instructions, this.latitude, this.longitude, this.gpsAccuracy, this.isDefault});
  factory _CreateAddressRequest.fromJson(Map<String, dynamic> json) => _$CreateAddressRequestFromJson(json);

@override final  String line1;
@override final  String city;
@override final  String pincode;
@override final  String? label;
@override final  String? area;
@override final  String? line2;
@override final  String? landmark;
@override final  String? state;
@override final  String? instructions;
@override final  double? latitude;
@override final  double? longitude;
@override final  double? gpsAccuracy;
@override final  bool? isDefault;

/// Create a copy of CreateAddressRequest
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$CreateAddressRequestCopyWith<_CreateAddressRequest> get copyWith => __$CreateAddressRequestCopyWithImpl<_CreateAddressRequest>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$CreateAddressRequestToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _CreateAddressRequest&&(identical(other.line1, line1) || other.line1 == line1)&&(identical(other.city, city) || other.city == city)&&(identical(other.pincode, pincode) || other.pincode == pincode)&&(identical(other.label, label) || other.label == label)&&(identical(other.area, area) || other.area == area)&&(identical(other.line2, line2) || other.line2 == line2)&&(identical(other.landmark, landmark) || other.landmark == landmark)&&(identical(other.state, state) || other.state == state)&&(identical(other.instructions, instructions) || other.instructions == instructions)&&(identical(other.latitude, latitude) || other.latitude == latitude)&&(identical(other.longitude, longitude) || other.longitude == longitude)&&(identical(other.gpsAccuracy, gpsAccuracy) || other.gpsAccuracy == gpsAccuracy)&&(identical(other.isDefault, isDefault) || other.isDefault == isDefault));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,line1,city,pincode,label,area,line2,landmark,state,instructions,latitude,longitude,gpsAccuracy,isDefault);

@override
String toString() {
  return 'CreateAddressRequest(line1: $line1, city: $city, pincode: $pincode, label: $label, area: $area, line2: $line2, landmark: $landmark, state: $state, instructions: $instructions, latitude: $latitude, longitude: $longitude, gpsAccuracy: $gpsAccuracy, isDefault: $isDefault)';
}


}

/// @nodoc
abstract mixin class _$CreateAddressRequestCopyWith<$Res> implements $CreateAddressRequestCopyWith<$Res> {
  factory _$CreateAddressRequestCopyWith(_CreateAddressRequest value, $Res Function(_CreateAddressRequest) _then) = __$CreateAddressRequestCopyWithImpl;
@override @useResult
$Res call({
 String line1, String city, String pincode, String? label, String? area, String? line2, String? landmark, String? state, String? instructions, double? latitude, double? longitude, double? gpsAccuracy, bool? isDefault
});




}
/// @nodoc
class __$CreateAddressRequestCopyWithImpl<$Res>
    implements _$CreateAddressRequestCopyWith<$Res> {
  __$CreateAddressRequestCopyWithImpl(this._self, this._then);

  final _CreateAddressRequest _self;
  final $Res Function(_CreateAddressRequest) _then;

/// Create a copy of CreateAddressRequest
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? line1 = null,Object? city = null,Object? pincode = null,Object? label = freezed,Object? area = freezed,Object? line2 = freezed,Object? landmark = freezed,Object? state = freezed,Object? instructions = freezed,Object? latitude = freezed,Object? longitude = freezed,Object? gpsAccuracy = freezed,Object? isDefault = freezed,}) {
  return _then(_CreateAddressRequest(
line1: null == line1 ? _self.line1 : line1 // ignore: cast_nullable_to_non_nullable
as String,city: null == city ? _self.city : city // ignore: cast_nullable_to_non_nullable
as String,pincode: null == pincode ? _self.pincode : pincode // ignore: cast_nullable_to_non_nullable
as String,label: freezed == label ? _self.label : label // ignore: cast_nullable_to_non_nullable
as String?,area: freezed == area ? _self.area : area // ignore: cast_nullable_to_non_nullable
as String?,line2: freezed == line2 ? _self.line2 : line2 // ignore: cast_nullable_to_non_nullable
as String?,landmark: freezed == landmark ? _self.landmark : landmark // ignore: cast_nullable_to_non_nullable
as String?,state: freezed == state ? _self.state : state // ignore: cast_nullable_to_non_nullable
as String?,instructions: freezed == instructions ? _self.instructions : instructions // ignore: cast_nullable_to_non_nullable
as String?,latitude: freezed == latitude ? _self.latitude : latitude // ignore: cast_nullable_to_non_nullable
as double?,longitude: freezed == longitude ? _self.longitude : longitude // ignore: cast_nullable_to_non_nullable
as double?,gpsAccuracy: freezed == gpsAccuracy ? _self.gpsAccuracy : gpsAccuracy // ignore: cast_nullable_to_non_nullable
as double?,isDefault: freezed == isDefault ? _self.isDefault : isDefault // ignore: cast_nullable_to_non_nullable
as bool?,
  ));
}


}


/// @nodoc
mixin _$CustomerProfile {

 String get id; int get loyaltyPoints; int get totalOrders; double get totalSpent; String? get name; String? get email; String? get phone; String? get avatar; String? get gstNumber; String? get loyaltyTier;
/// Create a copy of CustomerProfile
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$CustomerProfileCopyWith<CustomerProfile> get copyWith => _$CustomerProfileCopyWithImpl<CustomerProfile>(this as CustomerProfile, _$identity);

  /// Serializes this CustomerProfile to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is CustomerProfile&&(identical(other.id, id) || other.id == id)&&(identical(other.loyaltyPoints, loyaltyPoints) || other.loyaltyPoints == loyaltyPoints)&&(identical(other.totalOrders, totalOrders) || other.totalOrders == totalOrders)&&(identical(other.totalSpent, totalSpent) || other.totalSpent == totalSpent)&&(identical(other.name, name) || other.name == name)&&(identical(other.email, email) || other.email == email)&&(identical(other.phone, phone) || other.phone == phone)&&(identical(other.avatar, avatar) || other.avatar == avatar)&&(identical(other.gstNumber, gstNumber) || other.gstNumber == gstNumber)&&(identical(other.loyaltyTier, loyaltyTier) || other.loyaltyTier == loyaltyTier));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,loyaltyPoints,totalOrders,totalSpent,name,email,phone,avatar,gstNumber,loyaltyTier);

@override
String toString() {
  return 'CustomerProfile(id: $id, loyaltyPoints: $loyaltyPoints, totalOrders: $totalOrders, totalSpent: $totalSpent, name: $name, email: $email, phone: $phone, avatar: $avatar, gstNumber: $gstNumber, loyaltyTier: $loyaltyTier)';
}


}

/// @nodoc
abstract mixin class $CustomerProfileCopyWith<$Res>  {
  factory $CustomerProfileCopyWith(CustomerProfile value, $Res Function(CustomerProfile) _then) = _$CustomerProfileCopyWithImpl;
@useResult
$Res call({
 String id, int loyaltyPoints, int totalOrders, double totalSpent, String? name, String? email, String? phone, String? avatar, String? gstNumber, String? loyaltyTier
});




}
/// @nodoc
class _$CustomerProfileCopyWithImpl<$Res>
    implements $CustomerProfileCopyWith<$Res> {
  _$CustomerProfileCopyWithImpl(this._self, this._then);

  final CustomerProfile _self;
  final $Res Function(CustomerProfile) _then;

/// Create a copy of CustomerProfile
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? id = null,Object? loyaltyPoints = null,Object? totalOrders = null,Object? totalSpent = null,Object? name = freezed,Object? email = freezed,Object? phone = freezed,Object? avatar = freezed,Object? gstNumber = freezed,Object? loyaltyTier = freezed,}) {
  return _then(_self.copyWith(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,loyaltyPoints: null == loyaltyPoints ? _self.loyaltyPoints : loyaltyPoints // ignore: cast_nullable_to_non_nullable
as int,totalOrders: null == totalOrders ? _self.totalOrders : totalOrders // ignore: cast_nullable_to_non_nullable
as int,totalSpent: null == totalSpent ? _self.totalSpent : totalSpent // ignore: cast_nullable_to_non_nullable
as double,name: freezed == name ? _self.name : name // ignore: cast_nullable_to_non_nullable
as String?,email: freezed == email ? _self.email : email // ignore: cast_nullable_to_non_nullable
as String?,phone: freezed == phone ? _self.phone : phone // ignore: cast_nullable_to_non_nullable
as String?,avatar: freezed == avatar ? _self.avatar : avatar // ignore: cast_nullable_to_non_nullable
as String?,gstNumber: freezed == gstNumber ? _self.gstNumber : gstNumber // ignore: cast_nullable_to_non_nullable
as String?,loyaltyTier: freezed == loyaltyTier ? _self.loyaltyTier : loyaltyTier // ignore: cast_nullable_to_non_nullable
as String?,
  ));
}

}


/// Adds pattern-matching-related methods to [CustomerProfile].
extension CustomerProfilePatterns on CustomerProfile {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _CustomerProfile value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _CustomerProfile() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _CustomerProfile value)  $default,){
final _that = this;
switch (_that) {
case _CustomerProfile():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _CustomerProfile value)?  $default,){
final _that = this;
switch (_that) {
case _CustomerProfile() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String id,  int loyaltyPoints,  int totalOrders,  double totalSpent,  String? name,  String? email,  String? phone,  String? avatar,  String? gstNumber,  String? loyaltyTier)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _CustomerProfile() when $default != null:
return $default(_that.id,_that.loyaltyPoints,_that.totalOrders,_that.totalSpent,_that.name,_that.email,_that.phone,_that.avatar,_that.gstNumber,_that.loyaltyTier);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String id,  int loyaltyPoints,  int totalOrders,  double totalSpent,  String? name,  String? email,  String? phone,  String? avatar,  String? gstNumber,  String? loyaltyTier)  $default,) {final _that = this;
switch (_that) {
case _CustomerProfile():
return $default(_that.id,_that.loyaltyPoints,_that.totalOrders,_that.totalSpent,_that.name,_that.email,_that.phone,_that.avatar,_that.gstNumber,_that.loyaltyTier);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String id,  int loyaltyPoints,  int totalOrders,  double totalSpent,  String? name,  String? email,  String? phone,  String? avatar,  String? gstNumber,  String? loyaltyTier)?  $default,) {final _that = this;
switch (_that) {
case _CustomerProfile() when $default != null:
return $default(_that.id,_that.loyaltyPoints,_that.totalOrders,_that.totalSpent,_that.name,_that.email,_that.phone,_that.avatar,_that.gstNumber,_that.loyaltyTier);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _CustomerProfile implements CustomerProfile {
  const _CustomerProfile({required this.id, this.loyaltyPoints = 0, this.totalOrders = 0, this.totalSpent = 0.0, this.name, this.email, this.phone, this.avatar, this.gstNumber, this.loyaltyTier});
  factory _CustomerProfile.fromJson(Map<String, dynamic> json) => _$CustomerProfileFromJson(json);

@override final  String id;
@override@JsonKey() final  int loyaltyPoints;
@override@JsonKey() final  int totalOrders;
@override@JsonKey() final  double totalSpent;
@override final  String? name;
@override final  String? email;
@override final  String? phone;
@override final  String? avatar;
@override final  String? gstNumber;
@override final  String? loyaltyTier;

/// Create a copy of CustomerProfile
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$CustomerProfileCopyWith<_CustomerProfile> get copyWith => __$CustomerProfileCopyWithImpl<_CustomerProfile>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$CustomerProfileToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _CustomerProfile&&(identical(other.id, id) || other.id == id)&&(identical(other.loyaltyPoints, loyaltyPoints) || other.loyaltyPoints == loyaltyPoints)&&(identical(other.totalOrders, totalOrders) || other.totalOrders == totalOrders)&&(identical(other.totalSpent, totalSpent) || other.totalSpent == totalSpent)&&(identical(other.name, name) || other.name == name)&&(identical(other.email, email) || other.email == email)&&(identical(other.phone, phone) || other.phone == phone)&&(identical(other.avatar, avatar) || other.avatar == avatar)&&(identical(other.gstNumber, gstNumber) || other.gstNumber == gstNumber)&&(identical(other.loyaltyTier, loyaltyTier) || other.loyaltyTier == loyaltyTier));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,loyaltyPoints,totalOrders,totalSpent,name,email,phone,avatar,gstNumber,loyaltyTier);

@override
String toString() {
  return 'CustomerProfile(id: $id, loyaltyPoints: $loyaltyPoints, totalOrders: $totalOrders, totalSpent: $totalSpent, name: $name, email: $email, phone: $phone, avatar: $avatar, gstNumber: $gstNumber, loyaltyTier: $loyaltyTier)';
}


}

/// @nodoc
abstract mixin class _$CustomerProfileCopyWith<$Res> implements $CustomerProfileCopyWith<$Res> {
  factory _$CustomerProfileCopyWith(_CustomerProfile value, $Res Function(_CustomerProfile) _then) = __$CustomerProfileCopyWithImpl;
@override @useResult
$Res call({
 String id, int loyaltyPoints, int totalOrders, double totalSpent, String? name, String? email, String? phone, String? avatar, String? gstNumber, String? loyaltyTier
});




}
/// @nodoc
class __$CustomerProfileCopyWithImpl<$Res>
    implements _$CustomerProfileCopyWith<$Res> {
  __$CustomerProfileCopyWithImpl(this._self, this._then);

  final _CustomerProfile _self;
  final $Res Function(_CustomerProfile) _then;

/// Create a copy of CustomerProfile
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? id = null,Object? loyaltyPoints = null,Object? totalOrders = null,Object? totalSpent = null,Object? name = freezed,Object? email = freezed,Object? phone = freezed,Object? avatar = freezed,Object? gstNumber = freezed,Object? loyaltyTier = freezed,}) {
  return _then(_CustomerProfile(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,loyaltyPoints: null == loyaltyPoints ? _self.loyaltyPoints : loyaltyPoints // ignore: cast_nullable_to_non_nullable
as int,totalOrders: null == totalOrders ? _self.totalOrders : totalOrders // ignore: cast_nullable_to_non_nullable
as int,totalSpent: null == totalSpent ? _self.totalSpent : totalSpent // ignore: cast_nullable_to_non_nullable
as double,name: freezed == name ? _self.name : name // ignore: cast_nullable_to_non_nullable
as String?,email: freezed == email ? _self.email : email // ignore: cast_nullable_to_non_nullable
as String?,phone: freezed == phone ? _self.phone : phone // ignore: cast_nullable_to_non_nullable
as String?,avatar: freezed == avatar ? _self.avatar : avatar // ignore: cast_nullable_to_non_nullable
as String?,gstNumber: freezed == gstNumber ? _self.gstNumber : gstNumber // ignore: cast_nullable_to_non_nullable
as String?,loyaltyTier: freezed == loyaltyTier ? _self.loyaltyTier : loyaltyTier // ignore: cast_nullable_to_non_nullable
as String?,
  ));
}


}

// dart format on
