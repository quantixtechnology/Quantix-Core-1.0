// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'order_dto.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// dart format off
T _$identity<T>(T value) => value;

/// @nodoc
mixin _$OrderItemDTO {

 String get id; String get itemType; String get itemName; int get quantity; double get unitPrice; double get totalPrice; String? get variantName; String? get specialInstructions; bool? get isVeg;
/// Create a copy of OrderItemDTO
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$OrderItemDTOCopyWith<OrderItemDTO> get copyWith => _$OrderItemDTOCopyWithImpl<OrderItemDTO>(this as OrderItemDTO, _$identity);

  /// Serializes this OrderItemDTO to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is OrderItemDTO&&(identical(other.id, id) || other.id == id)&&(identical(other.itemType, itemType) || other.itemType == itemType)&&(identical(other.itemName, itemName) || other.itemName == itemName)&&(identical(other.quantity, quantity) || other.quantity == quantity)&&(identical(other.unitPrice, unitPrice) || other.unitPrice == unitPrice)&&(identical(other.totalPrice, totalPrice) || other.totalPrice == totalPrice)&&(identical(other.variantName, variantName) || other.variantName == variantName)&&(identical(other.specialInstructions, specialInstructions) || other.specialInstructions == specialInstructions)&&(identical(other.isVeg, isVeg) || other.isVeg == isVeg));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,itemType,itemName,quantity,unitPrice,totalPrice,variantName,specialInstructions,isVeg);

@override
String toString() {
  return 'OrderItemDTO(id: $id, itemType: $itemType, itemName: $itemName, quantity: $quantity, unitPrice: $unitPrice, totalPrice: $totalPrice, variantName: $variantName, specialInstructions: $specialInstructions, isVeg: $isVeg)';
}


}

/// @nodoc
abstract mixin class $OrderItemDTOCopyWith<$Res>  {
  factory $OrderItemDTOCopyWith(OrderItemDTO value, $Res Function(OrderItemDTO) _then) = _$OrderItemDTOCopyWithImpl;
@useResult
$Res call({
 String id, String itemType, String itemName, int quantity, double unitPrice, double totalPrice, String? variantName, String? specialInstructions, bool? isVeg
});




}
/// @nodoc
class _$OrderItemDTOCopyWithImpl<$Res>
    implements $OrderItemDTOCopyWith<$Res> {
  _$OrderItemDTOCopyWithImpl(this._self, this._then);

  final OrderItemDTO _self;
  final $Res Function(OrderItemDTO) _then;

/// Create a copy of OrderItemDTO
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? id = null,Object? itemType = null,Object? itemName = null,Object? quantity = null,Object? unitPrice = null,Object? totalPrice = null,Object? variantName = freezed,Object? specialInstructions = freezed,Object? isVeg = freezed,}) {
  return _then(_self.copyWith(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,itemType: null == itemType ? _self.itemType : itemType // ignore: cast_nullable_to_non_nullable
as String,itemName: null == itemName ? _self.itemName : itemName // ignore: cast_nullable_to_non_nullable
as String,quantity: null == quantity ? _self.quantity : quantity // ignore: cast_nullable_to_non_nullable
as int,unitPrice: null == unitPrice ? _self.unitPrice : unitPrice // ignore: cast_nullable_to_non_nullable
as double,totalPrice: null == totalPrice ? _self.totalPrice : totalPrice // ignore: cast_nullable_to_non_nullable
as double,variantName: freezed == variantName ? _self.variantName : variantName // ignore: cast_nullable_to_non_nullable
as String?,specialInstructions: freezed == specialInstructions ? _self.specialInstructions : specialInstructions // ignore: cast_nullable_to_non_nullable
as String?,isVeg: freezed == isVeg ? _self.isVeg : isVeg // ignore: cast_nullable_to_non_nullable
as bool?,
  ));
}

}


/// Adds pattern-matching-related methods to [OrderItemDTO].
extension OrderItemDTOPatterns on OrderItemDTO {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _OrderItemDTO value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _OrderItemDTO() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _OrderItemDTO value)  $default,){
final _that = this;
switch (_that) {
case _OrderItemDTO():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _OrderItemDTO value)?  $default,){
final _that = this;
switch (_that) {
case _OrderItemDTO() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String id,  String itemType,  String itemName,  int quantity,  double unitPrice,  double totalPrice,  String? variantName,  String? specialInstructions,  bool? isVeg)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _OrderItemDTO() when $default != null:
return $default(_that.id,_that.itemType,_that.itemName,_that.quantity,_that.unitPrice,_that.totalPrice,_that.variantName,_that.specialInstructions,_that.isVeg);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String id,  String itemType,  String itemName,  int quantity,  double unitPrice,  double totalPrice,  String? variantName,  String? specialInstructions,  bool? isVeg)  $default,) {final _that = this;
switch (_that) {
case _OrderItemDTO():
return $default(_that.id,_that.itemType,_that.itemName,_that.quantity,_that.unitPrice,_that.totalPrice,_that.variantName,_that.specialInstructions,_that.isVeg);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String id,  String itemType,  String itemName,  int quantity,  double unitPrice,  double totalPrice,  String? variantName,  String? specialInstructions,  bool? isVeg)?  $default,) {final _that = this;
switch (_that) {
case _OrderItemDTO() when $default != null:
return $default(_that.id,_that.itemType,_that.itemName,_that.quantity,_that.unitPrice,_that.totalPrice,_that.variantName,_that.specialInstructions,_that.isVeg);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _OrderItemDTO implements OrderItemDTO {
  const _OrderItemDTO({required this.id, required this.itemType, required this.itemName, required this.quantity, required this.unitPrice, required this.totalPrice, this.variantName, this.specialInstructions, this.isVeg});
  factory _OrderItemDTO.fromJson(Map<String, dynamic> json) => _$OrderItemDTOFromJson(json);

@override final  String id;
@override final  String itemType;
@override final  String itemName;
@override final  int quantity;
@override final  double unitPrice;
@override final  double totalPrice;
@override final  String? variantName;
@override final  String? specialInstructions;
@override final  bool? isVeg;

/// Create a copy of OrderItemDTO
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$OrderItemDTOCopyWith<_OrderItemDTO> get copyWith => __$OrderItemDTOCopyWithImpl<_OrderItemDTO>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$OrderItemDTOToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _OrderItemDTO&&(identical(other.id, id) || other.id == id)&&(identical(other.itemType, itemType) || other.itemType == itemType)&&(identical(other.itemName, itemName) || other.itemName == itemName)&&(identical(other.quantity, quantity) || other.quantity == quantity)&&(identical(other.unitPrice, unitPrice) || other.unitPrice == unitPrice)&&(identical(other.totalPrice, totalPrice) || other.totalPrice == totalPrice)&&(identical(other.variantName, variantName) || other.variantName == variantName)&&(identical(other.specialInstructions, specialInstructions) || other.specialInstructions == specialInstructions)&&(identical(other.isVeg, isVeg) || other.isVeg == isVeg));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,itemType,itemName,quantity,unitPrice,totalPrice,variantName,specialInstructions,isVeg);

@override
String toString() {
  return 'OrderItemDTO(id: $id, itemType: $itemType, itemName: $itemName, quantity: $quantity, unitPrice: $unitPrice, totalPrice: $totalPrice, variantName: $variantName, specialInstructions: $specialInstructions, isVeg: $isVeg)';
}


}

