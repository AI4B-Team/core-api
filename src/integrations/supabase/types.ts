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
      account_memberships: {
        Row: {
          account_id: string
          created_at: string
          id: string
          role: string
          user_id: string
        }
        Insert: {
          account_id: string
          created_at?: string
          id?: string
          role: string
          user_id: string
        }
        Update: {
          account_id?: string
          created_at?: string
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "account_memberships_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "account_memberships_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      accounts: {
        Row: {
          accent_color: string | null
          billing_email: string
          brand_name: string | null
          created_at: string
          id: string
          is_reseller: boolean
          logo_url: string | null
          name: string
          stripe_customer_id: string | null
          support_email: string | null
          type: string
        }
        Insert: {
          accent_color?: string | null
          billing_email: string
          brand_name?: string | null
          created_at?: string
          id?: string
          is_reseller?: boolean
          logo_url?: string | null
          name: string
          stripe_customer_id?: string | null
          support_email?: string | null
          type: string
        }
        Update: {
          accent_color?: string | null
          billing_email?: string
          brand_name?: string | null
          created_at?: string
          id?: string
          is_reseller?: boolean
          logo_url?: string | null
          name?: string
          stripe_customer_id?: string | null
          support_email?: string | null
          type?: string
        }
        Relationships: []
      }
      app_credentials: {
        Row: {
          app_id: string
          created_at: string
          id: string
          is_active: boolean
          last_used_at: string | null
          name: string
          token_hash: string
          token_prefix: string
        }
        Insert: {
          app_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          last_used_at?: string | null
          name: string
          token_hash: string
          token_prefix: string
        }
        Update: {
          app_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          last_used_at?: string | null
          name?: string
          token_hash?: string
          token_prefix?: string
        }
        Relationships: [
          {
            foreignKeyName: "app_credentials_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "apps"
            referencedColumns: ["id"]
          },
        ]
      }
      app_packs: {
        Row: {
          app_ids: string[]
          created_at: string
          description: string | null
          id: string
          name: string
        }
        Insert: {
          app_ids: string[]
          created_at?: string
          description?: string | null
          id: string
          name: string
        }
        Update: {
          app_ids?: string[]
          created_at?: string
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      apps: {
        Row: {
          base_url: string
          created_at: string
          description: string | null
          icon: string | null
          id: string
          is_active: boolean
          is_alacarte: boolean
          manifest: Json
          name: string
        }
        Insert: {
          base_url: string
          created_at?: string
          description?: string | null
          icon?: string | null
          id: string
          is_active?: boolean
          is_alacarte?: boolean
          manifest?: Json
          name: string
        }
        Update: {
          base_url?: string
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean
          is_alacarte?: boolean
          manifest?: Json
          name?: string
        }
        Relationships: []
      }
      auth_codes: {
        Row: {
          app_id: string
          code_hash: string
          consumed_at: string | null
          created_at: string
          expires_at: string
          redirect_uri: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          app_id: string
          code_hash: string
          consumed_at?: string | null
          created_at?: string
          expires_at: string
          redirect_uri: string
          user_id: string
          workspace_id: string
        }
        Update: {
          app_id?: string
          code_hash?: string
          consumed_at?: string | null
          created_at?: string
          expires_at?: string
          redirect_uri?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "auth_codes_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "apps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auth_codes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auth_codes_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      brands: {
        Row: {
          created_at: string
          failure_reason: string | null
          id: string
          legal_entity_id: string
          provider: string
          provider_brand_id: string | null
          status: string
          submitted_at: string | null
          tcr_brand_id: string | null
          verified_at: string | null
          vertical: string | null
        }
        Insert: {
          created_at?: string
          failure_reason?: string | null
          id?: string
          legal_entity_id: string
          provider: string
          provider_brand_id?: string | null
          status: string
          submitted_at?: string | null
          tcr_brand_id?: string | null
          verified_at?: string | null
          vertical?: string | null
        }
        Update: {
          created_at?: string
          failure_reason?: string | null
          id?: string
          legal_entity_id?: string
          provider?: string
          provider_brand_id?: string | null
          status?: string
          submitted_at?: string | null
          tcr_brand_id?: string | null
          verified_at?: string | null
          vertical?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "brands_legal_entity_id_fkey"
            columns: ["legal_entity_id"]
            isOneToOne: true
            referencedRelation: "legal_entities"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns_10dlc: {
        Row: {
          app_id: string
          brand_id: string
          created_at: string
          id: string
          opt_in_description: string | null
          provider_campaign_id: string | null
          sample_messages: string[] | null
          status: string
          throughput_tpm: number | null
          use_case: string
        }
        Insert: {
          app_id: string
          brand_id: string
          created_at?: string
          id?: string
          opt_in_description?: string | null
          provider_campaign_id?: string | null
          sample_messages?: string[] | null
          status?: string
          throughput_tpm?: number | null
          use_case: string
        }
        Update: {
          app_id?: string
          brand_id?: string
          created_at?: string
          id?: string
          opt_in_description?: string | null
          provider_campaign_id?: string | null
          sample_messages?: string[] | null
          status?: string
          throughput_tpm?: number | null
          use_case?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_10dlc_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "apps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaigns_10dlc_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      consent_records: {
        Row: {
          basis: string
          captured_at: string
          captured_by_app: string | null
          channel: string
          contact_id: string | null
          created_at: string
          evidence: Json | null
          expires_at: string | null
          id: string
          identifier: string
          legal_entity_id: string
        }
        Insert: {
          basis: string
          captured_at?: string
          captured_by_app?: string | null
          channel: string
          contact_id?: string | null
          created_at?: string
          evidence?: Json | null
          expires_at?: string | null
          id?: string
          identifier: string
          legal_entity_id: string
        }
        Update: {
          basis?: string
          captured_at?: string
          captured_by_app?: string | null
          channel?: string
          contact_id?: string | null
          created_at?: string
          evidence?: Json | null
          expires_at?: string | null
          id?: string
          identifier?: string
          legal_entity_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "consent_records_captured_by_app_fkey"
            columns: ["captured_by_app"]
            isOneToOne: false
            referencedRelation: "apps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consent_records_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consent_records_legal_entity_id_fkey"
            columns: ["legal_entity_id"]
            isOneToOne: false
            referencedRelation: "legal_entities"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_emails: {
        Row: {
          contact_id: string
          created_at: string
          email: string
          id: string
          is_primary: boolean
          legal_entity_id: string
          validated_at: string | null
        }
        Insert: {
          contact_id: string
          created_at?: string
          email: string
          id?: string
          is_primary?: boolean
          legal_entity_id: string
          validated_at?: string | null
        }
        Update: {
          contact_id?: string
          created_at?: string
          email?: string
          id?: string
          is_primary?: boolean
          legal_entity_id?: string
          validated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contact_emails_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_emails_legal_entity_id_fkey"
            columns: ["legal_entity_id"]
            isOneToOne: false
            referencedRelation: "legal_entities"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_phones: {
        Row: {
          carrier: string | null
          connection_status: string | null
          contact_id: string
          created_at: string
          e164: string
          id: string
          is_primary: boolean
          legal_entity_id: string
          line_type: string | null
          validated_at: string | null
        }
        Insert: {
          carrier?: string | null
          connection_status?: string | null
          contact_id: string
          created_at?: string
          e164: string
          id?: string
          is_primary?: boolean
          legal_entity_id: string
          line_type?: string | null
          validated_at?: string | null
        }
        Update: {
          carrier?: string | null
          connection_status?: string | null
          contact_id?: string
          created_at?: string
          e164?: string
          id?: string
          is_primary?: boolean
          legal_entity_id?: string
          line_type?: string | null
          validated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contact_phones_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_phones_legal_entity_id_fkey"
            columns: ["legal_entity_id"]
            isOneToOne: false
            referencedRelation: "legal_entities"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          company: string | null
          created_at: string
          first_name: string | null
          id: string
          last_name: string | null
          legal_entity_id: string
          mailing_address: Json | null
          timezone: string | null
          updated_at: string
        }
        Insert: {
          company?: string | null
          created_at?: string
          first_name?: string | null
          id?: string
          last_name?: string | null
          legal_entity_id: string
          mailing_address?: Json | null
          timezone?: string | null
          updated_at?: string
        }
        Update: {
          company?: string | null
          created_at?: string
          first_name?: string | null
          id?: string
          last_name?: string | null
          legal_entity_id?: string
          mailing_address?: Json | null
          timezone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contacts_legal_entity_id_fkey"
            columns: ["legal_entity_id"]
            isOneToOne: false
            referencedRelation: "legal_entities"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          assigned_user_id: string | null
          contact_id: string
          created_at: string
          id: string
          last_message_at: string | null
          status: string
          workspace_id: string
        }
        Insert: {
          assigned_user_id?: string | null
          contact_id: string
          created_at?: string
          id?: string
          last_message_at?: string | null
          status?: string
          workspace_id: string
        }
        Update: {
          assigned_user_id?: string | null
          contact_id?: string
          created_at?: string
          id?: string
          last_message_at?: string | null
          status?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_assigned_user_id_fkey"
            columns: ["assigned_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_balances: {
        Row: {
          balance: number
          meter_id: string
          workspace_id: string
        }
        Insert: {
          balance?: number
          meter_id: string
          workspace_id: string
        }
        Update: {
          balance?: number
          meter_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_balances_meter_id_fkey"
            columns: ["meter_id"]
            isOneToOne: false
            referencedRelation: "credit_meters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_balances_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_ledger: {
        Row: {
          account_id: string
          app_id: string | null
          billed_cents: number
          created_at: string
          id: string
          idempotency_key: string | null
          markup_rate: number
          meter_id: string
          quantity: number
          reference: Json | null
          unit_cost_cents: number
          workspace_id: string
        }
        Insert: {
          account_id: string
          app_id?: string | null
          billed_cents: number
          created_at?: string
          id?: string
          idempotency_key?: string | null
          markup_rate?: number
          meter_id: string
          quantity: number
          reference?: Json | null
          unit_cost_cents: number
          workspace_id: string
        }
        Update: {
          account_id?: string
          app_id?: string | null
          billed_cents?: number
          created_at?: string
          id?: string
          idempotency_key?: string | null
          markup_rate?: number
          meter_id?: string
          quantity?: number
          reference?: Json | null
          unit_cost_cents?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_ledger_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_ledger_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "apps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_ledger_meter_id_fkey"
            columns: ["meter_id"]
            isOneToOne: false
            referencedRelation: "credit_meters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_ledger_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_meters: {
        Row: {
          base_cost_cents: number
          id: string
          name: string
          unit: string
        }
        Insert: {
          base_cost_cents: number
          id: string
          name: string
          unit: string
        }
        Update: {
          base_cost_cents?: number
          id?: string
          name?: string
          unit?: string
        }
        Relationships: []
      }
      entitlements: {
        Row: {
          activated_at: string
          app_id: string
          expires_at: string | null
          id: string
          plan: string
          seats: number
          settings: Json
          status: string
          workspace_id: string
        }
        Insert: {
          activated_at?: string
          app_id: string
          expires_at?: string | null
          id?: string
          plan?: string
          seats?: number
          settings?: Json
          status: string
          workspace_id: string
        }
        Update: {
          activated_at?: string
          app_id?: string
          expires_at?: string | null
          id?: string
          plan?: string
          seats?: number
          settings?: Json
          status?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "entitlements_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "apps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entitlements_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      legal_entities: {
        Row: {
          account_id: string
          country: string
          created_at: string
          ein: string | null
          entity_type: string | null
          id: string
          legal_name: string
        }
        Insert: {
          account_id: string
          country?: string
          created_at?: string
          ein?: string | null
          entity_type?: string | null
          id?: string
          legal_name: string
        }
        Update: {
          account_id?: string
          country?: string
          created_at?: string
          ein?: string | null
          entity_type?: string | null
          id?: string
          legal_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "legal_entities_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      memberships: {
        Row: {
          created_at: string
          id: string
          role: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: string
          user_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "memberships_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memberships_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          app_id: string
          body: string | null
          channel: string
          conversation_id: string
          created_at: string
          direction: string
          error_code: string | null
          from_identifier: string
          id: string
          media: Json | null
          policy_check_id: string | null
          provider_message_id: string | null
          segments: number | null
          sent_at: string | null
          status: string
          to_identifier: string
          workspace_id: string
        }
        Insert: {
          app_id: string
          body?: string | null
          channel: string
          conversation_id: string
          created_at?: string
          direction: string
          error_code?: string | null
          from_identifier: string
          id?: string
          media?: Json | null
          policy_check_id?: string | null
          provider_message_id?: string | null
          segments?: number | null
          sent_at?: string | null
          status: string
          to_identifier: string
          workspace_id: string
        }
        Update: {
          app_id?: string
          body?: string | null
          channel?: string
          conversation_id?: string
          created_at?: string
          direction?: string
          error_code?: string | null
          from_identifier?: string
          id?: string
          media?: Json | null
          policy_check_id?: string | null
          provider_message_id?: string | null
          segments?: number | null
          sent_at?: string | null
          status?: string
          to_identifier?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "apps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      phone_numbers: {
        Row: {
          brand_id: string
          campaign_id: string | null
          capabilities: string[]
          e164: string
          friendly_name: string | null
          id: string
          provider: string
          provisioned_at: string
          status: string
          workspace_id: string
        }
        Insert: {
          brand_id: string
          campaign_id?: string | null
          capabilities?: string[]
          e164: string
          friendly_name?: string | null
          id?: string
          provider: string
          provisioned_at?: string
          status?: string
          workspace_id: string
        }
        Update: {
          brand_id?: string
          campaign_id?: string | null
          capabilities?: string[]
          e164?: string
          friendly_name?: string | null
          id?: string
          provider?: string
          provisioned_at?: string
          status?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "phone_numbers_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "phone_numbers_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns_10dlc"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "phone_numbers_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      policy_checks: {
        Row: {
          action: string
          actor_id: string | null
          actor_type: string
          app_id: string
          channel: string | null
          contact_id: string | null
          created_at: string
          decision: string
          denied_by: string | null
          id: string
          identifier: string | null
          legal_entity_id: string
          rules_evaluated: Json
          workspace_id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_type: string
          app_id: string
          channel?: string | null
          contact_id?: string | null
          created_at?: string
          decision: string
          denied_by?: string | null
          id?: string
          identifier?: string | null
          legal_entity_id: string
          rules_evaluated?: Json
          workspace_id: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_type?: string
          app_id?: string
          channel?: string | null
          contact_id?: string | null
          created_at?: string
          decision?: string
          denied_by?: string | null
          id?: string
          identifier?: string | null
          legal_entity_id?: string
          rules_evaluated?: Json
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "policy_checks_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "apps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "policy_checks_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "policy_checks_legal_entity_id_fkey"
            columns: ["legal_entity_id"]
            isOneToOne: false
            referencedRelation: "legal_entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "policy_checks_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      policy_packs: {
        Row: {
          created_at: string
          id: string
          industry: string | null
          name: string
          rules: Json
        }
        Insert: {
          created_at?: string
          id: string
          industry?: string | null
          name: string
          rules: Json
        }
        Update: {
          created_at?: string
          id?: string
          industry?: string | null
          name?: string
          rules?: Json
        }
        Relationships: []
      }
      refresh_tokens: {
        Row: {
          app_id: string
          created_at: string
          expires_at: string
          revoked_at: string | null
          token_hash: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          app_id: string
          created_at?: string
          expires_at: string
          revoked_at?: string | null
          token_hash: string
          user_id: string
          workspace_id: string
        }
        Update: {
          app_id?: string
          created_at?: string
          expires_at?: string
          revoked_at?: string | null
          token_hash?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "refresh_tokens_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "apps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "refresh_tokens_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "refresh_tokens_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      reseller_markups: {
        Row: {
          account_id: string
          id: string
          markup_rate: number
          meter_id: string
          workspace_id: string | null
        }
        Insert: {
          account_id: string
          id?: string
          markup_rate: number
          meter_id: string
          workspace_id?: string | null
        }
        Update: {
          account_id?: string
          id?: string
          markup_rate?: number
          meter_id?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reseller_markups_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reseller_markups_meter_id_fkey"
            columns: ["meter_id"]
            isOneToOne: false
            referencedRelation: "credit_meters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reseller_markups_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      suppression_audit: {
        Row: {
          action: string
          actor_app_id: string | null
          actor_user_id: string | null
          channel: string
          created_at: string
          id: string
          identifier: string
          legal_entity_id: string
          notes: string | null
          suppression_id: string | null
        }
        Insert: {
          action: string
          actor_app_id?: string | null
          actor_user_id?: string | null
          channel: string
          created_at?: string
          id?: string
          identifier: string
          legal_entity_id: string
          notes?: string | null
          suppression_id?: string | null
        }
        Update: {
          action?: string
          actor_app_id?: string | null
          actor_user_id?: string | null
          channel?: string
          created_at?: string
          id?: string
          identifier?: string
          legal_entity_id?: string
          notes?: string | null
          suppression_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "suppression_audit_actor_app_id_fkey"
            columns: ["actor_app_id"]
            isOneToOne: false
            referencedRelation: "apps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "suppression_audit_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "suppression_audit_legal_entity_id_fkey"
            columns: ["legal_entity_id"]
            isOneToOne: false
            referencedRelation: "legal_entities"
            referencedColumns: ["id"]
          },
        ]
      }
      suppressions: {
        Row: {
          channel: string
          created_at: string
          id: string
          identifier: string
          legal_entity_id: string
          notes: string | null
          reason: string
          source_app_id: string | null
          source_message_id: string | null
        }
        Insert: {
          channel: string
          created_at?: string
          id?: string
          identifier: string
          legal_entity_id: string
          notes?: string | null
          reason: string
          source_app_id?: string | null
          source_message_id?: string | null
        }
        Update: {
          channel?: string
          created_at?: string
          id?: string
          identifier?: string
          legal_entity_id?: string
          notes?: string | null
          reason?: string
          source_app_id?: string | null
          source_message_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "suppressions_legal_entity_id_fkey"
            columns: ["legal_entity_id"]
            isOneToOne: false
            referencedRelation: "legal_entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "suppressions_source_app_id_fkey"
            columns: ["source_app_id"]
            isOneToOne: false
            referencedRelation: "apps"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          full_name: string | null
          id: string
          is_staff: boolean
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          is_staff?: boolean
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          is_staff?: boolean
        }
        Relationships: []
      }
      workspace_policies: {
        Row: {
          autonomy_level: number
          overrides: Json
          policy_pack_ids: string[]
          workspace_id: string
        }
        Insert: {
          autonomy_level?: number
          overrides?: Json
          policy_pack_ids?: string[]
          workspace_id: string
        }
        Update: {
          autonomy_level?: number
          overrides?: Json
          policy_pack_ids?: string[]
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_policies_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: true
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspaces: {
        Row: {
          account_id: string
          created_at: string
          id: string
          industry: string | null
          legal_entity_id: string
          name: string
          slug: string
          timezone: string
        }
        Insert: {
          account_id: string
          created_at?: string
          id?: string
          industry?: string | null
          legal_entity_id: string
          name: string
          slug: string
          timezone?: string
        }
        Update: {
          account_id?: string
          created_at?: string
          id?: string
          industry?: string | null
          legal_entity_id?: string
          name?: string
          slug?: string
          timezone?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspaces_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workspaces_legal_entity_id_fkey"
            columns: ["legal_entity_id"]
            isOneToOne: false
            referencedRelation: "legal_entities"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_manage_workspace: { Args: { _ws: string }; Returns: boolean }
      consume_credits: {
        Args: {
          _app_id: string
          _idempotency_key: string
          _meter_id: string
          _quantity: number
          _reference: Json
          _workspace_id: string
        }
        Returns: {
          account_id: string
          app_id: string | null
          billed_cents: number
          created_at: string
          id: string
          idempotency_key: string | null
          markup_rate: number
          meter_id: string
          quantity: number
          reference: Json | null
          unit_cost_cents: number
          workspace_id: string
        }
        SetofOptions: {
          from: "*"
          to: "credit_ledger"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      has_account_access: { Args: { _acct: string }; Returns: boolean }
      has_entity_access: { Args: { _le: string }; Returns: boolean }
      has_workspace_access: { Args: { _ws: string }; Returns: boolean }
      is_staff: { Args: { _uid: string }; Returns: boolean }
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
