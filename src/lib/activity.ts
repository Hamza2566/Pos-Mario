import { supabase } from '@/lib/supabase'

export async function logActivity(
  action: string,
  entityType: string | null,
  entityId: string | null,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  const { error } = await supabase.rpc('log_activity', {
    p_action: action,
    p_entity_type: entityType,
    p_entity_id: entityId,
    p_metadata: metadata,
  })
  if (error) {
    console.error('[activity]', error.message)
  }
}
