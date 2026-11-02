export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18";
  };
  public: {
    Tables: {
      chat_messages: {
        Row: {
          author_email: string | null;
          author_name: string;
          created_at: string | null;
          event_id: string;
          id: string;
          is_organiser: boolean | null;
          pinned: boolean | null;
          text: string;
        };
        Insert: {
          author_email?: string | null;
          author_name: string;
          created_at?: string | null;
          event_id: string;
          id?: string;
          is_organiser?: boolean | null;
          pinned?: boolean | null;
          text: string;
        };
        Update: {
          author_email?: string | null;
          author_name?: string;
          created_at?: string | null;
          event_id?: string;
          id?: string;
          is_organiser?: boolean | null;
          pinned?: boolean | null;
          text?: string;
        };
        Relationships: [
          {
            foreignKeyName: "chat_messages_event_id_fkey";
            columns: ["event_id"];
            isOneToOne: false;
            referencedRelation: "events";
            referencedColumns: ["id"];
          },
        ];
      };
      events: {
        Row: {
          closed_at: string | null;
          confirmed_at: string | null;
          confirmed_slot_id: string | null;
          created_at: string | null;
          deadline: string;
          description: string | null;
          id: string;
          location: string | null;
          minimum_count: number | null;
          owner_id: string;
          participation_mode: string;
          status: string;
          title: string;
          token: string;
        };
        Insert: {
          closed_at?: string | null;
          confirmed_at?: string | null;
          confirmed_slot_id?: string | null;
          created_at?: string | null;
          deadline: string;
          description?: string | null;
          id?: string;
          location?: string | null;
          minimum_count?: number | null;
          owner_id: string;
          participation_mode: string;
          status?: string;
          title: string;
          token: string;
        };
        Update: {
          closed_at?: string | null;
          confirmed_at?: string | null;
          confirmed_slot_id?: string | null;
          created_at?: string | null;
          deadline?: string;
          description?: string | null;
          id?: string;
          location?: string | null;
          minimum_count?: number | null;
          owner_id?: string;
          participation_mode?: string;
          status?: string;
          title?: string;
          token?: string;
        };
        Relationships: [];
      };
      named_participants: {
        Row: {
          avatar_url: string | null;
          email: string;
          event_id: string;
          first_name: string;
          id: string;
          last_name: string;
        };
        Insert: {
          avatar_url?: string | null;
          email: string;
          event_id: string;
          first_name: string;
          id: string;
          last_name: string;
        };
        Update: {
          avatar_url?: string | null;
          email?: string;
          event_id?: string;
          first_name?: string;
          id?: string;
          last_name?: string;
        };
        Relationships: [
          {
            foreignKeyName: "named_participants_event_id_fkey";
            columns: ["event_id"];
            isOneToOne: false;
            referencedRelation: "events";
            referencedColumns: ["id"];
          },
        ];
      };
      participant_responses: {
        Row: {
          avatar_url: string | null;
          email: string;
          event_id: string;
          first_name: string;
          id: string;
          last_name: string;
          notes: string | null;
          slot_ids: string[] | null;
          submitted_at: string | null;
        };
        Insert: {
          avatar_url?: string | null;
          email: string;
          event_id: string;
          first_name: string;
          id?: string;
          last_name: string;
          notes?: string | null;
          slot_ids?: string[] | null;
          submitted_at?: string | null;
        };
        Update: {
          avatar_url?: string | null;
          email?: string;
          event_id?: string;
          first_name?: string;
          id?: string;
          last_name?: string;
          notes?: string | null;
          slot_ids?: string[] | null;
          submitted_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "participant_responses_event_id_fkey";
            columns: ["event_id"];
            isOneToOne: false;
            referencedRelation: "events";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          avatar_url: string | null;
          created_at: string | null;
          email: string | null;
          email_verified: boolean | null;
          embed_settings: Json | null;
          first_name: string | null;
          id: string;
          last_name: string | null;
          notification_prefs: Json | null;
          plan: string | null;
          sms_auto_top_up: boolean | null;
          sms_credits: number | null;
          sms_low_balance_threshold: number | null;
        };
        Insert: {
          avatar_url?: string | null;
          created_at?: string | null;
          email?: string | null;
          email_verified?: boolean | null;
          embed_settings?: Json | null;
          first_name?: string | null;
          id: string;
          last_name?: string | null;
          notification_prefs?: Json | null;
          plan?: string | null;
          sms_auto_top_up?: boolean | null;
          sms_credits?: number | null;
          sms_low_balance_threshold?: number | null;
        };
        Update: {
          avatar_url?: string | null;
          created_at?: string | null;
          email?: string | null;
          email_verified?: boolean | null;
          embed_settings?: Json | null;
          first_name?: string | null;
          id?: string;
          last_name?: string | null;
          notification_prefs?: Json | null;
          plan?: string | null;
          sms_auto_top_up?: boolean | null;
          sms_credits?: number | null;
          sms_low_balance_threshold?: number | null;
        };
        Relationships: [];
      };
      sms_usage: {
        Row: {
          credits: number;
          date: string | null;
          event_id: string | null;
          event_title: string | null;
          id: string;
          recipient: string;
          type: string;
          user_id: string;
        };
        Insert: {
          credits: number;
          date?: string | null;
          event_id?: string | null;
          event_title?: string | null;
          id?: string;
          recipient: string;
          type: string;
          user_id: string;
        };
        Update: {
          credits?: number;
          date?: string | null;
          event_id?: string | null;
          event_title?: string | null;
          id?: string;
          recipient?: string;
          type?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      time_slots: {
        Row: {
          date: string;
          end_time: string;
          event_id: string;
          id: string;
          start_time: string;
        };
        Insert: {
          date: string;
          end_time: string;
          event_id: string;
          id: string;
          start_time: string;
        };
        Update: {
          date?: string;
          end_time?: string;
          event_id?: string;
          id?: string;
          start_time?: string;
        };
        Relationships: [
          {
            foreignKeyName: "time_slots_event_id_fkey";
            columns: ["event_id"];
            isOneToOne: false;
            referencedRelation: "events";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;
