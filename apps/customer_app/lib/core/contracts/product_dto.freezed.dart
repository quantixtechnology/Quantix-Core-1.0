// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'product_dto.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// dart format off
T _$identity<T>(T value) => value;

/// @nodoc
mixin _$CategoryDTO {

 String get id; String get name; String get slug; String? get description; String? get image; String? get icon; String get color; int get sortOrder; bool get isActive; String? get workflowType; int get productCount; List<CategoryDTO> get children;
/// Create a copy of CategoryDTO
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$CategoryDTOCopyWith<CategoryDTO> get copyWith => _$CategoryDTOCopyWithImpl<CategoryDTO>(this as CategoryDTO, _$identity);

  /// Serializes this CategoryDTO to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is CategoryDTO&&(identical(other.id, id) || other.id == id)&&(identical(other.name, name) || other.name == name)&&(identical(other.slug, slug) || other.slug == slug)&&(identical(other.description, description) || other.description == description)&&(identical(other.image, image) || other.image == image)&&(identical(other.icon, icon) || other.icon == icon)&&(identical(other.color, color) || other.color == color)&&(identical(other.sortOrder, sortOrder) || other.sortOrder == sortOrder)&&(identical(other.isActive, isActive) || other.isActive == isActive)&&(identical(other.workflowType, workflowType) || other.workflowType == workflowType)&&(identical(other.productCount, productCount) || other.productCount == productCount)&&const DeepCollectionEquality().equals(other.children, children));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,name,slug,description,image,icon,color,sortOrder,isActive,workflowType,productCount,const DeepCollectionEquality().hash(children));

@override
String toString() {
  return 'CategoryDTO(id: $id, name: $name, slug: $slug, description: $description, image: $image, icon: $icon, color: $color, sortOrder: $sortOrder, isActive: $isActive, workflowType: $workflowType, productCount: $productCount, children: $children)';
}


}

/// @nodoc
abstract mixin class $CategoryDTOCopyWith<$Res>  {
  factory $CategoryDTOCopyWith(CategoryDTO value, $Res Function(CategoryDTO) _then) = _$CategoryDTOCopyWithImpl;
@useResult
$Res call({
 String id, String name, String slug, String? description, String? image, String? icon, String color, int sortOrder, bool isActive, String? workflowType, int productCount, List<CategoryDTO> children
});




}
/// @nodoc
class _$CategoryDTOCopyWithImpl<$Res>
    implements $CategoryDTOCopyWith<$Res> {
  _$CategoryDTOCopyWithImpl(this._self, this._then);

  final CategoryDTO _self;
  final $Res Function(CategoryDTO) _then;

/// Create a copy of CategoryDTO
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? id = null,Object? name = null,Object? slug = null,Object? description = freezed,Object? image = freezed,Object? icon = freezed,Object? color = null,Object? sortOrder = null,Object? isActive = null,Object? workflowType = freezed,Object? productCount = null,Object? children = null,}) {
  return _then(_self.copyWith(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,name: null == name ? _self.name : name // ignore: cast_nullable_to_non_nullable
as String,slug: null == slug ? _self.slug : slug // ignore: cast_nullable_to_non_nullable
as String,description: freezed == description ? _self.description : description // ignore: cast_nullable_to_non_nullable
as String?,image: freezed == image ? _self.image : image // ignore: cast_nullable_to_non_nullable
as String?,icon: freezed == icon ? _self.icon : icon // ignore: cast_nullable_to_non_nullable
as String?,color: null == color ? _self.color : color // ignore: cast_nullable_to_non_nullable
as String,sortOrder: null == sortOrder ? _self.sortOrder : sortOrder // ignore: cast_nullable_to_non_nullable
as int,isActive: null == isActive ? _self.isActive : isActive // ignore: cast_nullable_to_non_nullable
as bool,workflowType: freezed == workflowType ? _self.workflowType : workflowType // ignore: cast_nullable_to_non_nullable
as String?,productCount: null == productCount ? _self.productCount : productCount // ignore: cast_nullable_to_non_nullable
as int,children: null == children ? _self.children : children // ignore: cast_nullable_to_non_nullable
as List<CategoryDTO>,
  ));
}

}


/// Adds pattern-matching-related methods to [CategoryDTO].
extension CategoryDTOPatterns on CategoryDTO {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _CategoryDTO value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _CategoryDTO() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _CategoryDTO value)  $default,){
final _that = this;
switch (_that) {
case _CategoryDTO():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _CategoryDTO value)?  $default,){
final _that = this;
switch (_that) {
case _CategoryDTO() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String id,  String name,  String slug,  String? description,  String? image,  String? icon,  String color,  int sortOrder,  bool isActive,  String? workflowType,  int productCount,  List<CategoryDTO> children)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _CategoryDTO() when $default != null:
return $default(_that.id,_that.name,_that.slug,_that.description,_that.image,_that.icon,_that.color,_that.sortOrder,_that.isActive,_that.workflowType,_that.productCount,_that.children);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String id,  String name,  String slug,  String? description,  String? image,  String? icon,  String color,  int sortOrder,  bool isActive,  String? workflowType,  int productCount,  List<CategoryDTO> children)  $default,) {final _that = this;
switch (_that) {
case _CategoryDTO():
return $default(_that.id,_that.name,_that.slug,_that.description,_that.image,_that.icon,_that.color,_that.sortOrder,_that.isActive,_that.workflowType,_that.productCount,_that.children);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String id,  String name,  String slug,  String? description,  String? image,  String? icon,  String color,  int sortOrder,  bool isActive,  String? workflowType,  int productCount,  List<CategoryDTO> children)?  $default,) {final _that = this;
switch (_that) {
case _CategoryDTO() when $default != null:
return $default(_that.id,_that.name,_that.slug,_that.description,_that.image,_that.icon,_that.color,_that.sortOrder,_that.isActive,_that.workflowType,_that.productCount,_that.children);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _CategoryDTO implements CategoryDTO {
  const _CategoryDTO({required this.id, required this.name, required this.slug, this.description, this.image, this.icon, this.color = '#10B981', this.sortOrder = 0, this.isActive = true, this.workflowType, this.productCount = 0, final  List<CategoryDTO> children = const []}): _children = children;
  factory _CategoryDTO.fromJson(Map<String, dynamic> json) => _$CategoryDTOFromJson(json);

@override final  String id;
@override final  String name;
@override final  String slug;
@override final  String? description;
@override final  String? image;
@override final  String? icon;
@override@JsonKey() final  String color;
@override@JsonKey() final  int sortOrder;
@override@JsonKey() final  bool isActive;
@override final  String? workflowType;
@override@JsonKey() final  int productCount;
 final  List<CategoryDTO> _children;
@override@JsonKey() List<CategoryDTO> get children {
  if (_children is EqualUnmodifiableListView) return _children;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_children);
}


/// Create a copy of CategoryDTO
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$CategoryDTOCopyWith<_CategoryDTO> get copyWith => __$CategoryDTOCopyWithImpl<_CategoryDTO>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$CategoryDTOToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _CategoryDTO&&(identical(other.id, id) || other.id == id)&&(identical(other.name, name) || other.name == name)&&(identical(other.slug, slug) || other.slug == slug)&&(identical(other.description, description) || other.description == description)&&(identical(other.image, image) || other.image == image)&&(identical(other.icon, icon) || other.icon == icon)&&(identical(other.color, color) || other.color == color)&&(identical(other.sortOrder, sortOrder) || other.sortOrder == sortOrder)&&(identical(other.isActive, isActive) || other.isActive == isActive)&&(identical(other.workflowType, workflowType) || other.workflowType == workflowType)&&(identical(other.productCount, productCount) || other.productCount == productCount)&&const DeepCollectionEquality().equals(other._children, _children));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,name,slug,description,image,icon,color,sortOrder,isActive,workflowType,productCount,const DeepCollectionEquality().hash(_children));

