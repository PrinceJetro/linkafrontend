'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import {
  ArrowUpRight,
  Bell,
  Building2,
  ChevronRight,
  CircleHelp,
  Compass,
  FileText,
  Globe2,
  Handshake,
  LayoutDashboard,
  LogOut,
  Map,
  Megaphone,
  Menu,
  MessageSquare,
  Mic,
  Plus,
  Search,
  Send,
  Sparkles,
  Star,
  Target,
  Users,
  X,
} from 'lucide-react'
import { api, clearTokens, isLoggedIn } from '@/lib/api'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import type { DictKey } from '@/lib/i18n'
import LanguageSwitcher from '@/components/LanguageSwitcher'

const MOCK_PROFILES = [
  { id: -1, name: 'Kora Distribution Co.', country: 'Ghana', flag: 'GH', sector: 'Logistics', score: 91, initials: 'KD', tone: 'orange', detail: 'Nationwide FMCG distribution network with cold-chain capacity.', tags: ['Distribution', 'Cold chain'], verified: true, matched: true, avatar: '', raw: null, why: ['Mock data — start the Django backend for live matches.'] },
  { id: -2, name: 'Nia Foods & Retail', country: 'Ghana', flag: 'GH', sector: 'Agriculture', score: 86, initials: 'NF', tone: 'blue', detail: 'Trusted retail network serving 120+ stores across Accra and Kumasi.', tags: ['Retail', 'Agriculture'], verified: true, matched: true, avatar: '', raw: null, why: ['Mock data — start the Django backend for live matches.'] },
  { id: -3, name: 'Mansa Freight', country: 'Ghana', flag: 'GH', sector: 'Logistics', score: 82, initials: 'MF', tone: 'purple', detail: 'Cross-border logistics and customs support for West Africa.', tags: ['Freight', 'Customs'], verified: false, matched: true, avatar: '', raw: null, why: ['Mock data — start the Django backend for live matches.'] },
]

const COUNTRY_NAMES: Record<string, string> = { NG: 'Nigeria', GH: 'Ghana', KE: 'Kenya', RW: 'Rwanda', ZA: 'South Africa', EG: 'Egypt', OTHER: 'Other' }
const TONES = ['orange', 'blue', 'purple']
const INDUSTRIES = ['Agriculture', 'Technology', 'Manufacturing', 'Logistics', 'Healthcare', 'Education', 'Finance', 'Creative', 'Research', 'Natural resources']

// Leaflet needs `window` — client-only, no SSR
const AfricaMap = dynamic(() => import('@/components/AfricaMap'), {
  ssr: false,
  loading: () => <div className="match-card"><p className="match-detail">…</p></div>,
})

function initialsOf(name: string) {
  return name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
}

function adaptProfile(r: any, i: number, matched = false) {
  return {
    id: r.id,
    name: r.name,
    country: COUNTRY_NAMES[r.country] ?? r.country,
    flag: r.country,
    sector: r.industry,
    score: r.match_score ?? null,
    matched,
    initials: initialsOf(r.name),
    tone: TONES[i % 3],
    detail: r.offers ?? r.products_services ?? '',
    avatar: r.avatar_url || '',
    tags: [...new Set([r.industry, r.partnership_type].filter(Boolean))],
    verified: !!r.is_verified,
    why: r.why ?? [],
    raw: r,
  }
}

type Profile = ReturnType<typeof adaptProfile>

function Flag({ code }: { code: string }) {
  return <span className="flag">{code}</span>
}

