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
      bookmarks: {
        Row: {
          channel: string | null
          created_at: string
          duration_seconds: number | null
          id: string
          thumbnail_url: string | null
          title: string
          user_id: string
          youtube_id: string
        }
        Insert: {
          channel?: string | null
          created_at?: string
          duration_seconds?: number | null
          id?: string
          thumbnail_url?: string | null
          title: string
          user_id: string
          youtube_id: string
        }
        Update: {
          channel?: string | null
          created_at?: string
          duration_seconds?: number | null
          id?: string
          thumbnail_url?: string | null
          title?: string
          user_id?: string
          youtube_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookmarks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      event_sources: {
        Row: {
          city: string
          country: string
          created_at: string
          display_name: string
          enabled: boolean
          key: string
          kind: string
          last_run_at: string | null
          last_run_id: string | null
          last_status: string | null
          timezone: string
          url: string
        }
        Insert: {
          city: string
          country: string
          created_at?: string
          display_name: string
          enabled?: boolean
          key: string
          kind: string
          last_run_at?: string | null
          last_run_id?: string | null
          last_status?: string | null
          timezone: string
          url: string
        }
        Update: {
          city?: string
          country?: string
          created_at?: string
          display_name?: string
          enabled?: boolean
          key?: string
          kind?: string
          last_run_at?: string | null
          last_run_id?: string | null
          last_status?: string | null
          timezone?: string
          url?: string
        }
        Relationships: []
      }
      events: {
        Row: {
          city: string
          content_hash: string | null
          country: string
          created_at: string
          created_by: string | null
          description: string | null
          ends_at: string | null
          flyer_extraction_id: string | null
          flyer_storage_path: string | null
          id: string
          kind: string | null
          last_seen_at: string | null
          missing_run_count: number
          recurrence: string | null
          source: string | null
          source_event_id: string | null
          source_url: string | null
          starts_at: string
          status: string
          timezone: string
          title: string
          url: string | null
          venue_id: string | null
        }
        Insert: {
          city?: string
          content_hash?: string | null
          country?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          ends_at?: string | null
          flyer_extraction_id?: string | null
          flyer_storage_path?: string | null
          id?: string
          kind?: string | null
          last_seen_at?: string | null
          missing_run_count?: number
          recurrence?: string | null
          source?: string | null
          source_event_id?: string | null
          source_url?: string | null
          starts_at: string
          status?: string
          timezone?: string
          title: string
          url?: string | null
          venue_id?: string | null
        }
        Update: {
          city?: string
          content_hash?: string | null
          country?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          ends_at?: string | null
          flyer_extraction_id?: string | null
          flyer_storage_path?: string | null
          id?: string
          kind?: string | null
          last_seen_at?: string | null
          missing_run_count?: number
          recurrence?: string | null
          source?: string | null
          source_event_id?: string | null
          source_url?: string | null
          starts_at?: string
          status?: string
          timezone?: string
          title?: string
          url?: string | null
          venue_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_flyer_extraction_id_fkey"
            columns: ["flyer_extraction_id"]
            isOneToOne: false
            referencedRelation: "flyer_extractions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      flyer_extractions: {
        Row: {
          bytes: number
          completed_at: string | null
          created_at: string
          created_by: string
          error: string | null
          extracted: Json | null
          fields_edited: string[]
          finalized_event_id: string | null
          finalized_payload: Json | null
          id: string
          input_tokens: number
          latency_ms: number | null
          mime: string
          model: string
          output_tokens: number
          raw_response: Json | null
          status: string
          storage_path: string
          total_tokens: number
          warnings: Json
        }
        Insert: {
          bytes: number
          completed_at?: string | null
          created_at?: string
          created_by: string
          error?: string | null
          extracted?: Json | null
          fields_edited?: string[]
          finalized_event_id?: string | null
          finalized_payload?: Json | null
          id?: string
          input_tokens?: number
          latency_ms?: number | null
          mime: string
          model: string
          output_tokens?: number
          raw_response?: Json | null
          status: string
          storage_path: string
          total_tokens?: number
          warnings?: Json
        }
        Update: {
          bytes?: number
          completed_at?: string | null
          created_at?: string
          created_by?: string
          error?: string | null
          extracted?: Json | null
          fields_edited?: string[]
          finalized_event_id?: string | null
          finalized_payload?: Json | null
          id?: string
          input_tokens?: number
          latency_ms?: number | null
          mime?: string
          model?: string
          output_tokens?: number
          raw_response?: Json | null
          status?: string
          storage_path?: string
          total_tokens?: number
          warnings?: Json
        }
        Relationships: [
          {
            foreignKeyName: "flyer_extractions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flyer_extractions_finalized_event_id_fkey"
            columns: ["finalized_event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      ingest_runs: {
        Row: {
          archived_count: number
          error: string | null
          fetched_count: number
          finished_at: string | null
          id: string
          log: Json
          promoted_count: number
          rejected_count: number
          source: string
          staged_count: number
          started_at: string
          status: string
        }
        Insert: {
          archived_count?: number
          error?: string | null
          fetched_count?: number
          finished_at?: string | null
          id?: string
          log?: Json
          promoted_count?: number
          rejected_count?: number
          source: string
          staged_count?: number
          started_at?: string
          status?: string
        }
        Update: {
          archived_count?: number
          error?: string | null
          fetched_count?: number
          finished_at?: string | null
          id?: string
          log?: Json
          promoted_count?: number
          rejected_count?: number
          source?: string
          staged_count?: number
          started_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "ingest_runs_source_fkey"
            columns: ["source"]
            isOneToOne: false
            referencedRelation: "event_sources"
            referencedColumns: ["key"]
          },
        ]
      }
      lab_waitlist: {
        Row: {
          created_at: string
          email: string
          id: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
        }
        Relationships: []
      }
      playlist_items: {
        Row: {
          channel: string | null
          playlist_id: string
          position: number
          thumbnail_url: string | null
          title: string
          youtube_id: string
        }
        Insert: {
          channel?: string | null
          playlist_id: string
          position?: number
          thumbnail_url?: string | null
          title: string
          youtube_id: string
        }
        Update: {
          channel?: string | null
          playlist_id?: string
          position?: number
          thumbnail_url?: string | null
          title?: string
          youtube_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "playlist_items_playlist_id_fkey"
            columns: ["playlist_id"]
            isOneToOne: false
            referencedRelation: "playlists"
            referencedColumns: ["id"]
          },
        ]
      }
      playlists: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "playlists_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      quality_rejections: {
        Row: {
          created_at: string
          duplicate_of: string | null
          id: string
          raw_event_id: string
          reason_code: string
          reason_detail: string | null
          resolved: boolean
          resolved_at: string | null
          resolved_by: string | null
          run_id: string
        }
        Insert: {
          created_at?: string
          duplicate_of?: string | null
          id?: string
          raw_event_id: string
          reason_code: string
          reason_detail?: string | null
          resolved?: boolean
          resolved_at?: string | null
          resolved_by?: string | null
          run_id: string
        }
        Update: {
          created_at?: string
          duplicate_of?: string | null
          id?: string
          raw_event_id?: string
          reason_code?: string
          reason_detail?: string | null
          resolved?: boolean
          resolved_at?: string | null
          resolved_by?: string | null
          run_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quality_rejections_duplicate_of_fkey"
            columns: ["duplicate_of"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quality_rejections_raw_event_id_fkey"
            columns: ["raw_event_id"]
            isOneToOne: false
            referencedRelation: "raw_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quality_rejections_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quality_rejections_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "ingest_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      raw_events: {
        Row: {
          content_hash: string
          fetched_at: string
          id: string
          normalized: Json
          outcome: string | null
          outcome_detail: string | null
          processed: boolean
          promoted_event_id: string | null
          raw_payload: Json
          run_id: string
          sequence: number | null
          source: string
          source_event_id: string
        }
        Insert: {
          content_hash: string
          fetched_at?: string
          id?: string
          normalized: Json
          outcome?: string | null
          outcome_detail?: string | null
          processed?: boolean
          promoted_event_id?: string | null
          raw_payload: Json
          run_id: string
          sequence?: number | null
          source: string
          source_event_id: string
        }
        Update: {
          content_hash?: string
          fetched_at?: string
          id?: string
          normalized?: Json
          outcome?: string | null
          outcome_detail?: string | null
          processed?: boolean
          promoted_event_id?: string | null
          raw_payload?: Json
          run_id?: string
          sequence?: number | null
          source?: string
          source_event_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "raw_events_promoted_event_id_fkey"
            columns: ["promoted_event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "raw_events_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "ingest_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "raw_events_source_fkey"
            columns: ["source"]
            isOneToOne: false
            referencedRelation: "event_sources"
            referencedColumns: ["key"]
          },
        ]
      }
      users: {
        Row: {
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          role: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id: string
          role?: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          role?: string
        }
        Relationships: []
      }
      venue_geocode_cache: {
        Row: {
          fetched_at: string
          lat: number
          lng: number
          neighborhood: string | null
          normalized_address: string
          place_name: string | null
        }
        Insert: {
          fetched_at?: string
          lat: number
          lng: number
          neighborhood?: string | null
          normalized_address: string
          place_name?: string | null
        }
        Update: {
          fetched_at?: string
          lat?: number
          lng?: number
          neighborhood?: string | null
          normalized_address?: string
          place_name?: string | null
        }
        Relationships: []
      }
      venues: {
        Row: {
          address: string | null
          city: string
          country: string
          id: string
          lat: number | null
          lng: number | null
          name: string
          neighborhood: string | null
          normalized_address: string | null
          normalized_name: string | null
          timezone: string
        }
        Insert: {
          address?: string | null
          city?: string
          country?: string
          id?: string
          lat?: number | null
          lng?: number | null
          name: string
          neighborhood?: string | null
          normalized_address?: string | null
          normalized_name?: string | null
          timezone?: string
        }
        Update: {
          address?: string | null
          city?: string
          country?: string
          id?: string
          lat?: number | null
          lng?: number | null
          name?: string
          neighborhood?: string | null
          normalized_address?: string | null
          normalized_name?: string | null
          timezone?: string
        }
        Relationships: []
      }
      youtube_cache: {
        Row: {
          fetched_at: string
          page_token: string | null
          query: string
          query_hash: string
          results: Json
        }
        Insert: {
          fetched_at?: string
          page_token?: string | null
          query: string
          query_hash: string
          results: Json
        }
        Update: {
          fetched_at?: string
          page_token?: string | null
          query?: string
          query_hash?: string
          results?: Json
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