@override
String toString() {
  return 'CategoryDTO(id: $id, name: $name, slug: $slug, description: $description, image: $image, icon: $icon, color: $color, sortOrder: $sortOrder, isActive: $isActive, workflowType: $workflowType, productCount: $productCount, children: $children)';
}


}

/// @nodoc
abstract mixin class _$CategoryDTOCopyWith<$Res> implements $CategoryDTOCopyWith<$Res> {
  factory _$CategoryDTOCopyWith(_CategoryDTO value, $Res Function(_CategoryDTO) _then) = __$CategoryDTOCopyWithImpl;
@override @useResult
$Res call({
 String id, String name, String slug, String? description, String? image, String? icon, String color, int sortOrder, bool isActive, String? workflowType, int productCount, List<CategoryDTO> children
});




}
/// @nodoc
class __$CategoryDTOCopyWithImpl<$Res>
    implements _$CategoryDTOCopyWith<$Res> {
  __$CategoryDTOCopyWithImpl(this._self, this._then);

  final _CategoryDTO _self;
  final $Res Function(_CategoryDTO) _then;

/// Create a copy of CategoryDTO
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? id = null,Object? name = null,Object? slug = null,Object? description = freezed,Object? image = freezed,Object? icon = freezed,Object? color = null,Object? sortOrder = null,Object? isActive = null,Object? workflowType = freezed,Object? productCount = null,Object? children = null,}) {
  return _then(_CategoryDTO(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,name: null == name ? _self.name : name // ignore: cast_nullable_to_non_nullable
as String,slug: null == slug ? _self.slug : slug // ignore: cast_nullable_to_non_nullable
as String,description: freezed == description ? _self.description : description // ignore: cast_nullable_to_non_nullable
as String?,image: freezed == image ? _self.image : image // ignore: cast_nullable_to_non_nullable
as String?,icon: freezed == icon ? _self.icon : icon // ignore: cast_nullable_to_non_nullable
as String?,color: null == color ? _self.color : color // ignore: cast_nullable_to_non_nullable
as String,sortOrder: null == sortOrder ? _self.sortOrder : sortOrder // ignore: cast_nullable_to_non_nullable
as int,isActive: null == isActive ? _self.isActive : isActive // ignore: cast_nullable_to_non_nullable
as bool,workflowType: freezed == workflowType ? _self.workflowType : workflowType // ignore: cast_nullable_to_non_nullable
as String?,productCount: null == productCount ? _self.productCount : productCount // ignore: cast_nullable_to_non_nullable
as int,children: null == children ? _self._children : children // ignore: cast_nullable_to_non_nullable
as List<CategoryDTO>,
  ));
}


}


/// @nodoc
mixin _$VariantDTO {

 String get id; String get name; double get price; bool get isDefault; bool get isActive; Map<String, String> get attributes; String? get sku; double? get mrp; double? get discountPrice; double? get discountPercent; int? get stock;
/// Create a copy of VariantDTO
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$VariantDTOCopyWith<VariantDTO> get copyWith => _$VariantDTOCopyWithImpl<VariantDTO>(this as VariantDTO, _$identity);

  /// Serializes this VariantDTO to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is VariantDTO&&(identical(other.id, id) || other.id == id)&&(identical(other.name, name) || other.name == name)&&(identical(other.price, price) || other.price == price)&&(identical(other.isDefault, isDefault) || other.isDefault == isDefault)&&(identical(other.isActive, isActive) || other.isActive == isActive)&&const DeepCollectionEquality().equals(other.attributes, attributes)&&(identical(other.sku, sku) || other.sku == sku)&&(identical(other.mrp, mrp) || other.mrp == mrp)&&(identical(other.discountPrice, discountPrice) || other.discountPrice == discountPrice)&&(identical(other.discountPercent, discountPercent) || other.discountPercent == discountPercent)&&(identical(other.stock, stock) || other.stock == stock));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,name,price,isDefault,isActive,const DeepCollectionEquality().hash(attributes),sku,mrp,discountPrice,discountPercent,stock);

@override
String toString() {
  return 'VariantDTO(id: $id, name: $name, price: $price, isDefault: $isDefault, isActive: $isActive, attributes: $attributes, sku: $sku, mrp: $mrp, discountPrice: $discountPrice, discountPercent: $discountPercent, stock: $stock)';
}


}

/// @nodoc
abstract mixin class $VariantDTOCopyWith<$Res>  {
  factory $VariantDTOCopyWith(VariantDTO value, $Res Function(VariantDTO) _then) = _$VariantDTOCopyWithImpl;
@useResult
$Res call({
 String id, String name, double price, bool isDefault, bool isActive, Map<String, String> attributes, String? sku, double? mrp, double? discountPrice, double? discountPercent, int? stock
});




}
/// @nodoc
class _$VariantDTOCopyWithImpl<$Res>
    implements $VariantDTOCopyWith<$Res> {
  _$VariantDTOCopyWithImpl(this._self, this._then);

  final VariantDTO _self;
  final $Res Function(VariantDTO) _then;

/// Create a copy of VariantDTO
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? id = null,Object? name = null,Object? price = null,Object? isDefault = null,Object? isActive = null,Object? attributes = null,Object? sku = freezed,Object? mrp = freezed,Object? discountPrice = freezed,Object? discountPercent = freezed,Object? stock = freezed,}) {
  return _then(_self.copyWith(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,name: null == name ? _self.name : name // ignore: cast_nullable_to_non_nullable
as String,price: null == price ? _self.price : price // ignore: cast_nullable_to_non_nullable
as double,isDefault: null == isDefault ? _self.isDefault : isDefault // ignore: cast_nullable_to_non_nullable
as bool,isActive: null == isActive ? _self.isActive : isActive // ignore: cast_nullable_to_non_nullable
as bool,attributes: null == attributes ? _self.attributes : attributes // ignore: cast_nullable_to_non_nullable
as Map<String, String>,sku: freezed == sku ? _self.sku : sku // ignore: cast_nullable_to_non_nullable
as String?,mrp: freezed == mrp ? _self.mrp : mrp // ignore: cast_nullable_to_non_nullable
as double?,discountPrice: freezed == discountPrice ? _self.discountPrice : discountPrice // ignore: cast_nullable_to_non_nullable
as double?,discountPercent: freezed == discountPercent ? _self.discountPercent : discountPercent // ignore: cast_nullable_to_non_nullable
as double?,stock: freezed == stock ? _self.stock : stock // ignore: cast_nullable_to_non_nullable
as int?,
  ));
}

}


