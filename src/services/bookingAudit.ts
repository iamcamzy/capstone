import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "../lib/database.types";
import { supabaseAdmin, supabase } from "../lib/supabase";

type DbClient = SupabaseClient<Database>;

export type BookingAuditActorType = "admin" | "staff" | "customer" | "system";

export type BookingAuditInput = {
  bookingId: string;
  actorId?: string | null;
  actorType: BookingAuditActorType;
  action: string;
  fromStatus?: string | null;
  toStatus?: string | null;
  reason?: string | null;
  metadata?: Json;
};

const db = supabaseAdmin ?? supabase;

export async function logBookingAudit(
  input: BookingAuditInput,
  client: DbClient = db,
): Promise<void> {
  const { error } = await client.from("booking_audit_log").insert({
    booking_id: input.bookingId,
    actor_id: input.actorId ?? null,
    actor_type: input.actorType,
    action: input.action,
    from_status: input.fromStatus ?? null,
    to_status: input.toStatus ?? null,
    reason: input.reason ?? null,
    metadata: input.metadata ?? {},
  });

  if (error) {
    console.error("[BookingAudit]", error.message);
  }
}
