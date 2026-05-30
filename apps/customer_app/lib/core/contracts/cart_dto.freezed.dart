// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'cart_dto.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// dart format off
T _$identity<T>(T value) => value;

/// @nodoc
mixin _$CartVariantSummary {

 String get id; String get name; double get price; String? get sku; double? get mrp; double? get discountPrice;
/// Create a copy of CartVariantSummary
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$CartVariantSummaryCopyWith<CartVariantSummary> get copyWith => _$CartVariantSummaryCopyWithImpl<CartVariantSummary>(this as CartVariantSummary, _$identity);

  /// Serializes this CartVariantSummary to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is CartVariantSummary&&(identical(other.id, id) || other.id == id)&&(identical(other.name, name) || other.name == name)&&(identical(other.price, price) || other.price == price)&&(identical(other.sku, sku) || other.sku == sku)&&(identical(other.mrp, mrp) || other.mrp == mrp)&&(identical(other.discountPrice, discountPrice) || other.discountPrice == discountPrice));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,name,price,sku,mrp,discountPrice);

@override
String toString() {
  return 'CartVariantSummary(id: $id, name: $name, price: $price, sku: $sku, mrp: $mrp, discountPrice: $discountPrice)';
}


}

/// @nodoc
abstract mixin class $CartVariantSummaryCopyWith<$Res>  {
  factory $CartVariantSummaryCopyWith(CartVariantSummary value, $Res Function(CartVariantSummary) _then) = _$CartVariantSummaryCopyWithImpl;
@useResult
$Res call({
 String id, String name, double price, String? sku, double? mrp, double? discountPrice
});




}
/// @nodoc
class _$CartVariantSummaryCopyWithImpl<$Res>
    implements $CartVariantSummaryCopyWith<$Res> {
  _$CartVariantSummaryCopyWithImpl(this._self, this._then);

  final CartVariantSummary _self;
  final $Res Function(CartVariantSummary) _then;

/// Create a copy of CartVariantSummary
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? id = null,Object? name = null,Object? price = null,Object? sku = freezed,Object? mrp = freezed,Object? discountPrice = freezed,}) {
  return _then(_self.copyWith(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,name: null == name ? _self.name : name // ignore: cast_nullable_to_non_nullable
as String,price: null == price ? _self.price : price // ignore: cast_nullable_to_non_nullable
as double,sku: freezed == sku ? _self.sku : sku // ignore: cast_nullable_to_non_nullable
as String?,mrp: freezed == mrp ? _self.mrp : mrp // ignore: cast_nullable_to_non_nullable
as double?,discountPrice: freezed == discountPrice ? _self.discountPrice : discountPrice // ignore: cast_nullable_to_non_nullable
as double?,
  ));
}

}


/// Adds pattern-matching-related methods to [CartVariantSummary].
extension CartVariantSummaryPatterns on CartVariantSummary {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _CartVariantSummary value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _CartVariantSummary() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _CartVariantSummary value)  $default,){
final _that = this;
switch (_that) {
case _CartVariantSummary():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _CartVariantSummary value)?  $default,){
final _that = this;
switch (_that) {
case _CartVariantSummary() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String id,  String name,  double price,  String? sku,  double? mrp,  double? discountPrice)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _CartVariantSummary() when $default != null:
return $default(_that.id,_that.name,_that.price,_that.sku,_that.mrp,_that.discountPrice);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String id,  String name,  double price,  String? sku,  double? mrp,  double? discountPrice)  $default,) {final _that = this;
switch (_that) {
case _CartVariantSummary():
return $default(_that.id,_that.name,_that.price,_that.sku,_that.mrp,_that.discountPrice);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String id,  String name,  double price,  String? sku,  double? mrp,  double? discountPrice)?  $default,) {final _that = this;
switch (_that) {
case _CartVariantSummary() when $default != null:
return $default(_that.id,_that.name,_that.price,_that.sku,_that.mrp,_that.discountPrice);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _CartVariantSummary implements CartVariantSummary {
  const _CartVariantSummary({required this.id, required this.name, required this.price, this.sku, this.mrp, this.discountPrice});
  factory _CartVariantSummary.fromJson(Map<String, dynamic> json) => _$CartVariantSummaryFromJson(json);

@override final  String id;
@override final  String name;
@override final  double price;
@override final  String? sku;
@override final  double? mrp;
@override final  double? discountPrice;

/// Create a copy of CartVariantSummary
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$CartVariantSummaryCopyWith<_CartVariantSummary> get copyWith => __$CartVariantSummaryCopyWithImpl<_CartVariantSummary>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$CartVariantSummaryToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _CartVariantSummary&&(identical(other.id, id) || other.id == id)&&(identical(other.name, name) || other.name == name)&&(identical(other.price, price) || other.price == price)&&(identical(other.sku, sku) || other.sku == sku)&&(identical(other.mrp, mrp) || other.mrp == mrp)&&(identical(other.discountPrice, discountPrice) || other.discountPrice == discountPrice));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,name,price,sku,mrp,discountPrice);

@override
String toString() {
  return 'CartVariantSummary(id: $id, name: $name, price: $price, sku: $sku, mrp: $mrp, discountPrice: $discountPrice)';
}


}

