/**
 * Pure permission resolution. No DB calls. The API layer fetches the document
 * and (optionally) shares, then asks these functions whether the current user
 * may perform the action. Keeps the rules testable in isolation.
 */

export type DocLike = { ownerId: string };
export type ShareLike = { documentId: string; userId: string };
export type Actor = { id: string };

export function isOwner(actor: Actor, doc: DocLike): boolean {
  return actor.id === doc.ownerId;
}

export function isShared(actor: Actor, docId: string, shares: readonly ShareLike[]): boolean {
  return shares.some((s) => s.documentId === docId && s.userId === actor.id);
}

export function canRead(
  actor: Actor,
  doc: DocLike & { id: string },
  shares: readonly ShareLike[]
): boolean {
  return isOwner(actor, doc) || isShared(actor, doc.id, shares);
}

export function canEdit(
  actor: Actor,
  doc: DocLike & { id: string },
  shares: readonly ShareLike[]
): boolean {
  return isOwner(actor, doc) || isShared(actor, doc.id, shares);
}

export function canManageShares(actor: Actor, doc: DocLike): boolean {
  return isOwner(actor, doc);
}

export function canDelete(actor: Actor, doc: DocLike): boolean {
  return isOwner(actor, doc);
}
