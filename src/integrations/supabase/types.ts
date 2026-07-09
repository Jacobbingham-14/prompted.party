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
      custom_prompts: {
        Row: {
          created_at: string | null
          id: string
          judge_name: string | null
          promoted: boolean | null
          reviewed: boolean | null
          room_id: string | null
          round_id: string | null
          text: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          judge_name?: string | null
          promoted?: boolean | null
          reviewed?: boolean | null
          room_id?: string | null
          round_id?: string | null
          text: string
        }
        Update: {
          created_at?: string | null
          id?: string
          judge_name?: string | null
          promoted?: boolean | null
          reviewed?: boolean | null
          room_id?: string | null
          round_id?: string | null
          text?: string
        }
        Relationships: [
          {
            foreignKeyName: "custom_prompts_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "custom_prompts_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "rounds"
            referencedColumns: ["id"]
          },
        ]
      }
      duel_matchups: {
        Row: {
          created_at: string | null
          id: string
          matchup_order: number
          player_a_id: string
          player_b_id: string
          prompt_text: string
          room_id: string
          round_id: string
          status: string
          winner_player_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          matchup_order: number
          player_a_id: string
          player_b_id: string
          prompt_text: string
          room_id: string
          round_id: string
          status?: string
          winner_player_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          matchup_order?: number
          player_a_id?: string
          player_b_id?: string
          prompt_text?: string
          room_id?: string
          round_id?: string
          status?: string
          winner_player_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "duel_matchups_player_a_id_fkey"
            columns: ["player_a_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "duel_matchups_player_b_id_fkey"
            columns: ["player_b_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "duel_matchups_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "duel_matchups_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "rounds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "duel_matchups_winner_player_id_fkey"
            columns: ["winner_player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      duel_prompts: {
        Row: {
          archived: boolean
          category: string[]
          created_at: string | null
          id: string
          text: string
        }
        Insert: {
          archived?: boolean
          category?: string[]
          created_at?: string | null
          id?: string
          text: string
        }
        Update: {
          archived?: boolean
          category?: string[]
          created_at?: string | null
          id?: string
          text?: string
        }
        Relationships: []
      }
      duel_submissions: {
        Row: {
          answer_text: string
          created_at: string | null
          id: string
          image_status: string
          image_url: string | null
          matchup_id: string
          player_id: string
          round_id: string
          updated_at: string | null
        }
        Insert: {
          answer_text: string
          created_at?: string | null
          id?: string
          image_status?: string
          image_url?: string | null
          matchup_id: string
          player_id: string
          round_id: string
          updated_at?: string | null
        }
        Update: {
          answer_text?: string
          created_at?: string | null
          id?: string
          image_status?: string
          image_url?: string | null
          matchup_id?: string
          player_id?: string
          round_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "duel_submissions_matchup_id_fkey"
            columns: ["matchup_id"]
            isOneToOne: false
            referencedRelation: "duel_matchups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "duel_submissions_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "duel_submissions_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "rounds"
            referencedColumns: ["id"]
          },
        ]
      }
      duel_votes: {
        Row: {
          created_at: string | null
          id: string
          matchup_id: string
          round_id: string
          voted_player_id: string
          voter_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          matchup_id: string
          round_id: string
          voted_player_id: string
          voter_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          matchup_id?: string
          round_id?: string
          voted_player_id?: string
          voter_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "duel_votes_matchup_id_fkey"
            columns: ["matchup_id"]
            isOneToOne: false
            referencedRelation: "duel_matchups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "duel_votes_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "rounds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "duel_votes_voted_player_id_fkey"
            columns: ["voted_player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "duel_votes_voter_id_fkey"
            columns: ["voter_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      forgery_prompts: {
        Row: {
          archived: boolean
          category: string[]
          created_at: string | null
          forger_prompt: string
          id: string
          main_prompt: string
          set_id: string | null
        }
        Insert: {
          archived?: boolean
          category?: string[]
          created_at?: string | null
          forger_prompt: string
          id?: string
          main_prompt: string
          set_id?: string | null
        }
        Update: {
          archived?: boolean
          category?: string[]
          created_at?: string | null
          forger_prompt?: string
          id?: string
          main_prompt?: string
          set_id?: string | null
        }
        Relationships: []
      }
      forgery_votes: {
        Row: {
          accused_player_id: string
          created_at: string | null
          id: string
          round_id: string
          voter_id: string
        }
        Insert: {
          accused_player_id: string
          created_at?: string | null
          id?: string
          round_id: string
          voter_id: string
        }
        Update: {
          accused_player_id?: string
          created_at?: string | null
          id?: string
          round_id?: string
          voter_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "forgery_votes_accused_player_id_fkey"
            columns: ["accused_player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "forgery_votes_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "rounds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "forgery_votes_voter_id_fkey"
            columns: ["voter_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      image_generation_stats: {
        Row: {
          total_generations: number
          updated_at: string | null
          user_id: string
        }
        Insert: {
          total_generations?: number
          updated_at?: string | null
          user_id: string
        }
        Update: {
          total_generations?: number
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      image_votes: {
        Row: {
          created_at: string
          id: string
          round_id: string
          submission_id: string
          voter_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          round_id: string
          submission_id: string
          voter_id: string
        }
        Update: {
          created_at?: string
          id?: string
          round_id?: string
          submission_id?: string
          voter_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "image_votes_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "rounds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "image_votes_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "submissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "image_votes_voter_id_fkey"
            columns: ["voter_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      judge_prompts: {
        Row: {
          archived: boolean
          category: string[]
          created_at: string
          id: string
          text: string
        }
        Insert: {
          archived?: boolean
          category?: string[]
          created_at?: string
          id?: string
          text: string
        }
        Update: {
          archived?: boolean
          category?: string[]
          created_at?: string
          id?: string
          text?: string
        }
        Relationships: []
      }
      player_round_prompts: {
        Row: {
          created_at: string | null
          id: string
          is_forger: boolean
          player_id: string
          prompt_text: string
          round_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_forger?: boolean
          player_id: string
          prompt_text: string
          round_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_forger?: boolean
          player_id?: string
          prompt_text?: string
          round_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "player_round_prompts_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_round_prompts_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "rounds"
            referencedColumns: ["id"]
          },
        ]
      }
      players: {
        Row: {
          avatar_url: string | null
          created_at: string
          id: string
          is_judge: boolean
          name: string
          room_id: string
          score: number
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          id?: string
          is_judge?: boolean
          name: string
          room_id: string
          score?: number
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          id?: string
          is_judge?: boolean
          name?: string
          room_id?: string
          score?: number
        }
        Relationships: [
          {
            foreignKeyName: "players_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      prompt_votes: {
        Row: {
          created_at: string
          id: string
          player_id: string
          prompt_text: string
          round_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          player_id: string
          prompt_text: string
          round_id: string
        }
        Update: {
          created_at?: string
          id?: string
          player_id?: string
          prompt_text?: string
          round_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "prompt_votes_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prompt_votes_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "rounds"
            referencedColumns: ["id"]
          },
        ]
      }
      prompts: {
        Row: {
          created_at: string | null
          id: string
          text: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          text: string
        }
        Update: {
          created_at?: string | null
          id?: string
          text?: string
        }
        Relationships: []
      }
      purchase_events: {
        Row: {
          amount_cents: number
          created_at: string
          detail: Json
          host_id: string
          id: string
          kind: string
          stripe_payment_intent_id: string | null
          stripe_session_id: string | null
        }
        Insert: {
          amount_cents: number
          created_at?: string
          detail?: Json
          host_id: string
          id?: string
          kind: string
          stripe_payment_intent_id?: string | null
          stripe_session_id?: string | null
        }
        Update: {
          amount_cents?: number
          created_at?: string
          detail?: Json
          host_id?: string
          id?: string
          kind?: string
          stripe_payment_intent_id?: string | null
          stripe_session_id?: string | null
        }
        Relationships: []
      }
      purchased_game_modes: {
        Row: {
          game_mode: string
          host_id: string
          id: string
          purchased_at: string
          stripe_payment_intent_id: string | null
        }
        Insert: {
          game_mode: string
          host_id: string
          id?: string
          purchased_at?: string
          stripe_payment_intent_id?: string | null
        }
        Update: {
          game_mode?: string
          host_id?: string
          id?: string
          purchased_at?: string
          stripe_payment_intent_id?: string | null
        }
        Relationships: []
      }
      rooms: {
        Row: {
          code: string
          created_at: string
          game_mode: string
          host_id: string | null
          id: string
          status: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          code: string
          created_at?: string
          game_mode?: string
          host_id?: string | null
          id?: string
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          game_mode?: string
          host_id?: string | null
          id?: string
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      rounds: {
        Row: {
          active_matchup_id: string | null
          created_at: string
          deadline_at: string | null
          id: string
          judge_id: string | null
          presentation_order: Json | null
          prompt: string | null
          room_id: string
          round_number: number
          selected_prompts: Json | null
          status: string
          winning_submission_ids: string[] | null
        }
        Insert: {
          active_matchup_id?: string | null
          created_at?: string
          deadline_at?: string | null
          id?: string
          judge_id?: string | null
          presentation_order?: Json | null
          prompt?: string | null
          room_id: string
          round_number: number
          selected_prompts?: Json | null
          status?: string
          winning_submission_ids?: string[] | null
        }
        Update: {
          active_matchup_id?: string | null
          created_at?: string
          deadline_at?: string | null
          id?: string
          judge_id?: string | null
          presentation_order?: Json | null
          prompt?: string | null
          room_id?: string
          round_number?: number
          selected_prompts?: Json | null
          status?: string
          winning_submission_ids?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "rounds_judge_id_fkey"
            columns: ["judge_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rounds_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      submissions: {
        Row: {
          created_at: string
          id: string
          image_url: string
          is_winner: boolean
          player_id: string
          round_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          image_url: string
          is_winner?: boolean
          player_id: string
          round_id: string
        }
        Update: {
          created_at?: string
          id?: string
          image_url?: string
          is_winner?: boolean
          player_id?: string
          round_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "submissions_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "submissions_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "rounds"
            referencedColumns: ["id"]
          },
        ]
      }
      suggestions: {
        Row: {
          created_at: string
          email: string | null
          id: string
          message: string
          name: string | null
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          message: string
          name?: string | null
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          message?: string
          name?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      user_game_stats: {
        Row: {
          active_games: number
          completed_games: number
          first_game_date: string | null
          generation_limit: number
          host_id: string
          last_activity_date: string | null
          last_game_date: string | null
          total_games_hosted: number
          total_image_generations: number
          updated_at: string
          waiting_games: number
        }
        Insert: {
          active_games?: number
          completed_games?: number
          first_game_date?: string | null
          generation_limit?: number
          host_id: string
          last_activity_date?: string | null
          last_game_date?: string | null
          total_games_hosted?: number
          total_image_generations?: number
          updated_at?: string
          waiting_games?: number
        }
        Update: {
          active_games?: number
          completed_games?: number
          first_game_date?: string | null
          generation_limit?: number
          host_id?: string
          last_activity_date?: string | null
          last_game_date?: string | null
          total_games_hosted?: number
          total_image_generations?: number
          updated_at?: string
          waiting_games?: number
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      voting_prompts: {
        Row: {
          archived: boolean
          category: string[]
          created_at: string
          id: string
          text: string
        }
        Insert: {
          archived?: boolean
          category?: string[]
          created_at?: string
          id?: string
          text: string
        }
        Update: {
          archived?: boolean
          category?: string[]
          created_at?: string
          id?: string
          text?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      assign_forgery_roles: {
        Args: { p_room_id: string; p_round_id: string }
        Returns: undefined
      }
      check_generation_limit: {
        Args: { p_user_id: string }
        Returns: {
          allowed: boolean
          current_count: number
          max_limit: number
          remaining: number
        }[]
      }
      create_duel_matchups: {
        Args: { p_room_id: string; p_round_id: string }
        Returns: undefined
      }
      delete_ended_room: {
        Args: { p_caller_id: string; p_room_id: string }
        Returns: undefined
      }
      delete_ended_room_service: {
        Args: { p_room_id: string }
        Returns: undefined
      }
      finalize_duel_matchup: {
        Args: { p_matchup_id: string }
        Returns: {
          a_votes: number
          b_votes: number
          player_a_id: string
          player_b_id: string
          points_per_vote: number
          winner_player_id: string
        }[]
      }
      find_room_by_code: {
        Args: { room_code: string }
        Returns: {
          code: string
          created_at: string
          host_id: string
          id: string
          status: string
          updated_at: string
          user_id: string
        }[]
      }
      grant_game_modes: {
        Args: {
          p_host_id: string
          p_modes: string[]
          p_payment_intent_id: string
        }
        Returns: undefined
      }
      grant_generation_credits: {
        Args: { p_amount: number; p_host_id: string }
        Returns: undefined
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_generation_count: {
        Args: { p_user_id: string }
        Returns: undefined
      }
      increment_player_score: {
        Args: { p_player_id: string; p_round_id: string }
        Returns: undefined
      }
      refresh_host_stats: { Args: { p_host_id: string }; Returns: undefined }
      set_round_judge: {
        Args: { p_caller_id: string; p_judge_id: string; p_room_id: string }
        Returns: undefined
      }
      update_player_avatar: {
        Args: { p_avatar_url: string; p_player_id: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "user"
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
    ? never
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "user"],
    },
  },
} as const