/// @nodoc
abstract mixin class _$OrderItemDTOCopyWith<$Res> implements $OrderItemDTOCopyWith<$Res> {
  factory _$OrderItemDTOCopyWith(_OrderItemDTO value, $Res Function(_OrderItemDTO) _then) = __$OrderItemDTOCopyWithImpl;
@override @useResult
$Res call({
 String id, String itemType, String itemName, int quantity, double unitPrice, double totalPrice, String? variantName, String? specialInstructions, bool? isVeg
});




}
/// @nodoc
class __$OrderItemDTOCopyWithImpl<$Res>
    implements _$OrderItemDTOCopyWith<$Res> {
  __$OrderItemDTOCopyWithImpl(this._self, this._then);

  final _OrderItemDTO _self;
  final $Res Function(_OrderItemDTO) _then;

/// Create a copy of OrderItemDTO
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? id = null,Object? itemType = null,Object? itemName = null,Object? quantity = null,Object? unitPrice = null,Object? totalPrice = null,Object? variantName = freezed,Object? specialInstructions = freezed,Object? isVeg = freezed,}) {
  return _then(_OrderItemDTO(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,itemType: null == itemType ? _self.itemType : itemType // ignore: cast_nullable_to_non_nullable
as String,itemName: null == itemName ? _self.itemName : itemName // ignore: cast_nullable_to_non_nullable
as String,quantity: null == quantity ? _self.quantity : quantity // ignore: cast_nullable_to_non_nullable
as int,unitPrice: null == unitPrice ? _self.unitPrice : unitPrice // ignore: cast_nullable_to_non_nullable
as double,totalPrice: null == totalPrice ? _self.totalPrice : totalPrice // ignore: cast_nullable_to_non_nullable
as double,variantName: freezed == variantName ? _self.variantName : variantName // ignore: cast_nullable_to_non_nullable
as String?,specialInstructions: freezed == specialInstructions ? _self.specialInstructions : specialInstructions // ignore: cast_nullable_to_non_nullable
as String?,isVeg: freezed == isVeg ? _self.isVeg : isVeg // ignore: cast_nullable_to_non_nullable
as bool?,
  ));
}


}


/// @nodoc
mixin _$OrderDTO {

 String get id; String get businessId; String get storeId; String get orderNumber; String get orderType; String get orderSource; String get status; String get paymentStatus; double get subtotal; double get totalTax; double get deliveryFee; double get totalDiscount; double get totalAmount; String get createdAt; List<OrderItemDTO> get items; String? get paymentMethod; String? get promoCodeId; String? get deliveryAddress; String? get notes; String? get confirmedAt; String? get deliveredAt; double? get deliveryLat; double? get deliveryLng;
/// Create a copy of OrderDTO
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$OrderDTOCopyWith<OrderDTO> get copyWith => _$OrderDTOCopyWithImpl<OrderDTO>(this as OrderDTO, _$identity);

  /// Serializes this OrderDTO to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is OrderDTO&&(identical(other.id, id) || other.id == id)&&(identical(other.businessId, businessId) || other.businessId == businessId)&&(identical(other.storeId, storeId) || other.storeId == storeId)&&(identical(other.orderNumber, orderNumber) || other.orderNumber == orderNumber)&&(identical(other.orderType, orderType) || other.orderType == orderType)&&(identical(other.orderSource, orderSource) || other.orderSource == orderSource)&&(identical(other.status, status) || other.status == status)&&(identical(other.paymentStatus, paymentStatus) || other.paymentStatus == paymentStatus)&&(identical(other.subtotal, subtotal) || other.subtotal == subtotal)&&(identical(other.totalTax, totalTax) || other.totalTax == totalTax)&&(identical(other.deliveryFee, deliveryFee) || other.deliveryFee == deliveryFee)&&(identical(other.totalDiscount, totalDiscount) || other.totalDiscount == totalDiscount)&&(identical(other.totalAmount, totalAmount) || other.totalAmount == totalAmount)&&(identical(other.createdAt, createdAt) || other.createdAt == createdAt)&&const DeepCollectionEquality().equals(other.items, items)&&(identical(other.paymentMethod, paymentMethod) || other.paymentMethod == paymentMethod)&&(identical(other.promoCodeId, promoCodeId) || other.promoCodeId == promoCodeId)&&(identical(other.deliveryAddress, deliveryAddress) || other.deliveryAddress == deliveryAddress)&&(identical(other.notes, notes) || other.notes == notes)&&(identical(other.confirmedAt, confirmedAt) || other.confirmedAt == confirmedAt)&&(identical(other.deliveredAt, deliveredAt) || other.deliveredAt == deliveredAt)&&(identical(other.deliveryLat, deliveryLat) || other.deliveryLat == deliveryLat)&&(identical(other.deliveryLng, deliveryLng) || other.deliveryLng == deliveryLng));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hashAll([runtimeType,id,businessId,storeId,orderNumber,orderType,orderSource,status,paymentStatus,subtotal,totalTax,deliveryFee,totalDiscount,totalAmount,createdAt,const DeepCollectionEquality().hash(items),paymentMethod,promoCodeId,deliveryAddress,notes,confirmedAt,deliveredAt,deliveryLat,deliveryLng]);

@override
String toString() {
  return 'OrderDTO(id: $id, businessId: $businessId, storeId: $storeId, orderNumber: $orderNumber, orderType: $orderType, orderSource: $orderSource, status: $status, paymentStatus: $paymentStatus, subtotal: $subtotal, totalTax: $totalTax, deliveryFee: $deliveryFee, totalDiscount: $totalDiscount, totalAmount: $totalAmount, createdAt: $createdAt, items: $items, paymentMethod: $paymentMethod, promoCodeId: $promoCodeId, deliveryAddress: $deliveryAddress, notes: $notes, confirmedAt: $confirmedAt, deliveredAt: $deliveredAt, deliveryLat: $deliveryLat, deliveryLng: $deliveryLng)';
}


}