/// @nodoc
abstract mixin class _$CartVariantSummaryCopyWith<$Res> implements $CartVariantSummaryCopyWith<$Res> {
  factory _$CartVariantSummaryCopyWith(_CartVariantSummary value, $Res Function(_CartVariantSummary) _then) = __$CartVariantSummaryCopyWithImpl;
@override @useResult
$Res call({
 String id, String name, double price, String? sku, double? mrp, double? discountPrice
});




}
/// @nodoc
class __$CartVariantSummaryCopyWithImpl<$Res>
    implements _$CartVariantSummaryCopyWith<$Res> {
  __$CartVariantSummaryCopyWithImpl(this._self, this._then);

  final _CartVariantSummary _self;
  final $Res Function(_CartVariantSummary) _then;

/// Create a copy of CartVariantSummary
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? id = null,Object? name = null,Object? price = null,Object? sku = freezed,Object? mrp = freezed,Object? discountPrice = freezed,}) {
  return _then(_CartVariantSummary(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,name: null == name ? _self.name : name // ignore: cast_nullable_to_non_nullable
as String,price: null == price ? _self.price : price // ignore: cast_nullable_to_non_nullable
as double,sku: freezed == sku ? _self.sku : sku // ignore: cast_nullable_to_non_nullable
as String?,mrp: freezed == mrp ? _self.mrp : mrp // ignore: cast_nullable_to_non_nullable
as double?,discountPrice: freezed == discountPrice ? _self.discountPrice : discountPrice // ignore: cast_nullable_to_non_nullable
as double?,
  ));
}


}


/// @nodoc
mixin _$CartProductSummary {

 String get name; String get slug; List<String> get images; String get status;
/// Create a copy of CartProductSummary
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$CartProductSummaryCopyWith<CartProductSummary> get copyWith => _$CartProductSummaryCopyWithImpl<CartProductSummary>(this as CartProductSummary, _$identity);

  /// Serializes this CartProductSummary to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is CartProductSummary&&(identical(other.name, name) || other.name == name)&&(identical(other.slug, slug) || other.slug == slug)&&const DeepCollectionEquality().equals(other.images, images)&&(identical(other.status, status) || other.status == status));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,name,slug,const DeepCollectionEquality().hash(images),status);

@override
String toString() {
  return 'CartProductSummary(name: $name, slug: $slug, images: $images, status: $status)';
}


}

/// @nodoc
abstract mixin class $CartProductSummaryCopyWith<$Res>  {
  factory $CartProductSummaryCopyWith(CartProductSummary value, $Res Function(CartProductSummary) _then) = _$CartProductSummaryCopyWithImpl;
@useResult
$Res call({
 String name, String slug, List<String> images, String status
});




}
/// @nodoc
class _$CartProductSummaryCopyWithImpl<$Res>
    implements $CartProductSummaryCopyWith<$Res> {
  _$CartProductSummaryCopyWithImpl(this._self, this._then);

  final CartProductSummary _self;
  final $Res Function(CartProductSummary) _then;

/// Create a copy of CartProductSummary
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? name = null,Object? slug = null,Object? images = null,Object? status = null,}) {
  return _then(_self.copyWith(
name: null == name ? _self.name : name // ignore: cast_nullable_to_non_nullable
as String,slug: null == slug ? _self.slug : slug // ignore: cast_nullable_to_non_nullable
as String,images: null == images ? _self.images : images // ignore: cast_nullable_to_non_nullable
as List<String>,status: null == status ? _self.status : status // ignore: cast_nullable_to_non_nullable
as String,
  ));
}

}


/// Adds pattern-matching-related methods to [CartProductSummary].
extension CartProductSummaryPatterns on CartProductSummary {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _CartProductSummary value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _CartProductSummary() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _CartProductSummary value)  $default,){
final _that = this;
switch (_that) {
case _CartProductSummary():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _CartProductSummary value)?  $default,){
final _that = this;
switch (_that) {
case _CartProductSummary() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String name,  String slug,  List<String> images,  String status)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _CartProductSummary() when $default != null:
return $default(_that.name,_that.slug,_that.images,_that.status);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String name,  String slug,  List<String> images,  String status)  $default,) {final _that = this;
switch (_that) {
case _CartProductSummary():
return $default(_that.name,_that.slug,_that.images,_that.status);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String name,  String slug,  List<String> images,  String status)?  $default,) {final _that = this;
switch (_that) {
case _CartProductSummary() when $default != null:
return $default(_that.name,_that.slug,_that.images,_that.status);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _CartProductSummary implements CartProductSummary {
  const _CartProductSummary({required this.name, required this.slug, required final  List<String> images, required this.status}): _images = images;
  factory _CartProductSummary.fromJson(Map<String, dynamic> json) => _$CartProductSummaryFromJson(json);

@override final  String name;
@override final  String slug;
 final  List<String> _images;
@override List<String> get images {
  if (_images is EqualUnmodifiableListView) return _images;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_images);
}

@override final  String status;

/// Create a copy of CartProductSummary
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$CartProductSummaryCopyWith<_CartProductSummary> get copyWith => __$CartProductSummaryCopyWithImpl<_CartProductSummary>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$CartProductSummaryToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _CartProductSummary&&(identical(other.name, name) || other.name == name)&&(identical(other.slug, slug) || other.slug == slug)&&const DeepCollectionEquality().equals(other._images, _images)&&(identical(other.status, status) || other.status == status));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,name,slug,const DeepCollectionEquality().hash(_images),status);

