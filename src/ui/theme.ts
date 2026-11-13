import type { Theme } from '../domain/types'

export function applyTheme(theme: Theme): void {
  if (theme === 'system') delete document.documentElement.dataset.theme
  else document.documentElement.dataset.theme = theme
  try {
    localStorage.setItem('afi-theme', theme)
  } catch {
    /* theme still applies for this visit */
  }
}