/// @nodoc
abstract mixin class $OrderDTOCopyWith<$Res>  {
  factory $OrderDTOCopyWith(OrderDTO value, $Res Function(OrderDTO) _then) = _$OrderDTOCopyWithImpl;
@useResult
$Res call({
 String id, String businessId, String storeId, String orderNumber, String orderType, String orderSource, String status, String paymentStatus, double subtotal, double totalTax, double deliveryFee, double totalDiscount, double totalAmount, String createdAt, List<OrderItemDTO> items, String? paymentMethod, String? promoCodeId, String? deliveryAddress, String? notes, String? confirmedAt, String? deliveredAt, double? deliveryLat, double? deliveryLng
});




}
/// @nodoc
class _$OrderDTOCopyWithImpl<$Res>
    implements $OrderDTOCopyWith<$Res> {
  _$OrderDTOCopyWithImpl(this._self, this._then);

  final OrderDTO _self;
  final $Res Function(OrderDTO) _then;

/// Create a copy of OrderDTO
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? id = null,Object? businessId = null,Object? storeId = null,Object? orderNumber = null,Object? orderType = null,Object? orderSource = null,Object? status = null,Object? paymentStatus = null,Object? subtotal = null,Object? totalTax = null,Object? deliveryFee = null,Object? totalDiscount = null,Object? totalAmount = null,Object? createdAt = null,Object? items = null,Object? paymentMethod = freezed,Object? promoCodeId = freezed,Object? deliveryAddress = freezed,Object? notes = freezed,Object? confirmedAt = freezed,Object? deliveredAt = freezed,Object? deliveryLat = freezed,Object? deliveryLng = freezed,}) {
  return _then(_self.copyWith(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,businessId: null == businessId ? _self.businessId : businessId // ignore: cast_nullable_to_non_nullable
as String,storeId: null == storeId ? _self.storeId : storeId // ignore: cast_nullable_to_non_nullable
as String,orderNumber: null == orderNumber ? _self.orderNumber : orderNumber // ignore: cast_nullable_to_non_nullable
as String,orderType: null == orderType ? _self.orderType : orderType // ignore: cast_nullable_to_non_nullable
as String,orderSource: null == orderSource ? _self.orderSource : orderSource // ignore: cast_nullable_to_non_nullable
as String,status: null == status ? _self.status : status // ignore: cast_nullable_to_non_nullable
as String,paymentStatus: null == paymentStatus ? _self.paymentStatus : paymentStatus // ignore: cast_nullable_to_non_nullable
as String,subtotal: null == subtotal ? _self.subtotal : subtotal // ignore: cast_nullable_to_non_nullable
as double,totalTax: null == totalTax ? _self.totalTax : totalTax // ignore: cast_nullable_to_non_nullable
as double,deliveryFee: null == deliveryFee ? _self.deliveryFee : deliveryFee // ignore: cast_nullable_to_non_nullable
as double,totalDiscount: null == totalDiscount ? _self.totalDiscount : totalDiscount // ignore: cast_nullable_to_non_nullable
as double,totalAmount: null == totalAmount ? _self.totalAmount : totalAmount // ignore: cast_nullable_to_non_nullable
as double,createdAt: null == createdAt ? _self.createdAt : createdAt // ignore: cast_nullable_to_non_nullable
as String,items: null == items ? _self.items : items // ignore: cast_nullable_to_non_nullable
as List<OrderItemDTO>,paymentMethod: freezed == paymentMethod ? _self.paymentMethod : paymentMethod // ignore: cast_nullable_to_non_nullable
as String?,promoCodeId: freezed == promoCodeId ? _self.promoCodeId : promoCodeId // ignore: cast_nullable_to_non_nullable
as String?,deliveryAddress: freezed == deliveryAddress ? _self.deliveryAddress : deliveryAddress // ignore: cast_nullable_to_non_nullable
as String?,notes: freezed == notes ? _self.notes : notes // ignore: cast_nullable_to_non_nullable
as String?,confirmedAt: freezed == confirmedAt ? _self.confirmedAt : confirmedAt // ignore: cast_nullable_to_non_nullable
as String?,deliveredAt: freezed == deliveredAt ? _self.deliveredAt : deliveredAt // ignore: cast_nullable_to_non_nullable
as String?,deliveryLat: freezed == deliveryLat ? _self.deliveryLat : deliveryLat // ignore: cast_nullable_to_non_nullable
as double?,deliveryLng: freezed == deliveryLng ? _self.deliveryLng : deliveryLng // ignore: cast_nullable_to_non_nullable
as double?,
  ));
}

}