/// Adds pattern-matching-related methods to [VariantDTO].
extension VariantDTOPatterns on VariantDTO {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _VariantDTO value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _VariantDTO() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _VariantDTO value)  $default,){
final _that = this;
switch (_that) {
case _VariantDTO():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _VariantDTO value)?  $default,){
final _that = this;
switch (_that) {
case _VariantDTO() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String id,  String name,  double price,  bool isDefault,  bool isActive,  Map<String, String> attributes,  String? sku,  double? mrp,  double? discountPrice,  double? discountPercent,  int? stock)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _VariantDTO() when $default != null:
return $default(_that.id,_that.name,_that.price,_that.isDefault,_that.isActive,_that.attributes,_that.sku,_that.mrp,_that.discountPrice,_that.discountPercent,_that.stock);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String id,  String name,  double price,  bool isDefault,  bool isActive,  Map<String, String> attributes,  String? sku,  double? mrp,  double? discountPrice,  double? discountPercent,  int? stock)  $default,) {final _that = this;
switch (_that) {
case _VariantDTO():
return $default(_that.id,_that.name,_that.price,_that.isDefault,_that.isActive,_that.attributes,_that.sku,_that.mrp,_that.discountPrice,_that.discountPercent,_that.stock);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String id,  String name,  double price,  bool isDefault,  bool isActive,  Map<String, String> attributes,  String? sku,  double? mrp,  double? discountPrice,  double? discountPercent,  int? stock)?  $default,) {final _that = this;
switch (_that) {
case _VariantDTO() when $default != null:
return $default(_that.id,_that.name,_that.price,_that.isDefault,_that.isActive,_that.attributes,_that.sku,_that.mrp,_that.discountPrice,_that.discountPercent,_that.stock);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _VariantDTO implements VariantDTO {
  const _VariantDTO({required this.id, required this.name, required this.price, this.isDefault = true, this.isActive = true, final  Map<String, String> attributes = const {}, this.sku, this.mrp, this.discountPrice, this.discountPercent, this.stock}): _attributes = attributes;
  factory _VariantDTO.fromJson(Map<String, dynamic> json) => _$VariantDTOFromJson(json);

@override final  String id;
@override final  String name;
@override final  double price;
@override@JsonKey() final  bool isDefault;
@override@JsonKey() final  bool isActive;
 final  Map<String, String> _attributes;
@override@JsonKey() Map<String, String> get attributes {
  if (_attributes is EqualUnmodifiableMapView) return _attributes;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableMapView(_attributes);
}

@override final  String? sku;
@override final  double? mrp;
@override final  double? discountPrice;
@override final  double? discountPercent;
@override final  int? stock;

/// Create a copy of VariantDTO
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$VariantDTOCopyWith<_VariantDTO> get copyWith => __$VariantDTOCopyWithImpl<_VariantDTO>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$VariantDTOToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _VariantDTO&&(identical(other.id, id) || other.id == id)&&(identical(other.name, name) || other.name == name)&&(identical(other.price, price) || other.price == price)&&(identical(other.isDefault, isDefault) || other.isDefault == isDefault)&&(identical(other.isActive, isActive) || other.isActive == isActive)&&const DeepCollectionEquality().equals(other._attributes, _attributes)&&(identical(other.sku, sku) || other.sku == sku)&&(identical(other.mrp, mrp) || other.mrp == mrp)&&(identical(other.discountPrice, discountPrice) || other.discountPrice == discountPrice)&&(identical(other.discountPercent, discountPercent) || other.discountPercent == discountPercent)&&(identical(other.stock, stock) || other.stock == stock));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,name,price,isDefault,isActive,const DeepCollectionEquality().hash(_attributes),sku,mrp,discountPrice,discountPercent,stock);

@override
String toString() {
  return 'VariantDTO(id: $id, name: $name, price: $price, isDefault: $isDefault, isActive: $isActive, attributes: $attributes, sku: $sku, mrp: $mrp, discountPrice: $discountPrice, discountPercent: $discountPercent, stock: $stock)';
}


}

/// @nodoc
abstract mixin class _$VariantDTOCopyWith<$Res> implements $VariantDTOCopyWith<$Res> {
  factory _$VariantDTOCopyWith(_VariantDTO value, $Res Function(_VariantDTO) _then) = __$VariantDTOCopyWithImpl;
@override @useResult
$Res call({
 String id, String name, double price, bool isDefault, bool isActive, Map<String, String> attributes, String? sku, double? mrp, double? discountPrice, double? discountPercent, int? stock
});




}
/// @nodoc
class __$VariantDTOCopyWithImpl<$Res>
    implements _$VariantDTOCopyWith<$Res> {
  __$VariantDTOCopyWithImpl(this._self, this._then);

  final _VariantDTO _self;
  final $Res Function(_VariantDTO) _then;

/// Create a copy of VariantDTO
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? id = null,Object? name = null,Object? price = null,Object? isDefault = null,Object? isActive = null,Object? attributes = null,Object? sku = freezed,Object? mrp = freezed,Object? discountPrice = freezed,Object? discountPercent = freezed,Object? stock = freezed,}) {
  return _then(_VariantDTO(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,name: null == name ? _self.name : name // ignore: cast_nullable_to_non_nullable
as String,price: null == price ? _self.price : price // ignore: cast_nullable_to_non_nullable
as double,isDefault: null == isDefault ? _self.isDefault : isDefault // ignore: cast_nullable_to_non_nullable
as bool,isActive: null == isActive ? _self.isActive : isActive // ignore: cast_nullable_to_non_nullable
as bool,attributes: null == attributes ? _self._attributes : attributes // ignore: cast_nullable_to_non_nullable
as Map<String, String>,sku: freezed == sku ? _self.sku : sku // ignore: cast_nullable_to_non_nullable
as String?,mrp: freezed == mrp ? _self.mrp : mrp // ignore: cast_nullable_to_non_nullable
as double?,discountPrice: freezed == discountPrice ? _self.discountPrice : discountPrice // ignore: cast_nullable_to_non_nullable
as double?,discountPercent: freezed == discountPercent ? _self.discountPercent : discountPercent // ignore: cast_nullable_to_non_nullable
as double?,stock: freezed == stock ? _self.stock : stock // ignore: cast_nullable_to_non_nullable
as int?,
  ));
}


}


