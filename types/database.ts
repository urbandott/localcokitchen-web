export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type AdminCookStatus = "submitted" | "approved" | "rejected" | "suspended" | "draft";

export type IdentityUser = {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  full_name: string | null;
  marketing_opt_in: boolean;
  marketing_opt_in_at: string | null;
  avatar_url: string | null;
  avatar_path: string | null;
  cook_onboarding_started_at: string | null;
  created_at: string;
  updated_at: string;
};

export type CustomerMenuItem = {
  id: string;
  cook_id: string;
  name: string;
  description: string;
  image_url: string | null;
  price_cents: number;
  quantity_available: number;
  category: string;
  allergens: string[];
  dietary_tags: string[];
  main_ingredients: string[];
  portion_size: string | null;
  portion_serves: number | null;
  spice_level: string | null;
  pickup_window_note: string | null;
  cook_display_name: string;
  cook_profile_image_url: string | null;
  cook_description: string | null;
  cook_cuisine_type: string | null;
  cook_order_notes: string | null;
  cook_rating: number;
  cook_review_count: number;
  cook_public_menu_count: number;
  created_at: string;
};

export type CookApplication = {
  user_id: string;
  legal_name: string;
  phone: string;
  pickup_address: string;
  pickup_zip_code: string;
  food_handler_training_completed: boolean;
  food_handler_certificate_url: string | null;
  permit_or_certification_url: string | null;
  government_id_document_url: string | null;
  selfie_verification_url: string | null;
  status: AdminCookStatus;
  submitted_at: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  review_notes: string | null;
  created_at: string;
  updated_at: string;
};

export type CookProfile = {
  cook_id: string;
  display_name: string;
  profile_image_url: string | null;
  description: string | null;
  cuisine_type: string | null;
  pickup_zip_code: string | null;
  preorder_cutoff_hours: number;
  order_notes: string | null;
  is_public: boolean;
  rating: number;
  review_count: number;
  moderator_disabled_at: string | null;
  moderator_disabled_by: string | null;
  created_at: string;
  updated_at: string;
};