/// Adds pattern-matching-related methods to [OrderDTO].
extension OrderDTOPatterns on OrderDTO {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _OrderDTO value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _OrderDTO() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _OrderDTO value)  $default,){
final _that = this;
switch (_that) {
case _OrderDTO():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _OrderDTO value)?  $default,){
final _that = this;
switch (_that) {
case _OrderDTO() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String id,  String businessId,  String storeId,  String orderNumber,  String orderType,  String orderSource,  String status,  String paymentStatus,  double subtotal,  double totalTax,  double deliveryFee,  double totalDiscount,  double totalAmount,  String createdAt,  List<OrderItemDTO> items,  String? paymentMethod,  String? promoCodeId,  String? deliveryAddress,  String? notes,  String? confirmedAt,  String? deliveredAt,  double? deliveryLat,  double? deliveryLng)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _OrderDTO() when $default != null:
return $default(_that.id,_that.businessId,_that.storeId,_that.orderNumber,_that.orderType,_that.orderSource,_that.status,_that.paymentStatus,_that.subtotal,_that.totalTax,_that.deliveryFee,_that.totalDiscount,_that.totalAmount,_that.createdAt,_that.items,_that.paymentMethod,_that.promoCodeId,_that.deliveryAddress,_that.notes,_that.confirmedAt,_that.deliveredAt,_that.deliveryLat,_that.deliveryLng);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String id,  String businessId,  String storeId,  String orderNumber,  String orderType,  String orderSource,  String status,  String paymentStatus,  double subtotal,  double totalTax,  double deliveryFee,  double totalDiscount,  double totalAmount,  String createdAt,  List<OrderItemDTO> items,  String? paymentMethod,  String? promoCodeId,  String? deliveryAddress,  String? notes,  String? confirmedAt,  String? deliveredAt,  double? deliveryLat,  double? deliveryLng)  $default,) {final _that = this;
switch (_that) {
case _OrderDTO():
return $default(_that.id,_that.businessId,_that.storeId,_that.orderNumber,_that.orderType,_that.orderSource,_that.status,_that.paymentStatus,_that.subtotal,_that.totalTax,_that.deliveryFee,_that.totalDiscount,_that.totalAmount,_that.createdAt,_that.items,_that.paymentMethod,_that.promoCodeId,_that.deliveryAddress,_that.notes,_that.confirmedAt,_that.deliveredAt,_that.deliveryLat,_that.deliveryLng);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String id,  String businessId,  String storeId,  String orderNumber,  String orderType,  String orderSource,  String status,  String paymentStatus,  double subtotal,  double totalTax,  double deliveryFee,  double totalDiscount,  double totalAmount,  String createdAt,  List<OrderItemDTO> items,  String? paymentMethod,  String? promoCodeId,  String? deliveryAddress,  String? notes,  String? confirmedAt,  String? deliveredAt,  double? deliveryLat,  double? deliveryLng)?  $default,) {final _that = this;
switch (_that) {
case _OrderDTO() when $default != null:
return $default(_that.id,_that.businessId,_that.storeId,_that.orderNumber,_that.orderType,_that.orderSource,_that.status,_that.paymentStatus,_that.subtotal,_that.totalTax,_that.deliveryFee,_that.totalDiscount,_that.totalAmount,_that.createdAt,_that.items,_that.paymentMethod,_that.promoCodeId,_that.deliveryAddress,_that.notes,_that.confirmedAt,_that.deliveredAt,_that.deliveryLat,_that.deliveryLng);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _OrderDTO implements OrderDTO {
  const _OrderDTO({required this.id, required this.businessId, required this.storeId, required this.orderNumber, required this.orderType, required this.orderSource, required this.status, required this.paymentStatus, required this.subtotal, required this.totalTax, required this.deliveryFee, required this.totalDiscount, required this.totalAmount, required this.createdAt, final  List<OrderItemDTO> items = const [], this.paymentMethod, this.promoCodeId, this.deliveryAddress, this.notes, this.confirmedAt, this.deliveredAt, this.deliveryLat, this.deliveryLng}): _items = items;
  factory _OrderDTO.fromJson(Map<String, dynamic> json) => _$OrderDTOFromJson(json);

@override final  String id;
@override final  String businessId;
@override final  String storeId;
@override final  String orderNumber;
@override final  String orderType;
@override final  String orderSource;
@override final  String status;
@override final  String paymentStatus;
@override final  double subtotal;
@override final  double totalTax;
@override final  double deliveryFee;
@override final  double totalDiscount;
@override final  double totalAmount;
@override final  String createdAt;
 final  List<OrderItemDTO> _items;
@override@JsonKey() List<OrderItemDTO> get items {
  if (_items is EqualUnmodifiableListView) return _items;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_items);
}

@override final  String? paymentMethod;
@override final  String? promoCodeId;
@override final  String? deliveryAddress;
@override final  String? notes;
@override final  String? confirmedAt;
@override final  String? deliveredAt;
@override final  double? deliveryLat;
@override final  double? deliveryLng;

/// Create a copy of OrderDTO
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$OrderDTOCopyWith<_OrderDTO> get copyWith => __$OrderDTOCopyWithImpl<_OrderDTO>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$OrderDTOToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _OrderDTO&&(identical(other.id, id) || other.id == id)&&(identical(other.businessId, businessId) || other.businessId == businessId)&&(identical(other.storeId, storeId) || other.storeId == storeId)&&(identical(other.orderNumber, orderNumber) || other.orderNumber == orderNumber)&&(identical(other.orderType, orderType) || other.orderType == orderType)&&(identical(other.orderSource, orderSource) || other.orderSource == orderSource)&&(identical(other.status, status) || other.status == status)&&(identical(other.paymentStatus, paymentStatus) || other.paymentStatus == paymentStatus)&&(identical(other.subtotal, subtotal) || other.subtotal == subtotal)&&(identical(other.totalTax, totalTax) || other.totalTax == totalTax)&&(identical(other.deliveryFee, deliveryFee) || other.deliveryFee == deliveryFee)&&(identical(other.totalDiscount, totalDiscount) || other.totalDiscount == totalDiscount)&&(identical(other.totalAmount, totalAmount) || other.totalAmount == totalAmount)&&(identical(other.createdAt, createdAt) || other.createdAt == createdAt)&&const DeepCollectionEquality().equals(other._items, _items)&&(identical(other.paymentMethod, paymentMethod) || other.paymentMethod == paymentMethod)&&(identical(other.promoCodeId, promoCodeId) || other.promoCodeId == promoCodeId)&&(identical(other.deliveryAddress, deliveryAddress) || other.deliveryAddress == deliveryAddress)&&(identical(other.notes, notes) || other.notes == notes)&&(identical(other.confirmedAt, confirmedAt) || other.confirmedAt == confirmedAt)&&(identical(other.deliveredAt, deliveredAt) || other.deliveredAt == deliveredAt)&&(identical(other.deliveryLat, deliveryLat) || other.deliveryLat == deliveryLat)&&(identical(other.deliveryLng, deliveryLng) || other.deliveryLng == deliveryLng));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hashAll([runtimeType,id,businessId,storeId,orderNumber,orderType,orderSource,status,paymentStatus,subtotal,totalTax,deliveryFee,totalDiscount,totalAmount,createdAt,const DeepCollectionEquality().hash(_items),paymentMethod,promoCodeId,deliveryAddress,notes,confirmedAt,deliveredAt,deliveryLat,deliveryLng]);

@override
String toString() {
  return 'OrderDTO(id: $id, businessId: $businessId, storeId: $storeId, orderNumber: $orderNumber, orderType: $orderType, orderSource: $orderSource, status: $status, paymentStatus: $paymentStatus, subtotal: $subtotal, totalTax: $totalTax, deliveryFee: $deliveryFee, totalDiscount: $totalDiscount, totalAmount: $totalAmount, createdAt: $createdAt, items: $items, paymentMethod: $paymentMethod, promoCodeId: $promoCodeId, deliveryAddress: $deliveryAddress, notes: $notes, confirmedAt: $confirmedAt, deliveredAt: $deliveredAt, deliveryLat: $deliveryLat, deliveryLng: $deliveryLng)';
}


}

