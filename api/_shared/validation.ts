import { z } from 'zod';

// Subscription push — formato W3C
const PushSubscriptionSchema = z.object({
  endpoint: z.string().url().max(2048),
  expirationTime: z.number().nullable().optional(),
  keys: z.object({
    p256dh: z.string().min(1).max(512),
    auth: z.string().min(1).max(64)
  })
});

// salvar-subscription
export const SalvarSubscriptionInputSchema = z.object({
  tipo: z.enum(['rega', 'sol', 'adubo']),
  subscription: PushSubscriptionSchema,
  timestamp: z.string().datetime(),
  dataDisparoCustom: z.string().datetime().optional()
}).refine(
  (data) => {
    if (!data.dataDisparoCustom) return true;
    const custom = new Date(data.dataDisparoCustom);
    const now = new Date();
    const oneYearFromNow = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
    return custom > now && custom < oneYearFromNow;
  },
  { message: 'dataDisparoCustom deve estar entre agora e 1 ano no futuro' }
);

export type SalvarSubscriptionInput = z.infer<typeof SalvarSubscriptionInputSchema>;

// sync-events
const SyncEventSchema = z.object({
  id: z.string().min(1).max(128),
  type: z.enum(['care_registered', 'care_deleted', 'reminder_created', 'reminder_deleted']),
  payload: z.record(z.string(), z.unknown()),
  idempotencyKey: z.string().min(1).max(256)
});

export const SyncEventsInputSchema = z.object({
  events: z.array(SyncEventSchema).min(1).max(100)
});

export type SyncEvent = z.infer<typeof SyncEventSchema>;
export type SyncEventsInput = z.infer<typeof SyncEventsInputSchema>;

// Helper: rejeita input com 400 + erro estruturado
export function parseOrReject<T>(
  schema: z.ZodType<T>,
  data: unknown
): { ok: true; data: T } | { ok: false; response: { error: string; details: z.ZodError } } {
  const result = schema.safeParse(data);
  if (result.success) return { ok: true, data: result.data };
  return {
    ok: false,
    response: {
      error: 'Dados inválidos',
      details: result.error
    }
  };
}
