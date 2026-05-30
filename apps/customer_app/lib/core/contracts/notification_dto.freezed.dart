// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'notification_dto.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// dart format off
T _$identity<T>(T value) => value;

/// @nodoc
mixin _$NotificationDTO {

 String get id; String get type; String get channel; String get title; String get message; bool get isRead; String get createdAt; Map<String, dynamic>? get data; String? get readAt; String? get sentAt;
/// Create a copy of NotificationDTO
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$NotificationDTOCopyWith<NotificationDTO> get copyWith => _$NotificationDTOCopyWithImpl<NotificationDTO>(this as NotificationDTO, _$identity);

  /// Serializes this NotificationDTO to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is NotificationDTO&&(identical(other.id, id) || other.id == id)&&(identical(other.type, type) || other.type == type)&&(identical(other.channel, channel) || other.channel == channel)&&(identical(other.title, title) || other.title == title)&&(identical(other.message, message) || other.message == message)&&(identical(other.isRead, isRead) || other.isRead == isRead)&&(identical(other.createdAt, createdAt) || other.createdAt == createdAt)&&const DeepCollectionEquality().equals(other.data, data)&&(identical(other.readAt, readAt) || other.readAt == readAt)&&(identical(other.sentAt, sentAt) || other.sentAt == sentAt));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,type,channel,title,message,isRead,createdAt,const DeepCollectionEquality().hash(data),readAt,sentAt);

@override
String toString() {
  return 'NotificationDTO(id: $id, type: $type, channel: $channel, title: $title, message: $message, isRead: $isRead, createdAt: $createdAt, data: $data, readAt: $readAt, sentAt: $sentAt)';
}


}

/// @nodoc
abstract mixin class $NotificationDTOCopyWith<$Res>  {
  factory $NotificationDTOCopyWith(NotificationDTO value, $Res Function(NotificationDTO) _then) = _$NotificationDTOCopyWithImpl;
@useResult
$Res call({
 String id, String type, String channel, String title, String message, bool isRead, String createdAt, Map<String, dynamic>? data, String? readAt, String? sentAt
});




}
/// @nodoc
class _$NotificationDTOCopyWithImpl<$Res>
    implements $NotificationDTOCopyWith<$Res> {
  _$NotificationDTOCopyWithImpl(this._self, this._then);

  final NotificationDTO _self;
  final $Res Function(NotificationDTO) _then;

/// Create a copy of NotificationDTO
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? id = null,Object? type = null,Object? channel = null,Object? title = null,Object? message = null,Object? isRead = null,Object? createdAt = null,Object? data = freezed,Object? readAt = freezed,Object? sentAt = freezed,}) {
  return _then(_self.copyWith(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,type: null == type ? _self.type : type // ignore: cast_nullable_to_non_nullable
as String,channel: null == channel ? _self.channel : channel // ignore: cast_nullable_to_non_nullable
as String,title: null == title ? _self.title : title // ignore: cast_nullable_to_non_nullable
as String,message: null == message ? _self.message : message // ignore: cast_nullable_to_non_nullable
as String,isRead: null == isRead ? _self.isRead : isRead // ignore: cast_nullable_to_non_nullable
as bool,createdAt: null == createdAt ? _self.createdAt : createdAt // ignore: cast_nullable_to_non_nullable
as String,data: freezed == data ? _self.data : data // ignore: cast_nullable_to_non_nullable
as Map<String, dynamic>?,readAt: freezed == readAt ? _self.readAt : readAt // ignore: cast_nullable_to_non_nullable
as String?,sentAt: freezed == sentAt ? _self.sentAt : sentAt // ignore: cast_nullable_to_non_nullable
as String?,
  ));
}

}