function MatchCard({ profile, onConnect, onView, t }: { profile: Profile; onConnect: () => void; onView: () => void; t: (k: any) => string }) {
  return (
    <article className="match-card">
      <div className="match-topline">
        <div className={`profile-mark ${profile.tone}`} style={profile.avatar ? { padding: 0, overflow: 'hidden' } : undefined}>{profile.avatar ? <img src={profile.avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : profile.initials}</div>
        <div className="match-copy">
          <div className="match-name-row"><h3>{profile.name}</h3>{profile.verified && <span className="verified">{t('card.verified')}</span>}</div>
          <p><Flag code={profile.flag} /> {profile.country} <span className="dot-sep">·</span> {profile.sector}</p>
        </div>
        <div className="score"><strong>{profile.score}%</strong><span>{t('card.match')}</span></div>
      </div>
      <p className="match-detail">{profile.detail}</p>
      <div className="tag-row">{profile.tags.map((tag, i) => <span className="tag" key={`${tag}-${i}`}>{tag}</span>)}</div>
      <div className="match-actions"><button className="ghost-btn" onClick={onView}>{t('card.view')} <ArrowUpRight size={14} /></button><button className="connect-btn" onClick={onConnect}>{t('card.connect')} <ChevronRight size={15} /></button></div>
    </article>
  )
}

const COUNTRY_CHIP: Record<string, string> = { NG: 'Nigeria', GH: 'Ghana', KE: 'Kenya', RW: 'Rwanda', ZA: 'South Africa', EG: 'Egypt', OTHER: 'Other' }

function IntentChips({ intent, ai, t }: { intent: any; ai: boolean; t: (k: any) => string }) {
  if (!intent) return null
  const chips = [
    ...(intent.countries ?? []).map((c: string) => COUNTRY_CHIP[c] ?? c),
    ...(intent.industries ?? []),
    ...((intent.keywords ?? []).slice(0, 4)),
  ]
  if (!chips.length) return null
  return (
    <div className="suggestions" style={{ marginTop: 10 }}>
      <span>{ai ? t('ov.aiUnderstood') : t('ov.understood')}:</span>
      {chips.map((c: string) => <span key={c} className="tag" style={{ background: '#eaf3ed', color: '#195c4b', fontWeight: 700 }}>{c}</span>)}
    </div>
  )
}

export default function Page() {
  const router = useRouter()
  const { t } = useLanguage()
  const [mounted, setMounted] = useState(false)
  const [authChecked, setAuthChecked] = useState(false)
  const [user, setUser] = useState<any>(null)
  const [activeNav, setActiveNav] = useState('Overview')
  const [query, setQuery] = useState('I produce processed cassava products in Nigeria. I want to enter Ghana and need a distributor and logistics partner.')
  const [hasSearched, setHasSearched] = useState(false)
  const [mobileNav, setMobileNav] = useState(false)
  const [toast, setToast] = useState<{ title: string; body: string } | null>(null)
  const [liveResults, setLiveResults] = useState<Profile[] | null>(null)
  const [allProfiles, setAllProfiles] = useState<Profile[] | null>(null)
  const [myProfiles, setMyProfiles] = useState<any[]>([])
  const [requests, setRequests] = useState<any[]>([])
  const [mapStats, setMapStats] = useState<any>(null)
  const [live, setLive] = useState(false)
  const [searching, setSearching] = useState(false)
  const [connecting, setConnecting] = useState<string | null>(null)
  const [savingProfile, setSavingProfile] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [filters, setFilters] = useState({ country: '', industry: '', partnership_type: '' })
  const [form, setForm] = useState({ name: '', country: 'NG', city: '', industry: 'Agriculture', offers: '', needs: '', partnership_type: 'Distribution', products_services: '', target_countries: [] as string[], avatar_url: '' })
  const EMPTY_FORM = { name: '', country: 'NG', city: '', industry: 'Agriculture', offers: '', needs: '', partnership_type: 'Distribution', products_services: '', target_countries: [] as string[], avatar_url: '' }
  const [intent, setIntent] = useState<any>(null)
  const [aiMatch, setAiMatch] = useState(false)
  const [metricsData, setMetricsData] = useState<any>(null)
  const [mapIndustry, setMapIndustry] = useState('')
  const [notifs, setNotifs] = useState<any[]>([])
  const [showNotifs, setShowNotifs] = useState(false)
  const [convos, setConvos] = useState<any[]>([])
  const [broadcasts, setBroadcasts] = useState<any[]>([])
  const [bcText, setBcText] = useState('')
  const [bcCountry, setBcCountry] = useState('')
  const [bcIndustry, setBcIndustry] = useState('')
  const [mouDoc, setMouDoc] = useState<{ request_id: number; markdown: string; ai: boolean } | null>(null)
  const [mouLoading, setMouLoading] = useState<number | null>(null)
  const [endorseFor, setEndorseFor] = useState<number | null>(null)
  const [endorseRating, setEndorseRating] = useState('5')
  const [endorseComment, setEndorseComment] = useState('')
  const [recording, setRecording] = useState(false)
  const [history, setHistory] = useState<any[]>([])
  const [profilesNext, setProfilesNext] = useState<string | null>(null)
  const [showAccount, setShowAccount] = useState(false)
  const [oldPw, setOldPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [pwMsg, setPwMsg] = useState('')
  const [pwSaving, setPwSaving] = useState(false)
  const [activeConvoId, setActiveConvoId] = useState<number | null>(null)
  const [threadMsgs, setThreadMsgs] = useState<any[]>([])
  const [msgBody, setMsgBody] = useState('')
  const [sendingMsg, setSendingMsg] = useState(false)
  const [onboarding, setOnboarding] = useState(false)
  const [acceptedModal, setAcceptedModal] = useState<{ fromName: string; toName: string } | null>(null)

  useEffect(() => { setMounted(true) }, [])

  // Auth gate + initial data load
  useEffect(() => {
    if (!mounted) return
    if (!isLoggedIn()) { router.replace('/login'); return }
    if (window.location.hash === '#capability') setActiveNav('My capability profile')
    if (window.location.hash === '#messages') setActiveNav('Messages')
    // Onboarding: new user redirected from registration
    const params = new URLSearchParams(window.location.search)
    if (params.get('onboarding') === '1') {
      setActiveNav('My capability profile')
      setOnboarding(true)
      window.history.replaceState({}, '', '/')
    }
    setAuthChecked(true)
    api.me().then(setUser).catch(() => { clearTokens(); router.replace('/login') })
    api.profiles().then((data: any) => {
      const list = Array.isArray(data) ? data : data.results ?? []
      setAllProfiles(list.map(adaptProfile))
      setProfilesNext(data.next ?? null)
      setLive(true)
    }).catch(() => setLive(false))
    api.myProfiles().then((data: any) => setMyProfiles(Array.isArray(data) ? data : data.results ?? [])).catch(() => {})
    api.mapStats().then(setMapStats).catch(() => {})
    api.myRequests().then((data: any) => setRequests(Array.isArray(data) ? data : data.results ?? [])).catch(() => {})
    api.metrics().then(setMetricsData).catch(() => {})
    api.notifications().then(setNotifs).catch(() => {})
    const loadConvos = (data: any) => {
      const list = Array.isArray(data) ? data : data.results ?? []
      setConvos(list)
      if (!activeConvoId && list.length) setActiveConvoId(list[0].id)
    }
    api.conversations().then(loadConvos).catch(() => {})
    api.matchHistory().then(setHistory).catch(() => {})
  }, [mounted, router])

  // Keep inbox counts + bell fresh while the app is open
  useEffect(() => {
    if (!mounted || !authChecked) return
    const t = window.setInterval(() => {
      api.notifications().then(setNotifs).catch(() => {})
      api.conversations().then((d: any) => setConvos(Array.isArray(d) ? d : d.results ?? [])).catch(() => {})
      api.myRequests().then((d: any) => setRequests(Array.isArray(d) ? d : d.results ?? [])).catch(() => {})
    }, 30000)
    return () => window.clearInterval(t)
  }, [mounted, authChecked])

  // Refetch map when the sector filter changes
  useEffect(() => {
    if (!mounted || !authChecked) return
    api.mapStats(mapIndustry).then(setMapStats).catch(() => {})
  }, [mapIndustry, mounted, authChecked])

  useEffect(() => {
    if (!toast) return
    const t = window.setTimeout(() => setToast(null), 4000)
    return () => window.clearTimeout(t)
  }, [toast])

  const visibleProfiles = useMemo(() => {
    const ownIds = new Set(myProfiles.map((p: any) => p.id))
    const notMine = (list: Profile[]) => list.filter((p) => !ownIds.has(p.id))
    if (hasSearched && liveResults) return notMine(liveResults)
    if (allProfiles) return notMine(allProfiles).slice(0, 6)
    return MOCK_PROFILES
  }, [hasSearched, liveResults, allProfiles, myProfiles])

  const headline = useMemo(
    () => (hasSearched ? t('ov.found', { n: visibleProfiles.length }) : t('ov.findDefault')),
    [hasSearched, visibleProfiles, t],
  )

  async function findPartners(override?: string) {
    const q = override ?? query
    if (override !== undefined) setQuery(override)
    setSearching(true)
    try {
      const data = await api.match(q, Object.fromEntries(Object.entries(filters).filter(([, v]) => v)))
      const adapted = (data.results ?? []).map((r: any, i: number) => adaptProfile(r, i, true))
      setIntent(data.intent ?? null)
      setAiMatch(!!data.ai)
      try { localStorage.setItem('linka_last_match', JSON.stringify({ query: q, results: (data.results ?? []).map((r: any) => ({ id: r.id, match_score: r.match_score, why: r.why })) })) } catch {}
      if (adapted.length) { setLiveResults(adapted); setLive(true) }
      api.metrics().then(setMetricsData).catch(() => {})
    api.matchHistory().then(setHistory).catch(() => {})
    const loadBroadcasts = (data: any) => setBroadcasts(Array.isArray(data) ? data : data.results ?? [])
    api.broadcasts().then(loadBroadcasts).catch(() => {})
    } catch {
      setLive(false)
      setToast({ title: t('toast.backendTitle'), body: t('toast.backendBody') })
    } finally {
      setHasSearched(true)
      setSearching(false)
    }
  }

  async function connect(profile: Profile) {
    if (profile.id < 0) {
      setToast({ title: t('toast.mockReqTitle'), body: t('toast.mockReqBody') })
      return
    }
    if (!myProfiles.length) {
      setActiveNav('My capability profile')
      setToast({ title: t('toast.noProfileTitle'), body: t('toast.noProfileBody') })
      return
    }
    setConnecting(profile.name)
    try {
      await api.sendRequest({
        from_profile: myProfiles[0].id,
        to_profile: profile.id,
        partnership_type: profile.raw?.partnership_type || 'Distribution',
        message: `${myProfiles[0].name} is interested in a partnership around: ${query.slice(0, 200)}`,
      })
      const data: any = await api.myRequests().catch(() => null)
      if (data) setRequests(Array.isArray(data) ? data : data.results ?? [])
      api.notifications().then(setNotifs).catch(() => {})
      setToast({ title: t('toast.reqSent'), body: t('toast.reqSentBody', { name: profile.name }) })
    } catch (e: any) {
      setToast({ title: t('toast.reqFail'), body: t('toast.reqFailBody') })
    } finally {
      setConnecting(null)
    }
  }

  async function actOnRequest(id: number, action: 'accept' | 'decline' | 'request_info', r?: any) {
    try {
      await api.requestAction(id, action)
      const data: any = await api.myRequests()
      const updated = Array.isArray(data) ? data : data.results ?? []
      setRequests(updated)
      api.notifications().then(setNotifs).catch(() => {})
      if (action === 'accept' && r) {
        setAcceptedModal({ fromName: r.from_profile_name ?? `#${r.from_profile}`, toName: r.to_profile_name ?? `#${r.to_profile}` })
      } else if (action === 'decline') {
        setToast({ title: t('toast.reqDeclined'), body: t('toast.reqDeclinedBody') })
      } else if (action === 'request_info') {
        setToast({ title: t('toast.infoReq'), body: t('toast.infoReqBody') })
      }
    } catch {
      setToast({ title: t('toast.updateFail'), body: t('toast.updateFailBody') })
    }
  }

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault()
    setSavingProfile(true)
    try {
      if (editingId) {
        await api.updateProfile(editingId, form)
        setToast({ title: t('toast.updated'), body: t('toast.updatedBody') })
      } else {
        await api.createProfile(form)
        setToast({ title: t('toast.created'), body: t('toast.createdBody') })
      }
      const data: any = await api.myProfiles()
      setMyProfiles(Array.isArray(data) ? data : data.results ?? [])
      setEditingId(null)
      setForm(EMPTY_FORM)
    } catch {
      setToast({ title: t('toast.saveFail'), body: t('toast.saveFailBody') })
    } finally {
      setSavingProfile(false)
    }
  }

  function startEdit(p: any) {
    setEditingId(p.id)
    setForm({
      name: p.name ?? '', country: p.country ?? 'NG', city: p.city ?? '',
      industry: p.industry ?? 'Agriculture', offers: p.offers ?? '', needs: p.needs ?? '',
      partnership_type: p.partnership_type ?? 'Distribution', products_services: p.products_services ?? '',
      target_countries: p.target_countries ?? [],
      avatar_url: p.avatar_url ?? '',
    })
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })
  }

  async function removeProfile(id: number) {
    if (!window.confirm(t('cap.deleteConfirm'))) return
    try {
      await api.deleteProfile(id)
      setMyProfiles(myProfiles.filter((p: any) => p.id !== id))
      setToast({ title: t('toast.deleted'), body: t('toast.deletedBody') })
    } catch {
      setToast({ title: t('toast.deleteFail'), body: t('toast.deleteFailBody') })
    }
  }

  async function loadThread(id: number) {
    setActiveConvoId(id)
    try {
      setThreadMsgs(await api.threadMessages(id))
      const data: any = await api.conversations()
      setConvos(Array.isArray(data) ? data : data.results ?? [])
    } catch { /* offline */ }
  }

  async function sendMsg(e: React.FormEvent) {
    e.preventDefault()
    const text = msgBody.trim()
    if (!text || !activeConvoId || sendingMsg) return
    setSendingMsg(true)
    try {
      const msg = await api.sendMessage(activeConvoId, text)
      setThreadMsgs([...threadMsgs, msg])
      setMsgBody('')
    } catch {
      setToast({ title: t('toast.sendFail'), body: t('toast.backendBody') })
    } finally {
      setSendingMsg(false)
    }
  }

  // Poll the open thread while Messages is visible
  useEffect(() => {
    if (activeNav !== 'Messages' || !activeConvoId) return
    loadThread(activeConvoId)
    const t = window.setInterval(() => loadThread(activeConvoId), 8000)
    return () => window.clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeNav, activeConvoId])

  function viewProfile(profile: Profile) {
    if ((profile.id ?? 0) < 0) {
      setToast({ title: t('toast.mockTitle'), body: t('toast.mockBody') })
      return
    }
    router.push(`/profiles/${profile.id}`)
  }

  async function loadMoreProfiles() {
    if (!profilesNext) return
    try {
      const res = await fetch(profilesNext)
      const data = await res.json()
      const list = Array.isArray(data) ? data : data.results ?? []
      setAllProfiles([...(allProfiles ?? []), ...list.map(adaptProfile)])
      setProfilesNext(data.next ?? null)
    } catch {
      setToast({ title: t('toast.loadFail'), body: t('toast.loadFailBody') })
    }
  }

  async function changePw(e: React.FormEvent) {
    e.preventDefault()
    setPwMsg('')
    setPwSaving(true)
    try {
      await api.changePassword(oldPw, newPw)
      setOldPw('')
      setNewPw('')
      setPwMsg(t('top.pwUpdated'))
    } catch (err: any) {
      setPwMsg(t('toast.failed') + ': ' + String(err.message || err).slice(0, 160))
    } finally {
      setPwSaving(false)
    }
  }

  async function postBroadcast(e: React.FormEvent) {
    e.preventDefault()
    if (!bcText.trim() || !myProfiles.length) {
      if (!myProfiles.length) setToast({ title: t('toast.bcNeedProfile'), body: t('toast.noProfileBody') })
      return
    }
    try {
      await api.postBroadcast({ author_profile_id: myProfiles[0].id, text: bcText.trim(), target_country: bcCountry, industry: bcIndustry })
      setBcText('')
      const data: any = await api.broadcasts()
      setBroadcasts(Array.isArray(data) ? data : data.results ?? [])
      setToast({ title: t('toast.bcLive'), body: t('toast.bcLiveBody') })
    } catch {
      setToast({ title: t('toast.failed'), body: t('toast.verifyFailBody') })
    }
  }

  async function closeBroadcast(id: number) {
    try {
      await api.closeBroadcast(id)
      setBroadcasts(broadcasts.map((b: any) => b.id === id ? { ...b, status: 'closed' } : b))
    } catch {
      setToast({ title: t('toast.failed'), body: t('toast.verifyFailBody') })
    }
  }

  async function openMou(requestId: number) {
    setMouLoading(requestId)
    try {
      const doc = await api.mou(requestId)
      setMouDoc({ request_id: requestId, ...doc })
    } catch {
      setToast({ title: t('toast.mouFail'), body: t('toast.backendBody') })
    } finally {
      setMouLoading(null)
    }
  }

  function downloadMou() {
    if (!mouDoc) return
    const blob = new Blob([mouDoc.markdown], { type: 'text/markdown' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `linka-mou-${mouDoc.request_id}.md`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  async function submitEndorsement(requestId: number) {
    try {
      await api.postEndorsement({ request_id: requestId, rating: Number(endorseRating), comment: endorseComment })
      setEndorseFor(null)
      setEndorseComment('')
      setToast({ title: t('toast.endorsed'), body: t('toast.endorsedBody') })
    } catch (err: any) {
      setToast({ title: t('toast.failed'), body: String(err.message || err).slice(0, 160) })
    }
  }

  const recRef = useRef<{ rec: MediaRecorder; chunks: Blob[]; stream: MediaStream } | null>(null)

  async function toggleRecording() {
    // Second tap stops and processes
    if (recording && recRef.current) { recRef.current.rec.stop(); return }
    if (!navigator.mediaDevices?.getUserMedia) {
      setToast({ title: t('toast.noMic'), body: t('toast.noMicBody') })
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const rec = new MediaRecorder(stream)
      const chunks: Blob[] = []
      rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data) }
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop())
        recRef.current = null
        setRecording(false)
        try {
          setToast({ title: t('toast.transcribing'), body: t('toast.transcribingBody') })
          const blob = new Blob(chunks, { type: rec.mimeType || 'audio/webm' })
          if (blob.size < 1024) {
            setToast({ title: t('toast.tooShort'), body: t('toast.tooShortBody') })
            return
          }
          const data = await api.voiceIntent(blob)
          setQuery(data.transcript || '')
          const adapted = (data.results ?? []).map((r: any, i: number) => adaptProfile(r, i, true))
          setIntent(data.intent ?? null)
          setAiMatch(!!data.ai)
          if (adapted.length) { setLiveResults(adapted); setLive(true) }
          setHasSearched(true)
          api.metrics().then(setMetricsData).catch(() => {})
        } catch (err: any) {
          let body = t('toast.voiceFail')
          try { body = JSON.parse(String(err.message || '')).detail || body } catch { /* keep default */ }
          setToast({ title: t('toast.voiceFail'), body })
        }
      }
      recRef.current = { rec, chunks, stream }
      rec.start()
      setRecording(true)
      setToast({ title: t('toast.recording'), body: t('toast.recordingBody') })
      window.setTimeout(() => { if (recRef.current) rec.stop() }, 60000)
    } catch {
      setRecording(false)
      setToast({ title: t('toast.micBlocked'), body: t('toast.micBlockedBody') })
    }
  }

  function logout() {
    clearTokens()
    router.replace('/login')
  }

  const navItems: { key: string; labelKey: DictKey; icon: any; count?: number }[] = [
    { key: 'Overview', labelKey: 'nav.overview', icon: LayoutDashboard },
    { key: 'Find partners', labelKey: 'nav.find', icon: Sparkles },
    { key: 'Intent wall', labelKey: 'nav.wall', icon: Megaphone },
    { key: 'Opportunity map', labelKey: 'nav.map', icon: Map },
    { key: 'My requests', labelKey: 'nav.requests', icon: Send, count: requests.length || undefined },
  ]
  const manageItems: { key: string; labelKey: DictKey; icon: any; count?: number }[] = [
    { key: 'My capability profile', labelKey: 'nav.profile', icon: Building2 },
    { key: 'Partnerships', labelKey: 'nav.partnerships', icon: Handshake },
    { key: 'Messages', labelKey: 'nav.messages', icon: MessageSquare, count: convos.reduce((s: number, c: any) => s + (c.unread_count || 0), 0) || undefined },
  ]
  const navLabel = (key: string): string => {
    const found = [...navItems, ...manageItems].find((n) => n.key === key)
    return found ? t(found.labelKey) : key
  }

  // SSR / pre-auth shell — must match server HTML exactly
  if (!mounted || !authChecked) {
    return <main className="app-shell" suppressHydrationWarning />
  }

  const userInitials = (user?.first_name?.[0] ?? user?.username?.[0] ?? 'U').toUpperCase()

  return (
    <main className="app-shell" suppressHydrationWarning>
      <aside className={`sidebar ${mobileNav ? 'open' : ''}`}>
        <div className="brand"><div className="brand-symbol"><Globe2 size={21} /></div><div><strong>linka</strong><span>{t('brand.tagline')}</span></div><button className="close-nav" onClick={() => setMobileNav(false)}><X size={18} /></button></div>
        <div className="workspace"><div className="workspace-avatar">{myProfiles[0] ? initialsOf(myProfiles[0].name) : userInitials}</div><div><strong>{myProfiles[0]?.name ?? t('nav.myWs')}</strong><span>{t('nav.businessWs')}</span></div><ChevronRight size={15} /></div>
        <nav className="side-nav" aria-label={t('nav.mainNav')}>
          <span className="nav-label">{t('nav.workspace')}</span>
          {navItems.map(({ key, labelKey, icon: Icon, count }: any) => <button key={key} className={`nav-item ${activeNav === key ? 'active' : ''}`} onClick={() => { setActiveNav(key); setMobileNav(false) }}><Icon size={18} /><span>{t(labelKey)}</span>{count ? <em>{count}</em> : null}</button>)}
          <span className="nav-label nav-label-spaced">{t('nav.manage')}</span>
          {manageItems.map(({ key, labelKey, icon: Icon, count }: any) => <button key={key} className={`nav-item ${activeNav === key ? 'active' : ''}`} onClick={() => { setActiveNav(key); setMobileNav(false) }}><Icon size={18} /><span>{t(labelKey)}</span>{count ? <em>{count}</em> : null}</button>)}
        </nav>
        <div className="sidebar-bottom">
          <div className="side-help"><CircleHelp size={17} /><div><strong>{t('nav.helpTitle')}</strong><span>{t('nav.helpSub')}</span></div></div>
          <div className="user-row"><div className="user-avatar">{userInitials}</div><div><strong>{user?.first_name || user?.username || t('top.account')}</strong><span>{live ? t('top.liveDot') : t('top.mockDot')}</span></div><button className="icon-btn" title={t('nav.logout')} onClick={logout} style={{ marginLeft: 'auto' }}><LogOut size={16} /></button></div>
        </div>
      </aside>
      {mobileNav && <button className="mobile-overlay" aria-label={t('nav.closeNav')} onClick={() => setMobileNav(false)} />}
      <section className="main-area">
        <header className="topbar"><button className="menu-btn" onClick={() => setMobileNav(true)}><Menu size={20} /></button><div className="crumb"><span>{t('nav.workspace')}</span><ChevronRight size={14} /><strong>{navLabel(activeNav)}</strong></div><div className="top-actions"><span className="tag">{live ? t('top.live') : t('top.mock')}</span><LanguageSwitcher compact /><div style={{ position: 'relative' }}><button className="icon-btn" aria-label={t('top.notifs')} onClick={() => { setShowNotifs(!showNotifs); if (!showNotifs) { try { localStorage.setItem('linka_notif_seen', new Date().toISOString()) } catch {} } }}><Bell size={18} />{notifs.filter((n: any) => { try { return new Date(n.created_at) > new Date(localStorage.getItem('linka_notif_seen') ?? 0) } catch { return true } }).length > 0 && <i />}</button>{showNotifs && <div className="match-card" style={{ position: 'absolute', right: 0, top: 40, width: 320, zIndex: 50, maxHeight: 380, overflow: 'auto' }}><p className="eyebrow">{t('top.notifs')}</p>{!notifs.length && <p className="match-detail">{t('top.notifEmpty')}</p>}{notifs.map((n: any, i: number) => <p key={i} className="match-detail" style={{ minHeight: 0, margin: '8px 0' }}>• {n.text}</p>)}<div className="match-actions"><button className="ghost-btn" onClick={() => { setShowNotifs(false); setActiveNav('My requests') }}>{t('top.openInbox')}</button></div></div>}</div><div style={{ position: 'relative' }}><button className="top-avatar" title={user?.username} onClick={() => setShowAccount(!showAccount)}>{userInitials}</button>{showAccount && <div className="match-card" style={{ position: 'absolute', right: 0, top: 40, width: 300, zIndex: 50 }}><p className="eyebrow">{t('top.account')}</p><p className="match-detail" style={{ minHeight: 0, margin: '4px 0' }}><strong>{user?.first_name || user?.username}</strong></p><p className="match-detail" style={{ minHeight: 0, margin: '0 0 10px' }}>{user?.email}</p><form onSubmit={changePw} style={{ display: 'grid', gap: 8 }}><input type="password" value={oldPw} onChange={(e) => setOldPw(e.target.value)} placeholder={t('top.curPw')} required style={{ border: '1px solid #cbd9cf', borderRadius: 9, padding: '9px 10px', fontSize: 12 }} /><input type="password" value={newPw} minLength={8} onChange={(e) => setNewPw(e.target.value)} placeholder={t('top.newPw')} required style={{ border: '1px solid #cbd9cf', borderRadius: 9, padding: '9px 10px', fontSize: 12 }} />{pwMsg && <p className="match-detail" style={{ minHeight: 0, margin: 0 }}>{pwMsg}</p>}<div className="match-actions"><button className="ghost-btn" type="submit" disabled={pwSaving}>{pwSaving ? t('top.saving') : t('top.changePw')}</button><button className="ghost-btn" type="button" onClick={logout}>{t('nav.logout')}</button></div></form></div>}</div></div></header>
        <div className="content-wrap">

          {activeNav === 'Overview' && (
            <>
              <div className="page-heading"><div><p className="eyebrow">{t('ov.date')}</p><h1>{t('ov.greet')}{user?.first_name ? `, ${user.first_name}` : ''} <span>—</span></h1><p className="subheading">{t('ov.sub')}</p></div><button className="outline-action" onClick={() => setActiveNav('My capability profile')}><Plus size={17} /> {t('ov.updateProfile')}</button></div>
              <section className="hero-grid">
                <div className="matcher-card"><div className="section-kicker"><span className="sparkle"><Sparkles size={15} /></span><span>{t('ov.matcher')}</span><span className="beta">BETA</span></div><h2>{headline}</h2><p className="matcher-intro">{t('ov.intro')}</p><div className="query-box"><textarea aria-label={t('find.need')} value={query} onChange={(e) => setQuery(e.target.value)} /><div className="query-footer"><span><Sparkles size={14} /> {t('ov.intentNote')}</span><span style={{ display: 'flex', gap: 8 }}><button className="icon-btn" title={t('ov.voiceTitle')} onClick={toggleRecording} style={recording ? { color: '#d77839' } : undefined}><Mic size={16} />{recording && <i />}</button><button onClick={() => findPartners()} disabled={searching}><Search size={16} /> {searching ? t('ov.searching') : t('ov.findBtn')}</button></span></div></div><IntentChips intent={intent} ai={aiMatch} t={t} /><div className="suggestions"><span>{t('ov.tryExample')}</span><button onClick={() => setQuery('I need a technology partner in Kenya to help scale our mobile payments platform.')}>{t('ov.techEx')}</button><button onClick={() => setQuery('Looking for a reliable manufacturer in South Africa for sustainable packaging.')}>{t('ov.mfgEx')}</button></div></div>
                <div className="insight-card"><div className="insight-orbit orbit-one" /><div className="insight-orbit orbit-two" /><div className="insight-icon"><Target size={22} /></div><p className="eyebrow light">{t('ov.pulse')}</p><h3>{requests.length ? t('ov.activeReq', { n: requests.length }) : t('ov.newOpp')}<br />{t('ov.worthExp')}</h3><p className="insight-text">{t('ov.pulseSub')}</p><button className="light-link" onClick={() => setActiveNav('Find partners')}>{t('ov.explore')} <ArrowUpRight size={15} /></button><div className="insight-stat"><div><strong>{mapStats?.total ?? 5}</strong><span>{t('ov.countriesConn')}</span></div><div><strong>{mapStats?.total ?? 18}</strong><span>{t('ov.activeCap')}</span></div></div></div>
              </section>
              <section className="section-block"><div className="section-header"><div><p className="eyebrow">{t('ov.weMeasure')}</p><h2 className="section-title">{t('ov.netPerf')}</h2></div><span className="tag">{aiMatch || (metricsData?.ai_searches ?? 0) > 0 ? t('ov.aiAssisted') : t('ov.ruleBased')}</span></div><div className="matches-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
                {[
                  [t('ov.profilesLive'), metricsData?.profiles ?? allProfiles?.length ?? '—'],
                  [t('ov.searchesRun'), metricsData?.searches ?? '—'],
                  [t('ov.avgTop'), metricsData ? `${metricsData.avg_top_score}%` : '—'],
                  [t('ov.searchToReq'), metricsData ? `${metricsData.request_conversion_pct}%` : '—'],
                ].map(([label, value]) => <div key={label} className="match-card"><div className="score" style={{ textAlign: 'left' }}><strong>{value}</strong><span>{label}</span></div></div>)}
              </div></section>
              <section className="section-block"><div className="section-header"><div><p className="eyebrow">{t('ov.basedOn')}</p><h2 className="section-title">{hasSearched ? t('ov.bestFit') : t('ov.potential')}</h2></div><button className="text-button" onClick={() => setActiveNav('Find partners')}>{t('ov.viewAll')} <ArrowUpRight size={15} /></button></div><div className="matches-grid">{visibleProfiles.slice(0, 3).map((profile) => <MatchCard key={profile.name} profile={profile} onConnect={() => connect(profile)} onView={() => viewProfile(profile)} t={t} />)}</div></section>
              <section className="lower-grid"><div className="activity-card"><div className="section-header compact"><div><p className="eyebrow">{t('ov.activity')}</p><h2 className="section-title">{t('ov.journey')}</h2></div><button className="icon-btn"><ArrowUpRight size={16} /></button></div><div className="journey"><div className="journey-step done"><span><Search size={15} /></span><div><strong>{t('ov.defNeed')}</strong><small>{t('ov.defNeedSub')}</small></div><b>{t('ov.done')}</b></div><div className="journey-line done" /><div className="journey-step current"><span><Sparkles size={15} /></span><div><strong>{t('ov.discover')}</strong><small>{t('ov.recReady', { n: visibleProfiles.length })}</small></div><b>{t('ov.now')}</b></div><div className="journey-line" /><div className="journey-step"><span><Handshake size={15} /></span><div><strong>{t('ov.startPartner')}</strong><small>{requests.length ? t('ov.reqsSent', { n: requests.length }) : t('ov.firstReq')}</small></div></div></div><div className="map-card"><div className="section-header compact"><div><p className="eyebrow">{t('ov.exploreNet')}</p><h2 className="section-title">{t('ov.africaGlance')}</h2></div><button className="text-button" onClick={() => setActiveNav('Opportunity map')}>{t('ov.openMap')} <ArrowUpRight size={15} /></button></div><div className="map-visual"><div className="map-glow" /><div className="map-label label-ng"><span />Nigeria</div><div className="map-label label-gh"><span />Ghana</div><div className="map-label label-ke"><span />Kenya</div><div className="map-label label-rw"><span />Rwanda</div><div className="map-label label-za"><span />South Africa</div><div className="map-lines line-a" /><div className="map-lines line-b" /><div className="map-land">AFRICA</div></div></div></div></section>
            </>
          )}

          {activeNav === 'Find partners' && (
            <>
              <div className="page-heading"><div><p className="eyebrow">{t('find.eyebrow')}</p><h1>{t('find.title')}</h1><p className="subheading">{live ? t('find.liveSub') : t('find.mockSub')}</p></div></div>
              <section className="hero-grid" style={{ gridTemplateColumns: '1fr' }}>
                <div className="matcher-card"><div className="section-kicker"><span className="sparkle"><Sparkles size={15} /></span><span>{t('ov.matcher')}</span><span className="beta">BETA</span></div><h2>{headline}</h2><div className="query-box"><textarea aria-label={t('find.need')} value={query} onChange={(e) => setQuery(e.target.value)} /><div className="query-footer"><span><Sparkles size={14} /> {t('ov.intentNote')}</span><span style={{ display: 'flex', gap: 8 }}><button className="icon-btn" title={t('ov.voiceTitle')} onClick={toggleRecording} style={recording ? { color: '#d77839' } : undefined}><Mic size={16} />{recording && <i />}</button><button onClick={() => findPartners()} disabled={searching}><Search size={16} /> {searching ? t('ov.searching') : t('ov.findBtn')}</button></span></div></div><IntentChips intent={intent} ai={aiMatch} t={t} /><div className="suggestions"><span>{t('find.filter')}</span><select value={filters.country} onChange={(e) => setFilters({ ...filters, country: e.target.value })} style={{ borderRadius: 20, border: '1px solid #e1e9e3', padding: '6px 10px', fontSize: 11 }}><option value="">{t('find.allCountries')}</option>{Object.entries(COUNTRY_NAMES).map(([c, n]) => <option key={c} value={c}>{n}</option>)}</select><select value={filters.industry} onChange={(e) => setFilters({ ...filters, industry: e.target.value })} style={{ borderRadius: 20, border: '1px solid #e1e9e3', padding: '6px 10px', fontSize: 11 }}><option value="">{t('find.allSectors')}</option>{INDUSTRIES.map((i) => <option key={i}>{i}</option>)}</select><select value={filters.partnership_type} onChange={(e) => setFilters({ ...filters, partnership_type: e.target.value })} style={{ borderRadius: 20, border: '1px solid #e1e9e3', padding: '6px 10px', fontSize: 11 }}><option value="">{t('find.anyType')}</option>{['Distribution', 'Retail', 'Logistics', 'Technology', 'Manufacturing', 'Research'].map((tp) => <option key={tp}>{tp}</option>)}</select></div></div>
              </section>
              <section className="section-block"><div className="matches-grid">{visibleProfiles.map((profile) => <MatchCard key={profile.name} profile={profile} onConnect={() => connect(profile)} onView={() => viewProfile(profile)} t={t} />)}</div>{profilesNext && (!hasSearched || !liveResults) && <div style={{ marginTop: 14 }}><button className="ghost-btn" onClick={loadMoreProfiles}>{t('find.showMore')}</button></div>}</section>
              {!!history.length && (
                <section className="section-block"><div className="section-header"><div><p className="eyebrow">{t('find.history')}</p><h2 className="section-title">{t('find.recent')}</h2></div></div>
                  {history.slice(0, 5).map((h: any) => (
                    <div key={h.id} className="match-card" style={{ marginBottom: 10, display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ flex: 1, minWidth: 0 }}><strong style={{ display: 'block', fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{h.query}</strong><small style={{ color: '#95a19c', fontSize: 10 }}>{t('find.resLine', { n: h.result_count, s: h.top_score })}{h.ai_used ? ' · ✨ AI' : ''}</small></div>
                      <button className="ghost-btn" onClick={() => findPartners(h.query)}>{t('find.rerun')}</button>
                    </div>
                  ))}
                </section>
              )}
            </>
          )}

          {activeNav === 'Intent wall' && (
            <>
              <div className="page-heading"><div><p className="eyebrow">{t('wall.eyebrow')}</p><h1>{t('wall.title')}</h1><p className="subheading">{t('wall.sub')}</p></div></div>
              <section className="section-block">
                <div className="matcher-card">
                  <div className="section-kicker"><span className="sparkle"><Megaphone size={15} /></span><span>{t('wall.composer')}</span></div>
                  <form onSubmit={postBroadcast} style={{ display: 'grid', gap: 10, marginTop: 18 }}>
                    <textarea value={bcText} onChange={(e) => setBcText(e.target.value)} placeholder={t('wall.placeholder')} required style={{ border: '1px solid #cbd9cf', borderRadius: 9, padding: '11px 12px', fontSize: 13, minHeight: 70 }} />
                    <div style={{ display: 'flex', gap: 10 }}>
                      <select value={bcCountry} onChange={(e) => setBcCountry(e.target.value)} style={{ borderRadius: 9, border: '1px solid #cbd9cf', padding: '10px', fontSize: 12 }}><option value="">{t('wall.anyCountry')}</option>{Object.entries(COUNTRY_NAMES).map(([c, n]) => <option key={c} value={c}>{n}</option>)}</select>
                      <select value={bcIndustry} onChange={(e) => setBcIndustry(e.target.value)} style={{ borderRadius: 9, border: '1px solid #cbd9cf', padding: '10px', fontSize: 12, flex: 1 }}><option value="">{t('wall.anySector')}</option>{INDUSTRIES.map((i) => <option key={i}>{i}</option>)}</select>
                      <button className="connect-btn" type="submit">{t('wall.broadcast')}</button>
                    </div>
                  </form>
                </div>
              </section>
              <section className="section-block">
                <div className="section-header"><div><p className="eyebrow">{t('wall.liveDemand')}</p><h2 className="section-title">{t('wall.openBc', { n: broadcasts.length })}</h2></div></div>
                {!broadcasts.length && <div className="match-card"><p className="match-detail">{t('wall.empty')}</p></div>}
                {broadcasts.map((b: any) => (
                  <div key={b.id} className="match-card" style={{ marginBottom: 10 }}>
                    <div className="match-topline"><div className="profile-mark orange"><Megaphone size={15} /></div>
                      <div className="match-copy"><div className="match-name-row"><h3>{b.author_profile_name}</h3><span className="verified">{b.status === 'open' ? t('wall.open') : t('wall.closed')}</span></div>
                        <p>{b.target_country ? (COUNTRY_NAMES[b.target_country] ?? b.target_country) : t('wall.panAfrican')}{b.industry ? ` · ${b.industry}` : ''}</p></div></div>
                    <p className="match-detail">“{b.text}”</p>
                      <div className="match-actions">
                      <span className="tag">{t('wall.notified', { n: b.match_count ?? 0 })}</span>
                      {b.author === user?.id && <button className="ghost-btn" onClick={() => closeBroadcast(b.id)}>{t('wall.close')}</button>}
                    </div>
                  </div>
                ))}
              </section>
            </>
          )}

          {activeNav === 'Opportunity map' && (
            <>
              <div className="page-heading"><div><p className="eyebrow">{t('map.coverage')}</p><h1>{t('map.title')}</h1><p className="subheading">{live ? t('map.liveSub', { n: mapStats?.total ?? allProfiles?.length ?? 0 }) : t('map.mockSub')}</p></div></div>
              <section className="section-block">
                <div className="section-header"><div><p className="eyebrow">{t('map.liveMap')}</p><h2 className="section-title">{t('map.capAcross')}</h2></div><select value={mapIndustry} onChange={(e) => setMapIndustry(e.target.value)} style={{ borderRadius: 20, border: '1px solid #e1e9e3', padding: '6px 10px', fontSize: 11 }}><option value="">{t('map.allSectors')}</option>{INDUSTRIES.map((i) => <option key={i}>{i}</option>)}</select></div>
                <AfricaMap points={mapStats?.by_country ?? [{ country: 'NG', count: 1 }, { country: 'GH', count: 3 }, { country: 'KE', count: 1 }, { country: 'RW', count: 1 }, { country: 'ZA', count: 1 }]} />
              </section>
              <section className="section-block">
                <div className="section-header"><div><p className="eyebrow">{t('map.byCountry')}</p><h2 className="section-title">{t('map.whereCap')}</h2></div></div>
                {(mapStats?.by_country ?? [{ country: 'NG', count: 1 }, { country: 'GH', count: 3 }, { country: 'KE', count: 1 }, { country: 'RW', count: 1 }, { country: 'ZA', count: 1 }]).map((row: any) => (
                  <div key={row.country} className="match-card" style={{ marginBottom: 10, display: 'flex', alignItems: 'center', gap: 12 }}>
                    <Flag code={row.country} /><strong style={{ minWidth: 120 }}>{COUNTRY_NAMES[row.country] ?? row.country}</strong>
                    <div style={{ flex: 1, background: '#eef4ef', borderRadius: 6, height: 10 }}><div style={{ width: `${Math.min(100, row.count * 25)}%`, background: '#195c4b', height: 10, borderRadius: 6 }} /></div>
                    <span className="tag">{t('map.profiles', { n: row.count })}</span>
                  </div>
                ))}
              </section>
              <section className="section-block">
                <div className="section-header"><div><p className="eyebrow">{t('map.bySector')}</p><h2 className="section-title">{t('map.whatOffers')}</h2></div></div>
                <div className="tag-row" style={{ flexWrap: 'wrap', gap: 8 }}>
                  {(mapStats?.by_industry ?? INDUSTRIES.slice(0, 4).map((i) => ({ industry: i, count: 1 }))).map((row: any) => (
                    <span key={row.industry} className="tag" style={{ fontSize: 11, padding: '8px 12px' }}>{row.industry} · {row.count}</span>
                  ))}
                </div>
              </section>
            </>
          )}

          {activeNav === 'My requests' && (
            <>
              <div className="page-heading"><div><p className="eyebrow">{t('req.inbox')}</p><h1>{t('req.title')}</h1><p className="subheading">{t('req.sub')}</p></div></div>
              <section className="section-block">
                {!requests.length && <div className="match-card"><p className="match-detail">{t('req.empty')}</p><div className="match-actions"><button className="connect-btn" onClick={() => setActiveNav('Find partners')}>{t('ov.findBtn')} <ChevronRight size={15} /></button></div></div>}
                {requests.map((r: any) => {
                  const isSender = myProfiles.some((p: any) => p.id === r.from_profile)
                  const isPending = r.status === 'pending'
                  const isReceiver = !isSender
                  return (
                    <div key={r.id} className={`match-card request-card ${r.status}`} style={{ marginBottom: 10 }}>
                      <div className="match-topline">
                        <div className={`profile-mark ${isSender ? 'orange' : 'blue'}`}>{isSender ? '↑' : '↓'}</div>
                        <div style={{ flex: 1 }}>
                          <div className="match-name-row">
                            <h3>{r.from_profile_name ?? `#${r.from_profile}`} → {r.to_profile_name ?? `#${r.to_profile}`}</h3>
                            <span className={`request-status-badge ${r.status}`}>{r.status === 'pending' ? (isSender ? t('req.awaiting') : t('req.actionNeeded')) : r.status}</span>
                          </div>
                          <p style={{ fontSize: 11, color: '#95a19c', margin: '3px 0 0' }}>{r.partnership_type} · {isSender ? t('req.sentByYou') : t('req.received')}</p>
                        </div>
                      </div>
                      <p className="match-detail">{r.message}</p>
                      {isReceiver && isPending && (
                        <div className="match-actions">
                          <button className="ghost-btn" onClick={() => actOnRequest(r.id, 'decline', r)}>{t('req.decline')}</button>
                          <button className="ghost-btn" onClick={() => actOnRequest(r.id, 'request_info', r)}>{t('req.askInfo')}</button>
                          <button className="connect-btn" onClick={() => actOnRequest(r.id, 'accept', r)}>{t('req.accept')} <ChevronRight size={15} /></button>
                        </div>
                      )}
                      {isSender && isPending && (
                        <div className="match-actions"><span className="tag" style={{ background: '#fff8ed', color: '#c07a30' }}>{t('req.waiting')}</span></div>
                      )}
                      {r.status === 'accepted' && (
                        <div className="match-actions"><span className="tag" style={{ background: '#eaf4ed', color: '#2d7a55', fontWeight: 700 }}>{t('req.active')}</span>
                          <button className="ghost-btn" onClick={() => setActiveNav('Partnerships')}>{t('req.viewInPart')}</button>
                        </div>
                      )}
                      {r.status === 'declined' && (
                        <div className="match-actions"><span className="tag" style={{ background: '#fdf0ec', color: '#b3543a' }}>{t('req.declined')}</span></div>
                      )}
                    </div>
                  )
                })}
              </section>
            </>
          )}

          {activeNav === 'My capability profile' && (
            <>
              <div className="page-heading"><div><p className="eyebrow">{t('cap.presence')}</p><h1>{t('cap.title')}</h1><p className="subheading">{t('cap.sub')}</p></div></div>
              {onboarding && (
                <div className="onboarding-banner">
                  <div className="onboarding-banner-icon">👋</div>
                  <div className="onboarding-banner-body">
                    <strong>{t('cap.welcome', { name: user?.first_name ? `, ${user.first_name}` : '' })}</strong>
                    <p>{t('cap.welcomeBody')}</p>
                  </div>
                  <button className="ghost-btn" onClick={() => setOnboarding(false)} style={{ marginLeft: 'auto', alignSelf: 'flex-start' }}>✕</button>
                </div>
              )}
              <section className="section-block">
                <div className="section-header"><div><p className="eyebrow">{t('cap.liveNet')}</p><h2 className="section-title">{t('cap.yourProfiles', { n: myProfiles.length })}</h2></div></div>
                {!myProfiles.length && <div className="match-card"><p className="match-detail">{t('cap.empty')}</p></div>}
                {myProfiles.map((p: any) => (
                  <div key={p.id} className="match-card" style={{ marginBottom: 10 }}>
                    <div className="match-topline">
                      <div className={`profile-mark ${TONES[p.id % 3]}`} style={p.avatar_url ? { padding: 0, overflow: 'hidden' } : undefined}>{p.avatar_url ? <img src={p.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : initialsOf(p.name)}</div>
                      <div className="match-copy"><div className="match-name-row"><h3>{p.name}</h3>{p.is_verified && <span className="verified">{t('card.verified')}</span>}</div><p>{COUNTRY_NAMES[p.country] ?? p.country}{p.city ? ` · ${p.city}` : ''} <span className="dot-sep">·</span> {p.industry}</p></div>
                    </div>
                    <p className="match-detail">{p.offers || p.products_services || t('cap.noOffers')}</p>
                    <div className="match-actions">
                      <button className="ghost-btn" onClick={() => router.push(`/profiles/${p.id}`)}>{t('cap.view')} <ArrowUpRight size={14} /></button>
                      <button className="ghost-btn" onClick={() => startEdit(p)}>{t('cap.edit')}</button>
                      <button className="ghost-btn" onClick={() => removeProfile(p.id)}>{t('cap.delete')}</button>
                      {!p.is_verified && <button className="ghost-btn" disabled={p.verification_requested} onClick={async () => { try { await api.requestVerification(p.id); setMyProfiles(myProfiles.map((x: any) => x.id === p.id ? { ...x, verification_requested: true } : x)); setToast({ title: t('toast.requested'), body: t('toast.requestedBody') }) } catch { setToast({ title: t('toast.verifyFail'), body: t('toast.verifyFailBody') }) } }}>{p.verification_requested ? t('cap.reviewPending') : t('cap.verifyMe')}</button>}
                    </div>
                  </div>
                ))}
              </section>
              <section className="section-block">
                <div className="profile-form-card">
                  <div className="profile-form-header">
                    <div className="profile-form-icon"><Plus size={18} /></div>
                    <div>
                      <p className="eyebrow">{editingId ? t('cap.editing', { id: editingId }) : t('cap.newProfile')}</p>
                      <h2 className="profile-form-title">{editingId ? t('cap.updateCap') : t('cap.newCap')}</h2>
                    </div>
                  </div>
                  <form onSubmit={saveProfile} className="profile-form-grid">
                    <div className="form-field full">
                      <label className="form-label">{t('cap.nameOrg')}</label>
                      <input className="form-input" placeholder={t('cap.namePh')} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
                    </div>
                    <div className="form-row">
                      <div className="form-field">
                        <label className="form-label">{t('cap.country')}</label>
                        <select className="form-input" value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })}>{Object.entries(COUNTRY_NAMES).map(([c, n]) => <option key={c} value={c}>{n}</option>)}</select>
                      </div>
                      <div className="form-field">
                        <label className="form-label">{t('cap.city')}</label>
                        <input className="form-input" placeholder={t('cap.cityPh')} value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
                      </div>
                      <div className="form-field">
                        <label className="form-label">{t('cap.industry')}</label>
                        <select className="form-input" value={form.industry} onChange={(e) => setForm({ ...form, industry: e.target.value })}>{INDUSTRIES.map((i) => <option key={i}>{i}</option>)}</select>
                      </div>
                    </div>
                    <div className="form-field full">
                      <label className="form-label">{t('cap.prodServ')}</label>
                      <input className="form-input" placeholder={t('cap.prodPh')} value={form.products_services} onChange={(e) => setForm({ ...form, products_services: e.target.value })} />
                    </div>
                    <div className="form-field full">
                      <label className="form-label">{t('cap.offerWhat')}</label>
                      <textarea className="form-input form-textarea" placeholder={t('cap.offerPh')} value={form.offers} onChange={(e) => setForm({ ...form, offers: e.target.value })} required />
                    </div>
                    <div className="form-field full">
                      <label className="form-label">{t('cap.needWhat')}</label>
                      <textarea className="form-input form-textarea" placeholder={t('cap.needPh')} value={form.needs} onChange={(e) => setForm({ ...form, needs: e.target.value })} />
                    </div>
                    <div className="form-field full">
                      <label className="form-label">{t('cap.ptype')}</label>
                      <input className="form-input" placeholder={t('cap.ptypePh')} value={form.partnership_type} onChange={(e) => setForm({ ...form, partnership_type: e.target.value })} />
                    </div>
                    <div className="form-field full">
                      <label className="form-label">{t('cap.logoUrl')} <span className="form-optional">{t('cap.optional')}</span></label>
                      <input className="form-input" placeholder="https://…" value={form.avatar_url} onChange={(e) => setForm({ ...form, avatar_url: e.target.value })} />
                    </div>
                    <div className="form-row">
                      <div className="form-field">
                        <label className="form-label">{t('cap.registry')} <span className="form-optional">{t('cap.registryEg')}</span></label>
                        <input className="form-input" placeholder={t('cap.registryPh')} value={(form as any).registry_name ?? ''} onChange={(e) => setForm({ ...form, registry_name: e.target.value } as any)} />
                      </div>
                      <div className="form-field">
                        <label className="form-label">{t('cap.regNum')}</label>
                        <input className="form-input" placeholder={t('cap.regNumPh')} value={(form as any).registration_number ?? ''} onChange={(e) => setForm({ ...form, registration_number: e.target.value } as any)} />
                      </div>
                    </div>
                    <div className="form-field full">
                      <label className="form-label">{t('cap.targetC')}</label>
                      <div className="country-tag-grid">{Object.entries(COUNTRY_NAMES).filter(([c]) => c !== 'OTHER').map(([c, n]) => (
                        <label key={c} className={`country-tag${form.target_countries.includes(c) ? ' selected' : ''}`}>
                          <input type="checkbox" checked={form.target_countries.includes(c)} onChange={() => setForm({ ...form, target_countries: form.target_countries.includes(c) ? form.target_countries.filter((x) => x !== c) : [...form.target_countries, c] })} />
                          {n}
                        </label>
                      ))}</div>
                    </div>
                    <div className="form-actions">
                      <button className="connect-btn" type="submit" disabled={savingProfile}>{savingProfile ? t('top.saving') : editingId ? t('cap.saveChanges') : t('cap.publish')}</button>
                      {editingId && <button className="ghost-btn" type="button" onClick={() => { setEditingId(null); setForm(EMPTY_FORM) }}>{t('cap.cancel')}</button>}
                    </div>
                  </form>
                </div>
              </section>
            </>
          )}

          {activeNav === 'Partnerships' && (
            <>
              <div className="page-heading"><div><p className="eyebrow">{t('part.acceptedEye')}</p><h1>{t('part.title')}</h1><p className="subheading">{t('part.sub')}</p></div></div>
              <section className="section-block">
                {!requests.filter((r) => r.status === 'accepted').length && <div className="match-card"><p className="match-detail">{t('part.empty')}</p></div>}
                {requests.filter((r) => r.status === 'accepted').map((r: any) => (
                  <div key={r.id} className="match-card" style={{ marginBottom: 10 }}>
                    <div className="match-name-row"><h3>{r.from_profile_name ?? `#${r.from_profile}`} → {r.to_profile_name ?? `#${r.to_profile}`}</h3><span className="verified">{t('part.acceptedBadge')}</span></div>
                    <p className="match-detail">{r.message}</p>
                    <div className="match-actions">
                      <button className="ghost-btn" onClick={() => openMou(r.id)} disabled={mouLoading === r.id}><FileText size={14} /> {mouLoading === r.id ? t('part.drafting') : t('part.draftMou')}</button>
                      <button className="ghost-btn" onClick={() => { setEndorseFor(endorseFor === r.id ? null : r.id); setEndorseComment('') }}><Star size={14} /> {t('part.endorse')}</button>
                    </div>
                    {endorseFor === r.id && (
                      <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <select value={endorseRating} onChange={(e) => setEndorseRating(e.target.value)} style={{ borderRadius: 9, border: '1px solid #cbd9cf', padding: '9px', fontSize: 12 }}>{['5', '4', '3', '2', '1'].map((s) => <option key={s} value={s}>{s} ★</option>)}</select>
                          <input value={endorseComment} onChange={(e) => setEndorseComment(e.target.value)} placeholder={t('part.endorsePh')} style={{ flex: 1, border: '1px solid #cbd9cf', borderRadius: 9, padding: '9px 10px', fontSize: 12 }} />
                        </div>
                        <div><button className="connect-btn" onClick={() => submitEndorsement(r.id)}>{t('part.submitReview')}</button></div>
                      </div>
                    )}
                  </div>
                ))}
                {mouDoc && (
                  <div className="match-card" style={{ marginTop: 10 }}>
                    <div className="section-header compact"><div><p className="eyebrow">{mouDoc.ai ? t('part.mouAi') : t('part.mouTpl')}</p><h2 className="section-title">{t('part.mouTitle')}</h2></div>
                      <button className="ghost-btn" onClick={() => setMouDoc(null)}>{t('top.close')}</button></div>
                    <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12, background: '#f5f8f5', borderRadius: 10, padding: 14, maxHeight: 400, overflow: 'auto' }}>{mouDoc.markdown}</pre>
                    <div className="match-actions" style={{ marginTop: 10 }}><button className="connect-btn" onClick={downloadMou}>{t('part.downloadMd')} <ChevronRight size={15} /></button></div>
                    <p className="match-detail" style={{ minHeight: 0 }}>{t('part.notBinding')}</p>
                  </div>
                )}
              </section>
            </>
          )}

          {activeNav === 'Messages' && (
            <>
              <div className="page-heading"><div><p className="eyebrow">{t('msg.direct')}</p><h1>{t('msg.title')}</h1><p className="subheading">{t('msg.sub')}</p></div></div>
              <section className="section-block">
                {!convos.length && <div className="match-card"><p className="match-detail">{t('msg.empty')}</p><div className="match-actions"><button className="connect-btn" onClick={() => setActiveNav('Find partners')}>{t('ov.findBtn')} <ChevronRight size={15} /></button></div></div>}
                {!!convos.length && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'minmax(220px, 300px) 1fr', gap: 14 }}>
                    <div className="match-card" style={{ padding: 10 }}>
                      {convos.map((c: any) => (
                        <button key={c.id} onClick={() => loadThread(c.id)} className={`nav-item ${activeConvoId === c.id ? 'active' : ''}`} style={{ width: '100%' }}>
                          <span className="profile-mark orange" style={{ width: 30, height: 30 }}>{initialsOf(c.other_username)}</span>
                          <span style={{ minWidth: 0 }}><strong style={{ display: 'block', fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.other_username}</strong><small style={{ display: 'block', fontSize: 10, color: '#95a19c', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.last_message ? `${c.last_message.sender_name}: ${c.last_message.body}` : t('msg.newConvo')}</small></span>
                          {!!c.unread_count && <em>{c.unread_count}</em>}
                        </button>
                      ))}
                    </div>
                    <div className="match-card" style={{ display: 'flex', flexDirection: 'column', minHeight: 380 }}>
                      {!activeConvoId && <p className="match-detail">{t('msg.pick')}</p>}
                      {!!activeConvoId && (
                        <>
                          <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12, maxHeight: 420 }}>
                            {threadMsgs.map((m: any) => {
                              const mine = m.sender_name === user?.username
                              return <div key={m.id} style={{ alignSelf: mine ? 'flex-end' : 'flex-start', background: mine ? '#195c4b' : '#f3f7f4', color: mine ? '#fff' : '#375149', borderRadius: 10, padding: '8px 12px', fontSize: 12, maxWidth: '80%' }}>{m.body}</div>
                            })}
                            {!threadMsgs.length && <p className="match-detail">{t('msg.sayHello')}</p>}
                          </div>
                          <form onSubmit={sendMsg} style={{ display: 'flex', gap: 8 }}>
                            <input value={msgBody} onChange={(e) => setMsgBody(e.target.value)} placeholder={t('msg.write')} style={{ flex: 1, border: '1px solid #cbd9cf', borderRadius: 9, padding: '10px 12px', fontSize: 13 }} />
                            <button className="connect-btn" type="submit" disabled={sendingMsg}><Send size={15} /> {sendingMsg ? '…' : t('msg.send')}</button>
                          </form>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </section>
            </>
          )}

        </div>
      </section>

      {toast && <div className="toast"><span><Handshake size={16} /></span><div><strong>{toast.title}</strong><p>{toast.body}</p></div><button onClick={() => setToast(null)}><X size={15} /></button></div>}
      <div style={{ display: 'none' }}><Compass size={10} /><Users size={10} /></div>

      {acceptedModal && (
        <div className="modal-overlay" onClick={() => setAcceptedModal(null)}>
          <div className="accepted-modal" onClick={(e) => e.stopPropagation()}>
            <div className="accepted-modal-icon">🤝</div>
            <h2 className="accepted-modal-title">{t('modal.accTitle')}</h2>
            <p className="accepted-modal-sub">{t('modal.accSub')}</p>
            <div className="accepted-modal-pair">
              <span>{acceptedModal.fromName}</span>
              <span className="accepted-modal-arrow">↔</span>
              <span>{acceptedModal.toName}</span>
            </div>
            <div className="accepted-modal-steps">
              <p className="eyebrow" style={{ marginBottom: 10 }}>{t('modal.whatNext')}</p>
              <button className="accepted-modal-action" onClick={() => { setAcceptedModal(null); setActiveNav('Messages') }}>{t('modal.sendMsg')}</button>
              <button className="accepted-modal-action" onClick={() => { setAcceptedModal(null); setActiveNav('Partnerships') }}>{t('modal.draftMou')}</button>
            </div>
            <button className="ghost-btn" style={{ marginTop: 16, alignSelf: 'center' }} onClick={() => setAcceptedModal(null)}>{t('top.close')}</button>
          </div>
        </div>
      )}
    </main>
  )
}
