import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { apiError, assertWorkspaceScope, authenticateCaller, getAdmin, json } from "@/lib/core/api.server";

const upsertSchema = z.object({
  workspace_id: z.string().uuid(),
  first_name: z.string().max(120).optional(),
  last_name: z.string().max(120).optional(),
  company: z.string().max(200).optional(),
  timezone: z.string().max(60).optional(),
  mailing_address: z.record(z.string(), z.unknown()).optional(),
  phone: z.string().max(20).optional(),
  email: z.string().email().max(320).optional(),
});

export const Route = createFileRoute("/api/public/v1/contacts")({
  server: {
    handlers: {
      /** Upsert by phone/email inside the legal entity, returns the canonical contact. */
      POST: async ({ request }) => {
        const db = await getAdmin();
        const caller = await authenticateCaller(request, db);
        if (!caller) return apiError("unauthorized", 401);

        const parsed = upsertSchema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return apiError("invalid_request", 400, { issues: parsed.error.issues });
        const input = parsed.data;
        if (!input.phone && !input.email) return apiError("identifier_required", 400);

        const scope = await assertWorkspaceScope(db, caller, input.workspace_id);
        if (!scope) return apiError("forbidden", 403);
        const le = scope.legalEntityId;

        let contactId: string | null = null;
        if (input.phone) {
          const { data } = await db
            .from("contact_phones")
            .select("contact_id")
            .eq("legal_entity_id", le)
            .eq("e164", input.phone)
            .maybeSingle();
          contactId = (data?.contact_id as string) ?? null;
        }
        if (!contactId && input.email) {
          const { data } = await db
            .from("contact_emails")
            .select("contact_id")
            .eq("legal_entity_id", le)
            .eq("email", input.email)
            .maybeSingle();
          contactId = (data?.contact_id as string) ?? null;
        }

        const fields = {
          first_name: input.first_name ?? null,
          last_name: input.last_name ?? null,
          company: input.company ?? null,
          timezone: input.timezone ?? null,
          mailing_address: input.mailing_address ?? null,
        };

        if (contactId) {
          await db
            .from("contacts")
            .update({
              ...Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== null)),
              updated_at: new Date().toISOString(),
            })
            .eq("id", contactId);
        } else {
          const { data, error } = await db
            .from("contacts")
            .insert({ legal_entity_id: le, ...fields })
            .select("id")
            .single();
          if (error) return apiError("contact_create_failed", 500, { detail: error.message });
          contactId = data.id as string;
        }

        if (input.phone) {
          await db
            .from("contact_phones")
            .upsert(
              { contact_id: contactId, legal_entity_id: le, e164: input.phone },
              { onConflict: "legal_entity_id,e164,contact_id" },
            );
        }
        if (input.email) {
          await db
            .from("contact_emails")
            .upsert(
              { contact_id: contactId, legal_entity_id: le, email: input.email },
              { onConflict: "legal_entity_id,email,contact_id" },
            );
        }

        const { data: contact } = await db
          .from("contacts")
          .select("*, contact_phones(*), contact_emails(*)")
          .eq("id", contactId)
          .single();

        return json({ contact });
      },

      /** Search within the caller's workspace legal entity. */
      GET: async ({ request }) => {
        const db = await getAdmin();
        const caller = await authenticateCaller(request, db);
        if (!caller) return apiError("unauthorized", 401);

        const url = new URL(request.url);
        const workspaceId = url.searchParams.get("workspace_id") ?? "";
        if (!z.string().uuid().safeParse(workspaceId).success)
          return apiError("workspace_id_required", 400);
        const scope = await assertWorkspaceScope(db, caller, workspaceId);
        if (!scope) return apiError("forbidden", 403);

        const phone = url.searchParams.get("phone");
        const email = url.searchParams.get("email");
        const q = url.searchParams.get("q");

        if (phone) {
          const { data } = await db
            .from("contact_phones")
            .select("contact_id, contacts(*)")
            .eq("legal_entity_id", scope.legalEntityId)
            .eq("e164", phone);
          return json({ contacts: (data ?? []).map((r) => r.contacts) });
        }
        if (email) {
          const { data } = await db
            .from("contact_emails")
            .select("contact_id, contacts(*)")
            .eq("legal_entity_id", scope.legalEntityId)
            .eq("email", email);
          return json({ contacts: (data ?? []).map((r) => r.contacts) });
        }

        let query = db
          .from("contacts")
          .select("*")
          .eq("legal_entity_id", scope.legalEntityId)
          .order("updated_at", { ascending: false })
          .limit(50);
        if (q) {
          // Commas, parens and wildcards would otherwise break out of the filter grammar.
          const safe = q.replace(/[,()%\\*]/g, " ").trim();
          if (safe)
            query = query.or(
              `first_name.ilike.%${safe}%,last_name.ilike.%${safe}%,company.ilike.%${safe}%`,
            );
        }
        const { data } = await query;
        return json({ contacts: data ?? [] });
      },
    },
  },
});