@override
String toString() {
  return 'CartProductSummary(name: $name, slug: $slug, images: $images, status: $status)';
}


}

/// @nodoc
abstract mixin class _$CartProductSummaryCopyWith<$Res> implements $CartProductSummaryCopyWith<$Res> {
  factory _$CartProductSummaryCopyWith(_CartProductSummary value, $Res Function(_CartProductSummary) _then) = __$CartProductSummaryCopyWithImpl;
@override @useResult
$Res call({
 String name, String slug, List<String> images, String status
});




}
/// @nodoc
class __$CartProductSummaryCopyWithImpl<$Res>
    implements _$CartProductSummaryCopyWith<$Res> {
  __$CartProductSummaryCopyWithImpl(this._self, this._then);

  final _CartProductSummary _self;
  final $Res Function(_CartProductSummary) _then;

/// Create a copy of CartProductSummary
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? name = null,Object? slug = null,Object? images = null,Object? status = null,}) {
  return _then(_CartProductSummary(
name: null == name ? _self.name : name // ignore: cast_nullable_to_non_nullable
as String,slug: null == slug ? _self.slug : slug // ignore: cast_nullable_to_non_nullable
as String,images: null == images ? _self._images : images // ignore: cast_nullable_to_non_nullable
as List<String>,status: null == status ? _self.status : status // ignore: cast_nullable_to_non_nullable
as String,
  ));
}


}


/// @nodoc
mixin _$CartItemDTO {

 String get id; String get productId; String get storeId; int get quantity; double get unitPrice; double get lineTotal; CartProductSummary get product; String? get variantId; int? get availableQty; String? get inventoryStatus; CartVariantSummary? get variant;
/// Create a copy of CartItemDTO
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$CartItemDTOCopyWith<CartItemDTO> get copyWith => _$CartItemDTOCopyWithImpl<CartItemDTO>(this as CartItemDTO, _$identity);

  /// Serializes this CartItemDTO to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is CartItemDTO&&(identical(other.id, id) || other.id == id)&&(identical(other.productId, productId) || other.productId == productId)&&(identical(other.storeId, storeId) || other.storeId == storeId)&&(identical(other.quantity, quantity) || other.quantity == quantity)&&(identical(other.unitPrice, unitPrice) || other.unitPrice == unitPrice)&&(identical(other.lineTotal, lineTotal) || other.lineTotal == lineTotal)&&(identical(other.product, product) || other.product == product)&&(identical(other.variantId, variantId) || other.variantId == variantId)&&(identical(other.availableQty, availableQty) || other.availableQty == availableQty)&&(identical(other.inventoryStatus, inventoryStatus) || other.inventoryStatus == inventoryStatus)&&(identical(other.variant, variant) || other.variant == variant));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,productId,storeId,quantity,unitPrice,lineTotal,product,variantId,availableQty,inventoryStatus,variant);

@override
String toString() {
  return 'CartItemDTO(id: $id, productId: $productId, storeId: $storeId, quantity: $quantity, unitPrice: $unitPrice, lineTotal: $lineTotal, product: $product, variantId: $variantId, availableQty: $availableQty, inventoryStatus: $inventoryStatus, variant: $variant)';
}


}

/// @nodoc
abstract mixin class $CartItemDTOCopyWith<$Res>  {
  factory $CartItemDTOCopyWith(CartItemDTO value, $Res Function(CartItemDTO) _then) = _$CartItemDTOCopyWithImpl;
@useResult
$Res call({
 String id, String productId, String storeId, int quantity, double unitPrice, double lineTotal, CartProductSummary product, String? variantId, int? availableQty, String? inventoryStatus, CartVariantSummary? variant
});


$CartProductSummaryCopyWith<$Res> get product;$CartVariantSummaryCopyWith<$Res>? get variant;

}
/// @nodoc
class _$CartItemDTOCopyWithImpl<$Res>
    implements $CartItemDTOCopyWith<$Res> {
  _$CartItemDTOCopyWithImpl(this._self, this._then);

  final CartItemDTO _self;
  final $Res Function(CartItemDTO) _then;

/// Create a copy of CartItemDTO
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? id = null,Object? productId = null,Object? storeId = null,Object? quantity = null,Object? unitPrice = null,Object? lineTotal = null,Object? product = null,Object? variantId = freezed,Object? availableQty = freezed,Object? inventoryStatus = freezed,Object? variant = freezed,}) {
  return _then(_self.copyWith(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,productId: null == productId ? _self.productId : productId // ignore: cast_nullable_to_non_nullable
as String,storeId: null == storeId ? _self.storeId : storeId // ignore: cast_nullable_to_non_nullable
as String,quantity: null == quantity ? _self.quantity : quantity // ignore: cast_nullable_to_non_nullable
as int,unitPrice: null == unitPrice ? _self.unitPrice : unitPrice // ignore: cast_nullable_to_non_nullable
as double,lineTotal: null == lineTotal ? _self.lineTotal : lineTotal // ignore: cast_nullable_to_non_nullable
as double,product: null == product ? _self.product : product // ignore: cast_nullable_to_non_nullable
as CartProductSummary,variantId: freezed == variantId ? _self.variantId : variantId // ignore: cast_nullable_to_non_nullable
as String?,availableQty: freezed == availableQty ? _self.availableQty : availableQty // ignore: cast_nullable_to_non_nullable
as int?,inventoryStatus: freezed == inventoryStatus ? _self.inventoryStatus : inventoryStatus // ignore: cast_nullable_to_non_nullable
as String?,variant: freezed == variant ? _self.variant : variant // ignore: cast_nullable_to_non_nullable
as CartVariantSummary?,
  ));
}
/// Create a copy of CartItemDTO
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$CartProductSummaryCopyWith<$Res> get product {
  
  return $CartProductSummaryCopyWith<$Res>(_self.product, (value) {
    return _then(_self.copyWith(product: value));
  });
}/// Create a copy of CartItemDTO
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$CartVariantSummaryCopyWith<$Res>? get variant {
    if (_self.variant == null) {
    return null;
  }

  return $CartVariantSummaryCopyWith<$Res>(_self.variant!, (value) {
    return _then(_self.copyWith(variant: value));
  });
}
}


