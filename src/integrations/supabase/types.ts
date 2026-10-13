// Tipos do schema `public`. Regenerar com: supabase gen types typescript --project-id <ref>
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type Rel<T> = { foreignKeyName: string; columns: string[]; isOneToOne: boolean; referencedRelation: string; referencedColumns: string[] } & T;

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.18";
  };
  public: {
    Tables: {
      campanhas: {
        Row: { ativa: boolean; cliente: string; created_at: string; id: string; nome: string };
        Insert: { ativa?: boolean; cliente: string; created_at?: string; id?: string; nome: string };
        Update: { ativa?: boolean; cliente?: string; created_at?: string; id?: string; nome?: string };
        Relationships: [Rel<{ referencedRelation: "clientes" }>];
      };
      campanha_documentos: {
        Row: {
          campanha_id: string;
          doc_type: string;
          obrigatorio: boolean;
          ordem: number;
          regime: string;
          tipos_veiculo: string[] | null;
        };
        Insert: {
          campanha_id: string;
          doc_type: string;
          obrigatorio?: boolean;
          ordem?: number;
          regime?: string;
          tipos_veiculo?: string[] | null;
        };
        Update: {
          campanha_id?: string;
          doc_type?: string;
          obrigatorio?: boolean;
          ordem?: number;
          regime?: string;
          tipos_veiculo?: string[] | null;
        };
        Relationships: [Rel<{ referencedRelation: "campanhas" }>, Rel<{ referencedRelation: "tipos_documento" }>];
      };
      tipos_documento: {
        Row: { codigo: string; created_at: string; descricao: string | null; modelo_url: string | null; nome: string; ordem: number };
        Insert: { codigo: string; created_at?: string; descricao?: string | null; modelo_url?: string | null; nome: string; ordem?: number };
        Update: { codigo?: string; created_at?: string; descricao?: string | null; modelo_url?: string | null; nome?: string; ordem?: number };
        Relationships: [];
      };
      medicoes: {
        Row: {
          comissao_agencia: number;
          created_at: string;
          criado_por: string | null;
          enviado_em: string | null;
          enviado_por: string | null;
          id: string;
          liberado_em: string | null;
          liberado_por: string | null;
          numero_nf: string | null;
          observacoes: string | null;
          pago_em: string | null;
          pago_por: string | null;
          periodo_fim: string | null;
          periodo_inicio: string | null;
          previsao_pagamento: string | null;
          status: Database["public"]["Enums"]["status_medicao"];
          submission_id: string;
          updated_at: string;
          valor_bruto: number;
          valor_liquido: number;
        };
        Insert: {
          comissao_agencia?: number;
          numero_nf?: string | null;
          observacoes?: string | null;
          periodo_fim?: string | null;
          periodo_inicio?: string | null;
          submission_id: string;
          valor_bruto: number;
        };
        Update: {
          comissao_agencia?: number;
          numero_nf?: string | null;
          observacoes?: string | null;
          periodo_fim?: string | null;
          periodo_inicio?: string | null;
          valor_bruto?: number;
        };
        Relationships: [Rel<{ referencedRelation: "submissions" }>];
      };
      medicao_eventos: {
        Row: {
          ator_id: string | null;
          created_at: string;
          de_status: Database["public"]["Enums"]["status_medicao"] | null;
          detalhe: string | null;
          id: string;
          medicao_id: string;
          para_status: Database["public"]["Enums"]["status_medicao"] | null;
          tipo: string;
        };
        Insert: never;
        Update: never;
        Relationships: [Rel<{ referencedRelation: "medicoes" }>];
      };
      clientes: {
        Row: {
          ativo: boolean;
          cnpj: string | null;
          contrato_info: string[];
          created_at: string;
          endereco_postal: string | null;
          id: string;
          nome: string;
          observacoes_nf: string[];
          texto_obrigatorio_nf: string | null;
        };
        Insert: {
          ativo?: boolean;
          cnpj?: string | null;
          contrato_info?: string[];
          created_at?: string;
          endereco_postal?: string | null;
          id?: string;
          nome: string;
          observacoes_nf?: string[];
          texto_obrigatorio_nf?: string | null;
        };
        Update: {
          ativo?: boolean;
          cnpj?: string | null;
          contrato_info?: string[];
          created_at?: string;
          endereco_postal?: string | null;
          id?: string;
          nome?: string;
          observacoes_nf?: string[];
          texto_obrigatorio_nf?: string | null;
        };
        Relationships: [];
      };
      documents: {
        Row: {
          created_at: string;
          doc_label: string;
          doc_type: string;
          file_name: string;
          id: string;
          storage_path: string;
          submission_id: string;
        };
        Insert: {
          created_at?: string;
          doc_label: string;
          doc_type: string;
          file_name: string;
          id?: string;
          storage_path: string;
          submission_id: string;
        };
        Update: {
          created_at?: string;
          doc_label?: string;
          doc_type?: string;
          file_name?: string;
          id?: string;
          storage_path?: string;
          submission_id?: string;
        };
        Relationships: [Rel<{ referencedRelation: "submissions" }>];
      };
      profiles: {
        Row: { ativo: boolean; created_at: string; email: string | null; id: string; nome: string | null };
        Insert: { ativo?: boolean; created_at?: string; email?: string | null; id: string; nome?: string | null };
        Update: { ativo?: boolean; created_at?: string; email?: string | null; id?: string; nome?: string | null };
        Relationships: [];
      };
      submission_events: {
        Row: {
          ator_id: string | null;
          created_at: string;
          de_status: string | null;
          detalhe: string | null;
          id: string;
          para_status: string | null;
          submission_id: string;
          tipo: string;
        };
        Insert: {
          ator_id?: string | null;
          created_at?: string;
          de_status?: string | null;
          detalhe?: string | null;
          id?: string;
          para_status?: string | null;
          submission_id: string;
          tipo: string;
        };
        Update: {
          ator_id?: string | null;
          created_at?: string;
          de_status?: string | null;
          detalhe?: string | null;
          id?: string;
          para_status?: string | null;
          submission_id?: string;
          tipo?: string;
        };
        Relationships: [Rel<{ referencedRelation: "submissions" }>];
      };
      submissions: {
        Row: {
          analise_ia: Json | null;
          campanha: string;
          cidade: string;
          cliente: string;
          contato_email: string;
          contato_nome: string;
          contato_telefone: string;
          created_at: string;
          data_envio: string;
          decidido_em: string | null;
          decidido_por: string | null;
          documentos_completos: boolean;
          id: string;
          nome_veiculo: string;
          numero_pi: string;
          observacoes: string | null;
          outro_tipo: string | null;
          parent_id: string | null;
          status: string;
          tipo_veiculo: string;
          updated_at: string;
        };
        Insert: {
          analise_ia?: Json | null;
          campanha: string;
          cidade?: string;
          cliente: string;
          contato_email: string;
          contato_nome: string;
          contato_telefone: string;
          created_at?: string;
          data_envio?: string;
          decidido_em?: string | null;
          decidido_por?: string | null;
          documentos_completos?: boolean;
          id?: string;
          nome_veiculo: string;
          numero_pi: string;
          observacoes?: string | null;
          outro_tipo?: string | null;
          parent_id?: string | null;
          status?: string;
          tipo_veiculo: string;
          updated_at?: string;
        };
        Update: {
          analise_ia?: Json | null;
          campanha?: string;
          cidade?: string;
          cliente?: string;
          contato_email?: string;
          contato_nome?: string;
          contato_telefone?: string;
          created_at?: string;
          data_envio?: string;
          decidido_em?: string | null;
          decidido_por?: string | null;
          documentos_completos?: boolean;
          id?: string;
          nome_veiculo?: string;
          numero_pi?: string;
          observacoes?: string | null;
          outro_tipo?: string | null;
          parent_id?: string | null;
          status?: string;
          tipo_veiculo?: string;
          updated_at?: string;
        };
        Relationships: [Rel<{ referencedRelation: "submissions" }>];
      };
      user_roles: {
        Row: { created_at: string; role: Database["public"]["Enums"]["app_role"]; user_id: string };
        Insert: { created_at?: string; role: Database["public"]["Enums"]["app_role"]; user_id: string };
        Update: { created_at?: string; role?: Database["public"]["Enums"]["app_role"]; user_id?: string };
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      concluir_envio: { Args: { p_id: string }; Returns: boolean };
      criar_medicao: {
        Args: { p_submission: string; p_valor_bruto: number; p_comissao?: number; p_inicio?: string; p_fim?: string; p_nf?: string; p_obs?: string };
        Returns: string;
      };
      mudar_status_medicao: {
        Args: { p_id: string; p_para: Database["public"]["Enums"]["status_medicao"]; p_data?: string; p_detalhe?: string };
        Returns: undefined;
      };
    };
    Enums: {
      app_role: "operador" | "financeiro" | "admin";
      status_medicao: "em_medicao" | "aguardando_liberacao" | "liberado" | "pago" | "cancelado";
    };
    CompositeTypes: { [_ in never]: never };
  };
};