/// @nodoc
abstract mixin class _$OrderDTOCopyWith<$Res> implements $OrderDTOCopyWith<$Res> {
  factory _$OrderDTOCopyWith(_OrderDTO value, $Res Function(_OrderDTO) _then) = __$OrderDTOCopyWithImpl;
@override @useResult
$Res call({
 String id, String businessId, String storeId, String orderNumber, String orderType, String orderSource, String status, String paymentStatus, double subtotal, double totalTax, double deliveryFee, double totalDiscount, double totalAmount, String createdAt, List<OrderItemDTO> items, String? paymentMethod, String? promoCodeId, String? deliveryAddress, String? notes, String? confirmedAt, String? deliveredAt, double? deliveryLat, double? deliveryLng
});




}
/// @nodoc
class __$OrderDTOCopyWithImpl<$Res>
    implements _$OrderDTOCopyWith<$Res> {
  __$OrderDTOCopyWithImpl(this._self, this._then);

  final _OrderDTO _self;
  final $Res Function(_OrderDTO) _then;

/// Create a copy of OrderDTO
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? id = null,Object? businessId = null,Object? storeId = null,Object? orderNumber = null,Object? orderType = null,Object? orderSource = null,Object? status = null,Object? paymentStatus = null,Object? subtotal = null,Object? totalTax = null,Object? deliveryFee = null,Object? totalDiscount = null,Object? totalAmount = null,Object? createdAt = null,Object? items = null,Object? paymentMethod = freezed,Object? promoCodeId = freezed,Object? deliveryAddress = freezed,Object? notes = freezed,Object? confirmedAt = freezed,Object? deliveredAt = freezed,Object? deliveryLat = freezed,Object? deliveryLng = freezed,}) {
  return _then(_OrderDTO(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,businessId: null == businessId ? _self.businessId : businessId // ignore: cast_nullable_to_non_nullable
as String,storeId: null == storeId ? _self.storeId : storeId // ignore: cast_nullable_to_non_nullable
as String,orderNumber: null == orderNumber ? _self.orderNumber : orderNumber // ignore: cast_nullable_to_non_nullable
as String,orderType: null == orderType ? _self.orderType : orderType // ignore: cast_nullable_to_non_nullable
as String,orderSource: null == orderSource ? _self.orderSource : orderSource // ignore: cast_nullable_to_non_nullable
as String,status: null == status ? _self.status : status // ignore: cast_nullable_to_non_nullable
as String,paymentStatus: null == paymentStatus ? _self.paymentStatus : paymentStatus // ignore: cast_nullable_to_non_nullable
as String,subtotal: null == subtotal ? _self.subtotal : subtotal // ignore: cast_nullable_to_non_nullable
as double,totalTax: null == totalTax ? _self.totalTax : totalTax // ignore: cast_nullable_to_non_nullable
as double,deliveryFee: null == deliveryFee ? _self.deliveryFee : deliveryFee // ignore: cast_nullable_to_non_nullable
as double,totalDiscount: null == totalDiscount ? _self.totalDiscount : totalDiscount // ignore: cast_nullable_to_non_nullable
as double,totalAmount: null == totalAmount ? _self.totalAmount : totalAmount // ignore: cast_nullable_to_non_nullable
as double,createdAt: null == createdAt ? _self.createdAt : createdAt // ignore: cast_nullable_to_non_nullable
as String,items: null == items ? _self._items : items // ignore: cast_nullable_to_non_nullable
as List<OrderItemDTO>,paymentMethod: freezed == paymentMethod ? _self.paymentMethod : paymentMethod // ignore: cast_nullable_to_non_nullable
as String?,promoCodeId: freezed == promoCodeId ? _self.promoCodeId : promoCodeId // ignore: cast_nullable_to_non_nullable
as String?,deliveryAddress: freezed == deliveryAddress ? _self.deliveryAddress : deliveryAddress // ignore: cast_nullable_to_non_nullable
as String?,notes: freezed == notes ? _self.notes : notes // ignore: cast_nullable_to_non_nullable
as String?,confirmedAt: freezed == confirmedAt ? _self.confirmedAt : confirmedAt // ignore: cast_nullable_to_non_nullable
as String?,deliveredAt: freezed == deliveredAt ? _self.deliveredAt : deliveredAt // ignore: cast_nullable_to_non_nullable
as String?,deliveryLat: freezed == deliveryLat ? _self.deliveryLat : deliveryLat // ignore: cast_nullable_to_non_nullable
as double?,deliveryLng: freezed == deliveryLng ? _self.deliveryLng : deliveryLng // ignore: cast_nullable_to_non_nullable
as double?,
  ));
}


}


