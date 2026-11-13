import type { BackupFile } from '../domain/types'

/**
 * Future cloud sync (Phase 2+). Phase 1 does not implement this and does not
 * open a network connection. Records already carry ids and timestamps so a
 * later adapter can be added without changing the stored shape.
 */
export interface SyncAdapter {
  readonly name: string
  push(backup: BackupFile): Promise<void>
  pull(sinceIso: string): Promise<BackupFile | null>
}