/// Adds pattern-matching-related methods to [NotificationDTO].
extension NotificationDTOPatterns on NotificationDTO {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _NotificationDTO value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _NotificationDTO() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _NotificationDTO value)  $default,){
final _that = this;
switch (_that) {
case _NotificationDTO():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _NotificationDTO value)?  $default,){
final _that = this;
switch (_that) {
case _NotificationDTO() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String id,  String type,  String channel,  String title,  String message,  bool isRead,  String createdAt,  Map<String, dynamic>? data,  String? readAt,  String? sentAt)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _NotificationDTO() when $default != null:
return $default(_that.id,_that.type,_that.channel,_that.title,_that.message,_that.isRead,_that.createdAt,_that.data,_that.readAt,_that.sentAt);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String id,  String type,  String channel,  String title,  String message,  bool isRead,  String createdAt,  Map<String, dynamic>? data,  String? readAt,  String? sentAt)  $default,) {final _that = this;
switch (_that) {
case _NotificationDTO():
return $default(_that.id,_that.type,_that.channel,_that.title,_that.message,_that.isRead,_that.createdAt,_that.data,_that.readAt,_that.sentAt);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String id,  String type,  String channel,  String title,  String message,  bool isRead,  String createdAt,  Map<String, dynamic>? data,  String? readAt,  String? sentAt)?  $default,) {final _that = this;
switch (_that) {
case _NotificationDTO() when $default != null:
return $default(_that.id,_that.type,_that.channel,_that.title,_that.message,_that.isRead,_that.createdAt,_that.data,_that.readAt,_that.sentAt);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _NotificationDTO implements NotificationDTO {
  const _NotificationDTO({required this.id, required this.type, required this.channel, required this.title, required this.message, required this.isRead, required this.createdAt, final  Map<String, dynamic>? data, this.readAt, this.sentAt}): _data = data;
  factory _NotificationDTO.fromJson(Map<String, dynamic> json) => _$NotificationDTOFromJson(json);

@override final  String id;
@override final  String type;
@override final  String channel;
@override final  String title;
@override final  String message;
@override final  bool isRead;
@override final  String createdAt;
 final  Map<String, dynamic>? _data;
@override Map<String, dynamic>? get data {
  final value = _data;
  if (value == null) return null;
  if (_data is EqualUnmodifiableMapView) return _data;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableMapView(value);
}

@override final  String? readAt;
@override final  String? sentAt;

/// Create a copy of NotificationDTO
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$NotificationDTOCopyWith<_NotificationDTO> get copyWith => __$NotificationDTOCopyWithImpl<_NotificationDTO>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$NotificationDTOToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _NotificationDTO&&(identical(other.id, id) || other.id == id)&&(identical(other.type, type) || other.type == type)&&(identical(other.channel, channel) || other.channel == channel)&&(identical(other.title, title) || other.title == title)&&(identical(other.message, message) || other.message == message)&&(identical(other.isRead, isRead) || other.isRead == isRead)&&(identical(other.createdAt, createdAt) || other.createdAt == createdAt)&&const DeepCollectionEquality().equals(other._data, _data)&&(identical(other.readAt, readAt) || other.readAt == readAt)&&(identical(other.sentAt, sentAt) || other.sentAt == sentAt));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,type,channel,title,message,isRead,createdAt,const DeepCollectionEquality().hash(_data),readAt,sentAt);

@override
String toString() {
  return 'NotificationDTO(id: $id, type: $type, channel: $channel, title: $title, message: $message, isRead: $isRead, createdAt: $createdAt, data: $data, readAt: $readAt, sentAt: $sentAt)';
}


}

/// @nodoc
abstract mixin class _$NotificationDTOCopyWith<$Res> implements $NotificationDTOCopyWith<$Res> {
  factory _$NotificationDTOCopyWith(_NotificationDTO value, $Res Function(_NotificationDTO) _then) = __$NotificationDTOCopyWithImpl;
@override @useResult
$Res call({
 String id, String type, String channel, String title, String message, bool isRead, String createdAt, Map<String, dynamic>? data, String? readAt, String? sentAt
});




}
/// @nodoc
class __$NotificationDTOCopyWithImpl<$Res>
    implements _$NotificationDTOCopyWith<$Res> {
  __$NotificationDTOCopyWithImpl(this._self, this._then);

  final _NotificationDTO _self;
  final $Res Function(_NotificationDTO) _then;

/// Create a copy of NotificationDTO
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? id = null,Object? type = null,Object? channel = null,Object? title = null,Object? message = null,Object? isRead = null,Object? createdAt = null,Object? data = freezed,Object? readAt = freezed,Object? sentAt = freezed,}) {
  return _then(_NotificationDTO(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,type: null == type ? _self.type : type // ignore: cast_nullable_to_non_nullable
as String,channel: null == channel ? _self.channel : channel // ignore: cast_nullable_to_non_nullable
as String,title: null == title ? _self.title : title // ignore: cast_nullable_to_non_nullable
as String,message: null == message ? _self.message : message // ignore: cast_nullable_to_non_nullable
as String,isRead: null == isRead ? _self.isRead : isRead // ignore: cast_nullable_to_non_nullable
as bool,createdAt: null == createdAt ? _self.createdAt : createdAt // ignore: cast_nullable_to_non_nullable
as String,data: freezed == data ? _self._data : data // ignore: cast_nullable_to_non_nullable
as Map<String, dynamic>?,readAt: freezed == readAt ? _self.readAt : readAt // ignore: cast_nullable_to_non_nullable
as String?,sentAt: freezed == sentAt ? _self.sentAt : sentAt // ignore: cast_nullable_to_non_nullable
as String?,
  ));
}


}


/// @nodoc
mixin _$NotificationMeta {

 int get page; int get limit; int get total; int get unreadCount; int get totalPages; bool get hasNext;
/// Create a copy of NotificationMeta
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$NotificationMetaCopyWith<NotificationMeta> get copyWith => _$NotificationMetaCopyWithImpl<NotificationMeta>(this as NotificationMeta, _$identity);

  /// Serializes this NotificationMeta to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is NotificationMeta&&(identical(other.page, page) || other.page == page)&&(identical(other.limit, limit) || other.limit == limit)&&(identical(other.total, total) || other.total == total)&&(identical(other.unreadCount, unreadCount) || other.unreadCount == unreadCount)&&(identical(other.totalPages, totalPages) || other.totalPages == totalPages)&&(identical(other.hasNext, hasNext) || other.hasNext == hasNext));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,page,limit,total,unreadCount,totalPages,hasNext);

@override
String toString() {
  return 'NotificationMeta(page: $page, limit: $limit, total: $total, unreadCount: $unreadCount, totalPages: $totalPages, hasNext: $hasNext)';
}


}

