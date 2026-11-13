import { systemClock, type Clock } from '../domain/clock'
import { migrateBackup } from '../domain/migrate'
import { seedDatabase } from '../domain/seed'
import { APP_ID, SCHEMA_VERSION, type BackupFile } from '../domain/types'
import { AfiDatabase, cloneData } from './db'
import type { Repository } from './repository'

export class DexieRepository implements Repository {
  private opened = false

  constructor(private readonly db = new AfiDatabase()) {}

  async ready(clock: Clock = systemClock): Promise<void> {
    if (!this.opened) {
      await this.db.open()
      this.opened = true
    }
    const settings = await this.db.settings.get('settings')
    if (!settings) await seedDatabase(this, clock)
  }

  async getSettings() {
    const settings = await this.db.settings.get('settings')
    if (!settings) throw new Error('Settings are not ready')
    return cloneData(settings)
  }

  async saveSettings(settings: BackupFile['settings']) {
    await this.db.settings.put(cloneData({ ...settings, id: 'settings', units: 'lb' }))
  }

  async listExercises() {
    return cloneData(await this.db.exercises.toArray())
  }

  async getExercise(id: string) {
    const exercise = await this.db.exercises.get(id)
    return exercise ? cloneData(exercise) : undefined
  }

  async saveExercise(exercise: BackupFile['exercises'][number]) {
    await this.db.exercises.put(cloneData(exercise))
  }

  async listTemplates() {
    const templates = await this.db.templates.toArray()
    return cloneData(templates).sort((a, b) => a.name.localeCompare(b.name))
  }

  async getTemplate(id: string) {
    const template = await this.db.templates.get(id)
    return template ? cloneData(template) : undefined
  }

  async saveTemplate(template: BackupFile['templates'][number]) {
    await this.db.templates.put(cloneData(template))
  }

  async listVersions(templateId?: string) {
    const rows = templateId
      ? await this.db.templateVersions.where('templateId').equals(templateId).toArray()
      : await this.db.templateVersions.toArray()
    return cloneData(rows).sort((a, b) => a.version - b.version)
  }

  async getVersion(id: string) {
    const version = await this.db.templateVersions.get(id)
    return version ? cloneData(version) : undefined
  }

  async saveVersion(version: BackupFile['templateVersions'][number]) {
    const existing = await this.db.templateVersions.get(version.id)
    if (existing) throw new Error('Template versions are immutable')
    await this.db.templateVersions.put(cloneData(version))
  }

  async listSessions() {
    return cloneData(await this.db.sessions.toArray())
  }

  async getSession(id: string) {
    const session = await this.db.sessions.get(id)
    return session ? cloneData(session) : undefined
  }

  async saveSession(session: BackupFile['sessions'][number]) {
    const existing = await this.db.sessions.get(session.id)
    if (existing && existing.status !== 'in_progress') {
      throw new Error('Finished sessions are immutable')
    }
    await this.db.sessions.put(cloneData(session))
  }

  async getProgression(exerciseId: string) {
    const state = await this.db.progression.get(exerciseId)
    return state ? cloneData(state) : undefined
  }

  async listProgression() {
    return cloneData(await this.db.progression.toArray())
  }

  async saveProgression(state: BackupFile['progression'][number]) {
    await this.db.progression.put(cloneData(state))
  }

  async getWarmupDefaults() {
    const warmup = await this.db.warmup.get('warmup')
    if (!warmup) throw new Error('Warm-up defaults are not ready')
    return cloneData(warmup)
  }

  async saveWarmupDefaults(warmup: BackupFile['warmupDefaults']) {
    await this.db.warmup.put(cloneData({ ...warmup, id: 'warmup' }))
  }

  async exportAll(exportedAt: string): Promise<BackupFile> {
    return {
      app: APP_ID,
      schemaVersion: SCHEMA_VERSION,
      exportedAt,
      exercises: await this.listExercises(),
      templates: await this.listTemplates(),
      templateVersions: await this.listVersions(),
      sessions: await this.listSessions(),
      progression: await this.listProgression(),
      settings: await this.getSettings(),
      warmupDefaults: await this.getWarmupDefaults(),
    }
  }

  async importAll(raw: unknown): Promise<void> {
    const backup = migrateBackup(raw)
    await this.db.transaction(
      'rw',
      [
        this.db.exercises,
        this.db.templates,
        this.db.templateVersions,
        this.db.sessions,
        this.db.progression,
        this.db.settings,
        this.db.warmup,
      ],
      async () => {
        await this.db.exercises.clear()
        await this.db.templates.clear()
        await this.db.templateVersions.clear()
        await this.db.sessions.clear()
        await this.db.progression.clear()
        await this.db.settings.clear()
        await this.db.warmup.clear()
        if (backup.exercises.length) await this.db.exercises.bulkPut(cloneData(backup.exercises))
        if (backup.templates.length) await this.db.templates.bulkPut(cloneData(backup.templates))
        if (backup.templateVersions.length) await this.db.templateVersions.bulkPut(cloneData(backup.templateVersions))
        if (backup.sessions.length) await this.db.sessions.bulkPut(cloneData(backup.sessions))
        if (backup.progression.length) await this.db.progression.bulkPut(cloneData(backup.progression))
        await this.db.settings.put(cloneData(backup.settings))
        await this.db.warmup.put(cloneData(backup.warmupDefaults))
      },
    )
  }

  async close(): Promise<void> {
    this.db.close()
  }

  async delete(): Promise<void> {
    await this.db.delete()
    this.opened = false
  }
}
