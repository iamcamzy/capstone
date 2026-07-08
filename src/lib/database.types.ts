export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      customers: {
        Row: {
          id: string;
          email: string | null;
          first_name: string | null;
          last_name: string | null;
          phone: string | null;
          email_notifications_enabled: boolean;
          sms_notifications_enabled: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email?: string | null;
          first_name?: string | null;
          last_name?: string | null;
          phone?: string | null;
          email_notifications_enabled?: boolean;
          sms_notifications_enabled?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string | null;
          first_name?: string | null;
          last_name?: string | null;
          phone?: string | null;
          email_notifications_enabled?: boolean;
          sms_notifications_enabled?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      admins: {
        Row: {
          id: string;
          email: string | null;
          first_name: string | null;
          last_name: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email?: string | null;
          first_name?: string | null;
          last_name?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string | null;
          first_name?: string | null;
          last_name?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      bookings: {
        Row: {
          id: string;
          user_id: string;
          venue_id: string;
          full_name: string | null;
          phone: string | null;
          address: string | null;
          pax: number | null;
          event_date: string | null;
          start_date: string;
          end_date: string;
          contract_signing_date: string | null;
          contract_signing_time: string | null;
          package_id: string | null;
          package_type: string | null;
          package_price: number | null;
          package_inclusions: Json | null;
          event_type_id: string | null;
          event_type: string | null;
          caterer: string | null;
          use_woodberry_caterer: boolean;
          rooms_count: number | null;
          selected_rooms: Json | null;
          facility_time_ranges: Json | null;
          additionals: Json | null;
          add_ons: Json | null;
          extension_selections: Json | null;
          corkage_selections: Json | null;
          estimate_summary: Json | null;
          minimum_payment_amount: number | null;
          remaining_balance_amount: number | null;
          terms_accepted_at: string | null;
          special_requests: string | null;
          total_price: number | null;
          status: "contract_signing" | "booked" | "rescheduled" | "cancelled" | "completed";
          status_updated_at: string | null;
          confirmed_at: string | null;
          cancelled_at: string | null;
          rescheduled_at: string | null;
          one_week_email_sent_at: string | null;
          one_week_sms_sent_at: string | null;
          one_week_notice_sent_at: string | null;
          rescheduled_from_booking_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          venue_id: string;
          full_name?: string | null;
          phone?: string | null;
          address?: string | null;
          pax?: number | null;
          event_date?: string | null;
          start_date: string;
          end_date: string;
          contract_signing_date?: string | null;
          contract_signing_time?: string | null;
          package_id?: string | null;
          package_type?: string | null;
          package_price?: number | null;
          package_inclusions?: Json | null;
          event_type_id?: string | null;
          event_type?: string | null;
          caterer?: string | null;
          use_woodberry_caterer?: boolean;
          rooms_count?: number | null;
          selected_rooms?: Json | null;
          facility_time_ranges?: Json | null;
          additionals?: Json | null;
          add_ons?: Json | null;
          extension_selections?: Json | null;
          corkage_selections?: Json | null;
          estimate_summary?: Json | null;
          minimum_payment_amount?: number | null;
          remaining_balance_amount?: number | null;
          terms_accepted_at?: string | null;
          special_requests?: string | null;
          total_price?: number | null;
          status?: "contract_signing" | "booked" | "rescheduled" | "cancelled" | "completed";
          status_updated_at?: string | null;
          confirmed_at?: string | null;
          cancelled_at?: string | null;
          rescheduled_at?: string | null;
          one_week_email_sent_at?: string | null;
          one_week_sms_sent_at?: string | null;
          one_week_notice_sent_at?: string | null;
          rescheduled_from_booking_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          venue_id?: string;
          full_name?: string | null;
          phone?: string | null;
          address?: string | null;
          pax?: number | null;
          event_date?: string | null;
          start_date?: string;
          end_date?: string;
          contract_signing_date?: string | null;
          contract_signing_time?: string | null;
          package_id?: string | null;
          package_type?: string | null;
          package_price?: number | null;
          package_inclusions?: Json | null;
          event_type_id?: string | null;
          event_type?: string | null;
          caterer?: string | null;
          use_woodberry_caterer?: boolean;
          rooms_count?: number | null;
          selected_rooms?: Json | null;
          facility_time_ranges?: Json | null;
          additionals?: Json | null;
          add_ons?: Json | null;
          extension_selections?: Json | null;
          corkage_selections?: Json | null;
          estimate_summary?: Json | null;
          minimum_payment_amount?: number | null;
          remaining_balance_amount?: number | null;
          terms_accepted_at?: string | null;
          special_requests?: string | null;
          total_price?: number | null;
          status?: "contract_signing" | "booked" | "rescheduled" | "cancelled" | "completed";
          status_updated_at?: string | null;
          confirmed_at?: string | null;
          cancelled_at?: string | null;
          rescheduled_at?: string | null;
          one_week_email_sent_at?: string | null;
          one_week_sms_sent_at?: string | null;
          one_week_notice_sent_at?: string | null;
          rescheduled_from_booking_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      event_types: {
        Row: { id: string; name: string; description: string | null; is_active: boolean; created_at: string; };
        Insert: { id?: string; name: string; description?: string | null; is_active?: boolean; created_at?: string; };
        Update: { id?: string; name?: string; description?: string | null; is_active?: boolean; created_at?: string; };
        Relationships: [];
      };
      packages: {
        Row: { id: string; name: string; description: string | null; price: number; inclusions: string | null; max_pax: number | null; is_active: boolean; created_at: string; updated_at: string; };
        Insert: { id?: string; name: string; description?: string | null; price: number; inclusions?: string | null; max_pax?: number | null; is_active?: boolean; created_at?: string; updated_at?: string; };
        Update: { id?: string; name?: string; description?: string | null; price?: number; inclusions?: string | null; max_pax?: number | null; is_active?: boolean; created_at?: string; updated_at?: string; };
        Relationships: [];
      };
      reviews: {
        Row: { id: string; user_id: string; booking_id: string; rating: number; comment: string | null; created_at: string; updated_at: string; };
        Insert: { id?: string; user_id: string; booking_id: string; rating: number; comment?: string | null; created_at?: string; updated_at?: string; };
        Update: { id?: string; user_id?: string; booking_id?: string; rating?: number; comment?: string | null; created_at?: string; updated_at?: string; };
        Relationships: [];
      };
      venues: {
        Row: { id: string; name: string; description: string | null; location: string | null; capacity: number | null; price_per_night: number; image_url: string | null; is_active: boolean; created_at: string; updated_at: string; };
        Insert: { id?: string; name: string; description?: string | null; location?: string | null; capacity?: number | null; price_per_night: number; image_url?: string | null; is_active?: boolean; created_at?: string; updated_at?: string; };
        Update: { id?: string; name?: string; description?: string | null; location?: string | null; capacity?: number | null; price_per_night?: number; image_url?: string | null; is_active?: boolean; created_at?: string; updated_at?: string; };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      create_booking: {
        Args: { p_user_id: string; p_venue_id: string; p_start_date: string; p_end_date: string; p_event_date?: string | null; p_event_type?: string | null; p_event_type_id?: string | null; p_package_id?: string | null; p_pax?: number | null; p_special_requests?: string | null; p_full_name?: string | null; p_phone?: string | null; };
        Returns: string;
      };
      cancel_booking:     { Args: { p_booking_id: string; p_user_id: string }; Returns: boolean; };
      confirm_booking:    { Args: { p_booking_id: string; p_user_id: string }; Returns: boolean; };
      reschedule_booking: { Args: { p_booking_id: string; p_new_start: string; p_new_end: string; p_new_event_date?: string | null }; Returns: string; };
      add_review:         { Args: { p_user_id: string; p_booking_id: string; p_rating: number; p_comment?: string | null }; Returns: string; };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
