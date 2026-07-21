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
          client_name: string
          client_notes: string | null
          client_phone: string
          created_at: string
          end_at: string
          id: string
          professional_id: string
          reference_image_url: string | null
          service_id: string
          service_variant_id: string | null
          start_at: string
          status: Database["public"]["Enums"]["appointment_status"]
          style_notes: string | null
        }
        Insert: {
          client_name: string
          client_notes?: string | null
          client_phone: string
          created_at?: string
          end_at: string
          id?: string
          professional_id: string
          reference_image_url?: string | null
          service_id: string
          service_variant_id?: string | null
          start_at: string
          status?: Database["public"]["Enums"]["appointment_status"]
          style_notes?: string | null
        }
        Update: {
          client_name?: string
          client_notes?: string | null
          client_phone?: string
          created_at?: string
          end_at?: string
          id?: string
          professional_id?: string
          reference_image_url?: string | null
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
      admin_regenerate_claim_code: {
        Args: { _hours: number; _pro_id: string }
        Returns: string
      }
      admin_revoke_claim_code: { Args: { _pro_id: string }; Returns: undefined }
      admin_unlink_professional: {
        Args: { _pro_id: string }
        Returns: undefined
      }
      claim_professional: { Args: { _code: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      owns_professional: { Args: { _prof_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "user" | "profissional"
      appointment_status: "pendente" | "confirmado" | "concluido" | "cancelado"
      service_category:
        | "masculino"
        | "feminino"
        | "noiva"
        | "manicure"
        | "outro"
        | "maquiagem"
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
      service_category: [
        "masculino",
        "feminino",
        "noiva",
        "manicure",
        "outro",
        "maquiagem",
      ],
    },
  },
} as const
