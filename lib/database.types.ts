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
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      achievements: {
        Row: {
          achievement_id: string
          category: string
          deleted_at: string | null
          description: string
          icon: string
          id: string
          progress: number | null
          target: number | null
          title: string
          unlocked_at: string
          updated_at: string
          user_id: string
          xp_reward: number
        }
        Insert: {
          achievement_id: string
          category: string
          deleted_at?: string | null
          description: string
          icon: string
          id?: string
          progress?: number | null
          target?: number | null
          title: string
          unlocked_at?: string
          updated_at?: string
          user_id: string
          xp_reward?: number
        }
        Update: {
          achievement_id?: string
          category?: string
          deleted_at?: string | null
          description?: string
          icon?: string
          id?: string
          progress?: number | null
          target?: number | null
          title?: string
          unlocked_at?: string
          updated_at?: string
          user_id?: string
          xp_reward?: number
        }
        Relationships: [
          {
            foreignKeyName: "achievements_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      consumed_meals: {
        Row: {
          breakfast: boolean
          date: string
          deleted_at: string | null
          dinner: boolean
          id: string
          lunch: boolean
          snack: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          breakfast?: boolean
          date: string
          deleted_at?: string | null
          dinner?: boolean
          id?: string
          lunch?: boolean
          snack?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          breakfast?: boolean
          date?: string
          deleted_at?: string | null
          dinner?: boolean
          id?: string
          lunch?: boolean
          snack?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "consumed_meals_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_diets: {
        Row: {
          created_at: string
          daily_schedule: Json | null
          deleted_at: string | null
          id: string
          is_active: boolean
          is_custom: boolean
          name: string
          recommended_diet_type: string | null
          schedule_type: string
          updated_at: string
          user_id: string
          weekly_schedule: Json | null
        }
        Insert: {
          created_at?: string
          daily_schedule?: Json | null
          deleted_at?: string | null
          id?: string
          is_active?: boolean
          is_custom?: boolean
          name: string
          recommended_diet_type?: string | null
          schedule_type: string
          updated_at?: string
          user_id: string
          weekly_schedule?: Json | null
        }
        Update: {
          created_at?: string
          daily_schedule?: Json | null
          deleted_at?: string | null
          id?: string
          is_active?: boolean
          is_custom?: boolean
          name?: string
          recommended_diet_type?: string | null
          schedule_type?: string
          updated_at?: string
          user_id?: string
          weekly_schedule?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "custom_diets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_meals: {
        Row: {
          calories: number
          carbs: number
          created_at: string
          deleted_at: string | null
          description: string | null
          fats: number
          id: string
          ingredients: string[] | null
          is_favorite: boolean
          meal_type: string
          name: string
          protein: number
          updated_at: string
          user_id: string
        }
        Insert: {
          calories: number
          carbs: number
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          fats: number
          id?: string
          ingredients?: string[] | null
          is_favorite?: boolean
          meal_type: string
          name: string
          protein: number
          updated_at?: string
          user_id: string
        }
        Update: {
          calories?: number
          carbs?: number
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          fats?: number
          id?: string
          ingredients?: string[] | null
          is_favorite?: boolean
          meal_type?: string
          name?: string
          protein?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "custom_meals_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      meal_plans: {
        Row: {
          created_at: string
          deleted_at: string | null
          diet_type: string
          end_date: string | null
          id: string
          is_active: boolean
          meals: Json
          next_update_date: string
          schedule_type: string
          start_date: string
          target_calories: number
          target_carbs: number
          target_fats: number
          target_protein: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          diet_type: string
          end_date?: string | null
          id?: string
          is_active?: boolean
          meals?: Json
          next_update_date: string
          schedule_type: string
          start_date: string
          target_calories: number
          target_carbs: number
          target_fats: number
          target_protein: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          diet_type?: string
          end_date?: string | null
          id?: string
          is_active?: boolean
          meals?: Json
          next_update_date?: string
          schedule_type?: string
          start_date?: string
          target_calories?: number
          target_carbs?: number
          target_fats?: number
          target_protein?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meal_plans_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      nutrition_logs: {
        Row: {
          calories: number
          carbs: number
          date: string
          deleted_at: string | null
          fats: number
          id: string
          is_custom_meal: boolean
          logged_at: string
          meal_id: string | null
          meal_name: string
          meal_type: string
          protein: number
          updated_at: string
          user_id: string
          water: number | null
        }
        Insert: {
          calories: number
          carbs: number
          date: string
          deleted_at?: string | null
          fats: number
          id?: string
          is_custom_meal?: boolean
          logged_at?: string
          meal_id?: string | null
          meal_name: string
          meal_type: string
          protein: number
          updated_at?: string
          user_id: string
          water?: number | null
        }
        Update: {
          calories?: number
          carbs?: number
          date?: string
          deleted_at?: string | null
          fats?: number
          id?: string
          is_custom_meal?: boolean
          logged_at?: string
          meal_id?: string | null
          meal_name?: string
          meal_type?: string
          protein?: number
          updated_at?: string
          user_id?: string
          water?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "nutrition_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      streaks: {
        Row: {
          current_streak: number
          deleted_at: string | null
          id: string
          last_activity_date: string
          longest_streak: number
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          current_streak?: number
          deleted_at?: string | null
          id?: string
          last_activity_date: string
          longest_streak?: number
          type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          current_streak?: number
          deleted_at?: string | null
          id?: string
          last_activity_date?: string
          longest_streak?: number
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "streaks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      sync_documents: {
        Row: {
          deleted_at: string | null
          device_id: string | null
          doc: Json | null
          doc_key: string
          updated_at: string
          user_id: string
        }
        Insert: {
          deleted_at?: string | null
          device_id?: string | null
          doc?: Json | null
          doc_key: string
          updated_at?: string
          user_id: string
        }
        Update: {
          deleted_at?: string | null
          device_id?: string | null
          doc?: Json | null
          doc_key?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sync_documents_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          activity_level: string | null
          age: number | null
          allergies: string[] | null
          avatar_url: string | null
          bio: Json | null
          created_at: string
          deleted_at: string | null
          dietary_preferences: string[] | null
          email: string | null
          gender: string | null
          goals: Json | null
          health_goals: string[] | null
          height: number | null
          id: string
          level: number
          name: string
          updated_at: string
          weight: number | null
          xp: number
        }
        Insert: {
          activity_level?: string | null
          age?: number | null
          allergies?: string[] | null
          avatar_url?: string | null
          bio?: Json | null
          created_at?: string
          deleted_at?: string | null
          dietary_preferences?: string[] | null
          email?: string | null
          gender?: string | null
          goals?: Json | null
          health_goals?: string[] | null
          height?: number | null
          id: string
          level?: number
          name?: string
          updated_at?: string
          weight?: number | null
          xp?: number
        }
        Update: {
          activity_level?: string | null
          age?: number | null
          allergies?: string[] | null
          avatar_url?: string | null
          bio?: Json | null
          created_at?: string
          deleted_at?: string | null
          dietary_preferences?: string[] | null
          email?: string | null
          gender?: string | null
          goals?: Json | null
          health_goals?: string[] | null
          height?: number | null
          id?: string
          level?: number
          name?: string
          updated_at?: string
          weight?: number | null
          xp?: number
        }
        Relationships: []
      }
      water_logs: {
        Row: {
          amount: number
          date: string
          deleted_at: string | null
          id: string
          logged_at: string
          target: number
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          date: string
          deleted_at?: string | null
          id?: string
          logged_at?: string
          target?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          date?: string
          deleted_at?: string | null
          id?: string
          logged_at?: string
          target?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "water_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      workouts: {
        Row: {
          completed_at: string | null
          created_at: string
          deleted_at: string | null
          exercises: Json
          id: string
          is_completed: boolean
          name: string
          scheduled_date: string | null
          total_calories_burned: number
          total_duration: number
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          deleted_at?: string | null
          exercises?: Json
          id?: string
          is_completed?: boolean
          name: string
          scheduled_date?: string | null
          total_calories_burned?: number
          total_duration?: number
          type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          deleted_at?: string | null
          exercises?: Json
          id?: string
          is_completed?: boolean
          name?: string
          scheduled_date?: string | null
          total_calories_burned?: number
          total_duration?: number
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workouts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