export type CookMenuItem = {
  id: string;
  cook_id: string;
  name: string;
  description: string;
  image_url: string;
  price_cents: number;
  quantity_available: number;
  category: string;
  allergens: string[];
  dietary_tags: string[];
  main_ingredients: string[];
  portion_size: string | null;
  portion_serves: number | null;
  spice_level: string | null;
  pickup_window_note: string | null;
  is_sold_out: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type CookPickupWindow = {
  id: string;
  cook_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type CustomerOrder = {
  id: string;
  customer_id: string;
  status: "pending_payment" | "paid" | "cancelled" | "fulfilled" | "refunded";
  subtotal_cents: number;
  currency: "usd";
  expires_at: string;
  paid_at: string | null;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
};

export type CustomerOrderItem = {
  id: string;
  order_id: string;
  menu_item_id: string;
  cook_id: string;
  item_name: string;
  unit_price_cents: number;
  quantity: number;
  line_total_cents: number;
  fulfillment_status: "pending" | "ready" | "fulfilled";
  fulfilled_at: string | null;
  created_at: string;
};

export type CheckoutOrderResult = {
  order_id: string;
  subtotal_cents: number;
  item_count: number;
};

export type CustomerPaymentAttempt = {
  id: string;
  order_id: string;
  customer_id: string;
  provider: "stripe" | "manual" | "test";
  provider_reference: string;
  status:
    | "created"
    | "requires_action"
    | "processing"
    | "succeeded"
    | "failed"
    | "canceled"
    | "expired";
  amount_cents: number;
  currency: "usd";
  last_event_id: string | null;
  last_event_type: string | null;
  created_at: string;
  updated_at: string;
};

export type PaymentWebhookResult = {
  order_id: string | null;
  order_status: string | null;
  payment_status: string;
  processed: boolean;
};

export type CookOrderItemSummary = {
  order_item_id: string;
  order_id: string;
  menu_item_id: string;
  item_name: string;
  quantity: number;
  unit_price_cents: number;
  line_total_cents: number;
  fulfillment_status: "pending" | "ready" | "fulfilled";
  fulfilled_at: string | null;
  order_status: CustomerOrder["status"];
  order_paid_at: string | null;
  order_created_at: string;
};

export type AdminCookSummary = {
  cook_id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  full_name: string | null;
  legal_name: string | null;
  phone: string | null;
  pickup_zip_code: string | null;
  application_status: AdminCookStatus;
  submitted_at: string | null;
  reviewed_at: string | null;
  display_name: string | null;
  cuisine_type: string | null;
  is_live_kitchen: boolean;
  moderator_disabled_at: string | null;
  active_menu_item_count: number;
  active_pickup_window_count: number;
  rating: number | null;
  review_count: number | null;
  total_count: number;
};

export type AdminMetrics = {
  submitted_application_count: number;
  approved_application_count: number;
  rejected_application_count: number;
  suspended_application_count: number;
  public_cook_count: number;
  moderator_disabled_cook_count: number;
  active_menu_item_count: number;
  sold_out_item_count: number;
  active_pickup_window_count: number;
  review_count_30d: number;
};

export type AdminAuditEvent = {
  event_source: "admin_action" | "system_event";
  event_name: string;
  actor_user_id: string | null;
  target_type: string;
  target_id: string | null;
  severity: "info" | "warning" | "critical";
  metadata: Json;
  created_at: string;
};

export type NotificationOutbox = {
  id: string;
  notification_type: string;
  recipient_user_id: string | null;
  recipient_email: string;
  channel: "email";
  template_key: string;
  target_type: string;
  target_id: string | null;
  payload: Json;
  status: "pending" | "processing" | "sent" | "failed" | "cancelled";
  attempts: number;
  next_attempt_at: string;
  sent_at: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
};

export type AdminNotificationSummary = {
  status: NotificationOutbox["status"];
  total_count: number;
  oldest_created_at: string | null;
  newest_created_at: string | null;
};

export type AdminNotificationRow = {
  notification_id: string;
  notification_type: string;
  recipient_email_masked: string;
  channel: "email";
  template_key: string;
  target_type: string;
  target_id: string | null;
  status: NotificationOutbox["status"];
  attempts: number;
  next_attempt_at: string;
  sent_at: string | null;
  last_error: string;
  created_at: string;
  updated_at: string;
  total_count: number;
};

export type OpsNotificationHealthAlert = {
  alert_key: string;
  severity: "warning" | "critical";
  message: string;
};

export type Database = {
  lck_marketplace: {
    Tables: {
      cook_applications: {
        Row: CookApplication;
        Insert: Partial<CookApplication>;
        Update: Partial<CookApplication>;
      };
      cook_profiles: {
        Row: CookProfile;
        Insert: Partial<CookProfile>;
        Update: Partial<CookProfile>;
      };
      cook_menu_items: {
        Row: CookMenuItem;
        Insert: Partial<CookMenuItem>;
        Update: Partial<CookMenuItem>;
      };
      cook_pickup_windows: {
        Row: CookPickupWindow;
        Insert: Partial<CookPickupWindow>;
        Update: Partial<CookPickupWindow>;
      };
      customer_orders: {
        Row: CustomerOrder;
        Insert: Partial<CustomerOrder>;
        Update: Partial<CustomerOrder>;
      };
      customer_order_items: {
        Row: CustomerOrderItem;
        Insert: Partial<CustomerOrderItem>;
        Update: Partial<CustomerOrderItem>;
      };
      customer_payment_attempts: {
        Row: CustomerPaymentAttempt;
        Insert: Partial<CustomerPaymentAttempt>;
        Update: Partial<CustomerPaymentAttempt>;
      };
    };
    Functions: {
      get_customer_menu_items: {
        Args: {
          p_search?: string | null;
          p_categories?: string[];
          p_dietary_tags?: string[];
          p_excluded_allergens?: string[];
          p_cuisine_types?: string[];
          p_spice_levels?: string[];
          p_cook_ids?: string[];
          p_item_ids?: string[];
          p_min_quantity?: number | null;
          p_limit?: number;
          p_offset?: number;
        };
        Returns: CustomerMenuItem[];
      };
      save_own_pickup_windows: {
        Args: { p_windows: Json };
        Returns: Json;
      };
      create_customer_checkout_order: {
        Args: { p_cart: Json };
        Returns: CheckoutOrderResult[];
      };
      create_checkout_session_payment_attempt: {
        Args: {
          p_amount_cents: number;
          p_currency?: string;
          p_order_id: string;
          p_provider_reference: string;
        };
        Returns: string;
      };
      cancel_own_pending_payment_order: {
        Args: { p_order_id: string };
        Returns: boolean;
      };
      record_payment_webhook_event: {
        Args: {
          p_provider: string;
          p_provider_event_id: string;
          p_event_type: string;
          p_provider_reference: string;
          p_payment_status: string;
          p_order_id?: string | null;
          p_amount_cents?: number | null;
          p_currency?: string | null;
          p_payload?: Json;
        };
        Returns: PaymentWebhookResult[];
      };
      expire_pending_payment_orders: {
        Args: { p_before?: string };
        Returns: number;
      };
      list_own_cook_order_items: {
        Args: Record<string, never>;
        Returns: CookOrderItemSummary[];
      };
      update_own_cook_order_item_fulfillment: {
        Args: { p_fulfillment_status: string; p_order_item_id: string };
        Returns: boolean;
      };
    };
  };
  lck_identity: {
    Tables: {
      users: {
        Row: IdentityUser;
        Insert: Partial<IdentityUser>;
        Update: Partial<IdentityUser>;
      };
    };
    Functions: {
      current_user_is_admin: { Args: Record<string, never>; Returns: boolean };
      get_admin_metrics: { Args: Record<string, never>; Returns: AdminMetrics };
      get_admin_notification_summary: {
        Args: Record<string, never>;
        Returns: AdminNotificationSummary[];
      };
      list_admin_audit_events: {
        Args: {
          p_event_type?: string | null;
          p_limit?: number;
          p_offset?: number;
          p_target_type?: string | null;
        };
        Returns: AdminAuditEvent[];
      };
      list_admin_notifications: {
        Args: {
          p_status?: string | null;
          p_limit?: number;
          p_offset?: number;
        };
        Returns: AdminNotificationRow[];
      };
      list_admin_cooks: {
        Args: {
          p_search?: string | null;
          p_status?: string | null;
          p_kitchen_state?: string | null;
          p_sort?: string | null;
          p_limit?: number;
          p_offset?: number;
        };
        Returns: AdminCookSummary[];
      };
      set_admin_cook_kitchen_disabled: {
        Args: { p_cook_id: string; p_disabled: boolean };
        Returns: boolean;
      };
      retry_admin_notification: {
        Args: { p_notification_id: string };
        Returns: boolean;
      };
    };
  };
  lck_private: {
    Tables: {
      notification_outbox: {
        Row: NotificationOutbox;
        Insert: Partial<NotificationOutbox>;
        Update: Partial<NotificationOutbox>;
      };
      notification_health_alert_state: {
        Row: {
          alert_key: string;
          severity: "warning" | "critical";
          message: string;
          last_seen_at: string;
          last_claimed_at: string | null;
          last_sent_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<{
          alert_key: string;
          severity: "warning" | "critical";
          message: string;
          last_seen_at: string;
          last_claimed_at: string | null;
          last_sent_at: string | null;
          created_at: string;
          updated_at: string;
        }>;
        Update: Partial<{
          alert_key: string;
          severity: "warning" | "critical";
          message: string;
          last_seen_at: string;
          last_claimed_at: string | null;
          last_sent_at: string | null;
          created_at: string;
          updated_at: string;
        }>;
      };
    };
    Functions: {
      claim_notification_health_alerts: {
        Args: Record<string, never>;
        Returns: OpsNotificationHealthAlert[];
      };
      claim_pending_notifications: {
        Args: { p_limit?: number };
        Returns: NotificationOutbox[];
      };
      mark_notification_health_alert_sent: {
        Args: { p_alert_key: string };
        Returns: boolean;
      };
      mark_notification_failed: {
        Args: { p_error: string; p_notification_id: string };
        Returns: boolean;
      };
      mark_notification_sent: {
        Args: { p_notification_id: string };
        Returns: boolean;
      };
    };
  };
};
