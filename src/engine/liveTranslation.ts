import { Capacitor, registerPlugin } from '@capacitor/core'
import type { Language } from '../i18n'
import { englishSourceFor, isManualTranslation } from '../i18n'

interface TranslationBridge {
  prepare(options: { language: Language }): Promise<void>
  translateBatch(options: { texts: string[] }): Promise<{ texts: string[] }>
}
const bridge = registerPlugin<TranslationBridge>('KickoffTranslation')
const sourceRecords = new WeakMap<Text, { source: string; rendered: string; language: Language }>()
export const supportsLiveTranslation = () => Capacitor.getPlatform() === 'android'
export async function prepareTranslation(language: Language) {
  if (!supportsLiveTranslation() || language === 'en') return
  await bridge.prepare({ language })
}

// Translate only visible text. The source text stays outside career saves and
// is restored on language changes; React remains the owner of all game data.
export function observeTranslation(root: HTMLElement, language: Language) {
  if (!supportsLiveTranslation() || language === 'en') return () => {}
  const cache = new Map<string, string>()
  const touched = new Set<Text>()
  let closed = false
  let timer: ReturnType<typeof setTimeout> | undefined
  let busy = false
  const inFlight = new Set<string>()
  const queue = new Map<string, Set<Text>>()

  function apply(node: Text, source: string, output: string) {
    if (closed || !node.isConnected) return
    const record = sourceRecords.get(node)
    if (!record || record.source !== source || (node.data !== record.rendered && node.data.trim() !== source.trim())) return
    const prefix = source.match(/^\s*/)?.[0] ?? ''
    const suffix = source.match(/\s*$/)?.[0] ?? ''
    const next = prefix + output.trim() + suffix
    record.rendered = next
    record.language = language
    node.data = next
  }

  async function flush() {
    if (busy || closed || queue.size === 0) return
    busy = true
    while (!closed && queue.size) {
      const batch = [...queue.entries()].slice(0, 30)
      for (const [source] of batch) queue.delete(source)
      for (const [source] of batch) inFlight.add(source)
      try {
        const { texts } = await bridge.translateBatch({ texts: batch.map(([source]) => source.trim()) })
        batch.forEach(([source, nodes], i) => {
          const output = texts[i] || source
          cache.set(source, output)
          nodes.forEach(node => apply(node, source, output))
        })
      } catch (error) {
        console.warn('[kickoff-star] translation unavailable', error)
        batch.forEach(([source, nodes]) => {
          cache.set(source, source)
          nodes.forEach(node => apply(node, source, source))
        })
        queue.clear()
      }
      for (const [source] of batch) inFlight.delete(source)
    }
    busy = false
    if (!closed) scan()
  }

  function scan() {
    if (closed) return
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
    let node: Node | null
    while ((node = walker.nextNode())) {
      const text = node as Text
      const parent = text.parentElement
      if (!parent || parent.closest('script,style,noscript,textarea,select,[data-no-translate]')) continue
      const current = text.data
      const old = sourceRecords.get(text)
      if (old?.rendered === current && old.language === language) continue
      const source = old?.rendered === current ? old.source : englishSourceFor(current)
      sourceRecords.set(text, { source, rendered: current, language: 'en' })
      touched.add(text)
      const trimmed = source.trim()
      if (trimmed.length < 3 || trimmed.length > 1800 || !/[a-zA-Z]{2}/.test(trimmed) || isManualTranslation(trimmed) || trimmed === 'KICKOFF STAR') {
        sourceRecords.get(text)!.language = language
        continue
      }
      const cached = cache.get(source)
      if (cached) { apply(text, source, cached); continue }
      if (inFlight.has(source)) continue
      const nodes = queue.get(source) ?? new Set<Text>()
      nodes.add(text)
      queue.set(source, nodes)
    }
    void flush()
  }
  const observer = new MutationObserver(() => {
    clearTimeout(timer)
    timer = setTimeout(scan, 90)
  })
  observer.observe(root, { subtree: true, childList: true, characterData: true })
  scan()
  return () => {
    closed = true
    clearTimeout(timer)
    observer.disconnect()
    touched.forEach(node => {
      const record = sourceRecords.get(node)
      if (record && node.isConnected && record.rendered === node.data && record.language === language) node.data = record.source
    })
  }
}
