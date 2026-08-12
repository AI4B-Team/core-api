/** Shared staff guard for admin server functions. */
export async function assertStaff(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: isStaff } = await supabaseAdmin.rpc("is_staff", { _uid: userId });
  if (!isStaff) throw new Error("Forbidden: staff access required");
  return supabaseAdmin;
}