/// Adds pattern-matching-related methods to [CartItemDTO].
extension CartItemDTOPatterns on CartItemDTO {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _CartItemDTO value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _CartItemDTO() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _CartItemDTO value)  $default,){
final _that = this;
switch (_that) {
case _CartItemDTO():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _CartItemDTO value)?  $default,){
final _that = this;
switch (_that) {
case _CartItemDTO() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String id,  String productId,  String storeId,  int quantity,  double unitPrice,  double lineTotal,  CartProductSummary product,  String? variantId,  int? availableQty,  String? inventoryStatus,  CartVariantSummary? variant)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _CartItemDTO() when $default != null:
return $default(_that.id,_that.productId,_that.storeId,_that.quantity,_that.unitPrice,_that.lineTotal,_that.product,_that.variantId,_that.availableQty,_that.inventoryStatus,_that.variant);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String id,  String productId,  String storeId,  int quantity,  double unitPrice,  double lineTotal,  CartProductSummary product,  String? variantId,  int? availableQty,  String? inventoryStatus,  CartVariantSummary? variant)  $default,) {final _that = this;
switch (_that) {
case _CartItemDTO():
return $default(_that.id,_that.productId,_that.storeId,_that.quantity,_that.unitPrice,_that.lineTotal,_that.product,_that.variantId,_that.availableQty,_that.inventoryStatus,_that.variant);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String id,  String productId,  String storeId,  int quantity,  double unitPrice,  double lineTotal,  CartProductSummary product,  String? variantId,  int? availableQty,  String? inventoryStatus,  CartVariantSummary? variant)?  $default,) {final _that = this;
switch (_that) {
case _CartItemDTO() when $default != null:
return $default(_that.id,_that.productId,_that.storeId,_that.quantity,_that.unitPrice,_that.lineTotal,_that.product,_that.variantId,_that.availableQty,_that.inventoryStatus,_that.variant);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _CartItemDTO implements CartItemDTO {
  const _CartItemDTO({required this.id, required this.productId, required this.storeId, required this.quantity, required this.unitPrice, required this.lineTotal, required this.product, this.variantId, this.availableQty, this.inventoryStatus, this.variant});
  factory _CartItemDTO.fromJson(Map<String, dynamic> json) => _$CartItemDTOFromJson(json);

@override final  String id;
@override final  String productId;
@override final  String storeId;
@override final  int quantity;
@override final  double unitPrice;
@override final  double lineTotal;
@override final  CartProductSummary product;
@override final  String? variantId;
@override final  int? availableQty;
@override final  String? inventoryStatus;
@override final  CartVariantSummary? variant;

/// Create a copy of CartItemDTO
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$CartItemDTOCopyWith<_CartItemDTO> get copyWith => __$CartItemDTOCopyWithImpl<_CartItemDTO>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$CartItemDTOToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _CartItemDTO&&(identical(other.id, id) || other.id == id)&&(identical(other.productId, productId) || other.productId == productId)&&(identical(other.storeId, storeId) || other.storeId == storeId)&&(identical(other.quantity, quantity) || other.quantity == quantity)&&(identical(other.unitPrice, unitPrice) || other.unitPrice == unitPrice)&&(identical(other.lineTotal, lineTotal) || other.lineTotal == lineTotal)&&(identical(other.product, product) || other.product == product)&&(identical(other.variantId, variantId) || other.variantId == variantId)&&(identical(other.availableQty, availableQty) || other.availableQty == availableQty)&&(identical(other.inventoryStatus, inventoryStatus) || other.inventoryStatus == inventoryStatus)&&(identical(other.variant, variant) || other.variant == variant));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,productId,storeId,quantity,unitPrice,lineTotal,product,variantId,availableQty,inventoryStatus,variant);

@override
String toString() {
  return 'CartItemDTO(id: $id, productId: $productId, storeId: $storeId, quantity: $quantity, unitPrice: $unitPrice, lineTotal: $lineTotal, product: $product, variantId: $variantId, availableQty: $availableQty, inventoryStatus: $inventoryStatus, variant: $variant)';
}


}