/// @nodoc
mixin _$ProductDTO {

 String get id; String get businessId; String get name; String get slug; String get type; String get status; double get defaultPrice; double get defaultMrp; String get stockStatus; int get availableStock; bool get hasInventory; List<String> get images; List<VariantDTO> get variants; List<String> get tags; int get minOrderQty; int get maxOrderQty; int get sortOrder; bool get isFeatured; bool get isPopular; Map<String, dynamic> get metadata; String? get categoryId; String? get description; String? get shortDesc; String? get sku; String? get unit; String? get unitQuantity; String? get workflowType; String? get createdAt; String? get updatedAt; bool? get isVeg; int? get preparationTime; CategoryDTO? get category;
/// Create a copy of ProductDTO
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$ProductDTOCopyWith<ProductDTO> get copyWith => _$ProductDTOCopyWithImpl<ProductDTO>(this as ProductDTO, _$identity);

  /// Serializes this ProductDTO to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is ProductDTO&&(identical(other.id, id) || other.id == id)&&(identical(other.businessId, businessId) || other.businessId == businessId)&&(identical(other.name, name) || other.name == name)&&(identical(other.slug, slug) || other.slug == slug)&&(identical(other.type, type) || other.type == type)&&(identical(other.status, status) || other.status == status)&&(identical(other.defaultPrice, defaultPrice) || other.defaultPrice == defaultPrice)&&(identical(other.defaultMrp, defaultMrp) || other.defaultMrp == defaultMrp)&&(identical(other.stockStatus, stockStatus) || other.stockStatus == stockStatus)&&(identical(other.availableStock, availableStock) || other.availableStock == availableStock)&&(identical(other.hasInventory, hasInventory) || other.hasInventory == hasInventory)&&const DeepCollectionEquality().equals(other.images, images)&&const DeepCollectionEquality().equals(other.variants, variants)&&const DeepCollectionEquality().equals(other.tags, tags)&&(identical(other.minOrderQty, minOrderQty) || other.minOrderQty == minOrderQty)&&(identical(other.maxOrderQty, maxOrderQty) || other.maxOrderQty == maxOrderQty)&&(identical(other.sortOrder, sortOrder) || other.sortOrder == sortOrder)&&(identical(other.isFeatured, isFeatured) || other.isFeatured == isFeatured)&&(identical(other.isPopular, isPopular) || other.isPopular == isPopular)&&const DeepCollectionEquality().equals(other.metadata, metadata)&&(identical(other.categoryId, categoryId) || other.categoryId == categoryId)&&(identical(other.description, description) || other.description == description)&&(identical(other.shortDesc, shortDesc) || other.shortDesc == shortDesc)&&(identical(other.sku, sku) || other.sku == sku)&&(identical(other.unit, unit) || other.unit == unit)&&(identical(other.unitQuantity, unitQuantity) || other.unitQuantity == unitQuantity)&&(identical(other.workflowType, workflowType) || other.workflowType == workflowType)&&(identical(other.createdAt, createdAt) || other.createdAt == createdAt)&&(identical(other.updatedAt, updatedAt) || other.updatedAt == updatedAt)&&(identical(other.isVeg, isVeg) || other.isVeg == isVeg)&&(identical(other.preparationTime, preparationTime) || other.preparationTime == preparationTime)&&(identical(other.category, category) || other.category == category));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hashAll([runtimeType,id,businessId,name,slug,type,status,defaultPrice,defaultMrp,stockStatus,availableStock,hasInventory,const DeepCollectionEquality().hash(images),const DeepCollectionEquality().hash(variants),const DeepCollectionEquality().hash(tags),minOrderQty,maxOrderQty,sortOrder,isFeatured,isPopular,const DeepCollectionEquality().hash(metadata),categoryId,description,shortDesc,sku,unit,unitQuantity,workflowType,createdAt,updatedAt,isVeg,preparationTime,category]);

@override
String toString() {
  return 'ProductDTO(id: $id, businessId: $businessId, name: $name, slug: $slug, type: $type, status: $status, defaultPrice: $defaultPrice, defaultMrp: $defaultMrp, stockStatus: $stockStatus, availableStock: $availableStock, hasInventory: $hasInventory, images: $images, variants: $variants, tags: $tags, minOrderQty: $minOrderQty, maxOrderQty: $maxOrderQty, sortOrder: $sortOrder, isFeatured: $isFeatured, isPopular: $isPopular, metadata: $metadata, categoryId: $categoryId, description: $description, shortDesc: $shortDesc, sku: $sku, unit: $unit, unitQuantity: $unitQuantity, workflowType: $workflowType, createdAt: $createdAt, updatedAt: $updatedAt, isVeg: $isVeg, preparationTime: $preparationTime, category: $category)';
}


}

/// @nodoc
abstract mixin class $ProductDTOCopyWith<$Res>  {
  factory $ProductDTOCopyWith(ProductDTO value, $Res Function(ProductDTO) _then) = _$ProductDTOCopyWithImpl;
@useResult
$Res call({
 String id, String businessId, String name, String slug, String type, String status, double defaultPrice, double defaultMrp, String stockStatus, int availableStock, bool hasInventory, List<String> images, List<VariantDTO> variants, List<String> tags, int minOrderQty, int maxOrderQty, int sortOrder, bool isFeatured, bool isPopular, Map<String, dynamic> metadata, String? categoryId, String? description, String? shortDesc, String? sku, String? unit, String? unitQuantity, String? workflowType, String? createdAt, String? updatedAt, bool? isVeg, int? preparationTime, CategoryDTO? category
});


$CategoryDTOCopyWith<$Res>? get category;

}
/// @nodoc
class _$ProductDTOCopyWithImpl<$Res>
    implements $ProductDTOCopyWith<$Res> {
  _$ProductDTOCopyWithImpl(this._self, this._then);

  final ProductDTO _self;
  final $Res Function(ProductDTO) _then;

/// Create a copy of ProductDTO
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? id = null,Object? businessId = null,Object? name = null,Object? slug = null,Object? type = null,Object? status = null,Object? defaultPrice = null,Object? defaultMrp = null,Object? stockStatus = null,Object? availableStock = null,Object? hasInventory = null,Object? images = null,Object? variants = null,Object? tags = null,Object? minOrderQty = null,Object? maxOrderQty = null,Object? sortOrder = null,Object? isFeatured = null,Object? isPopular = null,Object? metadata = null,Object? categoryId = freezed,Object? description = freezed,Object? shortDesc = freezed,Object? sku = freezed,Object? unit = freezed,Object? unitQuantity = freezed,Object? workflowType = freezed,Object? createdAt = freezed,Object? updatedAt = freezed,Object? isVeg = freezed,Object? preparationTime = freezed,Object? category = freezed,}) {
  return _then(_self.copyWith(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,businessId: null == businessId ? _self.businessId : businessId // ignore: cast_nullable_to_non_nullable
as String,name: null == name ? _self.name : name // ignore: cast_nullable_to_non_nullable
as String,slug: null == slug ? _self.slug : slug // ignore: cast_nullable_to_non_nullable
as String,type: null == type ? _self.type : type // ignore: cast_nullable_to_non_nullable
as String,status: null == status ? _self.status : status // ignore: cast_nullable_to_non_nullable
as String,defaultPrice: null == defaultPrice ? _self.defaultPrice : defaultPrice // ignore: cast_nullable_to_non_nullable
as double,defaultMrp: null == defaultMrp ? _self.defaultMrp : defaultMrp // ignore: cast_nullable_to_non_nullable
as double,stockStatus: null == stockStatus ? _self.stockStatus : stockStatus // ignore: cast_nullable_to_non_nullable
as String,availableStock: null == availableStock ? _self.availableStock : availableStock // ignore: cast_nullable_to_non_nullable
as int,hasInventory: null == hasInventory ? _self.hasInventory : hasInventory // ignore: cast_nullable_to_non_nullable
as bool,images: null == images ? _self.images : images // ignore: cast_nullable_to_non_nullable
as List<String>,variants: null == variants ? _self.variants : variants // ignore: cast_nullable_to_non_nullable
as List<VariantDTO>,tags: null == tags ? _self.tags : tags // ignore: cast_nullable_to_non_nullable
as List<String>,minOrderQty: null == minOrderQty ? _self.minOrderQty : minOrderQty // ignore: cast_nullable_to_non_nullable
as int,maxOrderQty: null == maxOrderQty ? _self.maxOrderQty : maxOrderQty // ignore: cast_nullable_to_non_nullable
as int,sortOrder: null == sortOrder ? _self.sortOrder : sortOrder // ignore: cast_nullable_to_non_nullable
as int,isFeatured: null == isFeatured ? _self.isFeatured : isFeatured // ignore: cast_nullable_to_non_nullable
as bool,isPopular: null == isPopular ? _self.isPopular : isPopular // ignore: cast_nullable_to_non_nullable
as bool,metadata: null == metadata ? _self.metadata : metadata // ignore: cast_nullable_to_non_nullable
as Map<String, dynamic>,categoryId: freezed == categoryId ? _self.categoryId : categoryId // ignore: cast_nullable_to_non_nullable
as String?,description: freezed == description ? _self.description : description // ignore: cast_nullable_to_non_nullable
as String?,shortDesc: freezed == shortDesc ? _self.shortDesc : shortDesc // ignore: cast_nullable_to_non_nullable
as String?,sku: freezed == sku ? _self.sku : sku // ignore: cast_nullable_to_non_nullable
as String?,unit: freezed == unit ? _self.unit : unit // ignore: cast_nullable_to_non_nullable
as String?,unitQuantity: freezed == unitQuantity ? _self.unitQuantity : unitQuantity // ignore: cast_nullable_to_non_nullable
as String?,workflowType: freezed == workflowType ? _self.workflowType : workflowType // ignore: cast_nullable_to_non_nullable
as String?,createdAt: freezed == createdAt ? _self.createdAt : createdAt // ignore: cast_nullable_to_non_nullable
as String?,updatedAt: freezed == updatedAt ? _self.updatedAt : updatedAt // ignore: cast_nullable_to_non_nullable
as String?,isVeg: freezed == isVeg ? _self.isVeg : isVeg // ignore: cast_nullable_to_non_nullable
as bool?,preparationTime: freezed == preparationTime ? _self.preparationTime : preparationTime // ignore: cast_nullable_to_non_nullable
as int?,category: freezed == category ? _self.category : category // ignore: cast_nullable_to_non_nullable
as CategoryDTO?,
  ));
}
/// Create a copy of ProductDTO
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$CategoryDTOCopyWith<$Res>? get category {
    if (_self.category == null) {
    return null;
  }

  return $CategoryDTOCopyWith<$Res>(_self.category!, (value) {
    return _then(_self.copyWith(category: value));
  });
}
}


