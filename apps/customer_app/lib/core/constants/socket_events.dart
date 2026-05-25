// WebSocket event names — must match src/lib/socket/events.ts exactly.
class SocketEvents {
  SocketEvents._();

  static const String orderCreated       = 'order:created';
  static const String orderStatusChanged = 'order:status_changed';
  static const String orderUpdated       = 'order:updated';
  static const String orderCancelled     = 'order:cancelled';

  static const String deliveryAssigned        = 'delivery:assigned';
  static const String deliveryStatusUpdated   = 'delivery:status_updated';
  static const String deliveryLocationUpdated = 'delivery:location_updated';
  static const String partnerAssigned         = 'partner:assigned';

  static const String trackingEtaUpdated      = 'tracking:eta_updated';
  static const String trackingSessionStarted  = 'tracking:session_started';
  static const String trackingSessionEnded    = 'tracking:session_ended';

  static const String notificationNew          = 'notification:new';
  static const String notificationCountUpdated = 'notification:count_updated';

  static const String paymentReceived = 'payment:received';
  static const String paymentFailed   = 'payment:failed';
  static const String paymentRefunded = 'payment:refunded';
}

// Room name builders — must match src/lib/socket/events.ts helpers.
class SocketRooms {
  SocketRooms._();

  static String user(String userId)                         => 'user:$userId';
  static String order(String orderId)                       => 'order:$orderId';
  static String business(String businessId)                 => 'business:$businessId';
  static String store(String businessId, String storeId)    => 'business:$businessId:store:$storeId';
  static String partner(String partnerId)                   => 'partner:$partnerId';
}
