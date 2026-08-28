/**
 * Every change to a financial or structural record is attributable to a person
 * and a time. This is what lets day-to-day entry be delegated without losing
 * control of the records.
 */
export async function writeAudit(client, { userId, action, entity, entityId, before, after }) {
  try {
    await client.auditLog.create({
      data: {
        userId: userId ?? null,
        action,
        entity,
        entityId: entityId ?? null,
        before: before ?? undefined,
        after: after ?? undefined,
      },
    });
  } catch (err) {
    // An audit failure must never roll back the user's actual work.
    console.error('audit write failed', action, entity, err?.message);
  }
}