/// @nodoc
abstract mixin class $NotificationMetaCopyWith<$Res>  {
  factory $NotificationMetaCopyWith(NotificationMeta value, $Res Function(NotificationMeta) _then) = _$NotificationMetaCopyWithImpl;
@useResult
$Res call({
 int page, int limit, int total, int unreadCount, int totalPages, bool hasNext
});




}
/// @nodoc
class _$NotificationMetaCopyWithImpl<$Res>
    implements $NotificationMetaCopyWith<$Res> {
  _$NotificationMetaCopyWithImpl(this._self, this._then);

  final NotificationMeta _self;
  final $Res Function(NotificationMeta) _then;

/// Create a copy of NotificationMeta
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? page = null,Object? limit = null,Object? total = null,Object? unreadCount = null,Object? totalPages = null,Object? hasNext = null,}) {
  return _then(_self.copyWith(
page: null == page ? _self.page : page // ignore: cast_nullable_to_non_nullable
as int,limit: null == limit ? _self.limit : limit // ignore: cast_nullable_to_non_nullable
as int,total: null == total ? _self.total : total // ignore: cast_nullable_to_non_nullable
as int,unreadCount: null == unreadCount ? _self.unreadCount : unreadCount // ignore: cast_nullable_to_non_nullable
as int,totalPages: null == totalPages ? _self.totalPages : totalPages // ignore: cast_nullable_to_non_nullable
as int,hasNext: null == hasNext ? _self.hasNext : hasNext // ignore: cast_nullable_to_non_nullable
as bool,
  ));
}

}


/// Adds pattern-matching-related methods to [NotificationMeta].
extension NotificationMetaPatterns on NotificationMeta {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _NotificationMeta value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _NotificationMeta() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _NotificationMeta value)  $default,){
final _that = this;
switch (_that) {
case _NotificationMeta():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _NotificationMeta value)?  $default,){
final _that = this;
switch (_that) {
case _NotificationMeta() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( int page,  int limit,  int total,  int unreadCount,  int totalPages,  bool hasNext)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _NotificationMeta() when $default != null:
return $default(_that.page,_that.limit,_that.total,_that.unreadCount,_that.totalPages,_that.hasNext);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( int page,  int limit,  int total,  int unreadCount,  int totalPages,  bool hasNext)  $default,) {final _that = this;
switch (_that) {
case _NotificationMeta():
return $default(_that.page,_that.limit,_that.total,_that.unreadCount,_that.totalPages,_that.hasNext);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( int page,  int limit,  int total,  int unreadCount,  int totalPages,  bool hasNext)?  $default,) {final _that = this;
switch (_that) {
case _NotificationMeta() when $default != null:
return $default(_that.page,_that.limit,_that.total,_that.unreadCount,_that.totalPages,_that.hasNext);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _NotificationMeta implements NotificationMeta {
  const _NotificationMeta({required this.page, required this.limit, required this.total, required this.unreadCount, required this.totalPages, required this.hasNext});
  factory _NotificationMeta.fromJson(Map<String, dynamic> json) => _$NotificationMetaFromJson(json);

@override final  int page;
@override final  int limit;
@override final  int total;
@override final  int unreadCount;
@override final  int totalPages;
@override final  bool hasNext;

/// Create a copy of NotificationMeta
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$NotificationMetaCopyWith<_NotificationMeta> get copyWith => __$NotificationMetaCopyWithImpl<_NotificationMeta>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$NotificationMetaToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _NotificationMeta&&(identical(other.page, page) || other.page == page)&&(identical(other.limit, limit) || other.limit == limit)&&(identical(other.total, total) || other.total == total)&&(identical(other.unreadCount, unreadCount) || other.unreadCount == unreadCount)&&(identical(other.totalPages, totalPages) || other.totalPages == totalPages)&&(identical(other.hasNext, hasNext) || other.hasNext == hasNext));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,page,limit,total,unreadCount,totalPages,hasNext);

@override
String toString() {
  return 'NotificationMeta(page: $page, limit: $limit, total: $total, unreadCount: $unreadCount, totalPages: $totalPages, hasNext: $hasNext)';
}


}

/// @nodoc
abstract mixin class _$NotificationMetaCopyWith<$Res> implements $NotificationMetaCopyWith<$Res> {
  factory _$NotificationMetaCopyWith(_NotificationMeta value, $Res Function(_NotificationMeta) _then) = __$NotificationMetaCopyWithImpl;
@override @useResult
$Res call({
 int page, int limit, int total, int unreadCount, int totalPages, bool hasNext
});




}
/// @nodoc
class __$NotificationMetaCopyWithImpl<$Res>
    implements _$NotificationMetaCopyWith<$Res> {
  __$NotificationMetaCopyWithImpl(this._self, this._then);

  final _NotificationMeta _self;
  final $Res Function(_NotificationMeta) _then;

/// Create a copy of NotificationMeta
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? page = null,Object? limit = null,Object? total = null,Object? unreadCount = null,Object? totalPages = null,Object? hasNext = null,}) {
  return _then(_NotificationMeta(
page: null == page ? _self.page : page // ignore: cast_nullable_to_non_nullable
as int,limit: null == limit ? _self.limit : limit // ignore: cast_nullable_to_non_nullable
as int,total: null == total ? _self.total : total // ignore: cast_nullable_to_non_nullable
as int,unreadCount: null == unreadCount ? _self.unreadCount : unreadCount // ignore: cast_nullable_to_non_nullable
as int,totalPages: null == totalPages ? _self.totalPages : totalPages // ignore: cast_nullable_to_non_nullable
as int,hasNext: null == hasNext ? _self.hasNext : hasNext // ignore: cast_nullable_to_non_nullable
as bool,
  ));
}


}


