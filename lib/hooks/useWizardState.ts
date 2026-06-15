'use client'

import { useCallback } from 'react'
import type { WizardDraft } from '@/lib/types/wizard'

export type { WizardDraft } from '@/lib/types/wizard'

const STORAGE_KEY = 'dsmvp_wizard_draft'

const EMPTY_DRAFT: WizardDraft = {
  disaster_type: 'heatwave',
  institution_id: null,
  institution_name: null,
  has_shuttle: false,
  disaster_message_id: null,
  disaster_message_text: '',
  disaster_message_source: 'sample',
  disaster_message_issued_at: null,
  selected_situations: [],
  situation_etc: '',
  role: null,
}

function load(): WizardDraft {
  if (typeof window === 'undefined') return { ...EMPTY_DRAFT }
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    return raw ? { ...EMPTY_DRAFT, ...JSON.parse(raw) } : { ...EMPTY_DRAFT }
  } catch {
    return { ...EMPTY_DRAFT }
  }
}

function save(draft: Partial<WizardDraft>) {
  if (typeof window === 'undefined') return
  const current = load()
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ ...current, ...draft }))
}

function clear() {
  if (typeof window === 'undefined') return
  sessionStorage.removeItem(STORAGE_KEY)
}

export const wizardDraft = { load, save, clear }

export function useWizardState() {
  const get = useCallback(load, [])
  const update = useCallback((patch: Partial<WizardDraft>) => save(patch), [])
  const reset = useCallback(clear, [])
  return { get, update, reset }
}