/// Adds pattern-matching-related methods to [ProductDTO].
extension ProductDTOPatterns on ProductDTO {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _ProductDTO value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _ProductDTO() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _ProductDTO value)  $default,){
final _that = this;
switch (_that) {
case _ProductDTO():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _ProductDTO value)?  $default,){
final _that = this;
switch (_that) {
case _ProductDTO() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String id,  String businessId,  String name,  String slug,  String type,  String status,  double defaultPrice,  double defaultMrp,  String stockStatus,  int availableStock,  bool hasInventory,  List<String> images,  List<VariantDTO> variants,  List<String> tags,  int minOrderQty,  int maxOrderQty,  int sortOrder,  bool isFeatured,  bool isPopular,  Map<String, dynamic> metadata,  String? categoryId,  String? description,  String? shortDesc,  String? sku,  String? unit,  String? unitQuantity,  String? workflowType,  String? createdAt,  String? updatedAt,  bool? isVeg,  int? preparationTime,  CategoryDTO? category)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _ProductDTO() when $default != null:
return $default(_that.id,_that.businessId,_that.name,_that.slug,_that.type,_that.status,_that.defaultPrice,_that.defaultMrp,_that.stockStatus,_that.availableStock,_that.hasInventory,_that.images,_that.variants,_that.tags,_that.minOrderQty,_that.maxOrderQty,_that.sortOrder,_that.isFeatured,_that.isPopular,_that.metadata,_that.categoryId,_that.description,_that.shortDesc,_that.sku,_that.unit,_that.unitQuantity,_that.workflowType,_that.createdAt,_that.updatedAt,_that.isVeg,_that.preparationTime,_that.category);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String id,  String businessId,  String name,  String slug,  String type,  String status,  double defaultPrice,  double defaultMrp,  String stockStatus,  int availableStock,  bool hasInventory,  List<String> images,  List<VariantDTO> variants,  List<String> tags,  int minOrderQty,  int maxOrderQty,  int sortOrder,  bool isFeatured,  bool isPopular,  Map<String, dynamic> metadata,  String? categoryId,  String? description,  String? shortDesc,  String? sku,  String? unit,  String? unitQuantity,  String? workflowType,  String? createdAt,  String? updatedAt,  bool? isVeg,  int? preparationTime,  CategoryDTO? category)  $default,) {final _that = this;
switch (_that) {
case _ProductDTO():
return $default(_that.id,_that.businessId,_that.name,_that.slug,_that.type,_that.status,_that.defaultPrice,_that.defaultMrp,_that.stockStatus,_that.availableStock,_that.hasInventory,_that.images,_that.variants,_that.tags,_that.minOrderQty,_that.maxOrderQty,_that.sortOrder,_that.isFeatured,_that.isPopular,_that.metadata,_that.categoryId,_that.description,_that.shortDesc,_that.sku,_that.unit,_that.unitQuantity,_that.workflowType,_that.createdAt,_that.updatedAt,_that.isVeg,_that.preparationTime,_that.category);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String id,  String businessId,  String name,  String slug,  String type,  String status,  double defaultPrice,  double defaultMrp,  String stockStatus,  int availableStock,  bool hasInventory,  List<String> images,  List<VariantDTO> variants,  List<String> tags,  int minOrderQty,  int maxOrderQty,  int sortOrder,  bool isFeatured,  bool isPopular,  Map<String, dynamic> metadata,  String? categoryId,  String? description,  String? shortDesc,  String? sku,  String? unit,  String? unitQuantity,  String? workflowType,  String? createdAt,  String? updatedAt,  bool? isVeg,  int? preparationTime,  CategoryDTO? category)?  $default,) {final _that = this;
switch (_that) {
case _ProductDTO() when $default != null:
return $default(_that.id,_that.businessId,_that.name,_that.slug,_that.type,_that.status,_that.defaultPrice,_that.defaultMrp,_that.stockStatus,_that.availableStock,_that.hasInventory,_that.images,_that.variants,_that.tags,_that.minOrderQty,_that.maxOrderQty,_that.sortOrder,_that.isFeatured,_that.isPopular,_that.metadata,_that.categoryId,_that.description,_that.shortDesc,_that.sku,_that.unit,_that.unitQuantity,_that.workflowType,_that.createdAt,_that.updatedAt,_that.isVeg,_that.preparationTime,_that.category);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _ProductDTO implements ProductDTO {
  const _ProductDTO({required this.id, required this.businessId, required this.name, required this.slug, required this.type, required this.status, required this.defaultPrice, required this.defaultMrp, required this.stockStatus, required this.availableStock, this.hasInventory = false, final  List<String> images = const [], final  List<VariantDTO> variants = const [], final  List<String> tags = const [], this.minOrderQty = 1, this.maxOrderQty = 100, this.sortOrder = 0, this.isFeatured = false, this.isPopular = false, final  Map<String, dynamic> metadata = const {}, this.categoryId, this.description, this.shortDesc, this.sku, this.unit, this.unitQuantity, this.workflowType, this.createdAt, this.updatedAt, this.isVeg, this.preparationTime, this.category}): _images = images,_variants = variants,_tags = tags,_metadata = metadata;
  factory _ProductDTO.fromJson(Map<String, dynamic> json) => _$ProductDTOFromJson(json);

@override final  String id;
@override final  String businessId;
@override final  String name;
@override final  String slug;
@override final  String type;
@override final  String status;
@override final  double defaultPrice;
@override final  double defaultMrp;
@override final  String stockStatus;
@override final  int availableStock;
@override@JsonKey() final  bool hasInventory;
 final  List<String> _images;
@override@JsonKey() List<String> get images {
  if (_images is EqualUnmodifiableListView) return _images;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_images);
}

 final  List<VariantDTO> _variants;
@override@JsonKey() List<VariantDTO> get variants {
  if (_variants is EqualUnmodifiableListView) return _variants;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_variants);
}

 final  List<String> _tags;
@override@JsonKey() List<String> get tags {
  if (_tags is EqualUnmodifiableListView) return _tags;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_tags);
}

@override@JsonKey() final  int minOrderQty;
@override@JsonKey() final  int maxOrderQty;
@override@JsonKey() final  int sortOrder;
@override@JsonKey() final  bool isFeatured;
@override@JsonKey() final  bool isPopular;
 final  Map<String, dynamic> _metadata;
@override@JsonKey() Map<String, dynamic> get metadata {
  if (_metadata is EqualUnmodifiableMapView) return _metadata;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableMapView(_metadata);
}

@override final  String? categoryId;
@override final  String? description;
@override final  String? shortDesc;
@override final  String? sku;
@override final  String? unit;
@override final  String? unitQuantity;
@override final  String? workflowType;
@override final  String? createdAt;
@override final  String? updatedAt;
@override final  bool? isVeg;
@override final  int? preparationTime;
@override final  CategoryDTO? category;