/// @nodoc
abstract mixin class _$CartItemDTOCopyWith<$Res> implements $CartItemDTOCopyWith<$Res> {
  factory _$CartItemDTOCopyWith(_CartItemDTO value, $Res Function(_CartItemDTO) _then) = __$CartItemDTOCopyWithImpl;
@override @useResult
$Res call({
 String id, String productId, String storeId, int quantity, double unitPrice, double lineTotal, CartProductSummary product, String? variantId, int? availableQty, String? inventoryStatus, CartVariantSummary? variant
});


@override $CartProductSummaryCopyWith<$Res> get product;@override $CartVariantSummaryCopyWith<$Res>? get variant;

}
/// @nodoc
class __$CartItemDTOCopyWithImpl<$Res>
    implements _$CartItemDTOCopyWith<$Res> {
  __$CartItemDTOCopyWithImpl(this._self, this._then);

  final _CartItemDTO _self;
  final $Res Function(_CartItemDTO) _then;

/// Create a copy of CartItemDTO
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? id = null,Object? productId = null,Object? storeId = null,Object? quantity = null,Object? unitPrice = null,Object? lineTotal = null,Object? product = null,Object? variantId = freezed,Object? availableQty = freezed,Object? inventoryStatus = freezed,Object? variant = freezed,}) {
  return _then(_CartItemDTO(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,productId: null == productId ? _self.productId : productId // ignore: cast_nullable_to_non_nullable
as String,storeId: null == storeId ? _self.storeId : storeId // ignore: cast_nullable_to_non_nullable
as String,quantity: null == quantity ? _self.quantity : quantity // ignore: cast_nullable_to_non_nullable
as int,unitPrice: null == unitPrice ? _self.unitPrice : unitPrice // ignore: cast_nullable_to_non_nullable
as double,lineTotal: null == lineTotal ? _self.lineTotal : lineTotal // ignore: cast_nullable_to_non_nullable
as double,product: null == product ? _self.product : product // ignore: cast_nullable_to_non_nullable
as CartProductSummary,variantId: freezed == variantId ? _self.variantId : variantId // ignore: cast_nullable_to_non_nullable
as String?,availableQty: freezed == availableQty ? _self.availableQty : availableQty // ignore: cast_nullable_to_non_nullable
as int?,inventoryStatus: freezed == inventoryStatus ? _self.inventoryStatus : inventoryStatus // ignore: cast_nullable_to_non_nullable
as String?,variant: freezed == variant ? _self.variant : variant // ignore: cast_nullable_to_non_nullable
as CartVariantSummary?,
  ));
}

/// Create a copy of CartItemDTO
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$CartProductSummaryCopyWith<$Res> get product {
  
  return $CartProductSummaryCopyWith<$Res>(_self.product, (value) {
    return _then(_self.copyWith(product: value));
  });
}/// Create a copy of CartItemDTO
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$CartVariantSummaryCopyWith<$Res>? get variant {
    if (_self.variant == null) {
    return null;
  }

  return $CartVariantSummaryCopyWith<$Res>(_self.variant!, (value) {
    return _then(_self.copyWith(variant: value));
  });
}
}


/// @nodoc
mixin _$CartDTO {

 List<CartItemDTO> get data; double get total; int get itemCount;
/// Create a copy of CartDTO
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$CartDTOCopyWith<CartDTO> get copyWith => _$CartDTOCopyWithImpl<CartDTO>(this as CartDTO, _$identity);

  /// Serializes this CartDTO to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is CartDTO&&const DeepCollectionEquality().equals(other.data, data)&&(identical(other.total, total) || other.total == total)&&(identical(other.itemCount, itemCount) || other.itemCount == itemCount));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,const DeepCollectionEquality().hash(data),total,itemCount);

@override
String toString() {
  return 'CartDTO(data: $data, total: $total, itemCount: $itemCount)';
}


}

/// @nodoc
abstract mixin class $CartDTOCopyWith<$Res>  {
  factory $CartDTOCopyWith(CartDTO value, $Res Function(CartDTO) _then) = _$CartDTOCopyWithImpl;
@useResult
$Res call({
 List<CartItemDTO> data, double total, int itemCount
});




}
/// @nodoc
class _$CartDTOCopyWithImpl<$Res>
    implements $CartDTOCopyWith<$Res> {
  _$CartDTOCopyWithImpl(this._self, this._then);

  final CartDTO _self;
  final $Res Function(CartDTO) _then;

/// Create a copy of CartDTO
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? data = null,Object? total = null,Object? itemCount = null,}) {
  return _then(_self.copyWith(
data: null == data ? _self.data : data // ignore: cast_nullable_to_non_nullable
as List<CartItemDTO>,total: null == total ? _self.total : total // ignore: cast_nullable_to_non_nullable
as double,itemCount: null == itemCount ? _self.itemCount : itemCount // ignore: cast_nullable_to_non_nullable
as int,
  ));
}

}