/// @nodoc
mixin _$CreateOrderItem {

 String get productId; int get quantity; String? get variantId; String? get specialInstructions; Map<String, dynamic>? get customizations;
/// Create a copy of CreateOrderItem
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$CreateOrderItemCopyWith<CreateOrderItem> get copyWith => _$CreateOrderItemCopyWithImpl<CreateOrderItem>(this as CreateOrderItem, _$identity);

  /// Serializes this CreateOrderItem to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is CreateOrderItem&&(identical(other.productId, productId) || other.productId == productId)&&(identical(other.quantity, quantity) || other.quantity == quantity)&&(identical(other.variantId, variantId) || other.variantId == variantId)&&(identical(other.specialInstructions, specialInstructions) || other.specialInstructions == specialInstructions)&&const DeepCollectionEquality().equals(other.customizations, customizations));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,productId,quantity,variantId,specialInstructions,const DeepCollectionEquality().hash(customizations));

@override
String toString() {
  return 'CreateOrderItem(productId: $productId, quantity: $quantity, variantId: $variantId, specialInstructions: $specialInstructions, customizations: $customizations)';
}


}

/// @nodoc
abstract mixin class $CreateOrderItemCopyWith<$Res>  {
  factory $CreateOrderItemCopyWith(CreateOrderItem value, $Res Function(CreateOrderItem) _then) = _$CreateOrderItemCopyWithImpl;
@useResult
$Res call({
 String productId, int quantity, String? variantId, String? specialInstructions, Map<String, dynamic>? customizations
});




}
/// @nodoc
class _$CreateOrderItemCopyWithImpl<$Res>
    implements $CreateOrderItemCopyWith<$Res> {
  _$CreateOrderItemCopyWithImpl(this._self, this._then);

  final CreateOrderItem _self;
  final $Res Function(CreateOrderItem) _then;

/// Create a copy of CreateOrderItem
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? productId = null,Object? quantity = null,Object? variantId = freezed,Object? specialInstructions = freezed,Object? customizations = freezed,}) {
  return _then(_self.copyWith(
productId: null == productId ? _self.productId : productId // ignore: cast_nullable_to_non_nullable
as String,quantity: null == quantity ? _self.quantity : quantity // ignore: cast_nullable_to_non_nullable
as int,variantId: freezed == variantId ? _self.variantId : variantId // ignore: cast_nullable_to_non_nullable
as String?,specialInstructions: freezed == specialInstructions ? _self.specialInstructions : specialInstructions // ignore: cast_nullable_to_non_nullable
as String?,customizations: freezed == customizations ? _self.customizations : customizations // ignore: cast_nullable_to_non_nullable
as Map<String, dynamic>?,
  ));
}

}


/// Adds pattern-matching-related methods to [CreateOrderItem].
extension CreateOrderItemPatterns on CreateOrderItem {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _CreateOrderItem value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _CreateOrderItem() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _CreateOrderItem value)  $default,){
final _that = this;
switch (_that) {
case _CreateOrderItem():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _CreateOrderItem value)?  $default,){
final _that = this;
switch (_that) {
case _CreateOrderItem() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String productId,  int quantity,  String? variantId,  String? specialInstructions,  Map<String, dynamic>? customizations)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _CreateOrderItem() when $default != null:
return $default(_that.productId,_that.quantity,_that.variantId,_that.specialInstructions,_that.customizations);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String productId,  int quantity,  String? variantId,  String? specialInstructions,  Map<String, dynamic>? customizations)  $default,) {final _that = this;
switch (_that) {
case _CreateOrderItem():
return $default(_that.productId,_that.quantity,_that.variantId,_that.specialInstructions,_that.customizations);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String productId,  int quantity,  String? variantId,  String? specialInstructions,  Map<String, dynamic>? customizations)?  $default,) {final _that = this;
switch (_that) {
case _CreateOrderItem() when $default != null:
return $default(_that.productId,_that.quantity,_that.variantId,_that.specialInstructions,_that.customizations);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _CreateOrderItem implements CreateOrderItem {
  const _CreateOrderItem({required this.productId, required this.quantity, this.variantId, this.specialInstructions, final  Map<String, dynamic>? customizations}): _customizations = customizations;
  factory _CreateOrderItem.fromJson(Map<String, dynamic> json) => _$CreateOrderItemFromJson(json);

@override final  String productId;
@override final  int quantity;
@override final  String? variantId;
@override final  String? specialInstructions;
 final  Map<String, dynamic>? _customizations;
@override Map<String, dynamic>? get customizations {
  final value = _customizations;
  if (value == null) return null;
  if (_customizations is EqualUnmodifiableMapView) return _customizations;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableMapView(value);
}


/// Create a copy of CreateOrderItem
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$CreateOrderItemCopyWith<_CreateOrderItem> get copyWith => __$CreateOrderItemCopyWithImpl<_CreateOrderItem>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$CreateOrderItemToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _CreateOrderItem&&(identical(other.productId, productId) || other.productId == productId)&&(identical(other.quantity, quantity) || other.quantity == quantity)&&(identical(other.variantId, variantId) || other.variantId == variantId)&&(identical(other.specialInstructions, specialInstructions) || other.specialInstructions == specialInstructions)&&const DeepCollectionEquality().equals(other._customizations, _customizations));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,productId,quantity,variantId,specialInstructions,const DeepCollectionEquality().hash(_customizations));

@override
String toString() {
  return 'CreateOrderItem(productId: $productId, quantity: $quantity, variantId: $variantId, specialInstructions: $specialInstructions, customizations: $customizations)';
}


}