/// @nodoc
mixin _$NotificationsResponse {

 List<NotificationDTO> get data; NotificationMeta get meta;
/// Create a copy of NotificationsResponse
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$NotificationsResponseCopyWith<NotificationsResponse> get copyWith => _$NotificationsResponseCopyWithImpl<NotificationsResponse>(this as NotificationsResponse, _$identity);

  /// Serializes this NotificationsResponse to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is NotificationsResponse&&const DeepCollectionEquality().equals(other.data, data)&&(identical(other.meta, meta) || other.meta == meta));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,const DeepCollectionEquality().hash(data),meta);

@override
String toString() {
  return 'NotificationsResponse(data: $data, meta: $meta)';
}


}

/// @nodoc
abstract mixin class $NotificationsResponseCopyWith<$Res>  {
  factory $NotificationsResponseCopyWith(NotificationsResponse value, $Res Function(NotificationsResponse) _then) = _$NotificationsResponseCopyWithImpl;
@useResult
$Res call({
 List<NotificationDTO> data, NotificationMeta meta
});


$NotificationMetaCopyWith<$Res> get meta;

}
/// @nodoc
class _$NotificationsResponseCopyWithImpl<$Res>
    implements $NotificationsResponseCopyWith<$Res> {
  _$NotificationsResponseCopyWithImpl(this._self, this._then);

  final NotificationsResponse _self;
  final $Res Function(NotificationsResponse) _then;

/// Create a copy of NotificationsResponse
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? data = null,Object? meta = null,}) {
  return _then(_self.copyWith(
data: null == data ? _self.data : data // ignore: cast_nullable_to_non_nullable
as List<NotificationDTO>,meta: null == meta ? _self.meta : meta // ignore: cast_nullable_to_non_nullable
as NotificationMeta,
  ));
}
/// Create a copy of NotificationsResponse
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$NotificationMetaCopyWith<$Res> get meta {
  
  return $NotificationMetaCopyWith<$Res>(_self.meta, (value) {
    return _then(_self.copyWith(meta: value));
  });
}
}


/// Adds pattern-matching-related methods to [NotificationsResponse].
extension NotificationsResponsePatterns on NotificationsResponse {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _NotificationsResponse value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _NotificationsResponse() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _NotificationsResponse value)  $default,){
final _that = this;
switch (_that) {
case _NotificationsResponse():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _NotificationsResponse value)?  $default,){
final _that = this;
switch (_that) {
case _NotificationsResponse() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( List<NotificationDTO> data,  NotificationMeta meta)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _NotificationsResponse() when $default != null:
return $default(_that.data,_that.meta);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( List<NotificationDTO> data,  NotificationMeta meta)  $default,) {final _that = this;
switch (_that) {
case _NotificationsResponse():
return $default(_that.data,_that.meta);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( List<NotificationDTO> data,  NotificationMeta meta)?  $default,) {final _that = this;
switch (_that) {
case _NotificationsResponse() when $default != null:
return $default(_that.data,_that.meta);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _NotificationsResponse implements NotificationsResponse {
  const _NotificationsResponse({required final  List<NotificationDTO> data, required this.meta}): _data = data;
  factory _NotificationsResponse.fromJson(Map<String, dynamic> json) => _$NotificationsResponseFromJson(json);

 final  List<NotificationDTO> _data;
@override List<NotificationDTO> get data {
  if (_data is EqualUnmodifiableListView) return _data;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_data);
}

@override final  NotificationMeta meta;

/// Create a copy of NotificationsResponse
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$NotificationsResponseCopyWith<_NotificationsResponse> get copyWith => __$NotificationsResponseCopyWithImpl<_NotificationsResponse>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$NotificationsResponseToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _NotificationsResponse&&const DeepCollectionEquality().equals(other._data, _data)&&(identical(other.meta, meta) || other.meta == meta));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,const DeepCollectionEquality().hash(_data),meta);

@override
String toString() {
  return 'NotificationsResponse(data: $data, meta: $meta)';
}


}

/// @nodoc
abstract mixin class _$NotificationsResponseCopyWith<$Res> implements $NotificationsResponseCopyWith<$Res> {
  factory _$NotificationsResponseCopyWith(_NotificationsResponse value, $Res Function(_NotificationsResponse) _then) = __$NotificationsResponseCopyWithImpl;
@override @useResult
$Res call({
 List<NotificationDTO> data, NotificationMeta meta
});


@override $NotificationMetaCopyWith<$Res> get meta;

}
/// @nodoc
class __$NotificationsResponseCopyWithImpl<$Res>
    implements _$NotificationsResponseCopyWith<$Res> {
  __$NotificationsResponseCopyWithImpl(this._self, this._then);

  final _NotificationsResponse _self;
  final $Res Function(_NotificationsResponse) _then;

/// Create a copy of NotificationsResponse
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? data = null,Object? meta = null,}) {
  return _then(_NotificationsResponse(
data: null == data ? _self._data : data // ignore: cast_nullable_to_non_nullable
as List<NotificationDTO>,meta: null == meta ? _self.meta : meta // ignore: cast_nullable_to_non_nullable
as NotificationMeta,
  ));
}

/// Create a copy of NotificationsResponse
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$NotificationMetaCopyWith<$Res> get meta {
  
  return $NotificationMetaCopyWith<$Res>(_self.meta, (value) {
    return _then(_self.copyWith(meta: value));
  });
}
}