/// Adds pattern-matching-related methods to [CartDTO].
extension CartDTOPatterns on CartDTO {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _CartDTO value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _CartDTO() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _CartDTO value)  $default,){
final _that = this;
switch (_that) {
case _CartDTO():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _CartDTO value)?  $default,){
final _that = this;
switch (_that) {
case _CartDTO() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( List<CartItemDTO> data,  double total,  int itemCount)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _CartDTO() when $default != null:
return $default(_that.data,_that.total,_that.itemCount);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( List<CartItemDTO> data,  double total,  int itemCount)  $default,) {final _that = this;
switch (_that) {
case _CartDTO():
return $default(_that.data,_that.total,_that.itemCount);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( List<CartItemDTO> data,  double total,  int itemCount)?  $default,) {final _that = this;
switch (_that) {
case _CartDTO() when $default != null:
return $default(_that.data,_that.total,_that.itemCount);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _CartDTO implements CartDTO {
  const _CartDTO({required final  List<CartItemDTO> data, required this.total, required this.itemCount}): _data = data;
  factory _CartDTO.fromJson(Map<String, dynamic> json) => _$CartDTOFromJson(json);

 final  List<CartItemDTO> _data;
@override List<CartItemDTO> get data {
  if (_data is EqualUnmodifiableListView) return _data;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_data);
}

@override final  double total;
@override final  int itemCount;

/// Create a copy of CartDTO
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$CartDTOCopyWith<_CartDTO> get copyWith => __$CartDTOCopyWithImpl<_CartDTO>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$CartDTOToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _CartDTO&&const DeepCollectionEquality().equals(other._data, _data)&&(identical(other.total, total) || other.total == total)&&(identical(other.itemCount, itemCount) || other.itemCount == itemCount));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,const DeepCollectionEquality().hash(_data),total,itemCount);

@override
String toString() {
  return 'CartDTO(data: $data, total: $total, itemCount: $itemCount)';
}


}

/// @nodoc
abstract mixin class _$CartDTOCopyWith<$Res> implements $CartDTOCopyWith<$Res> {
  factory _$CartDTOCopyWith(_CartDTO value, $Res Function(_CartDTO) _then) = __$CartDTOCopyWithImpl;
@override @useResult
$Res call({
 List<CartItemDTO> data, double total, int itemCount
});




}
/// @nodoc
class __$CartDTOCopyWithImpl<$Res>
    implements _$CartDTOCopyWith<$Res> {
  __$CartDTOCopyWithImpl(this._self, this._then);

  final _CartDTO _self;
  final $Res Function(_CartDTO) _then;

/// Create a copy of CartDTO
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? data = null,Object? total = null,Object? itemCount = null,}) {
  return _then(_CartDTO(
data: null == data ? _self._data : data // ignore: cast_nullable_to_non_nullable
as List<CartItemDTO>,total: null == total ? _self.total : total // ignore: cast_nullable_to_non_nullable
as double,itemCount: null == itemCount ? _self.itemCount : itemCount // ignore: cast_nullable_to_non_nullable
as int,
  ));
}


}


/// @nodoc
mixin _$AddToCartRequest {

 String get productId; String get storeId; int get quantity; String? get variantId;
/// Create a copy of AddToCartRequest
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$AddToCartRequestCopyWith<AddToCartRequest> get copyWith => _$AddToCartRequestCopyWithImpl<AddToCartRequest>(this as AddToCartRequest, _$identity);

  /// Serializes this AddToCartRequest to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is AddToCartRequest&&(identical(other.productId, productId) || other.productId == productId)&&(identical(other.storeId, storeId) || other.storeId == storeId)&&(identical(other.quantity, quantity) || other.quantity == quantity)&&(identical(other.variantId, variantId) || other.variantId == variantId));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,productId,storeId,quantity,variantId);

@override
String toString() {
  return 'AddToCartRequest(productId: $productId, storeId: $storeId, quantity: $quantity, variantId: $variantId)';
}


}

/// @nodoc
abstract mixin class $AddToCartRequestCopyWith<$Res>  {
  factory $AddToCartRequestCopyWith(AddToCartRequest value, $Res Function(AddToCartRequest) _then) = _$AddToCartRequestCopyWithImpl;
@useResult
$Res call({
 String productId, String storeId, int quantity, String? variantId
});




}
/// @nodoc
class _$AddToCartRequestCopyWithImpl<$Res>
    implements $AddToCartRequestCopyWith<$Res> {
  _$AddToCartRequestCopyWithImpl(this._self, this._then);

  final AddToCartRequest _self;
  final $Res Function(AddToCartRequest) _then;

/// Create a copy of AddToCartRequest
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? productId = null,Object? storeId = null,Object? quantity = null,Object? variantId = freezed,}) {
  return _then(_self.copyWith(
productId: null == productId ? _self.productId : productId // ignore: cast_nullable_to_non_nullable
as String,storeId: null == storeId ? _self.storeId : storeId // ignore: cast_nullable_to_non_nullable
as String,quantity: null == quantity ? _self.quantity : quantity // ignore: cast_nullable_to_non_nullable
as int,variantId: freezed == variantId ? _self.variantId : variantId // ignore: cast_nullable_to_non_nullable
as String?,
  ));
}

}


/// Adds pattern-matching-related methods to [AddToCartRequest].
extension AddToCartRequestPatterns on AddToCartRequest {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _AddToCartRequest value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _AddToCartRequest() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _AddToCartRequest value)  $default,){
final _that = this;
switch (_that) {
case _AddToCartRequest():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _AddToCartRequest value)?  $default,){
final _that = this;
switch (_that) {
case _AddToCartRequest() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String productId,  String storeId,  int quantity,  String? variantId)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _AddToCartRequest() when $default != null:
return $default(_that.productId,_that.storeId,_that.quantity,_that.variantId);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String productId,  String storeId,  int quantity,  String? variantId)  $default,) {final _that = this;
switch (_that) {
case _AddToCartRequest():
return $default(_that.productId,_that.storeId,_that.quantity,_that.variantId);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String productId,  String storeId,  int quantity,  String? variantId)?  $default,) {final _that = this;
switch (_that) {
case _AddToCartRequest() when $default != null:
return $default(_that.productId,_that.storeId,_that.quantity,_that.variantId);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _AddToCartRequest implements AddToCartRequest {
  const _AddToCartRequest({required this.productId, required this.storeId, this.quantity = 1, this.variantId});
  factory _AddToCartRequest.fromJson(Map<String, dynamic> json) => _$AddToCartRequestFromJson(json);

@override final  String productId;
@override final  String storeId;
@override@JsonKey() final  int quantity;
@override final  String? variantId;

/// Create a copy of AddToCartRequest
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$AddToCartRequestCopyWith<_AddToCartRequest> get copyWith => __$AddToCartRequestCopyWithImpl<_AddToCartRequest>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$AddToCartRequestToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _AddToCartRequest&&(identical(other.productId, productId) || other.productId == productId)&&(identical(other.storeId, storeId) || other.storeId == storeId)&&(identical(other.quantity, quantity) || other.quantity == quantity)&&(identical(other.variantId, variantId) || other.variantId == variantId));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,productId,storeId,quantity,variantId);

@override
String toString() {
  return 'AddToCartRequest(productId: $productId, storeId: $storeId, quantity: $quantity, variantId: $variantId)';
}


}

