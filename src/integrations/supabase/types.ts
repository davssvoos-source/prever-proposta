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
      blocos: {
        Row: {
          code: string
          created_at: string
          descricao: string | null
          hh: number
          id: string
          layer: number
          name: string
          obs: string | null
        }
        Insert: {
          code: string
          created_at?: string
          descricao?: string | null
          hh?: number
          id?: string
          layer: number
          name: string
          obs?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          descricao?: string | null
          hh?: number
          id?: string
          layer?: number
          name?: string
          obs?: string | null
        }
        Relationships: []
      }
      blocos_itens: {
        Row: {
          bloco_id: string
          id: string
          marca: string | null
          modelo: string
          nome: string
          qty: number
          seq: number
          variavel: boolean
        }
        Insert: {
          bloco_id: string
          id?: string
          marca?: string | null
          modelo: string
          nome: string
          qty?: number
          seq?: number
          variavel?: boolean
        }
        Update: {
          bloco_id?: string
          id?: string
          marca?: string | null
          modelo?: string
          nome?: string
          qty?: number
          seq?: number
          variavel?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "blocos_itens_bloco_id_fkey"
            columns: ["bloco_id"]
            isOneToOne: false
            referencedRelation: "blocos"
            referencedColumns: ["id"]
          },
        ]
      }
      clientes: {
        Row: {
          created_at: string
          email: string | null
          id: string
          nome: string
          owner_id: string
          telefone: string | null
          tipo_empreendimento: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          nome: string
          owner_id: string
          telefone?: string | null
          tipo_empreendimento?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          nome?: string
          owner_id?: string
          telefone?: string | null
          tipo_empreendimento?: string | null
        }
        Relationships: []
      }
      equipamentos: {
        Row: {
          cat: string | null
          code: string | null
          created_at: string
          custo: number
          fornecedor: string | null
          id: string
          marca: string | null
          markup: number
          modelo: string
          nome: string
          subcat: string | null
          un: string
        }
        Insert: {
          cat?: string | null
          code?: string | null
          created_at?: string
          custo?: number
          fornecedor?: string | null
          id?: string
          marca?: string | null
          markup?: number
          modelo: string
          nome: string
          subcat?: string | null
          un?: string
        }
        Update: {
          cat?: string | null
          code?: string | null
          created_at?: string
          custo?: number
          fornecedor?: string | null
          id?: string
          marca?: string | null
          markup?: number
          modelo?: string
          nome?: string
          subcat?: string | null
          un?: string
        }
        Relationships: []
      }
      fotos_visita: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          legenda: string | null
          storage_path: string | null
          url: string
          visita_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          legenda?: string | null
          storage_path?: string | null
          url: string
          visita_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          legenda?: string | null
          storage_path?: string | null
          url?: string
          visita_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fotos_visita_visita_id_fkey"
            columns: ["visita_id"]
            isOneToOne: false
            referencedRelation: "visitas_tecnicas"
            referencedColumns: ["id"]
          },
        ]
      }
      notificacoes: {
        Row: {
          corpo: string | null
          created_at: string
          id: string
          lida: boolean
          tipo: string
          titulo: string
          user_id: string | null
        }
        Insert: {
          corpo?: string | null
          created_at?: string
          id?: string
          lida?: boolean
          tipo?: string
          titulo: string
          user_id?: string | null
        }
        Update: {
          corpo?: string | null
          created_at?: string
          id?: string
          lida?: boolean
          tipo?: string
          titulo?: string
          user_id?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          ativo: boolean
          avatar_url: string | null
          cargo: string | null
          created_at: string
          email: string | null
          id: string
          nome: string | null
          telefone: string | null
        }
        Insert: {
          ativo?: boolean
          avatar_url?: string | null
          cargo?: string | null
          created_at?: string
          email?: string | null
          id: string
          nome?: string | null
          telefone?: string | null
        }
        Update: {
          ativo?: boolean
          avatar_url?: string | null
          cargo?: string | null
          created_at?: string
          email?: string | null
          id?: string
          nome?: string | null
          telefone?: string | null
        }
        Relationships: []
      }
      projeto_blocos: {
        Row: {
          ativo: boolean
          bloco_id: string
          id: string
          projeto_id: string
          quantidade: number
        }
        Insert: {
          ativo?: boolean
          bloco_id: string
          id?: string
          projeto_id: string
          quantidade?: number
        }
        Update: {
          ativo?: boolean
          bloco_id?: string
          id?: string
          projeto_id?: string
          quantidade?: number
        }
        Relationships: [
          {
            foreignKeyName: "projeto_blocos_bloco_id_fkey"
            columns: ["bloco_id"]
            isOneToOne: false
            referencedRelation: "blocos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projeto_blocos_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projetos"
            referencedColumns: ["id"]
          },
        ]
      }
      projeto_itens_variaveis: {
        Row: {
          bloco_item_id: string
          id: string
          projeto_id: string
          quantidade: number
        }
        Insert: {
          bloco_item_id: string
          id?: string
          projeto_id: string
          quantidade?: number
        }
        Update: {
          bloco_item_id?: string
          id?: string
          projeto_id?: string
          quantidade?: number
        }
        Relationships: [
          {
            foreignKeyName: "projeto_itens_variaveis_bloco_item_id_fkey"
            columns: ["bloco_item_id"]
            isOneToOne: false
            referencedRelation: "blocos_itens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projeto_itens_variaveis_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projetos"
            referencedColumns: ["id"]
          },
        ]
      }
      projeto_servicos: {
        Row: {
          ativo: boolean
          id: string
          projeto_id: string
          quantidade: number
          servico_id: string
        }
        Insert: {
          ativo?: boolean
          id?: string
          projeto_id: string
          quantidade?: number
          servico_id: string
        }
        Update: {
          ativo?: boolean
          id?: string
          projeto_id?: string
          quantidade?: number
          servico_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "projeto_servicos_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projetos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projeto_servicos_servico_id_fkey"
            columns: ["servico_id"]
            isOneToOne: false
            referencedRelation: "servicos"
            referencedColumns: ["id"]
          },
        ]
      }
      projetos: {
        Row: {
          cliente_id: string | null
          created_at: string
          data_visita: string | null
          fornecimento: boolean
          id: string
          nome: string
          owner_id: string
          status: string
          tipo_contrato: string
          updated_at: string
          valor_hora_hh: number
        }
        Insert: {
          cliente_id?: string | null
          created_at?: string
          data_visita?: string | null
          fornecimento?: boolean
          id?: string
          nome: string
          owner_id: string
          status?: string
          tipo_contrato?: string
          updated_at?: string
          valor_hora_hh?: number
        }
        Update: {
          cliente_id?: string | null
          created_at?: string
          data_visita?: string | null
          fornecimento?: boolean
          id?: string
          nome?: string
          owner_id?: string
          status?: string
          tipo_contrato?: string
          updated_at?: string
          valor_hora_hh?: number
        }
        Relationships: [
          {
            foreignKeyName: "projetos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      servicos: {
        Row: {
          ativo_padrao: boolean
          cat: string | null
          code: string
          id: string
          nome: string
          ordem: number
          preco_unitario_mensal: number
        }
        Insert: {
          ativo_padrao?: boolean
          cat?: string | null
          code: string
          id?: string
          nome: string
          ordem?: number
          preco_unitario_mensal?: number
        }
        Update: {
          ativo_padrao?: boolean
          cat?: string | null
          code?: string
          id?: string
          nome?: string
          ordem?: number
          preco_unitario_mensal?: number
        }
        Relationships: []
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
      visita_orcamentos: {
        Row: {
          blocos_selecionados: Json | null
          created_at: string
          fornecimento: boolean | null
          id: string
          itens_variaveis: Json | null
          obs_tecnico: string | null
          qtd_apartamentos: number | null
          servicos_ofertados: string[] | null
          sistema_atual: string | null
          step_atual: number | null
          updated_at: string
          valor_hora_hh: number | null
          visita_id: string | null
        }
        Insert: {
          blocos_selecionados?: Json | null
          created_at?: string
          fornecimento?: boolean | null
          id?: string
          itens_variaveis?: Json | null
          obs_tecnico?: string | null
          qtd_apartamentos?: number | null
          servicos_ofertados?: string[] | null
          sistema_atual?: string | null
          step_atual?: number | null
          updated_at?: string
          valor_hora_hh?: number | null
          visita_id?: string | null
        }
        Update: {
          blocos_selecionados?: Json | null
          created_at?: string
          fornecimento?: boolean | null
          id?: string
          itens_variaveis?: Json | null
          obs_tecnico?: string | null
          qtd_apartamentos?: number | null
          servicos_ofertados?: string[] | null
          sistema_atual?: string | null
          step_atual?: number | null
          updated_at?: string
          valor_hora_hh?: number | null
          visita_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "visita_orcamentos_visita_id_fkey"
            columns: ["visita_id"]
            isOneToOne: true
            referencedRelation: "visitas_tecnicas"
            referencedColumns: ["id"]
          },
        ]
      }
      visitas_tecnicas: {
        Row: {
          aprovado_em: string | null
          aprovado_por: string | null
          cliente_id: string | null
          complemento: string | null
          contato_sindico: string | null
          created_at: string
          created_by: string | null
          data_hora_agendada: string
          data_hora_fim: string | null
          data_hora_inicio: string | null
          descricao_pedido: string | null
          endereco: string
          equipamentos_vistos: string | null
          foto_fachada_url: string | null
          id: string
          latitude: number | null
          longitude: number | null
          motivo_reprovacao: string | null
          nome_predio: string | null
          nome_sindico: string | null
          notas_visita: string | null
          obs_agendamento: string | null
          prioridade: string | null
          projeto_id: string | null
          servico_solicitado: string | null
          servicos_solicitados: string[]
          status: string
          tecnico_id: string | null
          tipo_local: string | null
          titulo: string
          updated_at: string
        }
        Insert: {
          aprovado_em?: string | null
          aprovado_por?: string | null
          cliente_id?: string | null
          complemento?: string | null
          contato_sindico?: string | null
          created_at?: string
          created_by?: string | null
          data_hora_agendada: string
          data_hora_fim?: string | null
          data_hora_inicio?: string | null
          descricao_pedido?: string | null
          endereco: string
          equipamentos_vistos?: string | null
          foto_fachada_url?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          motivo_reprovacao?: string | null
          nome_predio?: string | null
          nome_sindico?: string | null
          notas_visita?: string | null
          obs_agendamento?: string | null
          prioridade?: string | null
          projeto_id?: string | null
          servico_solicitado?: string | null
          servicos_solicitados?: string[]
          status?: string
          tecnico_id?: string | null
          tipo_local?: string | null
          titulo: string
          updated_at?: string
        }
        Update: {
          aprovado_em?: string | null
          aprovado_por?: string | null
          cliente_id?: string | null
          complemento?: string | null
          contato_sindico?: string | null
          created_at?: string
          created_by?: string | null
          data_hora_agendada?: string
          data_hora_fim?: string | null
          data_hora_inicio?: string | null
          descricao_pedido?: string | null
          endereco?: string
          equipamentos_vistos?: string | null
          foto_fachada_url?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          motivo_reprovacao?: string | null
          nome_predio?: string | null
          nome_sindico?: string | null
          notas_visita?: string | null
          obs_agendamento?: string | null
          prioridade?: string | null
          projeto_id?: string | null
          servico_solicitado?: string | null
          servicos_solicitados?: string[]
          status?: string
          tecnico_id?: string | null
          tipo_local?: string | null
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "visitas_tecnicas_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visitas_tecnicas_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projetos"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "comercial" | "tecnico"
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
      app_role: ["admin", "comercial", "tecnico"],
    },
  },
} as const