/// @nodoc
abstract mixin class _$CreateOrderItemCopyWith<$Res> implements $CreateOrderItemCopyWith<$Res> {
  factory _$CreateOrderItemCopyWith(_CreateOrderItem value, $Res Function(_CreateOrderItem) _then) = __$CreateOrderItemCopyWithImpl;
@override @useResult
$Res call({
 String productId, int quantity, String? variantId, String? specialInstructions, Map<String, dynamic>? customizations
});




}
/// @nodoc
class __$CreateOrderItemCopyWithImpl<$Res>
    implements _$CreateOrderItemCopyWith<$Res> {
  __$CreateOrderItemCopyWithImpl(this._self, this._then);

  final _CreateOrderItem _self;
  final $Res Function(_CreateOrderItem) _then;

/// Create a copy of CreateOrderItem
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? productId = null,Object? quantity = null,Object? variantId = freezed,Object? specialInstructions = freezed,Object? customizations = freezed,}) {
  return _then(_CreateOrderItem(
productId: null == productId ? _self.productId : productId // ignore: cast_nullable_to_non_nullable
as String,quantity: null == quantity ? _self.quantity : quantity // ignore: cast_nullable_to_non_nullable
as int,variantId: freezed == variantId ? _self.variantId : variantId // ignore: cast_nullable_to_non_nullable
as String?,specialInstructions: freezed == specialInstructions ? _self.specialInstructions : specialInstructions // ignore: cast_nullable_to_non_nullable
as String?,customizations: freezed == customizations ? _self._customizations : customizations // ignore: cast_nullable_to_non_nullable
as Map<String, dynamic>?,
  ));
}


}


/// @nodoc
mixin _$CreateOrderRequest {

 String get storeId; String get orderType; List<CreateOrderItem> get items; String? get deliveryAddressId; String? get paymentMethod; String? get promoCodeId; String? get deliveryInstructions; String? get notes; double get deliveryFee;
/// Create a copy of CreateOrderRequest
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$CreateOrderRequestCopyWith<CreateOrderRequest> get copyWith => _$CreateOrderRequestCopyWithImpl<CreateOrderRequest>(this as CreateOrderRequest, _$identity);

  /// Serializes this CreateOrderRequest to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is CreateOrderRequest&&(identical(other.storeId, storeId) || other.storeId == storeId)&&(identical(other.orderType, orderType) || other.orderType == orderType)&&const DeepCollectionEquality().equals(other.items, items)&&(identical(other.deliveryAddressId, deliveryAddressId) || other.deliveryAddressId == deliveryAddressId)&&(identical(other.paymentMethod, paymentMethod) || other.paymentMethod == paymentMethod)&&(identical(other.promoCodeId, promoCodeId) || other.promoCodeId == promoCodeId)&&(identical(other.deliveryInstructions, deliveryInstructions) || other.deliveryInstructions == deliveryInstructions)&&(identical(other.notes, notes) || other.notes == notes)&&(identical(other.deliveryFee, deliveryFee) || other.deliveryFee == deliveryFee));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,storeId,orderType,const DeepCollectionEquality().hash(items),deliveryAddressId,paymentMethod,promoCodeId,deliveryInstructions,notes,deliveryFee);

@override
String toString() {
  return 'CreateOrderRequest(storeId: $storeId, orderType: $orderType, items: $items, deliveryAddressId: $deliveryAddressId, paymentMethod: $paymentMethod, promoCodeId: $promoCodeId, deliveryInstructions: $deliveryInstructions, notes: $notes, deliveryFee: $deliveryFee)';
}


}

/// @nodoc
abstract mixin class $CreateOrderRequestCopyWith<$Res>  {
  factory $CreateOrderRequestCopyWith(CreateOrderRequest value, $Res Function(CreateOrderRequest) _then) = _$CreateOrderRequestCopyWithImpl;
@useResult
$Res call({
 String storeId, String orderType, List<CreateOrderItem> items, String? deliveryAddressId, String? paymentMethod, String? promoCodeId, String? deliveryInstructions, String? notes, double deliveryFee
});




}
/// @nodoc
class _$CreateOrderRequestCopyWithImpl<$Res>
    implements $CreateOrderRequestCopyWith<$Res> {
  _$CreateOrderRequestCopyWithImpl(this._self, this._then);

  final CreateOrderRequest _self;
  final $Res Function(CreateOrderRequest) _then;

/// Create a copy of CreateOrderRequest
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? storeId = null,Object? orderType = null,Object? items = null,Object? deliveryAddressId = freezed,Object? paymentMethod = freezed,Object? promoCodeId = freezed,Object? deliveryInstructions = freezed,Object? notes = freezed,Object? deliveryFee = null,}) {
  return _then(_self.copyWith(
storeId: null == storeId ? _self.storeId : storeId // ignore: cast_nullable_to_non_nullable
as String,orderType: null == orderType ? _self.orderType : orderType // ignore: cast_nullable_to_non_nullable
as String,items: null == items ? _self.items : items // ignore: cast_nullable_to_non_nullable
as List<CreateOrderItem>,deliveryAddressId: freezed == deliveryAddressId ? _self.deliveryAddressId : deliveryAddressId // ignore: cast_nullable_to_non_nullable
as String?,paymentMethod: freezed == paymentMethod ? _self.paymentMethod : paymentMethod // ignore: cast_nullable_to_non_nullable
as String?,promoCodeId: freezed == promoCodeId ? _self.promoCodeId : promoCodeId // ignore: cast_nullable_to_non_nullable
as String?,deliveryInstructions: freezed == deliveryInstructions ? _self.deliveryInstructions : deliveryInstructions // ignore: cast_nullable_to_non_nullable
as String?,notes: freezed == notes ? _self.notes : notes // ignore: cast_nullable_to_non_nullable
as String?,deliveryFee: null == deliveryFee ? _self.deliveryFee : deliveryFee // ignore: cast_nullable_to_non_nullable
as double,
  ));
}

}