/// @nodoc
abstract mixin class _$AddToCartRequestCopyWith<$Res> implements $AddToCartRequestCopyWith<$Res> {
  factory _$AddToCartRequestCopyWith(_AddToCartRequest value, $Res Function(_AddToCartRequest) _then) = __$AddToCartRequestCopyWithImpl;
@override @useResult
$Res call({
 String productId, String storeId, int quantity, String? variantId
});




}
/// @nodoc
class __$AddToCartRequestCopyWithImpl<$Res>
    implements _$AddToCartRequestCopyWith<$Res> {
  __$AddToCartRequestCopyWithImpl(this._self, this._then);

  final _AddToCartRequest _self;
  final $Res Function(_AddToCartRequest) _then;

/// Create a copy of AddToCartRequest
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? productId = null,Object? storeId = null,Object? quantity = null,Object? variantId = freezed,}) {
  return _then(_AddToCartRequest(
productId: null == productId ? _self.productId : productId // ignore: cast_nullable_to_non_nullable
as String,storeId: null == storeId ? _self.storeId : storeId // ignore: cast_nullable_to_non_nullable
as String,quantity: null == quantity ? _self.quantity : quantity // ignore: cast_nullable_to_non_nullable
as int,variantId: freezed == variantId ? _self.variantId : variantId // ignore: cast_nullable_to_non_nullable
as String?,
  ));
}


}


/// @nodoc
mixin _$CouponDTO {

 String get id; String get code; String get type; double get value; double get minOrder; String get validUntil; String? get description; double? get maxDiscount; int? get usageLeft;
/// Create a copy of CouponDTO
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$CouponDTOCopyWith<CouponDTO> get copyWith => _$CouponDTOCopyWithImpl<CouponDTO>(this as CouponDTO, _$identity);

  /// Serializes this CouponDTO to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is CouponDTO&&(identical(other.id, id) || other.id == id)&&(identical(other.code, code) || other.code == code)&&(identical(other.type, type) || other.type == type)&&(identical(other.value, value) || other.value == value)&&(identical(other.minOrder, minOrder) || other.minOrder == minOrder)&&(identical(other.validUntil, validUntil) || other.validUntil == validUntil)&&(identical(other.description, description) || other.description == description)&&(identical(other.maxDiscount, maxDiscount) || other.maxDiscount == maxDiscount)&&(identical(other.usageLeft, usageLeft) || other.usageLeft == usageLeft));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,code,type,value,minOrder,validUntil,description,maxDiscount,usageLeft);

@override
String toString() {
  return 'CouponDTO(id: $id, code: $code, type: $type, value: $value, minOrder: $minOrder, validUntil: $validUntil, description: $description, maxDiscount: $maxDiscount, usageLeft: $usageLeft)';
}


}

/// @nodoc
abstract mixin class $CouponDTOCopyWith<$Res>  {
  factory $CouponDTOCopyWith(CouponDTO value, $Res Function(CouponDTO) _then) = _$CouponDTOCopyWithImpl;
@useResult
$Res call({
 String id, String code, String type, double value, double minOrder, String validUntil, String? description, double? maxDiscount, int? usageLeft
});




}
/// @nodoc
class _$CouponDTOCopyWithImpl<$Res>
    implements $CouponDTOCopyWith<$Res> {
  _$CouponDTOCopyWithImpl(this._self, this._then);

  final CouponDTO _self;
  final $Res Function(CouponDTO) _then;

/// Create a copy of CouponDTO
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? id = null,Object? code = null,Object? type = null,Object? value = null,Object? minOrder = null,Object? validUntil = null,Object? description = freezed,Object? maxDiscount = freezed,Object? usageLeft = freezed,}) {
  return _then(_self.copyWith(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,code: null == code ? _self.code : code // ignore: cast_nullable_to_non_nullable
as String,type: null == type ? _self.type : type // ignore: cast_nullable_to_non_nullable
as String,value: null == value ? _self.value : value // ignore: cast_nullable_to_non_nullable
as double,minOrder: null == minOrder ? _self.minOrder : minOrder // ignore: cast_nullable_to_non_nullable
as double,validUntil: null == validUntil ? _self.validUntil : validUntil // ignore: cast_nullable_to_non_nullable
as String,description: freezed == description ? _self.description : description // ignore: cast_nullable_to_non_nullable
as String?,maxDiscount: freezed == maxDiscount ? _self.maxDiscount : maxDiscount // ignore: cast_nullable_to_non_nullable
as double?,usageLeft: freezed == usageLeft ? _self.usageLeft : usageLeft // ignore: cast_nullable_to_non_nullable
as int?,
  ));
}

}


