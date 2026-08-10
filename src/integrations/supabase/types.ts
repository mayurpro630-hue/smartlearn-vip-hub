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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      attempt_answers: {
        Row: {
          answer_text: string | null
          attempt_id: string
          awarded_marks: number | null
          created_at: string
          graded: boolean
          id: string
          is_correct: boolean
          question_id: string
          selected_option: string | null
          time_spent_seconds: number
          user_id: string
        }
        Insert: {
          answer_text?: string | null
          attempt_id: string
          awarded_marks?: number | null
          created_at?: string
          graded?: boolean
          id?: string
          is_correct?: boolean
          question_id: string
          selected_option?: string | null
          time_spent_seconds?: number
          user_id: string
        }
        Update: {
          answer_text?: string | null
          attempt_id?: string
          awarded_marks?: number | null
          created_at?: string
          graded?: boolean
          id?: string
          is_correct?: boolean
          question_id?: string
          selected_option?: string | null
          time_spent_seconds?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attempt_answers_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "test_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attempt_answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
        ]
      }
      bookmarks: {
        Row: {
          created_at: string
          id: string
          note: string | null
          question_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          note?: string | null
          question_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          note?: string | null
          question_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookmarks_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
        ]
      }
      chapters: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          position: number
          subject_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          position?: number
          subject_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          position?: number
          subject_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chapters_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      error_reports: {
        Row: {
          created_at: string
          id: string
          message: string
          question_id: string
          resolved: boolean
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          question_id: string
          resolved?: boolean
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          question_id?: string
          resolved?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "error_reports_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_contacts: {
        Row: {
          created_at: string
          id: string
          mobile: string
        }
        Insert: {
          created_at?: string
          id: string
          mobile: string
        }
        Update: {
          created_at?: string
          id?: string
          mobile?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          id: string
          is_vip: boolean
          streak: number
          tests_taken: number
          total_score: number
          username: string
          vip_since: string | null
          vip_tier: string
        }
        Insert: {
          created_at?: string
          id: string
          is_vip?: boolean
          streak?: number
          tests_taken?: number
          total_score?: number
          username: string
          vip_since?: string | null
          vip_tier?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_vip?: boolean
          streak?: number
          tests_taken?: number
          total_score?: number
          username?: string
          vip_since?: string | null
          vip_tier?: string
        }
        Relationships: []
      }
      questions: {
        Row: {
          correct_option: string
          created_at: string
          explanation: string | null
          hint: string | null
          id: string
          marks: number
          model_answer: string | null
          option_a: string
          option_b: string
          option_c: string
          option_d: string
          passage_id: string | null
          passage_text: string | null
          position: number
          published_at: string | null
          question_text: string
          question_type: Database["public"]["Enums"]["question_kind"]
          status: Database["public"]["Enums"]["publish_status"]
          test_id: string
        }
        Insert: {
          correct_option: string
          created_at?: string
          explanation?: string | null
          hint?: string | null
          id?: string
          marks?: number
          model_answer?: string | null
          option_a: string
          option_b: string
          option_c: string
          option_d: string
          passage_id?: string | null
          passage_text?: string | null
          position?: number
          published_at?: string | null
          question_text: string
          question_type?: Database["public"]["Enums"]["question_kind"]
          status?: Database["public"]["Enums"]["publish_status"]
          test_id: string
        }
        Update: {
          correct_option?: string
          created_at?: string
          explanation?: string | null
          hint?: string | null
          id?: string
          marks?: number
          model_answer?: string | null
          option_a?: string
          option_b?: string
          option_c?: string
          option_d?: string
          passage_id?: string | null
          passage_text?: string | null
          position?: number
          published_at?: string | null
          question_text?: string
          question_type?: Database["public"]["Enums"]["question_kind"]
          status?: Database["public"]["Enums"]["publish_status"]
          test_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "questions_passage_id_fkey"
            columns: ["passage_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "questions_test_id_fkey"
            columns: ["test_id"]
            isOneToOne: false
            referencedRelation: "tests"
            referencedColumns: ["id"]
          },
        ]
      }
      subjects: {
        Row: {
          created_at: string
          description: string | null
          icon: string | null
          id: string
          name: string
          position: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          name: string
          position?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          name?: string
          position?: number
        }
        Relationships: []
      }
      test_attempts: {
        Row: {
          correct_count: number
          created_at: string
          id: string
          is_practice: boolean
          score: number
          tab_switch_count: number
          test_id: string
          time_spent_seconds: number
          total_questions: number
          user_id: string
        }
        Insert: {
          correct_count?: number
          created_at?: string
          id?: string
          is_practice?: boolean
          score?: number
          tab_switch_count?: number
          test_id: string
          time_spent_seconds?: number
          total_questions?: number
          user_id: string
        }
        Update: {
          correct_count?: number
          created_at?: string
          id?: string
          is_practice?: boolean
          score?: number
          tab_switch_count?: number
          test_id?: string
          time_spent_seconds?: number
          total_questions?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "test_attempts_test_id_fkey"
            columns: ["test_id"]
            isOneToOne: false
            referencedRelation: "tests"
            referencedColumns: ["id"]
          },
        ]
      }
      tests: {
        Row: {
          chapter_id: string
          created_at: string
          duration_minutes: number
          id: string
          position: number
          title: string
        }
        Insert: {
          chapter_id: string
          created_at?: string
          duration_minutes?: number
          id?: string
          position?: number
          title: string
        }
        Update: {
          chapter_id?: string
          created_at?: string
          duration_minutes?: number
          id?: string
          position?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "tests_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      vip_tiers: {
        Row: {
          created_at: string
          enabled: boolean
          label: string
          max_flags: number
          min_score: number
          min_tests: number
          rank: number
          tier: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          label: string
          max_flags?: number
          min_score?: number
          min_tests?: number
          rank?: number
          tier: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          label?: string
          max_flags?: number
          min_score?: number
          min_tests?: number
          rank?: number
          tier?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      evaluate_vip_tier: { Args: { _user_id: string }; Returns: undefined }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "student"
      publish_status: "draft" | "published"
      question_kind: "mcq" | "subjective" | "passage"
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
      app_role: ["admin", "student"],
      publish_status: ["draft", "published"],
      question_kind: ["mcq", "subjective", "passage"],
    },
  },
} as const