/// Create a copy of ProductDTO
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$ProductDTOCopyWith<_ProductDTO> get copyWith => __$ProductDTOCopyWithImpl<_ProductDTO>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$ProductDTOToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _ProductDTO&&(identical(other.id, id) || other.id == id)&&(identical(other.businessId, businessId) || other.businessId == businessId)&&(identical(other.name, name) || other.name == name)&&(identical(other.slug, slug) || other.slug == slug)&&(identical(other.type, type) || other.type == type)&&(identical(other.status, status) || other.status == status)&&(identical(other.defaultPrice, defaultPrice) || other.defaultPrice == defaultPrice)&&(identical(other.defaultMrp, defaultMrp) || other.defaultMrp == defaultMrp)&&(identical(other.stockStatus, stockStatus) || other.stockStatus == stockStatus)&&(identical(other.availableStock, availableStock) || other.availableStock == availableStock)&&(identical(other.hasInventory, hasInventory) || other.hasInventory == hasInventory)&&const DeepCollectionEquality().equals(other._images, _images)&&const DeepCollectionEquality().equals(other._variants, _variants)&&const DeepCollectionEquality().equals(other._tags, _tags)&&(identical(other.minOrderQty, minOrderQty) || other.minOrderQty == minOrderQty)&&(identical(other.maxOrderQty, maxOrderQty) || other.maxOrderQty == maxOrderQty)&&(identical(other.sortOrder, sortOrder) || other.sortOrder == sortOrder)&&(identical(other.isFeatured, isFeatured) || other.isFeatured == isFeatured)&&(identical(other.isPopular, isPopular) || other.isPopular == isPopular)&&const DeepCollectionEquality().equals(other._metadata, _metadata)&&(identical(other.categoryId, categoryId) || other.categoryId == categoryId)&&(identical(other.description, description) || other.description == description)&&(identical(other.shortDesc, shortDesc) || other.shortDesc == shortDesc)&&(identical(other.sku, sku) || other.sku == sku)&&(identical(other.unit, unit) || other.unit == unit)&&(identical(other.unitQuantity, unitQuantity) || other.unitQuantity == unitQuantity)&&(identical(other.workflowType, workflowType) || other.workflowType == workflowType)&&(identical(other.createdAt, createdAt) || other.createdAt == createdAt)&&(identical(other.updatedAt, updatedAt) || other.updatedAt == updatedAt)&&(identical(other.isVeg, isVeg) || other.isVeg == isVeg)&&(identical(other.preparationTime, preparationTime) || other.preparationTime == preparationTime)&&(identical(other.category, category) || other.category == category));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hashAll([runtimeType,id,businessId,name,slug,type,status,defaultPrice,defaultMrp,stockStatus,availableStock,hasInventory,const DeepCollectionEquality().hash(_images),const DeepCollectionEquality().hash(_variants),const DeepCollectionEquality().hash(_tags),minOrderQty,maxOrderQty,sortOrder,isFeatured,isPopular,const DeepCollectionEquality().hash(_metadata),categoryId,description,shortDesc,sku,unit,unitQuantity,workflowType,createdAt,updatedAt,isVeg,preparationTime,category]);

@override
String toString() {
  return 'ProductDTO(id: $id, businessId: $businessId, name: $name, slug: $slug, type: $type, status: $status, defaultPrice: $defaultPrice, defaultMrp: $defaultMrp, stockStatus: $stockStatus, availableStock: $availableStock, hasInventory: $hasInventory, images: $images, variants: $variants, tags: $tags, minOrderQty: $minOrderQty, maxOrderQty: $maxOrderQty, sortOrder: $sortOrder, isFeatured: $isFeatured, isPopular: $isPopular, metadata: $metadata, categoryId: $categoryId, description: $description, shortDesc: $shortDesc, sku: $sku, unit: $unit, unitQuantity: $unitQuantity, workflowType: $workflowType, createdAt: $createdAt, updatedAt: $updatedAt, isVeg: $isVeg, preparationTime: $preparationTime, category: $category)';
}


}

/// @nodoc
abstract mixin class _$ProductDTOCopyWith<$Res> implements $ProductDTOCopyWith<$Res> {
  factory _$ProductDTOCopyWith(_ProductDTO value, $Res Function(_ProductDTO) _then) = __$ProductDTOCopyWithImpl;
@override @useResult
$Res call({
 String id, String businessId, String name, String slug, String type, String status, double defaultPrice, double defaultMrp, String stockStatus, int availableStock, bool hasInventory, List<String> images, List<VariantDTO> variants, List<String> tags, int minOrderQty, int maxOrderQty, int sortOrder, bool isFeatured, bool isPopular, Map<String, dynamic> metadata, String? categoryId, String? description, String? shortDesc, String? sku, String? unit, String? unitQuantity, String? workflowType, String? createdAt, String? updatedAt, bool? isVeg, int? preparationTime, CategoryDTO? category
});


@override $CategoryDTOCopyWith<$Res>? get category;

}
/// @nodoc
class __$ProductDTOCopyWithImpl<$Res>
    implements _$ProductDTOCopyWith<$Res> {
  __$ProductDTOCopyWithImpl(this._self, this._then);

  final _ProductDTO _self;
  final $Res Function(_ProductDTO) _then;

/// Create a copy of ProductDTO
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? id = null,Object? businessId = null,Object? name = null,Object? slug = null,Object? type = null,Object? status = null,Object? defaultPrice = null,Object? defaultMrp = null,Object? stockStatus = null,Object? availableStock = null,Object? hasInventory = null,Object? images = null,Object? variants = null,Object? tags = null,Object? minOrderQty = null,Object? maxOrderQty = null,Object? sortOrder = null,Object? isFeatured = null,Object? isPopular = null,Object? metadata = null,Object? categoryId = freezed,Object? description = freezed,Object? shortDesc = freezed,Object? sku = freezed,Object? unit = freezed,Object? unitQuantity = freezed,Object? workflowType = freezed,Object? createdAt = freezed,Object? updatedAt = freezed,Object? isVeg = freezed,Object? preparationTime = freezed,Object? category = freezed,}) {
  return _then(_ProductDTO(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,businessId: null == businessId ? _self.businessId : businessId // ignore: cast_nullable_to_non_nullable
as String,name: null == name ? _self.name : name // ignore: cast_nullable_to_non_nullable
as String,slug: null == slug ? _self.slug : slug // ignore: cast_nullable_to_non_nullable
as String,type: null == type ? _self.type : type // ignore: cast_nullable_to_non_nullable
as String,status: null == status ? _self.status : status // ignore: cast_nullable_to_non_nullable
as String,defaultPrice: null == defaultPrice ? _self.defaultPrice : defaultPrice // ignore: cast_nullable_to_non_nullable
as double,defaultMrp: null == defaultMrp ? _self.defaultMrp : defaultMrp // ignore: cast_nullable_to_non_nullable
as double,stockStatus: null == stockStatus ? _self.stockStatus : stockStatus // ignore: cast_nullable_to_non_nullable
as String,availableStock: null == availableStock ? _self.availableStock : availableStock // ignore: cast_nullable_to_non_nullable
as int,hasInventory: null == hasInventory ? _self.hasInventory : hasInventory // ignore: cast_nullable_to_non_nullable
as bool,images: null == images ? _self._images : images // ignore: cast_nullable_to_non_nullable
as List<String>,variants: null == variants ? _self._variants : variants // ignore: cast_nullable_to_non_nullable
as List<VariantDTO>,tags: null == tags ? _self._tags : tags // ignore: cast_nullable_to_non_nullable
as List<String>,minOrderQty: null == minOrderQty ? _self.minOrderQty : minOrderQty // ignore: cast_nullable_to_non_nullable
as int,maxOrderQty: null == maxOrderQty ? _self.maxOrderQty : maxOrderQty // ignore: cast_nullable_to_non_nullable
as int,sortOrder: null == sortOrder ? _self.sortOrder : sortOrder // ignore: cast_nullable_to_non_nullable
as int,isFeatured: null == isFeatured ? _self.isFeatured : isFeatured // ignore: cast_nullable_to_non_nullable
as bool,isPopular: null == isPopular ? _self.isPopular : isPopular // ignore: cast_nullable_to_non_nullable
as bool,metadata: null == metadata ? _self._metadata : metadata // ignore: cast_nullable_to_non_nullable
as Map<String, dynamic>,categoryId: freezed == categoryId ? _self.categoryId : categoryId // ignore: cast_nullable_to_non_nullable
as String?,description: freezed == description ? _self.description : description // ignore: cast_nullable_to_non_nullable
as String?,shortDesc: freezed == shortDesc ? _self.shortDesc : shortDesc // ignore: cast_nullable_to_non_nullable
as String?,sku: freezed == sku ? _self.sku : sku // ignore: cast_nullable_to_non_nullable
as String?,unit: freezed == unit ? _self.unit : unit // ignore: cast_nullable_to_non_nullable
as String?,unitQuantity: freezed == unitQuantity ? _self.unitQuantity : unitQuantity // ignore: cast_nullable_to_non_nullable
as String?,workflowType: freezed == workflowType ? _self.workflowType : workflowType // ignore: cast_nullable_to_non_nullable
as String?,createdAt: freezed == createdAt ? _self.createdAt : createdAt // ignore: cast_nullable_to_non_nullable
as String?,updatedAt: freezed == updatedAt ? _self.updatedAt : updatedAt // ignore: cast_nullable_to_non_nullable
as String?,isVeg: freezed == isVeg ? _self.isVeg : isVeg // ignore: cast_nullable_to_non_nullable
as bool?,preparationTime: freezed == preparationTime ? _self.preparationTime : preparationTime // ignore: cast_nullable_to_non_nullable
as int?,category: freezed == category ? _self.category : category // ignore: cast_nullable_to_non_nullable
as CategoryDTO?,
  ));
}