/// Adds pattern-matching-related methods to [CouponDTO].
extension CouponDTOPatterns on CouponDTO {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _CouponDTO value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _CouponDTO() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _CouponDTO value)  $default,){
final _that = this;
switch (_that) {
case _CouponDTO():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _CouponDTO value)?  $default,){
final _that = this;
switch (_that) {
case _CouponDTO() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String id,  String code,  String type,  double value,  double minOrder,  String validUntil,  String? description,  double? maxDiscount,  int? usageLeft)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _CouponDTO() when $default != null:
return $default(_that.id,_that.code,_that.type,_that.value,_that.minOrder,_that.validUntil,_that.description,_that.maxDiscount,_that.usageLeft);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String id,  String code,  String type,  double value,  double minOrder,  String validUntil,  String? description,  double? maxDiscount,  int? usageLeft)  $default,) {final _that = this;
switch (_that) {
case _CouponDTO():
return $default(_that.id,_that.code,_that.type,_that.value,_that.minOrder,_that.validUntil,_that.description,_that.maxDiscount,_that.usageLeft);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String id,  String code,  String type,  double value,  double minOrder,  String validUntil,  String? description,  double? maxDiscount,  int? usageLeft)?  $default,) {final _that = this;
switch (_that) {
case _CouponDTO() when $default != null:
return $default(_that.id,_that.code,_that.type,_that.value,_that.minOrder,_that.validUntil,_that.description,_that.maxDiscount,_that.usageLeft);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _CouponDTO implements CouponDTO {
  const _CouponDTO({required this.id, required this.code, required this.type, required this.value, required this.minOrder, required this.validUntil, this.description, this.maxDiscount, this.usageLeft});
  factory _CouponDTO.fromJson(Map<String, dynamic> json) => _$CouponDTOFromJson(json);

@override final  String id;
@override final  String code;
@override final  String type;
@override final  double value;
@override final  double minOrder;
@override final  String validUntil;
@override final  String? description;
@override final  double? maxDiscount;
@override final  int? usageLeft;

/// Create a copy of CouponDTO
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$CouponDTOCopyWith<_CouponDTO> get copyWith => __$CouponDTOCopyWithImpl<_CouponDTO>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$CouponDTOToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _CouponDTO&&(identical(other.id, id) || other.id == id)&&(identical(other.code, code) || other.code == code)&&(identical(other.type, type) || other.type == type)&&(identical(other.value, value) || other.value == value)&&(identical(other.minOrder, minOrder) || other.minOrder == minOrder)&&(identical(other.validUntil, validUntil) || other.validUntil == validUntil)&&(identical(other.description, description) || other.description == description)&&(identical(other.maxDiscount, maxDiscount) || other.maxDiscount == maxDiscount)&&(identical(other.usageLeft, usageLeft) || other.usageLeft == usageLeft));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,code,type,value,minOrder,validUntil,description,maxDiscount,usageLeft);

@override
String toString() {
  return 'CouponDTO(id: $id, code: $code, type: $type, value: $value, minOrder: $minOrder, validUntil: $validUntil, description: $description, maxDiscount: $maxDiscount, usageLeft: $usageLeft)';
}


}

/// @nodoc
abstract mixin class _$CouponDTOCopyWith<$Res> implements $CouponDTOCopyWith<$Res> {
  factory _$CouponDTOCopyWith(_CouponDTO value, $Res Function(_CouponDTO) _then) = __$CouponDTOCopyWithImpl;
@override @useResult
$Res call({
 String id, String code, String type, double value, double minOrder, String validUntil, String? description, double? maxDiscount, int? usageLeft
});




}
/// @nodoc
class __$CouponDTOCopyWithImpl<$Res>
    implements _$CouponDTOCopyWith<$Res> {
  __$CouponDTOCopyWithImpl(this._self, this._then);

  final _CouponDTO _self;
  final $Res Function(_CouponDTO) _then;

/// Create a copy of CouponDTO
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? id = null,Object? code = null,Object? type = null,Object? value = null,Object? minOrder = null,Object? validUntil = null,Object? description = freezed,Object? maxDiscount = freezed,Object? usageLeft = freezed,}) {
  return _then(_CouponDTO(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,code: null == code ? _self.code : code // ignore: cast_nullable_to_non_nullable
as String,type: null == type ? _self.type : type // ignore: cast_nullable_to_non_nullable
as String,value: null == value ? _self.value : value // ignore: cast_nullable_to_non_nullable
as double,minOrder: null == minOrder ? _self.minOrder : minOrder // ignore: cast_nullable_to_non_nullable
as double,validUntil: null == validUntil ? _self.validUntil : validUntil // ignore: cast_nullable_to_non_nullable
as String,description: freezed == description ? _self.description : description // ignore: cast_nullable_to_non_nullable
as String?,maxDiscount: freezed == maxDiscount ? _self.maxDiscount : maxDiscount // ignore: cast_nullable_to_non_nullable
as double?,usageLeft: freezed == usageLeft ? _self.usageLeft : usageLeft // ignore: cast_nullable_to_non_nullable
as int?,
  ));
}


}

// dart format on
