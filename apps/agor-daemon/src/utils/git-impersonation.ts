/**
 * Git Impersonation Utilities
 *
 * Shared helper for resolving Unix user impersonation for git operations.
 * Used by both repos and worktrees services to ensure consistent behavior.
 */

import type { Database } from '@agor/core/db';
import type { UserID, Worktree } from '@agor/core/types';
import {
  resolveUnixUserForImpersonation,
  type UnixUserMode,
  validateResolvedUnixUser,
} from '@agor/core/unix';

/**
 * Resolve Unix user for git operations based on impersonation mode
 *
 * Uses the same logic as prompt executor:
 * - simple mode: no impersonation (daemon user)
 * - insulated mode: executor_unix_user from config
 * - strict mode: user's unix_username
 *
 * @param db - Database instance for user lookup
 * @param userId - User ID to resolve impersonation for
 * @returns Unix username to impersonate, or undefined for no impersonation
 */
export async function resolveGitImpersonationForUser(
  db: Database,
  userId: UserID
): Promise<string | undefined> {
  const { loadConfig } = await import('@agor/core/config');
  const { UsersRepository } = await import('@agor/core/db');

  const config = await loadConfig();
  const unixUserMode = (config.execution?.unix_user_mode ?? 'simple') as UnixUserMode;
  const configExecutorUser = config.execution?.executor_unix_user;

  // For git operations, use the requesting user's unix_username
  const usersRepo = new UsersRepository(db);
  const user = await usersRepo.findById(userId);
  const userUnixUsername = user?.unix_username;

  // Use centralized impersonation resolution logic
  const impersonationResult = resolveUnixUserForImpersonation({
    mode: unixUserMode,
    userUnixUsername,
    executorUnixUser: configExecutorUser,
  });

  const asUser = impersonationResult.unixUser ?? undefined;

  // Validate Unix user exists for modes that require it
  if (asUser) {
    validateResolvedUnixUser(unixUserMode, asUser);
  }

  return asUser;
}

/**
 * Resolve Unix user for git operations on a worktree
 *
 * Uses the worktree creator's unix_username for impersonation.
 *
 * @param db - Database instance for user lookup
 * @param worktree - Worktree to resolve user for
 * @returns Unix username to impersonate, or undefined for no impersonation
 */
export async function resolveGitImpersonationForWorktree(
  db: Database,
  worktree: Worktree
): Promise<string | undefined> {
  return resolveGitImpersonationForUser(db, worktree.created_by);
}