/// @nodoc
mixin _$DeviceRegisterRequest {

 String get fcmToken; String get platform; String? get deviceId; String? get appVersion;
/// Create a copy of DeviceRegisterRequest
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$DeviceRegisterRequestCopyWith<DeviceRegisterRequest> get copyWith => _$DeviceRegisterRequestCopyWithImpl<DeviceRegisterRequest>(this as DeviceRegisterRequest, _$identity);

  /// Serializes this DeviceRegisterRequest to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is DeviceRegisterRequest&&(identical(other.fcmToken, fcmToken) || other.fcmToken == fcmToken)&&(identical(other.platform, platform) || other.platform == platform)&&(identical(other.deviceId, deviceId) || other.deviceId == deviceId)&&(identical(other.appVersion, appVersion) || other.appVersion == appVersion));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,fcmToken,platform,deviceId,appVersion);

@override
String toString() {
  return 'DeviceRegisterRequest(fcmToken: $fcmToken, platform: $platform, deviceId: $deviceId, appVersion: $appVersion)';
}


}

/// @nodoc
abstract mixin class $DeviceRegisterRequestCopyWith<$Res>  {
  factory $DeviceRegisterRequestCopyWith(DeviceRegisterRequest value, $Res Function(DeviceRegisterRequest) _then) = _$DeviceRegisterRequestCopyWithImpl;
@useResult
$Res call({
 String fcmToken, String platform, String? deviceId, String? appVersion
});




}
/// @nodoc
class _$DeviceRegisterRequestCopyWithImpl<$Res>
    implements $DeviceRegisterRequestCopyWith<$Res> {
  _$DeviceRegisterRequestCopyWithImpl(this._self, this._then);

  final DeviceRegisterRequest _self;
  final $Res Function(DeviceRegisterRequest) _then;

/// Create a copy of DeviceRegisterRequest
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? fcmToken = null,Object? platform = null,Object? deviceId = freezed,Object? appVersion = freezed,}) {
  return _then(_self.copyWith(
fcmToken: null == fcmToken ? _self.fcmToken : fcmToken // ignore: cast_nullable_to_non_nullable
as String,platform: null == platform ? _self.platform : platform // ignore: cast_nullable_to_non_nullable
as String,deviceId: freezed == deviceId ? _self.deviceId : deviceId // ignore: cast_nullable_to_non_nullable
as String?,appVersion: freezed == appVersion ? _self.appVersion : appVersion // ignore: cast_nullable_to_non_nullable
as String?,
  ));
}

}


/// Adds pattern-matching-related methods to [DeviceRegisterRequest].
extension DeviceRegisterRequestPatterns on DeviceRegisterRequest {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _DeviceRegisterRequest value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _DeviceRegisterRequest() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _DeviceRegisterRequest value)  $default,){
final _that = this;
switch (_that) {
case _DeviceRegisterRequest():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _DeviceRegisterRequest value)?  $default,){
final _that = this;
switch (_that) {
case _DeviceRegisterRequest() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String fcmToken,  String platform,  String? deviceId,  String? appVersion)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _DeviceRegisterRequest() when $default != null:
return $default(_that.fcmToken,_that.platform,_that.deviceId,_that.appVersion);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String fcmToken,  String platform,  String? deviceId,  String? appVersion)  $default,) {final _that = this;
switch (_that) {
case _DeviceRegisterRequest():
return $default(_that.fcmToken,_that.platform,_that.deviceId,_that.appVersion);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String fcmToken,  String platform,  String? deviceId,  String? appVersion)?  $default,) {final _that = this;
switch (_that) {
case _DeviceRegisterRequest() when $default != null:
return $default(_that.fcmToken,_that.platform,_that.deviceId,_that.appVersion);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _DeviceRegisterRequest implements DeviceRegisterRequest {
  const _DeviceRegisterRequest({required this.fcmToken, required this.platform, this.deviceId, this.appVersion});
  factory _DeviceRegisterRequest.fromJson(Map<String, dynamic> json) => _$DeviceRegisterRequestFromJson(json);

@override final  String fcmToken;
@override final  String platform;
@override final  String? deviceId;
@override final  String? appVersion;

/// Create a copy of DeviceRegisterRequest
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$DeviceRegisterRequestCopyWith<_DeviceRegisterRequest> get copyWith => __$DeviceRegisterRequestCopyWithImpl<_DeviceRegisterRequest>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$DeviceRegisterRequestToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _DeviceRegisterRequest&&(identical(other.fcmToken, fcmToken) || other.fcmToken == fcmToken)&&(identical(other.platform, platform) || other.platform == platform)&&(identical(other.deviceId, deviceId) || other.deviceId == deviceId)&&(identical(other.appVersion, appVersion) || other.appVersion == appVersion));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,fcmToken,platform,deviceId,appVersion);

@override
String toString() {
  return 'DeviceRegisterRequest(fcmToken: $fcmToken, platform: $platform, deviceId: $deviceId, appVersion: $appVersion)';
}


}

