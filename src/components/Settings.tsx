/**
 * Settings.
 *
 * The only place a key is ever entered. It is stored in this browser's localStorage
 * and sent nowhere except to the provider you picked — or to this app's own relay if
 * that provider blocks direct browser calls.
 */

import { useEffect, useState } from 'react'
import { PROVIDERS, PROVIDER_ORDER, listModels, pickDefaultModel } from '../lib/ai/providers'
import { probeProvider, type AISettings } from '../lib/ai/client'
import { DEFAULT_PERSONA, type Persona } from '../lib/prompts'
import { LANGUAGES, store, useStore } from '../lib/store'
import type { ModelInfo, ProviderId, RunMode } from '../lib/ai/types'
import { cx, download } from '../lib/utils'
import { Badge, Button, Card, Chip, Field, Icon, SectionTitle, Select, Spinner, Toast, Toggle, useToast } from './ui'
import { useSpeaker, speech } from '../lib/speech'

export function Settings() {
  const app = useStore()
  const toast = useToast()
  const speaker = useSpeaker()

  const [provider, setProvider] = useState<ProviderId>(app.settings.provider)
  const [apiKey, setApiKey] = useState(app.settings.apiKey)
  const [baseUrl, setBaseUrl] = useState(app.settings.baseUrl ?? '')
  const [model, setModel] = useState(app.settings.model)
  const [runMode, setRunMode] = useState<RunMode>(app.settings.runMode)
  const [webSearch, setWebSearch] = useState(app.settings.webSearch)
  const [selfHeal, setSelfHeal] = useState(app.settings.selfHeal)
  const [temperature, setTemperature] = useState(app.settings.temperature)

  const [models, setModels] = useState<ModelInfo[]>([])
  const [detecting, setDetecting] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string; hint?: string; latency?: number } | null>(null)
  const [health, setHealth] = useState<{ ok: boolean; mode: string } | null>(null)

  const [youtubeKey, setYoutubeKey] = useState(app.youtubeKey)
  const [skill, setSkill] = useState<Persona['skill']>(app.persona.skill)
  const [units, setUnits] = useState<Persona['units']>(app.persona.units)
  const [constraints, setConstraints] = useState(app.persona.constraints.join('\n'))
  const [newConstraint, setNewConstraint] = useState('')

  const meta = PROVIDERS[provider]

  useEffect(() => {
    fetch('/api/health')
      .then((r) => r.json())
      .then((j) => setHealth({ ok: Boolean(j.ok), mode: j.mode }))
      .catch(() => setHealth(null))
  }, [])

  const currentSettings: AISettings = {
    ...app.settings,
    provider,
    apiKey,
    baseUrl: baseUrl || undefined,
    model,
    runMode,
    webSearch,
    selfHeal,
    temperature,
  }

  const save = () => {
    store.set({
      settings: currentSettings,
      youtubeKey: youtubeKey.trim(),
      persona: {
        ...app.persona,
        skill,
        units,
        constraints: constraints
          .split('\n')
          .map((c) => c.trim())
          .filter(Boolean),
        languages: [app.voice.language],
      },
    })
    toast.show('Settings saved')
  }

  const detect = async (opts: { silent?: boolean } = {}) => {
    setDetecting(true)
    setTestResult(null)
    try {
      let found: ModelInfo[] = []
      try {
        found = await listModels({ provider, apiKey, baseUrl: baseUrl || undefined })
      } catch (directErr) {
        // Providers that block cross-origin calls still work through the relay.
        const res = await fetch('/api/models', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ provider, apiKey, baseUrl: baseUrl || undefined }),
        })
        const j = await res.json()
        if (!res.ok) throw new Error(j?.error?.message ?? (directErr as Error).message)
        found = j.models ?? []
      }
      setModels(found)
      if (!found.length) {
        if (!opts.silent) toast.show('No compatible models found on that key.')
        return
      }
      const best = pickDefaultModel(provider, found)
      if (!model || !found.some((m) => m.id === model)) setModel(best)
      if (!opts.silent) toast.show(`Found ${found.length} usable model${found.length === 1 ? '' : 's'}`)
    } catch (err) {
      if (!opts.silent) setTestResult({ ok: false, message: err instanceof Error ? err.message : 'Model detection failed.' })
    } finally {
      setDetecting(false)
    }
  }

  const test = async () => {
    setTesting(true)
    setTestResult(null)
    const chosen = model || PROVIDERS[provider].defaultBaseUrl
    const result = await probeProvider({ provider, apiKey, model: chosen, baseUrl: baseUrl || undefined, runMode })
    setTestResult({ ok: result.ok, message: result.message, hint: result.hint, latency: result.latencyMs })
    if (result.ok) save()
    setTesting(false)
  }

  const isOpenAICompatible = meta.openAICompatible

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 pb-8 pt-5">
      <header>
        <h1 className="text-[22px] font-bold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-ink-300">
          Bring your own AI key. It is stored in this browser only, and used only for your own requests.
        </p>
      </header>

      {/* Status */}
      <Card className="flex flex-wrap items-center gap-2.5">
        <Badge tone={app.settings.apiKey || provider === 'ollama' ? 'good' : 'warn'}>
          <span className={cx('h-1.5 w-1.5 rounded-full', app.settings.apiKey ? 'bg-emerald-400' : 'bg-amber-400')} />
          {app.settings.apiKey || provider === 'ollama' ? `Live AI: ${PROVIDERS[app.settings.provider].label}` : 'Demo engine'}
        </Badge>
        {app.settings.model && <Badge tone="neutral">{app.settings.model}</Badge>}
        {health && <Badge tone="info">server {health.mode}</Badge>}
        <span className="ml-auto text-[11px] text-ink-400">
          {app.stats.analyses} analyses · {app.stats.stepsCompleted} steps completed
        </span>
      </Card>

      {/* Provider */}
      <Card>
        <SectionTitle
          icon={<Icon.Sparkle size={15} />}
          title="AI provider"
          subtitle="Gemini has the most generous free tier and needs no credit card"
        />

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {PROVIDER_ORDER.map((id) => {
            const p = PROVIDERS[id]
            return (
              <button
                key={id}
                onClick={() => {
                  setProvider(id)
                  setModels([])
                  setTestResult(null)
                  setBaseUrl(id === app.settings.provider ? app.settings.baseUrl ?? '' : '')
                  setModel('')
                  const preferred = pickDefaultModel(id, [])
                  setModel(preferred || (id === 'ollama' ? 'llama3.2-vision' : ''))
                }}
                className={cx(
                  'rounded-xl border p-2.5 text-left transition',
                  provider === id ? 'border-brand-400/50 bg-brand-400/10' : 'border-white/8 bg-white/4 hover:bg-white/8',
                )}
              >
                <span className="block text-xs font-semibold">{p.label}</span>
                {p.freeTier && <span className="mt-0.5 block text-[10px] leading-snug text-emerald-300/80">free tier</span>}
              </button>
            )
          })}
        </div>

        <div className="mt-3 space-y-1.5 rounded-xl border border-white/8 bg-white/4 p-3">
          <p className="text-xs text-ink-200">{meta.label}</p>
          <p className="text-[11px] leading-relaxed text-ink-400">{meta.keyHint}</p>
          {meta.freeTier && <p className="text-[11px] leading-relaxed text-emerald-300/85">{meta.freeTier}</p>}
          {meta.docsUrl && (
            <a href={meta.docsUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-brand-300 hover:text-brand-200">
              Get a key <Icon.ArrowRight size={12} />
            </a>
          )}
        </div>

        <div className="mt-3 space-y-3">
          {meta.needsKey && (
            <Field
              label="API key"
              value={apiKey}
              onChange={setApiKey}
              placeholder={provider === 'gemini' ? 'AIza…' : provider === 'anthropic' ? 'sk-ant-…' : 'sk-…'}
              secret
              mono
              hint="Stored in this browser only. Never sent to us."
            />
          )}

          {(isOpenAICompatible || baseUrl) && (
            <Field
              label="Base URL"
              value={baseUrl}
              onChange={setBaseUrl}
              placeholder={meta.defaultBaseUrl || 'https://your-host/v1'}
              mono
              hint={provider === 'ollama' ? 'Where Ollama is running on your machine.' : 'Override for a proxy or self-hosted gateway.'}
            />
          )}

          <div>
            <span className="label">Model</span>
            <div className="flex gap-2">
              {models.length > 0 ? (
                <select className="field flex-1 appearance-none" value={model} onChange={(e) => setModel(e.target.value)}>
                  {models.map((m) => (
                    <option key={m.id} value={m.id} className="bg-ink-850">
                      {m.label} {m.vision ? '· vision' : '· no vision'}
                    </option>
                  ))}
                </select>
              ) : (
                <input className="field flex-1 font-mono text-xs" value={model} onChange={(e) => setModel(e.target.value)} placeholder="Detect models, or type one" />
              )}
              <Button onClick={() => void detect()} disabled={detecting || (!apiKey && meta.needsKey)} className="shrink-0">
                {detecting ? <Spinner /> : <Icon.Search size={15} />} Detect
              </Button>
            </div>
            <p className="mt-1 text-[11px] leading-snug text-ink-400">
              “Detect” asks the provider which models your key can actually use, so you never pick one that gets rejected.
              Vision models are marked — those are the ones that can see your photos.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="primary" onClick={() => void test()} disabled={testing || (!apiKey && meta.needsKey)}>
              {testing ? <Spinner /> : <Icon.Check size={15} />} Test connection
            </Button>
            <Button onClick={save}>
              <Icon.Bookmark size={15} /> Save
            </Button>
          </div>

          {testResult && (
            <div
              className={cx(
                'rounded-xl border px-3.5 py-2.5 text-xs leading-relaxed',
                testResult.ok ? 'border-emerald-500/30 bg-emerald-500/8 text-emerald-100' : 'border-rose-500/30 bg-rose-500/8 text-rose-100',
              )}
            >
              <p className="font-semibold">
                {testResult.ok ? '✓ ' : '✕ '}
                {testResult.message}
                {testResult.latency ? <span className="ml-1.5 font-normal opacity-70">({testResult.latency} ms)</span> : null}
              </p>
              {testResult.hint && <p className="mt-1 opacity-85">{testResult.hint}</p>}
            </div>
          )}

          <Select
            label="How requests are sent"
            value={runMode}
            onChange={(v) => setRunMode(v as RunMode)}
            options={[
              { value: 'direct', label: 'Direct from my browser (recommended)' },
              { value: 'server', label: 'Through this app’s relay' },
            ]}
            hint="Direct keeps your key on your device. The relay is a fallback for providers that block browser calls — if one route fails, the app tries the other automatically."
          />

          <Toggle
            checked={webSearch}
            onChange={setWebSearch}
            label="Let the model search the web"
            hint="Gives live, grounded answers where the provider supports it. Turn off for faster, cheaper replies."
          />
          <Toggle
            checked={selfHeal}
            onChange={setSelfHeal}
            label="Fix malformed replies automatically"
            hint="If the model returns broken JSON, ask it once to correct itself rather than failing."
          />
          <label className="block pt-2">
            <span className="label">Creativity — {temperature.toFixed(2)}</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={temperature}
              onChange={(e) => setTemperature(Number(e.target.value))}
              className="mt-2 w-full accent-brand-400"
            />
            <span className="mt-1 block text-[11px] text-ink-400">
              Low is literal and consistent, which is usually what you want for instructions. High is more imaginative —
              better for meal ideas.
            </span>
          </label>
        </div>
      </Card>

      {/* Voice */}
      <Card>
        <SectionTitle icon={<Icon.Volume size={15} />} title="Voice" subtitle="Speak instructions and listen to questions" />
        <Toggle
          checked={app.voice.enabled}
          onChange={(v) => store.set({ voice: { ...app.voice, enabled: v } })}
          label="Voice output"
          hint="Read answers and steps aloud."
        />
        <Toggle
          checked={app.voice.autoSpeak}
          onChange={(v) => store.set({ voice: { ...app.voice, autoSpeak: v } })}
          label="Read each step automatically in guided mode"
          hint="Useful when both your hands are busy and you cannot look at the screen."
        />
        <Toggle
          checked={app.voice.preferCloud}
          onChange={(v) => store.set({ voice: { ...app.voice, preferCloud: v } })}
          label="Cloud voice instead of the browser voice"
          hint="Uses your AI key for more natural speech, and the only way to hear languages the browser does not carry."
        />

        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          <Select
            label="Language"
            value={app.voice.language}
            onChange={(v) => store.set({ voice: { ...app.voice, language: v }, persona: { ...app.persona, languages: [v] } })}
            options={LANGUAGES.map((l) => ({ value: l.code, label: `${l.label}${l.tts ? '' : ' (text only)'}` }))}
          />
          <label className="block">
            <span className="label">Speed — {app.voice.rate.toFixed(1)}×</span>
            <input
              type="range"
              min={0.6}
              max={1.6}
              step={0.1}
              value={app.voice.rate}
              onChange={(e) => store.set({ voice: { ...app.voice, rate: Number(e.target.value) } })}
              className="mt-3 w-full accent-brand-400"
            />
          </label>
        </div>

        <Button
          size="sm"
          className="mt-3"
          onClick={() =>
            void speaker.speak('This is how I will read your instructions out. Tell me if you would like it faster or slower.')
          }
        >
          <Icon.Play size={15} /> Test the voice
        </Button>
        <Button size="sm" variant="ghost" className="ml-2 mt-3" onClick={() => speech.stop()}>
          <Icon.Stop size={14} /> Stop
        </Button>

        <p className="mt-2.5 text-[11px] leading-relaxed text-ink-400">
          Browsers carry voices for English and Afrikaans. For isiZulu, isiXhosa, Sesotho and the other South African
          languages I will write the instructions in the language, and speak them with a cloud voice when a key is
          available.
        </p>
      </Card>

      {/* How to talk to me */}
      <Card>
        <SectionTitle
          icon={<Icon.Bulb size={15} />}
          title="How I explain things"
          subtitle="This changes the depth of every answer"
        />
        <div className="mb-3 flex flex-wrap gap-2">
          {(['beginner', 'normal', 'detailed', 'expert'] as const).map((l) => (
            <Chip key={l} active={skill === l} onClick={() => setSkill(l)}>
              {l}
            </Chip>
          ))}
        </div>
        <p className="mb-3 text-[11px] leading-relaxed text-ink-400">
          {skill === 'beginner'
            ? 'I name every control by its label and where it is, and I warn about anything that looks obvious but is not.'
            : skill === 'normal'
              ? 'General competence, no specialist knowledge. I name the specific controls.'
              : skill === 'detailed'
                ? 'Comfortable with tools. I explain why each step matters and what can go wrong.'
                : 'Terse and technical. Only non-obvious gotchas and specifications.'}
        </p>

        <Select
          label="Units"
          value={units}
          onChange={(v) => setUnits(v as Persona['units'])}
          options={[
            { value: 'metric', label: 'Metric (mm, °C, litres)' },
            { value: 'imperial', label: 'Imperial (inches, °F)' },
          ]}
        />

        <div className="mt-3">
          <span className="label">Always respect these</span>
          <div className="mb-2 flex flex-wrap gap-1.5">
            {constraints
              .split('\n')
              .map((c) => c.trim())
              .filter(Boolean)
              .map((c) => (
                <span key={c} className="chip chip-active">
                  {c}
                  <button
                    onClick={() => setConstraints(constraints.split('\n').filter((x) => x.trim() !== c).join('\n'))}
                    className="ml-1 opacity-70 hover:opacity-100"
                  >
                    <Icon.X size={11} />
                  </button>
                </span>
              ))}
          </div>
          <div className="flex gap-2">
            <input
              className="field flex-1"
              value={newConstraint}
              onChange={(e) => setNewConstraint(e.target.value)}
              placeholder="e.g. no oven, wheelchair user, left-handed"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newConstraint.trim()) {
                  setConstraints([constraints, newConstraint.trim()].filter(Boolean).join('\n'))
                  setNewConstraint('')
                }
              }}
            />
            <Button
              onClick={() => {
                if (!newConstraint.trim()) return
                setConstraints([constraints, newConstraint.trim()].filter(Boolean).join('\n'))
                setNewConstraint('')
              }}
            >
              <Icon.Plus size={15} />
            </Button>
          </div>
          <p className="mt-1.5 text-[11px] leading-relaxed text-ink-400">
            Anything here is treated as a hard constraint in every answer — I will not suggest something that ignores it.
          </p>
        </div>
      </Card>

      {/* Video */}
      <Card>
        <SectionTitle
          icon={<Icon.Video size={15} />}
          title="Videos"
          subtitle="Optional: matches real demonstrations instead of search links"
        />
        <Field
          label="YouTube Data API key (optional)"
          value={youtubeKey}
          onChange={setYoutubeKey}
          placeholder="AIza…"
          secret
          mono
          hint="With a key I search YouTube properly, show real thumbnails, and pull out the chapter timestamps the uploader wrote. Without one I give you precise search links instead — I will not invent a video."
        />
        <a
          href="https://console.cloud.google.com/apis/library/youtube.googleapis.com"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-flex items-center gap-1.5 text-[11px] font-semibold text-brand-300 hover:text-brand-200"
        >
          Enable the YouTube Data API <Icon.ArrowRight size={12} />
        </a>
      </Card>

      {/* Data */}
      <Card>
        <SectionTitle icon={<Icon.Lock size={15} />} title="Your data" subtitle="Everything lives in this browser" />
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            onClick={() => {
              download('show-me-backup.json', store.exportState(), 'application/json')
              toast.show('Backup downloaded (key removed)')
            }}
          >
            <Icon.Upload size={14} className="rotate-180" /> Export everything
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setProvider('demo')
              setApiKey('')
              setModel('')
              store.set({ settings: { ...app.settings, provider: 'demo', apiKey: '', model: '' } })
              toast.show('Switched to the demo engine')
            }}
          >
            <Icon.Refresh size={14} /> Use the demo engine
          </Button>
          <Button
            size="sm"
            variant="danger"
            onClick={() => {
              if (confirm('This deletes your saved tasks, your knowledge notes and your API key from this browser. Continue?')) {
                store.resetEverything()
                setApiKey('')
                setModel('')
                toast.show('Everything cleared')
              }
            }}
          >
            <Icon.Trash size={14} /> Delete everything
          </Button>
        </div>
        <p className="mt-2.5 text-[11px] leading-relaxed text-ink-400">
          Photos you take are processed in your browser and sent only to the AI provider you chose. Saved tasks store a
          small thumbnail, not the full photo. Your API key never leaves this device except in a request to that
          provider, and it is never written to a log.
        </p>
      </Card>

      <Card>
        <SectionTitle icon={<Icon.Hand size={15} />} title="About" />
        <p className="text-xs leading-relaxed text-ink-300">
          <span className="font-semibold text-ink-100">Show Me · Visual AI Everyday Assistant.</span> Show me what
          you&rsquo;re dealing with, tell me what you want to do, and I&rsquo;ll help you get it done.
        </p>
        <p className="mt-2 text-[11px] leading-relaxed text-ink-400">
          The assistant is honest about its limits by design: it will not point at a control it cannot see, will not
          call a photo proof that something is safe, and will not walk you through something dangerous. When it
          cannot help, it says so and tells you who can.
        </p>
      </Card>

      <Toast message={toast.message} onDone={toast.clear} />
    </div>
  )
}