/// Create a copy of ProductDTO
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$CategoryDTOCopyWith<$Res>? get category {
    if (_self.category == null) {
    return null;
  }

  return $CategoryDTOCopyWith<$Res>(_self.category!, (value) {
    return _then(_self.copyWith(category: value));
  });
}
}


/// @nodoc
mixin _$ProductListResponse {

 List<ProductDTO> get data; PaginationMeta get pagination; String? get storeId;
/// Create a copy of ProductListResponse
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$ProductListResponseCopyWith<ProductListResponse> get copyWith => _$ProductListResponseCopyWithImpl<ProductListResponse>(this as ProductListResponse, _$identity);

  /// Serializes this ProductListResponse to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is ProductListResponse&&const DeepCollectionEquality().equals(other.data, data)&&(identical(other.pagination, pagination) || other.pagination == pagination)&&(identical(other.storeId, storeId) || other.storeId == storeId));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,const DeepCollectionEquality().hash(data),pagination,storeId);

@override
String toString() {
  return 'ProductListResponse(data: $data, pagination: $pagination, storeId: $storeId)';
}


}

/// @nodoc
abstract mixin class $ProductListResponseCopyWith<$Res>  {
  factory $ProductListResponseCopyWith(ProductListResponse value, $Res Function(ProductListResponse) _then) = _$ProductListResponseCopyWithImpl;
@useResult
$Res call({
 List<ProductDTO> data, PaginationMeta pagination, String? storeId
});


$PaginationMetaCopyWith<$Res> get pagination;

}
/// @nodoc
class _$ProductListResponseCopyWithImpl<$Res>
    implements $ProductListResponseCopyWith<$Res> {
  _$ProductListResponseCopyWithImpl(this._self, this._then);

  final ProductListResponse _self;
  final $Res Function(ProductListResponse) _then;

/// Create a copy of ProductListResponse
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? data = null,Object? pagination = null,Object? storeId = freezed,}) {
  return _then(_self.copyWith(
data: null == data ? _self.data : data // ignore: cast_nullable_to_non_nullable
as List<ProductDTO>,pagination: null == pagination ? _self.pagination : pagination // ignore: cast_nullable_to_non_nullable
as PaginationMeta,storeId: freezed == storeId ? _self.storeId : storeId // ignore: cast_nullable_to_non_nullable
as String?,
  ));
}
/// Create a copy of ProductListResponse
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$PaginationMetaCopyWith<$Res> get pagination {
  
  return $PaginationMetaCopyWith<$Res>(_self.pagination, (value) {
    return _then(_self.copyWith(pagination: value));
  });
}
}


/// Adds pattern-matching-related methods to [ProductListResponse].
extension ProductListResponsePatterns on ProductListResponse {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _ProductListResponse value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _ProductListResponse() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _ProductListResponse value)  $default,){
final _that = this;
switch (_that) {
case _ProductListResponse():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _ProductListResponse value)?  $default,){
final _that = this;
switch (_that) {
case _ProductListResponse() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( List<ProductDTO> data,  PaginationMeta pagination,  String? storeId)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _ProductListResponse() when $default != null:
return $default(_that.data,_that.pagination,_that.storeId);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( List<ProductDTO> data,  PaginationMeta pagination,  String? storeId)  $default,) {final _that = this;
switch (_that) {
case _ProductListResponse():
return $default(_that.data,_that.pagination,_that.storeId);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( List<ProductDTO> data,  PaginationMeta pagination,  String? storeId)?  $default,) {final _that = this;
switch (_that) {
case _ProductListResponse() when $default != null:
return $default(_that.data,_that.pagination,_that.storeId);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _ProductListResponse implements ProductListResponse {
  const _ProductListResponse({required final  List<ProductDTO> data, required this.pagination, this.storeId}): _data = data;
  factory _ProductListResponse.fromJson(Map<String, dynamic> json) => _$ProductListResponseFromJson(json);

 final  List<ProductDTO> _data;
@override List<ProductDTO> get data {
  if (_data is EqualUnmodifiableListView) return _data;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_data);
}

@override final  PaginationMeta pagination;
@override final  String? storeId;

/// Create a copy of ProductListResponse
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$ProductListResponseCopyWith<_ProductListResponse> get copyWith => __$ProductListResponseCopyWithImpl<_ProductListResponse>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$ProductListResponseToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _ProductListResponse&&const DeepCollectionEquality().equals(other._data, _data)&&(identical(other.pagination, pagination) || other.pagination == pagination)&&(identical(other.storeId, storeId) || other.storeId == storeId));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,const DeepCollectionEquality().hash(_data),pagination,storeId);

@override
String toString() {
  return 'ProductListResponse(data: $data, pagination: $pagination, storeId: $storeId)';
}


}

/// @nodoc
abstract mixin class _$ProductListResponseCopyWith<$Res> implements $ProductListResponseCopyWith<$Res> {
  factory _$ProductListResponseCopyWith(_ProductListResponse value, $Res Function(_ProductListResponse) _then) = __$ProductListResponseCopyWithImpl;
@override @useResult
$Res call({
 List<ProductDTO> data, PaginationMeta pagination, String? storeId
});


@override $PaginationMetaCopyWith<$Res> get pagination;

}
/// @nodoc
class __$ProductListResponseCopyWithImpl<$Res>
    implements _$ProductListResponseCopyWith<$Res> {
  __$ProductListResponseCopyWithImpl(this._self, this._then);

  final _ProductListResponse _self;
  final $Res Function(_ProductListResponse) _then;

/// Create a copy of ProductListResponse
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? data = null,Object? pagination = null,Object? storeId = freezed,}) {
  return _then(_ProductListResponse(
data: null == data ? _self._data : data // ignore: cast_nullable_to_non_nullable
as List<ProductDTO>,pagination: null == pagination ? _self.pagination : pagination // ignore: cast_nullable_to_non_nullable
as PaginationMeta,storeId: freezed == storeId ? _self.storeId : storeId // ignore: cast_nullable_to_non_nullable
as String?,
  ));
}