/// @nodoc
abstract mixin class _$DeviceRegisterRequestCopyWith<$Res> implements $DeviceRegisterRequestCopyWith<$Res> {
  factory _$DeviceRegisterRequestCopyWith(_DeviceRegisterRequest value, $Res Function(_DeviceRegisterRequest) _then) = __$DeviceRegisterRequestCopyWithImpl;
@override @useResult
$Res call({
 String fcmToken, String platform, String? deviceId, String? appVersion
});




}
/// @nodoc
class __$DeviceRegisterRequestCopyWithImpl<$Res>
    implements _$DeviceRegisterRequestCopyWith<$Res> {
  __$DeviceRegisterRequestCopyWithImpl(this._self, this._then);

  final _DeviceRegisterRequest _self;
  final $Res Function(_DeviceRegisterRequest) _then;

/// Create a copy of DeviceRegisterRequest
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? fcmToken = null,Object? platform = null,Object? deviceId = freezed,Object? appVersion = freezed,}) {
  return _then(_DeviceRegisterRequest(
fcmToken: null == fcmToken ? _self.fcmToken : fcmToken // ignore: cast_nullable_to_non_nullable
as String,platform: null == platform ? _self.platform : platform // ignore: cast_nullable_to_non_nullable
as String,deviceId: freezed == deviceId ? _self.deviceId : deviceId // ignore: cast_nullable_to_non_nullable
as String?,appVersion: freezed == appVersion ? _self.appVersion : appVersion // ignore: cast_nullable_to_non_nullable
as String?,
  ));
}


}


/// @nodoc
mixin _$BannerDTO {

 String get id; String get title; String get imageUrl; int get sortOrder; String? get link; String? get startDate; String? get endDate;
/// Create a copy of BannerDTO
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$BannerDTOCopyWith<BannerDTO> get copyWith => _$BannerDTOCopyWithImpl<BannerDTO>(this as BannerDTO, _$identity);

  /// Serializes this BannerDTO to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is BannerDTO&&(identical(other.id, id) || other.id == id)&&(identical(other.title, title) || other.title == title)&&(identical(other.imageUrl, imageUrl) || other.imageUrl == imageUrl)&&(identical(other.sortOrder, sortOrder) || other.sortOrder == sortOrder)&&(identical(other.link, link) || other.link == link)&&(identical(other.startDate, startDate) || other.startDate == startDate)&&(identical(other.endDate, endDate) || other.endDate == endDate));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,title,imageUrl,sortOrder,link,startDate,endDate);

@override
String toString() {
  return 'BannerDTO(id: $id, title: $title, imageUrl: $imageUrl, sortOrder: $sortOrder, link: $link, startDate: $startDate, endDate: $endDate)';
}


}

/// @nodoc
abstract mixin class $BannerDTOCopyWith<$Res>  {
  factory $BannerDTOCopyWith(BannerDTO value, $Res Function(BannerDTO) _then) = _$BannerDTOCopyWithImpl;
@useResult
$Res call({
 String id, String title, String imageUrl, int sortOrder, String? link, String? startDate, String? endDate
});




}
/// @nodoc
class _$BannerDTOCopyWithImpl<$Res>
    implements $BannerDTOCopyWith<$Res> {
  _$BannerDTOCopyWithImpl(this._self, this._then);

  final BannerDTO _self;
  final $Res Function(BannerDTO) _then;

/// Create a copy of BannerDTO
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? id = null,Object? title = null,Object? imageUrl = null,Object? sortOrder = null,Object? link = freezed,Object? startDate = freezed,Object? endDate = freezed,}) {
  return _then(_self.copyWith(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,title: null == title ? _self.title : title // ignore: cast_nullable_to_non_nullable
as String,imageUrl: null == imageUrl ? _self.imageUrl : imageUrl // ignore: cast_nullable_to_non_nullable
as String,sortOrder: null == sortOrder ? _self.sortOrder : sortOrder // ignore: cast_nullable_to_non_nullable
as int,link: freezed == link ? _self.link : link // ignore: cast_nullable_to_non_nullable
as String?,startDate: freezed == startDate ? _self.startDate : startDate // ignore: cast_nullable_to_non_nullable
as String?,endDate: freezed == endDate ? _self.endDate : endDate // ignore: cast_nullable_to_non_nullable
as String?,
  ));
}

}


/// Adds pattern-matching-related methods to [BannerDTO].
extension BannerDTOPatterns on BannerDTO {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _BannerDTO value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _BannerDTO() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _BannerDTO value)  $default,){
final _that = this;
switch (_that) {
case _BannerDTO():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _BannerDTO value)?  $default,){
final _that = this;
switch (_that) {
case _BannerDTO() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String id,  String title,  String imageUrl,  int sortOrder,  String? link,  String? startDate,  String? endDate)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _BannerDTO() when $default != null:
return $default(_that.id,_that.title,_that.imageUrl,_that.sortOrder,_that.link,_that.startDate,_that.endDate);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String id,  String title,  String imageUrl,  int sortOrder,  String? link,  String? startDate,  String? endDate)  $default,) {final _that = this;
switch (_that) {
case _BannerDTO():
return $default(_that.id,_that.title,_that.imageUrl,_that.sortOrder,_that.link,_that.startDate,_that.endDate);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String id,  String title,  String imageUrl,  int sortOrder,  String? link,  String? startDate,  String? endDate)?  $default,) {final _that = this;
switch (_that) {
case _BannerDTO() when $default != null:
return $default(_that.id,_that.title,_that.imageUrl,_that.sortOrder,_that.link,_that.startDate,_that.endDate);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _BannerDTO implements BannerDTO {
  const _BannerDTO({required this.id, required this.title, required this.imageUrl, this.sortOrder = 0, this.link, this.startDate, this.endDate});
  factory _BannerDTO.fromJson(Map<String, dynamic> json) => _$BannerDTOFromJson(json);

@override final  String id;
@override final  String title;
@override final  String imageUrl;
@override@JsonKey() final  int sortOrder;
@override final  String? link;
@override final  String? startDate;
@override final  String? endDate;

/// Create a copy of BannerDTO
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$BannerDTOCopyWith<_BannerDTO> get copyWith => __$BannerDTOCopyWithImpl<_BannerDTO>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$BannerDTOToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _BannerDTO&&(identical(other.id, id) || other.id == id)&&(identical(other.title, title) || other.title == title)&&(identical(other.imageUrl, imageUrl) || other.imageUrl == imageUrl)&&(identical(other.sortOrder, sortOrder) || other.sortOrder == sortOrder)&&(identical(other.link, link) || other.link == link)&&(identical(other.startDate, startDate) || other.startDate == startDate)&&(identical(other.endDate, endDate) || other.endDate == endDate));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,title,imageUrl,sortOrder,link,startDate,endDate);

@override
String toString() {
  return 'BannerDTO(id: $id, title: $title, imageUrl: $imageUrl, sortOrder: $sortOrder, link: $link, startDate: $startDate, endDate: $endDate)';
}


}

