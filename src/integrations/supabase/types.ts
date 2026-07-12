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
      business_members: {
        Row: {
          business_id: string
          id: string
          invited_at: string
          role: Database["public"]["Enums"]["member_role"]
          user_id: string
        }
        Insert: {
          business_id: string
          id?: string
          invited_at?: string
          role?: Database["public"]["Enums"]["member_role"]
          user_id: string
        }
        Update: {
          business_id?: string
          id?: string
          invited_at?: string
          role?: Database["public"]["Enums"]["member_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_members_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      businesses: {
        Row: {
          created_at: string
          id: string
          invite_code: string
          name: string
          owner_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          invite_code?: string
          name: string
          owner_id: string
        }
        Update: {
          created_at?: string
          id?: string
          invite_code?: string
          name?: string
          owner_id?: string
        }
        Relationships: []
      }
      orders: {
        Row: {
          business_id: string
          created_at: string
          id: string
          note: string | null
          recorded_by: string
          total_amount: number
        }
        Insert: {
          business_id: string
          created_at?: string
          id?: string
          note?: string | null
          recorded_by: string
          total_amount?: number
        }
        Update: {
          business_id?: string
          created_at?: string
          id?: string
          note?: string | null
          recorded_by?: string
          total_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "orders_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          business_id: string
          category: string | null
          cost_price: number
          created_at: string
          current_stock: number
          id: string
          low_stock_threshold: number
          name: string
          sale_price: number
          unit: string
        }
        Insert: {
          business_id: string
          category?: string | null
          cost_price?: number
          created_at?: string
          current_stock?: number
          id?: string
          low_stock_threshold?: number
          name: string
          sale_price?: number
          unit?: string
        }
        Update: {
          business_id?: string
          category?: string | null
          cost_price?: number
          created_at?: string
          current_stock?: number
          id?: string
          low_stock_threshold?: number
          name?: string
          sale_price?: number
          unit?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_transactions: {
        Row: {
          business_id: string
          created_at: string
          id: string
          note: string | null
          order_id: string | null
          product_id: string
          quantity: number
          recorded_by: string
          type: Database["public"]["Enums"]["txn_type"]
          unit_cost_snapshot: number
          unit_sale_price_snapshot: number | null
        }
        Insert: {
          business_id: string
          created_at?: string
          id?: string
          note?: string | null
          order_id?: string | null
          product_id: string
          quantity: number
          recorded_by: string
          type: Database["public"]["Enums"]["txn_type"]
          unit_cost_snapshot?: number
          unit_sale_price_snapshot?: number | null
        }
        Update: {
          business_id?: string
          created_at?: string
          id?: string
          note?: string | null
          order_id?: string | null
          product_id?: string
          quantity?: number
          recorded_by?: string
          type?: Database["public"]["Enums"]["txn_type"]
          unit_cost_snapshot?: number
          unit_sale_price_snapshot?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_transactions_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transactions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transactions_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transactions_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_owner_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transactions_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_worker_view"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      products_owner_view: {
        Row: {
          business_id: string | null
          category: string | null
          cost_price: number | null
          created_at: string | null
          current_stock: number | null
          id: string | null
          low_stock_threshold: number | null
          name: string | null
          sale_price: number | null
          unit: string | null
        }
        Insert: {
          business_id?: string | null
          category?: string | null
          cost_price?: number | null
          created_at?: string | null
          current_stock?: number | null
          id?: string | null
          low_stock_threshold?: number | null
          name?: string | null
          sale_price?: number | null
          unit?: string | null
        }
        Update: {
          business_id?: string | null
          category?: string | null
          cost_price?: number | null
          created_at?: string | null
          current_stock?: number | null
          id?: string | null
          low_stock_threshold?: number | null
          name?: string | null
          sale_price?: number | null
          unit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "products_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      products_worker_view: {
        Row: {
          business_id: string | null
          category: string | null
          created_at: string | null
          current_stock: number | null
          id: string | null
          low_stock_threshold: number | null
          name: string | null
          sale_price: number | null
          unit: string | null
        }
        Insert: {
          business_id?: string | null
          category?: string | null
          created_at?: string | null
          current_stock?: number | null
          id?: string | null
          low_stock_threshold?: number | null
          name?: string | null
          sale_price?: number | null
          unit?: string | null
        }
        Update: {
          business_id?: string | null
          category?: string | null
          created_at?: string | null
          current_stock?: number | null
          id?: string | null
          low_stock_threshold?: number | null
          name?: string | null
          sale_price?: number | null
          unit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "products_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_transactions_owner_view: {
        Row: {
          business_id: string | null
          created_at: string | null
          id: string | null
          note: string | null
          order_id: string | null
          product_id: string | null
          quantity: number | null
          recorded_by: string | null
          type: Database["public"]["Enums"]["txn_type"] | null
          unit_cost_snapshot: number | null
          unit_sale_price_snapshot: number | null
        }
        Insert: {
          business_id?: string | null
          created_at?: string | null
          id?: string | null
          note?: string | null
          order_id?: string | null
          product_id?: string | null
          quantity?: number | null
          recorded_by?: string | null
          type?: Database["public"]["Enums"]["txn_type"] | null
          unit_cost_snapshot?: number | null
          unit_sale_price_snapshot?: number | null
        }
        Update: {
          business_id?: string | null
          created_at?: string | null
          id?: string | null
          note?: string | null
          order_id?: string | null
          product_id?: string | null
          quantity?: number | null
          recorded_by?: string | null
          type?: Database["public"]["Enums"]["txn_type"] | null
          unit_cost_snapshot?: number | null
          unit_sale_price_snapshot?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_transactions_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transactions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transactions_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transactions_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_owner_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transactions_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_worker_view"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_transactions_worker_view: {
        Row: {
          business_id: string | null
          created_at: string | null
          id: string | null
          note: string | null
          order_id: string | null
          product_id: string | null
          quantity: number | null
          recorded_by: string | null
          type: Database["public"]["Enums"]["txn_type"] | null
          unit_sale_price_snapshot: number | null
        }
        Insert: {
          business_id?: string | null
          created_at?: string | null
          id?: string | null
          note?: string | null
          order_id?: string | null
          product_id?: string | null
          quantity?: number | null
          recorded_by?: string | null
          type?: Database["public"]["Enums"]["txn_type"] | null
          unit_sale_price_snapshot?: number | null
        }
        Update: {
          business_id?: string | null
          created_at?: string | null
          id?: string | null
          note?: string | null
          order_id?: string | null
          product_id?: string | null
          quantity?: number | null
          recorded_by?: string | null
          type?: Database["public"]["Enums"]["txn_type"] | null
          unit_sale_price_snapshot?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_transactions_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transactions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transactions_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transactions_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_owner_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transactions_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_worker_view"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      create_restock: {
        Args: { _business_id: string; _items: Json; _note?: string }
        Returns: number
      }
      create_sale_order: {
        Args: { _business_id: string; _items: Json; _note?: string }
        Returns: string
      }
      is_member: {
        Args: { _business_id: string; _user_id: string }
        Returns: boolean
      }
      is_owner: {
        Args: { _business_id: string; _user_id: string }
        Returns: boolean
      }
      join_business_with_code: { Args: { _code: string }; Returns: string }
      member_role: {
        Args: { _business_id: string; _user_id: string }
        Returns: Database["public"]["Enums"]["member_role"]
      }
      regenerate_invite_code: {
        Args: { _business_id: string }
        Returns: string
      }
    }
    Enums: {
      member_role: "owner" | "worker"
      txn_type: "sale" | "restock" | "adjustment"
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
      member_role: ["owner", "worker"],
      txn_type: ["sale", "restock", "adjustment"],
    },
  },
} as const