/// Create a copy of ProductListResponse
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$PaginationMetaCopyWith<$Res> get pagination {
  
  return $PaginationMetaCopyWith<$Res>(_self.pagination, (value) {
    return _then(_self.copyWith(pagination: value));
  });
}
}


/// @nodoc
mixin _$PaginationMeta {

 int get page; int get limit; int get total; int get totalPages; bool get hasNext; bool get hasPrev;
/// Create a copy of PaginationMeta
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$PaginationMetaCopyWith<PaginationMeta> get copyWith => _$PaginationMetaCopyWithImpl<PaginationMeta>(this as PaginationMeta, _$identity);

  /// Serializes this PaginationMeta to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is PaginationMeta&&(identical(other.page, page) || other.page == page)&&(identical(other.limit, limit) || other.limit == limit)&&(identical(other.total, total) || other.total == total)&&(identical(other.totalPages, totalPages) || other.totalPages == totalPages)&&(identical(other.hasNext, hasNext) || other.hasNext == hasNext)&&(identical(other.hasPrev, hasPrev) || other.hasPrev == hasPrev));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,page,limit,total,totalPages,hasNext,hasPrev);

@override
String toString() {
  return 'PaginationMeta(page: $page, limit: $limit, total: $total, totalPages: $totalPages, hasNext: $hasNext, hasPrev: $hasPrev)';
}


}

/// @nodoc
abstract mixin class $PaginationMetaCopyWith<$Res>  {
  factory $PaginationMetaCopyWith(PaginationMeta value, $Res Function(PaginationMeta) _then) = _$PaginationMetaCopyWithImpl;
@useResult
$Res call({
 int page, int limit, int total, int totalPages, bool hasNext, bool hasPrev
});




}
/// @nodoc
class _$PaginationMetaCopyWithImpl<$Res>
    implements $PaginationMetaCopyWith<$Res> {
  _$PaginationMetaCopyWithImpl(this._self, this._then);

  final PaginationMeta _self;
  final $Res Function(PaginationMeta) _then;

/// Create a copy of PaginationMeta
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? page = null,Object? limit = null,Object? total = null,Object? totalPages = null,Object? hasNext = null,Object? hasPrev = null,}) {
  return _then(_self.copyWith(
page: null == page ? _self.page : page // ignore: cast_nullable_to_non_nullable
as int,limit: null == limit ? _self.limit : limit // ignore: cast_nullable_to_non_nullable
as int,total: null == total ? _self.total : total // ignore: cast_nullable_to_non_nullable
as int,totalPages: null == totalPages ? _self.totalPages : totalPages // ignore: cast_nullable_to_non_nullable
as int,hasNext: null == hasNext ? _self.hasNext : hasNext // ignore: cast_nullable_to_non_nullable
as bool,hasPrev: null == hasPrev ? _self.hasPrev : hasPrev // ignore: cast_nullable_to_non_nullable
as bool,
  ));
}

}


/// Adds pattern-matching-related methods to [PaginationMeta].
extension PaginationMetaPatterns on PaginationMeta {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _PaginationMeta value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _PaginationMeta() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _PaginationMeta value)  $default,){
final _that = this;
switch (_that) {
case _PaginationMeta():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _PaginationMeta value)?  $default,){
final _that = this;
switch (_that) {
case _PaginationMeta() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( int page,  int limit,  int total,  int totalPages,  bool hasNext,  bool hasPrev)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _PaginationMeta() when $default != null:
return $default(_that.page,_that.limit,_that.total,_that.totalPages,_that.hasNext,_that.hasPrev);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( int page,  int limit,  int total,  int totalPages,  bool hasNext,  bool hasPrev)  $default,) {final _that = this;
switch (_that) {
case _PaginationMeta():
return $default(_that.page,_that.limit,_that.total,_that.totalPages,_that.hasNext,_that.hasPrev);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( int page,  int limit,  int total,  int totalPages,  bool hasNext,  bool hasPrev)?  $default,) {final _that = this;
switch (_that) {
case _PaginationMeta() when $default != null:
return $default(_that.page,_that.limit,_that.total,_that.totalPages,_that.hasNext,_that.hasPrev);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _PaginationMeta implements PaginationMeta {
  const _PaginationMeta({required this.page, required this.limit, required this.total, required this.totalPages, required this.hasNext, required this.hasPrev});
  factory _PaginationMeta.fromJson(Map<String, dynamic> json) => _$PaginationMetaFromJson(json);

@override final  int page;
@override final  int limit;
@override final  int total;
@override final  int totalPages;
@override final  bool hasNext;
@override final  bool hasPrev;

/// Create a copy of PaginationMeta
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$PaginationMetaCopyWith<_PaginationMeta> get copyWith => __$PaginationMetaCopyWithImpl<_PaginationMeta>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$PaginationMetaToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _PaginationMeta&&(identical(other.page, page) || other.page == page)&&(identical(other.limit, limit) || other.limit == limit)&&(identical(other.total, total) || other.total == total)&&(identical(other.totalPages, totalPages) || other.totalPages == totalPages)&&(identical(other.hasNext, hasNext) || other.hasNext == hasNext)&&(identical(other.hasPrev, hasPrev) || other.hasPrev == hasPrev));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,page,limit,total,totalPages,hasNext,hasPrev);

@override
String toString() {
  return 'PaginationMeta(page: $page, limit: $limit, total: $total, totalPages: $totalPages, hasNext: $hasNext, hasPrev: $hasPrev)';
}


}

/// @nodoc
abstract mixin class _$PaginationMetaCopyWith<$Res> implements $PaginationMetaCopyWith<$Res> {
  factory _$PaginationMetaCopyWith(_PaginationMeta value, $Res Function(_PaginationMeta) _then) = __$PaginationMetaCopyWithImpl;
@override @useResult
$Res call({
 int page, int limit, int total, int totalPages, bool hasNext, bool hasPrev
});




}
/// @nodoc
class __$PaginationMetaCopyWithImpl<$Res>
    implements _$PaginationMetaCopyWith<$Res> {
  __$PaginationMetaCopyWithImpl(this._self, this._then);

  final _PaginationMeta _self;
  final $Res Function(_PaginationMeta) _then;

/// Create a copy of PaginationMeta
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? page = null,Object? limit = null,Object? total = null,Object? totalPages = null,Object? hasNext = null,Object? hasPrev = null,}) {
  return _then(_PaginationMeta(
page: null == page ? _self.page : page // ignore: cast_nullable_to_non_nullable
as int,limit: null == limit ? _self.limit : limit // ignore: cast_nullable_to_non_nullable
as int,total: null == total ? _self.total : total // ignore: cast_nullable_to_non_nullable
as int,totalPages: null == totalPages ? _self.totalPages : totalPages // ignore: cast_nullable_to_non_nullable
as int,hasNext: null == hasNext ? _self.hasNext : hasNext // ignore: cast_nullable_to_non_nullable
as bool,hasPrev: null == hasPrev ? _self.hasPrev : hasPrev // ignore: cast_nullable_to_non_nullable
as bool,
  ));
}


}

// dart format on