/// @nodoc
abstract mixin class _$BannerDTOCopyWith<$Res> implements $BannerDTOCopyWith<$Res> {
  factory _$BannerDTOCopyWith(_BannerDTO value, $Res Function(_BannerDTO) _then) = __$BannerDTOCopyWithImpl;
@override @useResult
$Res call({
 String id, String title, String imageUrl, int sortOrder, String? link, String? startDate, String? endDate
});




}
/// @nodoc
class __$BannerDTOCopyWithImpl<$Res>
    implements _$BannerDTOCopyWith<$Res> {
  __$BannerDTOCopyWithImpl(this._self, this._then);

  final _BannerDTO _self;
  final $Res Function(_BannerDTO) _then;

/// Create a copy of BannerDTO
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? id = null,Object? title = null,Object? imageUrl = null,Object? sortOrder = null,Object? link = freezed,Object? startDate = freezed,Object? endDate = freezed,}) {
  return _then(_BannerDTO(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,title: null == title ? _self.title : title // ignore: cast_nullable_to_non_nullable
as String,imageUrl: null == imageUrl ? _self.imageUrl : imageUrl // ignore: cast_nullable_to_non_nullable
as String,sortOrder: null == sortOrder ? _self.sortOrder : sortOrder // ignore: cast_nullable_to_non_nullable
as int,link: freezed == link ? _self.link : link // ignore: cast_nullable_to_non_nullable
as String?,startDate: freezed == startDate ? _self.startDate : startDate // ignore: cast_nullable_to_non_nullable
as String?,endDate: freezed == endDate ? _self.endDate : endDate // ignore: cast_nullable_to_non_nullable
as String?,
  ));
}


}


/// @nodoc
mixin _$PromoDisplayDTO {

 String get id; String get code; String get type; double get value; double get minOrderAmount; String get validUntil; String? get description; double? get maxDiscount;
/// Create a copy of PromoDisplayDTO
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$PromoDisplayDTOCopyWith<PromoDisplayDTO> get copyWith => _$PromoDisplayDTOCopyWithImpl<PromoDisplayDTO>(this as PromoDisplayDTO, _$identity);

  /// Serializes this PromoDisplayDTO to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is PromoDisplayDTO&&(identical(other.id, id) || other.id == id)&&(identical(other.code, code) || other.code == code)&&(identical(other.type, type) || other.type == type)&&(identical(other.value, value) || other.value == value)&&(identical(other.minOrderAmount, minOrderAmount) || other.minOrderAmount == minOrderAmount)&&(identical(other.validUntil, validUntil) || other.validUntil == validUntil)&&(identical(other.description, description) || other.description == description)&&(identical(other.maxDiscount, maxDiscount) || other.maxDiscount == maxDiscount));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,code,type,value,minOrderAmount,validUntil,description,maxDiscount);

@override
String toString() {
  return 'PromoDisplayDTO(id: $id, code: $code, type: $type, value: $value, minOrderAmount: $minOrderAmount, validUntil: $validUntil, description: $description, maxDiscount: $maxDiscount)';
}


}

/// @nodoc
abstract mixin class $PromoDisplayDTOCopyWith<$Res>  {
  factory $PromoDisplayDTOCopyWith(PromoDisplayDTO value, $Res Function(PromoDisplayDTO) _then) = _$PromoDisplayDTOCopyWithImpl;
@useResult
$Res call({
 String id, String code, String type, double value, double minOrderAmount, String validUntil, String? description, double? maxDiscount
});




}
/// @nodoc
class _$PromoDisplayDTOCopyWithImpl<$Res>
    implements $PromoDisplayDTOCopyWith<$Res> {
  _$PromoDisplayDTOCopyWithImpl(this._self, this._then);

  final PromoDisplayDTO _self;
  final $Res Function(PromoDisplayDTO) _then;

/// Create a copy of PromoDisplayDTO
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? id = null,Object? code = null,Object? type = null,Object? value = null,Object? minOrderAmount = null,Object? validUntil = null,Object? description = freezed,Object? maxDiscount = freezed,}) {
  return _then(_self.copyWith(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,code: null == code ? _self.code : code // ignore: cast_nullable_to_non_nullable
as String,type: null == type ? _self.type : type // ignore: cast_nullable_to_non_nullable
as String,value: null == value ? _self.value : value // ignore: cast_nullable_to_non_nullable
as double,minOrderAmount: null == minOrderAmount ? _self.minOrderAmount : minOrderAmount // ignore: cast_nullable_to_non_nullable
as double,validUntil: null == validUntil ? _self.validUntil : validUntil // ignore: cast_nullable_to_non_nullable
as String,description: freezed == description ? _self.description : description // ignore: cast_nullable_to_non_nullable
as String?,maxDiscount: freezed == maxDiscount ? _self.maxDiscount : maxDiscount // ignore: cast_nullable_to_non_nullable
as double?,
  ));
}

}


