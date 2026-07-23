export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      appointments: {
        Row: {
          cancelled_at: string | null
          cancelled_reason: string | null
          client_name: string
          client_notes: string | null
          client_phone: string
          created_at: string
          end_at: string
          id: string
          manage_token: string
          professional_id: string
          reference_image_url: string | null
          reminder_sent_at: string | null
          service_id: string
          service_variant_id: string | null
          start_at: string
          status: Database["public"]["Enums"]["appointment_status"]
          style_notes: string | null
        }
        Insert: {
          cancelled_at?: string | null
          cancelled_reason?: string | null
          client_name: string
          client_notes?: string | null
          client_phone: string
          created_at?: string
          end_at: string
          id?: string
          manage_token?: string
          professional_id: string
          reference_image_url?: string | null
          reminder_sent_at?: string | null
          service_id: string
          service_variant_id?: string | null
          start_at: string
          status?: Database["public"]["Enums"]["appointment_status"]
          style_notes?: string | null
        }
        Update: {
          cancelled_at?: string | null
          cancelled_reason?: string | null
          client_name?: string
          client_notes?: string | null
          client_phone?: string
          created_at?: string
          end_at?: string
          id?: string
          manage_token?: string
          professional_id?: string
          reference_image_url?: string | null
          reminder_sent_at?: string | null
          service_id?: string
          service_variant_id?: string | null
          start_at?: string
          status?: Database["public"]["Enums"]["appointment_status"]
          style_notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "appointments_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_service_variant_id_fkey"
            columns: ["service_variant_id"]
            isOneToOne: false
            referencedRelation: "service_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      claim_attempts: {
        Row: {
          attempts: number
          locked_until: string | null
          user_id: string
          window_start: string
        }
        Insert: {
          attempts?: number
          locked_until?: string | null
          user_id: string
          window_start?: string
        }
        Update: {
          attempts?: number
          locked_until?: string | null
          user_id?: string
          window_start?: string
        }
        Relationships: []
      }
      claim_audit: {
        Row: {
          actor_user_id: string | null
          at: string
          detail: string | null
          event: string
          id: string
          professional_id: string | null
          professional_name: string | null
        }
        Insert: {
          actor_user_id?: string | null
          at?: string
          detail?: string | null
          event: string
          id?: string
          professional_id?: string | null
          professional_name?: string | null
        }
        Update: {
          actor_user_id?: string | null
          at?: string
          detail?: string | null
          event?: string
          id?: string
          professional_id?: string | null
          professional_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "claim_audit_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claim_audit_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals_public"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          created_at: string
          first_visit_at: string
          id: string
          last_visit_at: string
          name: string
          notes: string | null
          opted_out: boolean
          phone_digits: string
          phone_display: string
          total_appointments: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          first_visit_at?: string
          id?: string
          last_visit_at?: string
          name: string
          notes?: string | null
          opted_out?: boolean
          phone_digits: string
          phone_display: string
          total_appointments?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          first_visit_at?: string
          id?: string
          last_visit_at?: string
          name?: string
          notes?: string | null
          opted_out?: boolean
          phone_digits?: string
          phone_display?: string
          total_appointments?: number
          updated_at?: string
        }
        Relationships: []
      }
      loyalty_points: {
        Row: {
          created_at: string
          customer_phone_digits: string
          expires_at: string | null
          id: string
          note: string | null
          points: number
          source: Database["public"]["Enums"]["loyalty_source"]
          source_id: string | null
        }
        Insert: {
          created_at?: string
          customer_phone_digits: string
          expires_at?: string | null
          id?: string
          note?: string | null
          points: number
          source: Database["public"]["Enums"]["loyalty_source"]
          source_id?: string | null
        }
        Update: {
          created_at?: string
          customer_phone_digits?: string
          expires_at?: string | null
          id?: string
          note?: string | null
          points?: number
          source?: Database["public"]["Enums"]["loyalty_source"]
          source_id?: string | null
        }
        Relationships: []
      }
      loyalty_rules: {
        Row: {
          celebration_thresholds: number[]
          enabled: boolean
          id: boolean
          points_expire_months: number
          points_per_real: number
          points_per_review: number
          redeem_ratio: number
          updated_at: string
        }
        Insert: {
          celebration_thresholds?: number[]
          enabled?: boolean
          id?: boolean
          points_expire_months?: number
          points_per_real?: number
          points_per_review?: number
          redeem_ratio?: number
          updated_at?: string
        }
        Update: {
          celebration_thresholds?: number[]
          enabled?: boolean
          id?: boolean
          points_expire_months?: number
          points_per_real?: number
          points_per_review?: number
          redeem_ratio?: number
          updated_at?: string
        }
        Relationships: []
      }
      portfolio_items: {
        Row: {
          active: boolean
          after_path: string
          before_path: string
          category: Database["public"]["Enums"]["service_category"]
          created_at: string
          id: string
          notes: string | null
          professional_id: string
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          sort_order: number
          status: Database["public"]["Enums"]["portfolio_status"]
          title: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          after_path: string
          before_path: string
          category?: Database["public"]["Enums"]["service_category"]
          created_at?: string
          id?: string
          notes?: string | null
          professional_id: string
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          sort_order?: number
          status?: Database["public"]["Enums"]["portfolio_status"]
          title?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          after_path?: string
          before_path?: string
          category?: Database["public"]["Enums"]["service_category"]
          created_at?: string
          id?: string
          notes?: string | null
          professional_id?: string
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          sort_order?: number
          status?: Database["public"]["Enums"]["portfolio_status"]
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "portfolio_items_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portfolio_items_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals_public"
            referencedColumns: ["id"]
          },
        ]
      }
      professionals: {
        Row: {
          active: boolean
          bio: string | null
          claim_code: string | null
          claim_code_expires_at: string | null
          created_at: string
          id: string
          name: string
          role_title: string
          slug: string
          user_id: string | null
          work_end: string
          work_start: string
        }
        Insert: {
          active?: boolean
          bio?: string | null
          claim_code?: string | null
          claim_code_expires_at?: string | null
          created_at?: string
          id?: string
          name: string
          role_title: string
          slug: string
          user_id?: string | null
          work_end?: string
          work_start?: string
        }
        Update: {
          active?: boolean
          bio?: string | null
          claim_code?: string | null
          claim_code_expires_at?: string | null
          created_at?: string
          id?: string
          name?: string
          role_title?: string
          slug?: string
          user_id?: string | null
          work_end?: string
          work_start?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string | null
          id: string
        }
        Insert: {
          created_at?: string
          full_name?: string | null
          id: string
        }
        Update: {
          created_at?: string
          full_name?: string | null
          id?: string
        }
        Relationships: []
      }
      reengagement_events: {
        Row: {
          channel: string
          customer_id: string
          id: string
          message: string | null
          sent_at: string
          status: string
          webhook_response: string | null
        }
        Insert: {
          channel?: string
          customer_id: string
          id?: string
          message?: string | null
          sent_at?: string
          status: string
          webhook_response?: string | null
        }
        Update: {
          channel?: string
          customer_id?: string
          id?: string
          message?: string | null
          sent_at?: string
          status?: string
          webhook_response?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reengagement_events_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      reengagement_settings: {
        Row: {
          cooldown_days: number
          days_threshold: number
          enabled: boolean
          id: number
          message_template: string
          updated_at: string
        }
        Insert: {
          cooldown_days?: number
          days_threshold?: number
          enabled?: boolean
          id?: number
          message_template?: string
          updated_at?: string
        }
        Update: {
          cooldown_days?: number
          days_threshold?: number
          enabled?: boolean
          id?: number
          message_template?: string
          updated_at?: string
        }
        Relationships: []
      }
      reminder_settings: {
        Row: {
          enabled: boolean
          hours_before: number
          id: number
          message_template: string
          updated_at: string
        }
        Insert: {
          enabled?: boolean
          hours_before?: number
          id?: number
          message_template?: string
          updated_at?: string
        }
        Update: {
          enabled?: boolean
          hours_before?: number
          id?: number
          message_template?: string
          updated_at?: string
        }
        Relationships: []
      }
      review_events: {
        Row: {
          appointment_id: string
          channel: string
          customer_id: string | null
          id: string
          message: string
          sent_at: string
          status: string
          webhook_response: string | null
        }
        Insert: {
          appointment_id: string
          channel?: string
          customer_id?: string | null
          id?: string
          message: string
          sent_at?: string
          status: string
          webhook_response?: string | null
        }
        Update: {
          appointment_id?: string
          channel?: string
          customer_id?: string | null
          id?: string
          message?: string
          sent_at?: string
          status?: string
          webhook_response?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "review_events_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: true
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_events_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      review_settings: {
        Row: {
          cooldown_days: number
          created_at: string
          enabled: boolean
          google_review_url: string
          hours_after: number
          id: number
          message_template: string
          updated_at: string
        }
        Insert: {
          cooldown_days?: number
          created_at?: string
          enabled?: boolean
          google_review_url?: string
          hours_after?: number
          id?: number
          message_template?: string
          updated_at?: string
        }
        Update: {
          cooldown_days?: number
          created_at?: string
          enabled?: boolean
          google_review_url?: string
          hours_after?: number
          id?: number
          message_template?: string
          updated_at?: string
        }
        Relationships: []
      }
      service_variants: {
        Row: {
          active: boolean
          created_at: string
          description: string | null
          extra_price_cents: number
          id: string
          name: string
          service_id: string
          sort_order: number
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string | null
          extra_price_cents?: number
          id?: string
          name: string
          service_id: string
          sort_order?: number
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string | null
          extra_price_cents?: number
          id?: string
          name?: string
          service_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "service_variants_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      services: {
        Row: {
          active: boolean
          category: Database["public"]["Enums"]["service_category"]
          created_at: string
          duration_minutes: number
          id: string
          name: string
          price_cents: number
          professional_id: string
          sort_order: number
        }
        Insert: {
          active?: boolean
          category: Database["public"]["Enums"]["service_category"]
          created_at?: string
          duration_minutes?: number
          id?: string
          name: string
          price_cents?: number
          professional_id: string
          sort_order?: number
        }
        Update: {
          active?: boolean
          category?: Database["public"]["Enums"]["service_category"]
          created_at?: string
          duration_minutes?: number
          id?: string
          name?: string
          price_cents?: number
          professional_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "services_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "services_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals_public"
            referencedColumns: ["id"]
          },
        ]
      }
      time_blocks: {
        Row: {
          created_at: string
          created_by: string | null
          end_at: string
          id: string
          professional_id: string
          reason: string | null
          start_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          end_at: string
          id?: string
          professional_id: string
          reason?: string | null
          start_at: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          end_at?: string
          id?: string
          professional_id?: string
          reason?: string | null
          start_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "time_blocks_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_blocks_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals_public"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      waitlist: {
        Row: {
          client_name: string
          client_phone: string
          created_at: string
          desired_date: string
          id: string
          notes: string | null
          notified_at: string | null
          professional_id: string
          service_id: string
          status: string
          track_token: string
          updated_at: string
        }
        Insert: {
          client_name: string
          client_phone: string
          created_at?: string
          desired_date: string
          id?: string
          notes?: string | null
          notified_at?: string | null
          professional_id: string
          service_id: string
          status?: string
          track_token?: string
          updated_at?: string
        }
        Update: {
          client_name?: string
          client_phone?: string
          created_at?: string
          desired_date?: string
          id?: string
          notes?: string | null
          notified_at?: string | null
          professional_id?: string
          service_id?: string
          status?: string
          track_token?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "waitlist_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waitlist_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waitlist_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      wedding_guests: {
        Row: {
          appointment_id: string | null
          consent_at: string | null
          created_at: string
          end_at: string
          guest_name: string
          guest_phone: string
          id: string
          notes: string | null
          package_id: string
          professional_id: string
          service_id: string
          start_at: string
          status: Database["public"]["Enums"]["appointment_status"]
          updated_at: string
        }
        Insert: {
          appointment_id?: string | null
          consent_at?: string | null
          created_at?: string
          end_at: string
          guest_name: string
          guest_phone: string
          id?: string
          notes?: string | null
          package_id: string
          professional_id: string
          service_id: string
          start_at: string
          status?: Database["public"]["Enums"]["appointment_status"]
          updated_at?: string
        }
        Update: {
          appointment_id?: string | null
          consent_at?: string | null
          created_at?: string
          end_at?: string
          guest_name?: string
          guest_phone?: string
          id?: string
          notes?: string | null
          package_id?: string
          professional_id?: string
          service_id?: string
          start_at?: string
          status?: Database["public"]["Enums"]["appointment_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "wedding_guests_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wedding_guests_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "wedding_packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wedding_guests_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wedding_guests_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wedding_guests_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      wedding_packages: {
        Row: {
          block_end_at: string
          block_start_at: string
          bride_name: string
          bride_phone: string
          created_at: string
          created_by: string | null
          event_date: string
          event_location: string | null
          group_token: string
          id: string
          max_guests: number
          notes: string | null
          professional_id: string
          status: Database["public"]["Enums"]["wedding_status"]
          updated_at: string
        }
        Insert: {
          block_end_at: string
          block_start_at: string
          bride_name: string
          bride_phone: string
          created_at?: string
          created_by?: string | null
          event_date: string
          event_location?: string | null
          group_token?: string
          id?: string
          max_guests?: number
          notes?: string | null
          professional_id: string
          status?: Database["public"]["Enums"]["wedding_status"]
          updated_at?: string
        }
        Update: {
          block_end_at?: string
          block_start_at?: string
          bride_name?: string
          bride_phone?: string
          created_at?: string
          created_by?: string | null
          event_date?: string
          event_location?: string | null
          group_token?: string
          id?: string
          max_guests?: number
          notes?: string | null
          professional_id?: string
          status?: Database["public"]["Enums"]["wedding_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "wedding_packages_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wedding_packages_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals_public"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      appointments_busy: {
        Row: {
          end_at: string | null
          professional_id: string | null
          start_at: string | null
          status: Database["public"]["Enums"]["appointment_status"] | null
        }
        Insert: {
          end_at?: string | null
          professional_id?: string | null
          start_at?: string | null
          status?: Database["public"]["Enums"]["appointment_status"] | null
        }
        Update: {
          end_at?: string | null
          professional_id?: string | null
          start_at?: string | null
          status?: Database["public"]["Enums"]["appointment_status"] | null
        }
        Relationships: [
          {
            foreignKeyName: "appointments_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals_public"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_loyalty_summary: {
        Row: {
          balance: number | null
          last_activity_at: string | null
          lifetime_earned: number | null
          phone_digits: string | null
        }
        Relationships: []
      }
      professionals_public: {
        Row: {
          active: boolean | null
          bio: string | null
          id: string | null
          name: string | null
          role_title: string | null
          slug: string | null
          work_end: string | null
          work_start: string | null
        }
        Insert: {
          active?: boolean | null
          bio?: string | null
          id?: string | null
          name?: string | null
          role_title?: string | null
          slug?: string | null
          work_end?: string | null
          work_start?: string | null
        }
        Update: {
          active?: boolean | null
          bio?: string | null
          id?: string | null
          name?: string | null
          role_title?: string | null
          slug?: string | null
          work_end?: string | null
          work_start?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      admin_grant_loyalty_bonus: {
        Args: { _note: string; _phone_digits: string; _points: number }
        Returns: string
      }
      admin_regenerate_claim_code: {
        Args: { _hours: number; _pro_id: string }
        Returns: string
      }
      admin_revoke_claim_code: { Args: { _pro_id: string }; Returns: undefined }
      admin_unlink_professional: {
        Args: { _pro_id: string }
        Returns: undefined
      }
      book_appointment: {
        Args: {
          _client_name: string
          _client_notes: string
          _client_phone: string
          _end_at: string
          _professional_id: string
          _reference_image_url: string
          _service_id: string
          _service_variant_id: string
          _start_at: string
          _style_notes: string
        }
        Returns: string
      }
      book_wedding_guest: {
        Args: {
          _consent: boolean
          _guest_name: string
          _guest_phone: string
          _notes?: string
          _service_id: string
          _start_at: string
          _token: string
        }
        Returns: string
      }
      cancel_appointment_by_token: {
        Args: { _token: string }
        Returns: undefined
      }
      claim_professional: { Args: { _code: string }; Returns: string }
      get_appointment_by_token: { Args: { _token: string }; Returns: Json }
      get_loyalty_by_token: { Args: { _token: string }; Returns: Json }
      get_waitlist_status: { Args: { _token: string }; Returns: Json }
      get_wedding_by_token: { Args: { _token: string }; Returns: Json }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      leave_waitlist: { Args: { _token: string }; Returns: undefined }
      owns_professional: { Args: { _prof_id: string }; Returns: boolean }
      reschedule_appointment_by_token: {
        Args: { _new_start: string; _token: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "user" | "profissional"
      appointment_status: "pendente" | "confirmado" | "concluido" | "cancelado"
      loyalty_source: "appointment" | "review" | "referral" | "bonus" | "redeem"
      portfolio_status: "rascunho" | "aprovado" | "oculto"
      service_category:
        | "masculino"
        | "feminino"
        | "noiva"
        | "manicure"
        | "outro"
        | "maquiagem"
      wedding_status: "rascunho" | "ativo" | "concluido" | "cancelado"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "user", "profissional"],
      appointment_status: ["pendente", "confirmado", "concluido", "cancelado"],
      loyalty_source: ["appointment", "review", "referral", "bonus", "redeem"],
      portfolio_status: ["rascunho", "aprovado", "oculto"],
      service_category: [
        "masculino",
        "feminino",
        "noiva",
        "manicure",
        "outro",
        "maquiagem",
      ],
      wedding_status: ["rascunho", "ativo", "concluido", "cancelado"],
    },
  },
} as const