/// Adds pattern-matching-related methods to [CreateOrderRequest].
extension CreateOrderRequestPatterns on CreateOrderRequest {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _CreateOrderRequest value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _CreateOrderRequest() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _CreateOrderRequest value)  $default,){
final _that = this;
switch (_that) {
case _CreateOrderRequest():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _CreateOrderRequest value)?  $default,){
final _that = this;
switch (_that) {
case _CreateOrderRequest() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String storeId,  String orderType,  List<CreateOrderItem> items,  String? deliveryAddressId,  String? paymentMethod,  String? promoCodeId,  String? deliveryInstructions,  String? notes,  double deliveryFee)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _CreateOrderRequest() when $default != null:
return $default(_that.storeId,_that.orderType,_that.items,_that.deliveryAddressId,_that.paymentMethod,_that.promoCodeId,_that.deliveryInstructions,_that.notes,_that.deliveryFee);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String storeId,  String orderType,  List<CreateOrderItem> items,  String? deliveryAddressId,  String? paymentMethod,  String? promoCodeId,  String? deliveryInstructions,  String? notes,  double deliveryFee)  $default,) {final _that = this;
switch (_that) {
case _CreateOrderRequest():
return $default(_that.storeId,_that.orderType,_that.items,_that.deliveryAddressId,_that.paymentMethod,_that.promoCodeId,_that.deliveryInstructions,_that.notes,_that.deliveryFee);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String storeId,  String orderType,  List<CreateOrderItem> items,  String? deliveryAddressId,  String? paymentMethod,  String? promoCodeId,  String? deliveryInstructions,  String? notes,  double deliveryFee)?  $default,) {final _that = this;
switch (_that) {
case _CreateOrderRequest() when $default != null:
return $default(_that.storeId,_that.orderType,_that.items,_that.deliveryAddressId,_that.paymentMethod,_that.promoCodeId,_that.deliveryInstructions,_that.notes,_that.deliveryFee);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _CreateOrderRequest implements CreateOrderRequest {
  const _CreateOrderRequest({required this.storeId, required this.orderType, required final  List<CreateOrderItem> items, this.deliveryAddressId, this.paymentMethod, this.promoCodeId, this.deliveryInstructions, this.notes, this.deliveryFee = 0.0}): _items = items;
  factory _CreateOrderRequest.fromJson(Map<String, dynamic> json) => _$CreateOrderRequestFromJson(json);

@override final  String storeId;
@override final  String orderType;
 final  List<CreateOrderItem> _items;
@override List<CreateOrderItem> get items {
  if (_items is EqualUnmodifiableListView) return _items;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_items);
}

@override final  String? deliveryAddressId;
@override final  String? paymentMethod;
@override final  String? promoCodeId;
@override final  String? deliveryInstructions;
@override final  String? notes;
@override@JsonKey() final  double deliveryFee;

/// Create a copy of CreateOrderRequest
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$CreateOrderRequestCopyWith<_CreateOrderRequest> get copyWith => __$CreateOrderRequestCopyWithImpl<_CreateOrderRequest>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$CreateOrderRequestToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _CreateOrderRequest&&(identical(other.storeId, storeId) || other.storeId == storeId)&&(identical(other.orderType, orderType) || other.orderType == orderType)&&const DeepCollectionEquality().equals(other._items, _items)&&(identical(other.deliveryAddressId, deliveryAddressId) || other.deliveryAddressId == deliveryAddressId)&&(identical(other.paymentMethod, paymentMethod) || other.paymentMethod == paymentMethod)&&(identical(other.promoCodeId, promoCodeId) || other.promoCodeId == promoCodeId)&&(identical(other.deliveryInstructions, deliveryInstructions) || other.deliveryInstructions == deliveryInstructions)&&(identical(other.notes, notes) || other.notes == notes)&&(identical(other.deliveryFee, deliveryFee) || other.deliveryFee == deliveryFee));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,storeId,orderType,const DeepCollectionEquality().hash(_items),deliveryAddressId,paymentMethod,promoCodeId,deliveryInstructions,notes,deliveryFee);

@override
String toString() {
  return 'CreateOrderRequest(storeId: $storeId, orderType: $orderType, items: $items, deliveryAddressId: $deliveryAddressId, paymentMethod: $paymentMethod, promoCodeId: $promoCodeId, deliveryInstructions: $deliveryInstructions, notes: $notes, deliveryFee: $deliveryFee)';
}


}

/// @nodoc
abstract mixin class _$CreateOrderRequestCopyWith<$Res> implements $CreateOrderRequestCopyWith<$Res> {
  factory _$CreateOrderRequestCopyWith(_CreateOrderRequest value, $Res Function(_CreateOrderRequest) _then) = __$CreateOrderRequestCopyWithImpl;
@override @useResult
$Res call({
 String storeId, String orderType, List<CreateOrderItem> items, String? deliveryAddressId, String? paymentMethod, String? promoCodeId, String? deliveryInstructions, String? notes, double deliveryFee
});




}
/// @nodoc
class __$CreateOrderRequestCopyWithImpl<$Res>
    implements _$CreateOrderRequestCopyWith<$Res> {
  __$CreateOrderRequestCopyWithImpl(this._self, this._then);

  final _CreateOrderRequest _self;
  final $Res Function(_CreateOrderRequest) _then;

/// Create a copy of CreateOrderRequest
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? storeId = null,Object? orderType = null,Object? items = null,Object? deliveryAddressId = freezed,Object? paymentMethod = freezed,Object? promoCodeId = freezed,Object? deliveryInstructions = freezed,Object? notes = freezed,Object? deliveryFee = null,}) {
  return _then(_CreateOrderRequest(
storeId: null == storeId ? _self.storeId : storeId // ignore: cast_nullable_to_non_nullable
as String,orderType: null == orderType ? _self.orderType : orderType // ignore: cast_nullable_to_non_nullable
as String,items: null == items ? _self._items : items // ignore: cast_nullable_to_non_nullable
as List<CreateOrderItem>,deliveryAddressId: freezed == deliveryAddressId ? _self.deliveryAddressId : deliveryAddressId // ignore: cast_nullable_to_non_nullable
as String?,paymentMethod: freezed == paymentMethod ? _self.paymentMethod : paymentMethod // ignore: cast_nullable_to_non_nullable
as String?,promoCodeId: freezed == promoCodeId ? _self.promoCodeId : promoCodeId // ignore: cast_nullable_to_non_nullable
as String?,deliveryInstructions: freezed == deliveryInstructions ? _self.deliveryInstructions : deliveryInstructions // ignore: cast_nullable_to_non_nullable
as String?,notes: freezed == notes ? _self.notes : notes // ignore: cast_nullable_to_non_nullable
as String?,deliveryFee: null == deliveryFee ? _self.deliveryFee : deliveryFee // ignore: cast_nullable_to_non_nullable
as double,
  ));
}


}

// dart format on