/// Adds pattern-matching-related methods to [PromoDisplayDTO].
extension PromoDisplayDTOPatterns on PromoDisplayDTO {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _PromoDisplayDTO value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _PromoDisplayDTO() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _PromoDisplayDTO value)  $default,){
final _that = this;
switch (_that) {
case _PromoDisplayDTO():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _PromoDisplayDTO value)?  $default,){
final _that = this;
switch (_that) {
case _PromoDisplayDTO() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String id,  String code,  String type,  double value,  double minOrderAmount,  String validUntil,  String? description,  double? maxDiscount)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _PromoDisplayDTO() when $default != null:
return $default(_that.id,_that.code,_that.type,_that.value,_that.minOrderAmount,_that.validUntil,_that.description,_that.maxDiscount);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String id,  String code,  String type,  double value,  double minOrderAmount,  String validUntil,  String? description,  double? maxDiscount)  $default,) {final _that = this;
switch (_that) {
case _PromoDisplayDTO():
return $default(_that.id,_that.code,_that.type,_that.value,_that.minOrderAmount,_that.validUntil,_that.description,_that.maxDiscount);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String id,  String code,  String type,  double value,  double minOrderAmount,  String validUntil,  String? description,  double? maxDiscount)?  $default,) {final _that = this;
switch (_that) {
case _PromoDisplayDTO() when $default != null:
return $default(_that.id,_that.code,_that.type,_that.value,_that.minOrderAmount,_that.validUntil,_that.description,_that.maxDiscount);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _PromoDisplayDTO implements PromoDisplayDTO {
  const _PromoDisplayDTO({required this.id, required this.code, required this.type, required this.value, required this.minOrderAmount, required this.validUntil, this.description, this.maxDiscount});
  factory _PromoDisplayDTO.fromJson(Map<String, dynamic> json) => _$PromoDisplayDTOFromJson(json);

@override final  String id;
@override final  String code;
@override final  String type;
@override final  double value;
@override final  double minOrderAmount;
@override final  String validUntil;
@override final  String? description;
@override final  double? maxDiscount;

/// Create a copy of PromoDisplayDTO
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$PromoDisplayDTOCopyWith<_PromoDisplayDTO> get copyWith => __$PromoDisplayDTOCopyWithImpl<_PromoDisplayDTO>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$PromoDisplayDTOToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _PromoDisplayDTO&&(identical(other.id, id) || other.id == id)&&(identical(other.code, code) || other.code == code)&&(identical(other.type, type) || other.type == type)&&(identical(other.value, value) || other.value == value)&&(identical(other.minOrderAmount, minOrderAmount) || other.minOrderAmount == minOrderAmount)&&(identical(other.validUntil, validUntil) || other.validUntil == validUntil)&&(identical(other.description, description) || other.description == description)&&(identical(other.maxDiscount, maxDiscount) || other.maxDiscount == maxDiscount));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,code,type,value,minOrderAmount,validUntil,description,maxDiscount);

@override
String toString() {
  return 'PromoDisplayDTO(id: $id, code: $code, type: $type, value: $value, minOrderAmount: $minOrderAmount, validUntil: $validUntil, description: $description, maxDiscount: $maxDiscount)';
}


}

/// @nodoc
abstract mixin class _$PromoDisplayDTOCopyWith<$Res> implements $PromoDisplayDTOCopyWith<$Res> {
  factory _$PromoDisplayDTOCopyWith(_PromoDisplayDTO value, $Res Function(_PromoDisplayDTO) _then) = __$PromoDisplayDTOCopyWithImpl;
@override @useResult
$Res call({
 String id, String code, String type, double value, double minOrderAmount, String validUntil, String? description, double? maxDiscount
});




}
/// @nodoc
class __$PromoDisplayDTOCopyWithImpl<$Res>
    implements _$PromoDisplayDTOCopyWith<$Res> {
  __$PromoDisplayDTOCopyWithImpl(this._self, this._then);

  final _PromoDisplayDTO _self;
  final $Res Function(_PromoDisplayDTO) _then;

/// Create a copy of PromoDisplayDTO
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? id = null,Object? code = null,Object? type = null,Object? value = null,Object? minOrderAmount = null,Object? validUntil = null,Object? description = freezed,Object? maxDiscount = freezed,}) {
  return _then(_PromoDisplayDTO(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,code: null == code ? _self.code : code // ignore: cast_nullable_to_non_nullable
as String,type: null == type ? _self.type : type // ignore: cast_nullable_to_non_nullable
as String,value: null == value ? _self.value : value // ignore: cast_nullable_to_non_nullable
as double,minOrderAmount: null == minOrderAmount ? _self.minOrderAmount : minOrderAmount // ignore: cast_nullable_to_non_nullable
as double,validUntil: null == validUntil ? _self.validUntil : validUntil // ignore: cast_nullable_to_non_nullable
as String,description: freezed == description ? _self.description : description // ignore: cast_nullable_to_non_nullable
as String?,maxDiscount: freezed == maxDiscount ? _self.maxDiscount : maxDiscount // ignore: cast_nullable_to_non_nullable
as double?,
  ));
}


}

// dart format on
