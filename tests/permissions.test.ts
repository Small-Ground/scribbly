import { describe, expect, it } from 'vitest';
import {
  canDelete,
  canEdit,
  canManageShares,
  canRead,
  isOwner,
  isShared
} from '../src/lib/server/permissions';

const ALICE = { id: 'a-1' };
const BOB = { id: 'b-2' };
const CAROL = { id: 'c-3' };
const DAN = { id: 'd-4' };

const DOC = { id: 'doc-1', ownerId: ALICE.id };

describe('isOwner', () => {
  it('returns true for the owner and false otherwise', () => {
    expect(isOwner(ALICE, DOC)).toBe(true);
    expect(isOwner(BOB, DOC)).toBe(false);
  });
});

describe('isShared', () => {
  it('checks document/user pair against the share list', () => {
    const shares = [{ documentId: DOC.id, userId: BOB.id }];
    expect(isShared(BOB, DOC.id, shares)).toBe(true);
    expect(isShared(CAROL, DOC.id, shares)).toBe(false);
  });

  it('does not match shares for different documents', () => {
    const shares = [{ documentId: 'other', userId: BOB.id }];
    expect(isShared(BOB, DOC.id, shares)).toBe(false);
  });
});

describe('canRead / canEdit', () => {
  const shares = [{ documentId: DOC.id, userId: BOB.id }];

  it('allows the owner', () => {
    expect(canRead(ALICE, DOC, shares)).toBe(true);
    expect(canEdit(ALICE, DOC, shares)).toBe(true);
  });

  it('allows a user the document is shared with', () => {
    expect(canRead(BOB, DOC, shares)).toBe(true);
    expect(canEdit(BOB, DOC, shares)).toBe(true);
  });

  it('denies an unrelated user', () => {
    expect(canRead(CAROL, DOC, shares)).toBe(false);
    expect(canEdit(CAROL, DOC, shares)).toBe(false);
  });

  it('honours share removal: empty list -> only owner has access', () => {
    expect(canRead(BOB, DOC, [])).toBe(false);
    expect(canEdit(BOB, DOC, [])).toBe(false);
    expect(canRead(ALICE, DOC, [])).toBe(true);
  });

  it('does not leak access to other documents', () => {
    const otherDoc = { id: 'doc-2', ownerId: ALICE.id };
    expect(canRead(BOB, otherDoc, shares)).toBe(false);
  });
});

describe('canManageShares / canDelete', () => {
  it('owner-only', () => {
    expect(canManageShares(ALICE, DOC)).toBe(true);
    expect(canDelete(ALICE, DOC)).toBe(true);
  });

  it('shared user cannot manage shares or delete', () => {
    expect(canManageShares(BOB, DOC)).toBe(false);
    expect(canDelete(BOB, DOC)).toBe(false);
  });

  it('stranger cannot manage or delete', () => {
    expect(canManageShares(DAN, DOC)).toBe(false);
    expect(canDelete(DAN, DOC)).toBe(false);
  });
});

describe('access matrix (full sweep)', () => {
  // The README claims this exact behavior — pin it down with one matrix test
  // so behavioral regressions are loud.
  const shares = [{ documentId: DOC.id, userId: BOB.id }];
  const cases: Array<[string, { id: string }, boolean, boolean, boolean]> = [
    // [role,             actor, canRead, canEdit, canManageShares]
    ['owner', ALICE, true, true, true],
    ['shared (Bob)', BOB, true, true, false],
    ['stranger (Carol)', CAROL, false, false, false]
  ];
  for (const [role, actor, read, edit, manage] of cases) {
    it(`role=${role}`, () => {
      expect(canRead(actor, DOC, shares)).toBe(read);
      expect(canEdit(actor, DOC, shares)).toBe(edit);
      expect(canManageShares(actor, DOC)).toBe(manage);
    });
  }
});
