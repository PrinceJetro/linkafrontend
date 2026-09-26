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
  loading: () => <div className="match-card"><p className="match-detail">Loading map…</p></div>,
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

function MatchCard({ profile, onConnect, onView }: { profile: Profile; onConnect: () => void; onView: () => void }) {
  return (
    <article className="match-card">
      <div className="match-topline">
        <div className={`profile-mark ${profile.tone}`} style={profile.avatar ? { padding: 0, overflow: 'hidden' } : undefined}>{profile.avatar ? <img src={profile.avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : profile.initials}</div>
        <div className="match-copy">
          <div className="match-name-row"><h3>{profile.name}</h3>{profile.verified && <span className="verified">Verified</span>}</div>
          <p><Flag code={profile.flag} /> {profile.country} <span className="dot-sep">·</span> {profile.sector}</p>
        </div>
        {profile.matched && profile.score != null && <div className="score"><strong>{profile.score}%</strong><span>match</span></div>}
      </div>
      <p className="match-detail">{profile.detail}</p>
      <div className="tag-row">{profile.tags.map((tag, i) => <span className="tag" key={`${tag}-${i}`}>{tag}</span>)}</div>
      <div className="match-actions"><button className="ghost-btn" onClick={onView}>View profile <ArrowUpRight size={14} /></button><button className="connect-btn" onClick={onConnect}>Connect <ChevronRight size={15} /></button></div>
    </article>
  )
}

const COUNTRY_CHIP: Record<string, string> = { NG: 'Nigeria', GH: 'Ghana', KE: 'Kenya', RW: 'Rwanda', ZA: 'South Africa', EG: 'Egypt', OTHER: 'Other' }

function IntentChips({ intent, ai }: { intent: any; ai: boolean }) {
  if (!intent) return null
  const chips = [
    ...(intent.countries ?? []).map((c: string) => COUNTRY_CHIP[c] ?? c),
    ...(intent.industries ?? []),
    ...((intent.keywords ?? []).slice(0, 4)),
  ]
  if (!chips.length) return null
  return (
    <div className="suggestions" style={{ marginTop: 10 }}>
      <span>{ai ? '✨ AI understood' : 'Understood'}:</span>
      {chips.map((c: string) => <span key={c} className="tag" style={{ background: '#eaf3ed', color: '#195c4b', fontWeight: 700 }}>{c}</span>)}
    </div>
  )
}

export default function Page() {
  const router = useRouter()
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
    () => (hasSearched ? `${visibleProfiles.length} potential partners found` : 'Find the right partner across Africa'),
    [hasSearched, visibleProfiles],
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
      setToast({ title: 'Backend offline', body: 'Django API not reachable on :8000 — showing cached data.' })
    } finally {
      setHasSearched(true)
      setSearching(false)
    }
  }

  async function connect(profile: Profile) {
    if (profile.id < 0) {
      setToast({ title: 'Mock profile', body: 'Start the Django backend to send real partnership requests.' })
      return
    }
    if (!myProfiles.length) {
      setActiveNav('My capability profile')
      setToast({ title: 'Create your profile first', body: 'You need a capability profile to send requests from.' })
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
      setToast({ title: 'Request sent', body: `${profile.name} will receive your partnership request.` })
    } catch (e: any) {
      setToast({ title: 'Request failed', body: 'Are you still logged in? Try logging in again.' })
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
        setToast({ title: 'Request declined', body: 'The other party has been notified.' })
      } else if (action === 'request_info') {
        setToast({ title: 'Info requested', body: 'They\'ll be prompted to share more details.' })
      }
    } catch {
      setToast({ title: 'Update failed', body: 'Could not update that request.' })
    }
  }

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault()
    setSavingProfile(true)
    try {
      if (editingId) {
        await api.updateProfile(editingId, form)
        setToast({ title: 'Profile updated', body: 'Your changes are live on the network.' })
      } else {
        await api.createProfile(form)
        setToast({ title: 'Profile created', body: 'Your capability profile is live on the network.' })
      }
      const data: any = await api.myProfiles()
      setMyProfiles(Array.isArray(data) ? data : data.results ?? [])
      setEditingId(null)
      setForm(EMPTY_FORM)
    } catch {
      setToast({ title: 'Save failed', body: 'Check the backend is running and you are logged in.' })
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
    if (!window.confirm('Delete this capability profile?')) return
    try {
      await api.deleteProfile(id)
      setMyProfiles(myProfiles.filter((p: any) => p.id !== id))
      setToast({ title: 'Deleted', body: 'Capability profile removed.' })
    } catch {
      setToast({ title: 'Delete failed', body: 'Could not delete that profile.' })
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
      setToast({ title: 'Send failed', body: 'Backend unreachable.' })
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
      setToast({ title: 'Mock profile', body: 'Start the Django backend for full capability profiles.' })
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
      setToast({ title: 'Load failed', body: 'Could not fetch more profiles.' })
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
      setPwMsg('Password updated.')
    } catch (err: any) {
      setPwMsg('Failed: ' + String(err.message || err).slice(0, 160))
    } finally {
      setPwSaving(false)
    }
  }

  async function postBroadcast(e: React.FormEvent) {
    e.preventDefault()
    if (!bcText.trim() || !myProfiles.length) {
      if (!myProfiles.length) setToast({ title: 'Need a profile', body: 'Create a capability profile first.' })
      return
    }
    try {
      await api.postBroadcast({ author_profile_id: myProfiles[0].id, text: bcText.trim(), target_country: bcCountry, industry: bcIndustry })
      setBcText('')
      const data: any = await api.broadcasts()
      setBroadcasts(Array.isArray(data) ? data : data.results ?? [])
      setToast({ title: 'Broadcast live', body: 'Matching suppliers are being alerted.' })
    } catch {
      setToast({ title: 'Failed', body: 'Could not post broadcast.' })
    }
  }

  async function closeBroadcast(id: number) {
    try {
      await api.closeBroadcast(id)
      setBroadcasts(broadcasts.map((b: any) => b.id === id ? { ...b, status: 'closed' } : b))
    } catch {
      setToast({ title: 'Failed', body: 'Could not close broadcast.' })
    }
  }

  async function openMou(requestId: number) {
    setMouLoading(requestId)
    try {
      const doc = await api.mou(requestId)
      setMouDoc({ request_id: requestId, ...doc })
    } catch {
      setToast({ title: 'MOU failed', body: 'Backend unreachable.' })
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
      setToast({ title: 'Endorsed', body: 'Your verified review is on their profile.' })
    } catch (err: any) {
      setToast({ title: 'Failed', body: String(err.message || err).slice(0, 160) })
    }
  }

  const recRef = useRef<{ rec: MediaRecorder; chunks: Blob[]; stream: MediaStream } | null>(null)

  async function toggleRecording() {
    // Second tap stops and processes
    if (recording && recRef.current) { recRef.current.rec.stop(); return }
    if (!navigator.mediaDevices?.getUserMedia) {
      setToast({ title: 'No microphone', body: 'This browser cannot record audio.' })
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
          setToast({ title: 'Transcribing…', body: 'Gemini turns your voice note into intent.' })
          const blob = new Blob(chunks, { type: rec.mimeType || 'audio/webm' })
          if (blob.size < 1024) {
            setToast({ title: 'Too short', body: 'Hold the mic and speak for a second or more.' })
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
          let body = 'Transcription unavailable right now.'
          try { body = JSON.parse(String(err.message || '')).detail || body } catch { /* keep default */ }
          setToast({ title: 'Voice failed', body })
        }
      }
      recRef.current = { rec, chunks, stream }
      rec.start()
      setRecording(true)
      setToast({ title: 'Recording…', body: 'Tap the mic again to stop (max 60s).' })
      window.setTimeout(() => { if (recRef.current) rec.stop() }, 60000)
    } catch {
      setRecording(false)
      setToast({ title: 'Mic blocked', body: 'Allow microphone access to use voice notes.' })
    }
  }

  function logout() {
    clearTokens()
    router.replace('/login')
  }

  const navItems = [
    { label: 'Overview', icon: LayoutDashboard },
    { label: 'Find partners', icon: Sparkles },
    { label: 'Intent wall', icon: Megaphone },
    { label: 'Opportunity map', icon: Map },
    { label: 'My requests', icon: Send, count: requests.length || undefined },
  ]
  const manageItems = [
    { label: 'My capability profile', icon: Building2 },
    { label: 'Partnerships', icon: Handshake },
    { label: 'Messages', icon: MessageSquare, count: convos.reduce((s: number, c: any) => s + (c.unread_count || 0), 0) || undefined },
  ]

  // SSR / pre-auth shell — must match server HTML exactly
  if (!mounted || !authChecked) {
    return <main className="app-shell" suppressHydrationWarning />
  }

  const userInitials = (user?.first_name?.[0] ?? user?.username?.[0] ?? 'U').toUpperCase()

  return (
    <main className="app-shell" suppressHydrationWarning>
      <aside className={`sidebar ${mobileNav ? 'open' : ''}`}>
        <div className="brand"><div className="brand-symbol"><Globe2 size={21} /></div><div><strong>linka</strong><span>Africa&apos;s partnership network</span></div><button className="close-nav" onClick={() => setMobileNav(false)}><X size={18} /></button></div>
        <div className="workspace"><div className="workspace-avatar">{myProfiles[0] ? initialsOf(myProfiles[0].name) : userInitials}</div><div><strong>{myProfiles[0]?.name ?? 'My workspace'}</strong><span>Business workspace</span></div><ChevronRight size={15} /></div>
        <nav className="side-nav" aria-label="Main navigation">
          <span className="nav-label">Workspace</span>
          {navItems.map(({ label, icon: Icon, count }: any) => <button key={label} className={`nav-item ${activeNav === label ? 'active' : ''}`} onClick={() => { setActiveNav(label); setMobileNav(false) }}><Icon size={18} /><span>{label}</span>{count ? <em>{count}</em> : null}</button>)}
          <span className="nav-label nav-label-spaced">Manage</span>
          {manageItems.map(({ label, icon: Icon, count }: any) => <button key={label} className={`nav-item ${activeNav === label ? 'active' : ''}`} onClick={() => { setActiveNav(label); setMobileNav(false) }}><Icon size={18} /><span>{label}</span>{count ? <em>{count}</em> : null}</button>)}
        </nav>
        <div className="sidebar-bottom">
          <div className="side-help"><CircleHelp size={17} /><div><strong>Need a hand?</strong><span>Explore the network guide</span></div></div>
          <div className="user-row"><div className="user-avatar">{userInitials}</div><div><strong>{user?.first_name || user?.username || 'Account'}</strong><span>{live ? '● Live API' : '○ Mock data'}</span></div><button className="icon-btn" title="Log out" onClick={logout} style={{ marginLeft: 'auto' }}><LogOut size={16} /></button></div>
        </div>
      </aside>
      {mobileNav && <button className="mobile-overlay" aria-label="Close navigation" onClick={() => setMobileNav(false)} />}
      <section className="main-area">
        <header className="topbar"><button className="menu-btn" onClick={() => setMobileNav(true)}><Menu size={20} /></button><div className="crumb"><span>Workspace</span><ChevronRight size={14} /><strong>{activeNav}</strong></div><div className="top-actions"><span className="tag">{live ? 'Live API' : 'Mock data — start Django :8000'}</span><div style={{ position: 'relative' }}><button className="icon-btn" aria-label="Notifications" onClick={() => { setShowNotifs(!showNotifs); if (!showNotifs) { try { localStorage.setItem('linka_notif_seen', new Date().toISOString()) } catch {} } }}><Bell size={18} />{notifs.filter((n: any) => { try { return new Date(n.created_at) > new Date(localStorage.getItem('linka_notif_seen') ?? 0) } catch { return true } }).length > 0 && <i />}</button>{showNotifs && <div className="match-card" style={{ position: 'absolute', right: 0, top: 40, width: 320, zIndex: 50, maxHeight: 380, overflow: 'auto' }}><p className="eyebrow">Notifications</p>{!notifs.length && <p className="match-detail">All caught up — new requests and updates appear here.</p>}{notifs.map((n: any, i: number) => <p key={i} className="match-detail" style={{ minHeight: 0, margin: '8px 0' }}>• {n.text}</p>)}<div className="match-actions"><button className="ghost-btn" onClick={() => { setShowNotifs(false); setActiveNav('My requests') }}>Open inbox</button></div></div>}</div><div style={{ position: 'relative' }}><button className="top-avatar" title={user?.username} onClick={() => setShowAccount(!showAccount)}>{userInitials}</button>{showAccount && <div className="match-card" style={{ position: 'absolute', right: 0, top: 40, width: 300, zIndex: 50 }}><p className="eyebrow">Account</p><p className="match-detail" style={{ minHeight: 0, margin: '4px 0' }}><strong>{user?.first_name || user?.username}</strong></p><p className="match-detail" style={{ minHeight: 0, margin: '0 0 10px' }}>{user?.email}</p><form onSubmit={changePw} style={{ display: 'grid', gap: 8 }}><input type="password" value={oldPw} onChange={(e) => setOldPw(e.target.value)} placeholder="Current password" required style={{ border: '1px solid #cbd9cf', borderRadius: 9, padding: '9px 10px', fontSize: 12 }} /><input type="password" value={newPw} minLength={8} onChange={(e) => setNewPw(e.target.value)} placeholder="New password (min 8)" required style={{ border: '1px solid #cbd9cf', borderRadius: 9, padding: '9px 10px', fontSize: 12 }} />{pwMsg && <p className="match-detail" style={{ minHeight: 0, margin: 0 }}>{pwMsg}</p>}<div className="match-actions"><button className="ghost-btn" type="submit" disabled={pwSaving}>{pwSaving ? 'Saving…' : 'Change password'}</button><button className="ghost-btn" type="button" onClick={logout}>Log out</button></div></form></div>}</div></div></header>
        <div className="content-wrap">

          {activeNav === 'Overview' && (
            <>
              <div className="page-heading"><div><p className="eyebrow">Tuesday, 22 September 2026</p><h1>Good morning{user?.first_name ? `, ${user.first_name}` : ''} <span>—</span></h1><p className="subheading">Make your next cross-border connection count.</p></div><button className="outline-action" onClick={() => setActiveNav('My capability profile')}><Plus size={17} /> Update capability profile</button></div>
              <section className="hero-grid">
                <div className="matcher-card"><div className="section-kicker"><span className="sparkle"><Sparkles size={15} /></span><span>AI partnership matcher</span><span className="beta">BETA</span></div><h2>{headline}</h2><p className="matcher-intro">Tell us what you need in your own words. Linka finds complementary capabilities and explains why they could work.</p><div className="query-box"><textarea aria-label="Describe what you need" value={query} onChange={(e) => setQuery(e.target.value)} /><div className="query-footer"><span><Sparkles size={14} /> AI understands intent, not just keywords</span><span style={{ display: 'flex', gap: 8 }}><button className="icon-btn" title="Voice note (tap, speak, tap again)" onClick={toggleRecording} style={recording ? { color: '#d77839' } : undefined}><Mic size={16} />{recording && <i />}</button><button onClick={() => findPartners()} disabled={searching}><Search size={16} /> {searching ? 'Searching…' : 'Find partners'}</button></span></div></div><IntentChips intent={intent} ai={aiMatch} /><div className="suggestions"><span>Try an example</span><button onClick={() => setQuery('I need a technology partner in Kenya to help scale our mobile payments platform.')}>Tech partner in Kenya</button><button onClick={() => setQuery('Looking for a reliable manufacturer in South Africa for sustainable packaging.')}>Sustainable manufacturer</button></div></div>
                <div className="insight-card"><div className="insight-orbit orbit-one" /><div className="insight-orbit orbit-two" /><div className="insight-icon"><Target size={22} /></div><p className="eyebrow light">Your network pulse</p><h3>{requests.length ? `${requests.length} active requests` : '3 new opportunities'}<br />worth exploring</h3><p className="insight-text">Based on your capability profile and the latest activity across the network.</p><button className="light-link" onClick={() => setActiveNav('Find partners')}>Explore opportunities <ArrowUpRight size={15} /></button><div className="insight-stat"><div><strong>{mapStats?.total ?? 5}</strong><span>countries connected</span></div><div><strong>{mapStats?.total ?? 18}</strong><span>active capabilities</span></div></div></div>
              </section>
              <section className="section-block"><div className="section-header"><div><p className="eyebrow">We measure</p><h2 className="section-title">Network performance</h2></div><span className="tag">{aiMatch || (metricsData?.ai_searches ?? 0) > 0 ? '✨ AI-assisted' : 'Rule-based matching'}</span></div><div className="matches-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
                {[
                  ['Profiles live', metricsData?.profiles ?? allProfiles?.length ?? '—'],
                  ['Searches run', metricsData?.searches ?? '—'],
                  ['Avg. top match', metricsData ? `${metricsData.avg_top_score}%` : '—'],
                  ['Search → request', metricsData ? `${metricsData.request_conversion_pct}%` : '—'],
                ].map(([label, value]) => <div key={label} className="match-card"><div className="score" style={{ textAlign: 'left' }}><strong>{value}</strong><span>{label}</span></div></div>)}
              </div></section>
              <section className="section-block"><div className="section-header"><div><p className="eyebrow">Based on your search</p><h2 className="section-title">{hasSearched ? 'Your best-fit partners' : 'Potential partners for you'}</h2></div><button className="text-button" onClick={() => setActiveNav('Find partners')}>View all matches <ArrowUpRight size={15} /></button></div><div className="matches-grid">{visibleProfiles.slice(0, 3).map((profile) => <MatchCard key={profile.name} profile={profile} onConnect={() => connect(profile)} onView={() => viewProfile(profile)} />)}</div></section>
              <section className="lower-grid"><div className="activity-card"><div className="section-header compact"><div><p className="eyebrow">Your activity</p><h2 className="section-title">Partnership journey</h2></div><button className="icon-btn"><ArrowUpRight size={16} /></button></div><div className="journey"><div className="journey-step done"><span><Search size={15} /></span><div><strong>Define your need</strong><small>Profile and intent captured</small></div><b>Done</b></div><div className="journey-line done" /><div className="journey-step current"><span><Sparkles size={15} /></span><div><strong>Discover a match</strong><small>{visibleProfiles.length} recommendations ready</small></div><b>Now</b></div><div className="journey-line" /><div className="journey-step"><span><Handshake size={15} /></span><div><strong>Start a partnership</strong><small>{requests.length ? `${requests.length} requests sent` : 'Send your first request'}</small></div></div></div></div><div className="map-card"><div className="section-header compact"><div><p className="eyebrow">Explore the network</p><h2 className="section-title">Africa at a glance</h2></div><button className="text-button" onClick={() => setActiveNav('Opportunity map')}>Open map <ArrowUpRight size={15} /></button></div><div className="map-visual"><div className="map-glow" /><div className="map-label label-ng"><span />Nigeria</div><div className="map-label label-gh"><span />Ghana</div><div className="map-label label-ke"><span />Kenya</div><div className="map-label label-rw"><span />Rwanda</div><div className="map-label label-za"><span />South Africa</div><div className="map-lines line-a" /><div className="map-lines line-b" /><div className="map-land">AFRICA</div></div></div></section>
            </>
          )}

          {activeNav === 'Find partners' && (
            <>
              <div className="page-heading"><div><p className="eyebrow">AI matcher</p><h1>Find partners</h1><p className="subheading">{live ? 'Live results from the Django API.' : 'Backend offline — showing mock data.'}</p></div></div>
              <section className="hero-grid" style={{ gridTemplateColumns: '1fr' }}>
                <div className="matcher-card"><div className="section-kicker"><span className="sparkle"><Sparkles size={15} /></span><span>AI partnership matcher</span><span className="beta">BETA</span></div><h2>{headline}</h2><div className="query-box"><textarea aria-label="Describe what you need" value={query} onChange={(e) => setQuery(e.target.value)} /><div className="query-footer"><span><Sparkles size={14} /> AI understands intent, not just keywords</span><span style={{ display: 'flex', gap: 8 }}><button className="icon-btn" title="Voice note (tap, speak, tap again)" onClick={toggleRecording} style={recording ? { color: '#d77839' } : undefined}><Mic size={16} />{recording && <i />}</button><button onClick={() => findPartners()} disabled={searching}><Search size={16} /> {searching ? 'Searching…' : 'Find partners'}</button></span></div></div><IntentChips intent={intent} ai={aiMatch} /><div className="suggestions"><span>Filter</span><select value={filters.country} onChange={(e) => setFilters({ ...filters, country: e.target.value })} style={{ borderRadius: 20, border: '1px solid #e1e9e3', padding: '6px 10px', fontSize: 11 }}><option value="">All countries</option>{Object.entries(COUNTRY_NAMES).map(([c, n]) => <option key={c} value={c}>{n}</option>)}</select><select value={filters.industry} onChange={(e) => setFilters({ ...filters, industry: e.target.value })} style={{ borderRadius: 20, border: '1px solid #e1e9e3', padding: '6px 10px', fontSize: 11 }}><option value="">All sectors</option>{INDUSTRIES.map((i) => <option key={i}>{i}</option>)}</select><select value={filters.partnership_type} onChange={(e) => setFilters({ ...filters, partnership_type: e.target.value })} style={{ borderRadius: 20, border: '1px solid #e1e9e3', padding: '6px 10px', fontSize: 11 }}><option value="">Any partnership type</option>{['Distribution', 'Retail', 'Logistics', 'Technology', 'Manufacturing', 'Research'].map((t) => <option key={t}>{t}</option>)}</select></div></div>
              </section>
              <section className="section-block"><div className="matches-grid">{visibleProfiles.map((profile) => <MatchCard key={profile.name} profile={profile} onConnect={() => connect(profile)} onView={() => viewProfile(profile)} />)}</div>{profilesNext && (!hasSearched || !liveResults) && <div style={{ marginTop: 14 }}><button className="ghost-btn" onClick={loadMoreProfiles}>Show more partners</button></div>}</section>
              {!!history.length && (
                <section className="section-block"><div className="section-header"><div><p className="eyebrow">History</p><h2 className="section-title">Recent searches</h2></div></div>
                  {history.slice(0, 5).map((h: any) => (
                    <div key={h.id} className="match-card" style={{ marginBottom: 10, display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ flex: 1, minWidth: 0 }}><strong style={{ display: 'block', fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{h.query}</strong><small style={{ color: '#95a19c', fontSize: 10 }}>{h.result_count} results · top {h.top_score}%{h.ai_used ? ' · ✨ AI' : ''}</small></div>
                      <button className="ghost-btn" onClick={() => findPartners(h.query)}>Re-run</button>
                    </div>
                  ))}
                </section>
              )}
            </>
          )}

          {activeNav === 'Intent wall' && (
            <>
              <div className="page-heading"><div><p className="eyebrow">Reverse marketplace</p><h1>Intent wall</h1><p className="subheading">Post urgent demand — AI alerts suppliers whose capabilities match.</p></div></div>
              <section className="section-block">
                <div className="matcher-card">
                  <div className="section-kicker"><span className="sparkle"><Megaphone size={15} /></span><span>Broadcast urgent intent</span></div>
                  <form onSubmit={postBroadcast} style={{ display: 'grid', gap: 10, marginTop: 18 }}>
                    <textarea value={bcText} onChange={(e) => setBcText(e.target.value)} placeholder="e.g. Urgent: certified cold-chain warehouse in Nairobi for 30 days" required style={{ border: '1px solid #cbd9cf', borderRadius: 9, padding: '11px 12px', fontSize: 13, minHeight: 70 }} />
                    <div style={{ display: 'flex', gap: 10 }}>
                      <select value={bcCountry} onChange={(e) => setBcCountry(e.target.value)} style={{ borderRadius: 9, border: '1px solid #cbd9cf', padding: '10px', fontSize: 12 }}><option value="">Any country</option>{Object.entries(COUNTRY_NAMES).map(([c, n]) => <option key={c} value={c}>{n}</option>)}</select>
                      <select value={bcIndustry} onChange={(e) => setBcIndustry(e.target.value)} style={{ borderRadius: 9, border: '1px solid #cbd9cf', padding: '10px', fontSize: 12, flex: 1 }}><option value="">Any sector</option>{INDUSTRIES.map((i) => <option key={i}>{i}</option>)}</select>
                      <button className="connect-btn" type="submit">Broadcast</button>
                    </div>
                  </form>
                </div>
              </section>
              <section className="section-block">
                <div className="section-header"><div><p className="eyebrow">Live demand</p><h2 className="section-title">Open broadcasts ({broadcasts.length})</h2></div></div>
                {!broadcasts.length && <div className="match-card"><p className="match-detail">No open broadcasts — post the first urgent need.</p></div>}
                {broadcasts.map((b: any) => (
                  <div key={b.id} className="match-card" style={{ marginBottom: 10 }}>
                    <div className="match-topline"><div className="profile-mark orange"><Megaphone size={15} /></div>
                      <div className="match-copy"><div className="match-name-row"><h3>{b.author_profile_name}</h3><span className="verified">{b.status}</span></div>
                        <p>{b.target_country ? (COUNTRY_NAMES[b.target_country] ?? b.target_country) : 'Pan-African'}{b.industry ? ` · ${b.industry}` : ''}</p></div></div>
                    <p className="match-detail">“{b.text}”</p>
                    <div className="match-actions">
                      <span className="tag">{b.match_count ?? 0} suppliers notified</span>
                      {b.author === user?.id && <button className="ghost-btn" onClick={() => closeBroadcast(b.id)}>Close</button>}
                    </div>
                  </div>
                ))}
              </section>
            </>
          )}

          {activeNav === 'Opportunity map' && (
            <>
              <div className="page-heading"><div><p className="eyebrow">Network coverage</p><h1>Opportunity map</h1><p className="subheading">{live ? `${mapStats?.total ?? allProfiles?.length ?? 0} capabilities live on the network.` : 'Backend offline — showing mock coverage.'}</p></div></div>
              <section className="section-block">
                <div className="section-header"><div><p className="eyebrow">Live map</p><h2 className="section-title">Capabilities across Africa</h2></div><select value={mapIndustry} onChange={(e) => setMapIndustry(e.target.value)} style={{ borderRadius: 20, border: '1px solid #e1e9e3', padding: '6px 10px', fontSize: 11 }}><option value="">All sectors</option>{INDUSTRIES.map((i) => <option key={i}>{i}</option>)}</select></div>
                <AfricaMap points={mapStats?.by_country ?? [{ country: 'NG', count: 1 }, { country: 'GH', count: 3 }, { country: 'KE', count: 1 }, { country: 'RW', count: 1 }, { country: 'ZA', count: 1 }]} />
              </section>
              <section className="section-block">
                <div className="section-header"><div><p className="eyebrow">By country</p><h2 className="section-title">Where capabilities live</h2></div></div>
                {(mapStats?.by_country ?? [{ country: 'NG', count: 1 }, { country: 'GH', count: 3 }, { country: 'KE', count: 1 }, { country: 'RW', count: 1 }, { country: 'ZA', count: 1 }]).map((row: any) => (
                  <div key={row.country} className="match-card" style={{ marginBottom: 10, display: 'flex', alignItems: 'center', gap: 12 }}>
                    <Flag code={row.country} /><strong style={{ minWidth: 120 }}>{COUNTRY_NAMES[row.country] ?? row.country}</strong>
                    <div style={{ flex: 1, background: '#eef4ef', borderRadius: 6, height: 10 }}><div style={{ width: `${Math.min(100, row.count * 25)}%`, background: '#195c4b', height: 10, borderRadius: 6 }} /></div>
                    <span className="tag">{row.count} profiles</span>
                  </div>
                ))}
              </section>
              <section className="section-block">
                <div className="section-header"><div><p className="eyebrow">By sector</p><h2 className="section-title">What the network offers</h2></div></div>
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
              <div className="page-heading"><div><p className="eyebrow">Inbox</p><h1>My requests</h1><p className="subheading">Sent and received partnership requests.</p></div></div>
              <section className="section-block">
                {!requests.length && <div className="match-card"><p className="match-detail">No requests yet. Find a partner and hit Connect.</p><div className="match-actions"><button className="connect-btn" onClick={() => setActiveNav('Find partners')}>Find partners <ChevronRight size={15} /></button></div></div>}
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
                            <span className={`request-status-badge ${r.status}`}>{r.status === 'pending' ? (isSender ? 'Awaiting response' : 'Action needed') : r.status}</span>
                          </div>
                          <p style={{ fontSize: 11, color: '#95a19c', margin: '3px 0 0' }}>{r.partnership_type} · {isSender ? 'Sent by you' : 'Received'}</p>
                        </div>
                      </div>
                      <p className="match-detail">{r.message}</p>
                      {isReceiver && isPending && (
                        <div className="match-actions">
                          <button className="ghost-btn" onClick={() => actOnRequest(r.id, 'decline', r)}>Decline</button>
                          <button className="ghost-btn" onClick={() => actOnRequest(r.id, 'request_info', r)}>Ask for info</button>
                          <button className="connect-btn" onClick={() => actOnRequest(r.id, 'accept', r)}>Accept <ChevronRight size={15} /></button>
                        </div>
                      )}
                      {isSender && isPending && (
                        <div className="match-actions"><span className="tag" style={{ background: '#fff8ed', color: '#c07a30' }}>⏳ Waiting for their response</span></div>
                      )}
                      {r.status === 'accepted' && (
                        <div className="match-actions"><span className="tag" style={{ background: '#eaf4ed', color: '#2d7a55', fontWeight: 700 }}>✓ Partnership active</span>
                          <button className="ghost-btn" onClick={() => setActiveNav('Partnerships')}>View in Partnerships →</button>
                        </div>
                      )}
                      {r.status === 'declined' && (
                        <div className="match-actions"><span className="tag" style={{ background: '#fdf0ec', color: '#b3543a' }}>✕ Declined</span></div>
                      )}
                    </div>
                  )
                })}
              </section>
            </>
          )}

          {activeNav === 'My capability profile' && (
            <>
              <div className="page-heading"><div><p className="eyebrow">Your presence</p><h1>My capability profile</h1><p className="subheading">What you offer Africa — and what you need from it.</p></div></div>
              {onboarding && (
                <div className="onboarding-banner">
                  <div className="onboarding-banner-icon">👋</div>
                  <div className="onboarding-banner-body">
                    <strong>Welcome{user?.first_name ? `, ${user.first_name}` : ''}! One last step.</strong>
                    <p>Tell the network who you are and what you're looking for. Fill in the form below to publish your capability profile — this is what the AI uses to match you with the right partners across Africa.</p>
                  </div>
                  <button className="ghost-btn" onClick={() => setOnboarding(false)} style={{ marginLeft: 'auto', alignSelf: 'flex-start' }}>✕</button>
                </div>
              )}
              <section className="section-block">
                <div className="section-header"><div><p className="eyebrow">Live on the network</p><h2 className="section-title">Your profiles ({myProfiles.length})</h2></div></div>
                {!myProfiles.length && <div className="match-card"><p className="match-detail">No profile yet — create your first one below to start sending partnership requests.</p></div>}
                {myProfiles.map((p: any) => (
                  <div key={p.id} className="match-card" style={{ marginBottom: 10 }}>
                    <div className="match-topline">
                      <div className={`profile-mark ${TONES[p.id % 3]}`} style={p.avatar_url ? { padding: 0, overflow: 'hidden' } : undefined}>{p.avatar_url ? <img src={p.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : initialsOf(p.name)}</div>
                      <div className="match-copy"><div className="match-name-row"><h3>{p.name}</h3>{p.is_verified && <span className="verified">Verified</span>}</div><p>{COUNTRY_NAMES[p.country] ?? p.country}{p.city ? ` · ${p.city}` : ''} <span className="dot-sep">·</span> {p.industry}</p></div>
                    </div>
                    <p className="match-detail">{p.offers || p.products_services || 'No offers described yet.'}</p>
                    <div className="match-actions">
                      <button className="ghost-btn" onClick={() => router.push(`/profiles/${p.id}`)}>View <ArrowUpRight size={14} /></button>
                      <button className="ghost-btn" onClick={() => startEdit(p)}>Edit</button>
                      <button className="ghost-btn" onClick={() => removeProfile(p.id)}>Delete</button>
                      {!p.is_verified && <button className="ghost-btn" disabled={p.verification_requested} onClick={async () => { try { await api.requestVerification(p.id); setMyProfiles(myProfiles.map((x: any) => x.id === p.id ? { ...x, verification_requested: true } : x)); setToast({ title: 'Requested', body: 'Verification requested — an admin will review it.' }) } catch { setToast({ title: 'Failed', body: 'Could not request verification.' }) } }}>{p.verification_requested ? 'Review pending' : 'Verify me'}</button>}
                    </div>
                  </div>
                ))}
              </section>
              <section className="section-block">
                <div className="profile-form-card">
                  <div className="profile-form-header">
                    <div className="profile-form-icon"><Plus size={18} /></div>
                    <div>
                      <p className="eyebrow">{editingId ? `Editing profile #${editingId}` : 'New profile'}</p>
                      <h2 className="profile-form-title">{editingId ? 'Update your capability' : 'New capability profile'}</h2>
                    </div>
                  </div>
                  <form onSubmit={saveProfile} className="profile-form-grid">
                    <div className="form-field full">
                      <label className="form-label">Name / Organization</label>
                      <input className="form-input" placeholder="e.g. Agro Exports Ltd." value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
                    </div>
                    <div className="form-row">
                      <div className="form-field">
                        <label className="form-label">Country</label>
                        <select className="form-input" value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })}>{Object.entries(COUNTRY_NAMES).map(([c, n]) => <option key={c} value={c}>{n}</option>)}</select>
                      </div>
                      <div className="form-field">
                        <label className="form-label">City</label>
                        <input className="form-input" placeholder="e.g. Lagos" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
                      </div>
                      <div className="form-field">
                        <label className="form-label">Industry</label>
                        <select className="form-input" value={form.industry} onChange={(e) => setForm({ ...form, industry: e.target.value })}>{INDUSTRIES.map((i) => <option key={i}>{i}</option>)}</select>
                      </div>
                    </div>
                    <div className="form-field full">
                      <label className="form-label">Products / Services</label>
                      <input className="form-input" placeholder="What do you produce or provide?" value={form.products_services} onChange={(e) => setForm({ ...form, products_services: e.target.value })} />
                    </div>
                    <div className="form-field full">
                      <label className="form-label">What can you offer?</label>
                      <textarea className="form-input form-textarea" placeholder="Describe your capability, capacity, or assets…" value={form.offers} onChange={(e) => setForm({ ...form, offers: e.target.value })} required />
                    </div>
                    <div className="form-field full">
                      <label className="form-label">What do you need?</label>
                      <textarea className="form-input form-textarea" placeholder="Describe what you're looking for from a partner…" value={form.needs} onChange={(e) => setForm({ ...form, needs: e.target.value })} />
                    </div>
                    <div className="form-field full">
                      <label className="form-label">Partnership type</label>
                      <input className="form-input" placeholder="e.g. Distribution, Joint Venture, Supplier…" value={form.partnership_type} onChange={(e) => setForm({ ...form, partnership_type: e.target.value })} />
                    </div>
                    <div className="form-field full">
                      <label className="form-label">Logo / Photo URL <span className="form-optional">(optional)</span></label>
                      <input className="form-input" placeholder="https://…" value={form.avatar_url} onChange={(e) => setForm({ ...form, avatar_url: e.target.value })} />
                    </div>
                    <div className="form-row">
                      <div className="form-field">
                        <label className="form-label">Registry <span className="form-optional">(e.g. CAC Nigeria)</span></label>
                        <input className="form-input" placeholder="Registry name" value={(form as any).registry_name ?? ''} onChange={(e) => setForm({ ...form, registry_name: e.target.value } as any)} />
                      </div>
                      <div className="form-field">
                        <label className="form-label">Reg. Number</label>
                        <input className="form-input" placeholder="e.g. RC1234567" value={(form as any).registration_number ?? ''} onChange={(e) => setForm({ ...form, registration_number: e.target.value } as any)} />
                      </div>
                    </div>
                    <div className="form-field full">
                      <label className="form-label">Target countries</label>
                      <div className="country-tag-grid">{Object.entries(COUNTRY_NAMES).filter(([c]) => c !== 'OTHER').map(([c, n]) => (
                        <label key={c} className={`country-tag${form.target_countries.includes(c) ? ' selected' : ''}`}>
                          <input type="checkbox" checked={form.target_countries.includes(c)} onChange={() => setForm({ ...form, target_countries: form.target_countries.includes(c) ? form.target_countries.filter((x) => x !== c) : [...form.target_countries, c] })} />
                          {n}
                        </label>
                      ))}</div>
                    </div>
                    <div className="form-actions">
                      <button className="connect-btn" type="submit" disabled={savingProfile}>{savingProfile ? 'Saving…' : editingId ? 'Save changes' : 'Publish profile'}</button>
                      {editingId && <button className="ghost-btn" type="button" onClick={() => { setEditingId(null); setForm(EMPTY_FORM) }}>Cancel</button>}
                    </div>
                  </form>
                </div>
              </section>
            </>
          )}

          {activeNav === 'Partnerships' && (
            <>
              <div className="page-heading"><div><p className="eyebrow">Accepted</p><h1>Partnerships</h1><p className="subheading">Connections that both sides confirmed.</p></div></div>
              <section className="section-block">
                {!requests.filter((r) => r.status === 'accepted').length && <div className="match-card"><p className="match-detail">No confirmed partnerships yet — accept a request to start one.</p></div>}
                {requests.filter((r) => r.status === 'accepted').map((r: any) => (
                  <div key={r.id} className="match-card" style={{ marginBottom: 10 }}>
                    <div className="match-name-row"><h3>{r.from_profile_name ?? `#${r.from_profile}`} → {r.to_profile_name ?? `#${r.to_profile}`}</h3><span className="verified">Accepted</span></div>
                    <p className="match-detail">{r.message}</p>
                    <div className="match-actions">
                      <button className="ghost-btn" onClick={() => openMou(r.id)} disabled={mouLoading === r.id}><FileText size={14} /> {mouLoading === r.id ? 'Drafting…' : 'Draft MOU'}</button>
                      <button className="ghost-btn" onClick={() => { setEndorseFor(endorseFor === r.id ? null : r.id); setEndorseComment('') }}><Star size={14} /> Endorse partner</button>
                    </div>
                    {endorseFor === r.id && (
                      <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <select value={endorseRating} onChange={(e) => setEndorseRating(e.target.value)} style={{ borderRadius: 9, border: '1px solid #cbd9cf', padding: '9px', fontSize: 12 }}>{['5', '4', '3', '2', '1'].map((s) => <option key={s} value={s}>{s} ★</option>)}</select>
                          <input value={endorseComment} onChange={(e) => setEndorseComment(e.target.value)} placeholder="How did the deal go?" style={{ flex: 1, border: '1px solid #cbd9cf', borderRadius: 9, padding: '9px 10px', fontSize: 12 }} />
                        </div>
                        <div><button className="connect-btn" onClick={() => submitEndorsement(r.id)}>Submit verified review</button></div>
                      </div>
                    )}
                  </div>
                ))}
                {mouDoc && (
                  <div className="match-card" style={{ marginTop: 10 }}>
                    <div className="section-header compact"><div><p className="eyebrow">Draft MOU {mouDoc.ai ? '✨ AI-generated' : '(template)'}</p><h2 className="section-title">Memorandum of Understanding</h2></div>
                      <button className="ghost-btn" onClick={() => setMouDoc(null)}>Close</button></div>
                    <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12, background: '#f5f8f5', borderRadius: 10, padding: 14, maxHeight: 400, overflow: 'auto' }}>{mouDoc.markdown}</pre>
                    <div className="match-actions" style={{ marginTop: 10 }}><button className="connect-btn" onClick={downloadMou}>Download .md <ChevronRight size={15} /></button></div>
                    <p className="match-detail" style={{ minHeight: 0 }}>Not legally binding — requires independent legal review.</p>
                  </div>
                )}
              </section>
            </>
          )}

          {activeNav === 'Messages' && (
            <>
              <div className="page-heading"><div><p className="eyebrow">Direct lines</p><h1>Messages</h1><p className="subheading">Talk to partners straight from a match — no inbox-hopping.</p></div></div>
              <section className="section-block">
                {!convos.length && <div className="match-card"><p className="match-detail">No conversations yet. Open any profile and hit Message to start one.</p><div className="match-actions"><button className="connect-btn" onClick={() => setActiveNav('Find partners')}>Find partners <ChevronRight size={15} /></button></div></div>}
                {!!convos.length && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'minmax(220px, 300px) 1fr', gap: 14 }}>
                    <div className="match-card" style={{ padding: 10 }}>
                      {convos.map((c: any) => (
                        <button key={c.id} onClick={() => loadThread(c.id)} className={`nav-item ${activeConvoId === c.id ? 'active' : ''}`} style={{ width: '100%' }}>
                          <span className="profile-mark orange" style={{ width: 30, height: 30 }}>{initialsOf(c.other_username)}</span>
                          <span style={{ minWidth: 0 }}><strong style={{ display: 'block', fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.other_username}</strong><small style={{ display: 'block', fontSize: 10, color: '#95a19c', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.last_message ? `${c.last_message.sender_name}: ${c.last_message.body}` : 'New conversation'}</small></span>
                          {!!c.unread_count && <em>{c.unread_count}</em>}
                        </button>
                      ))}
                    </div>
                    <div className="match-card" style={{ display: 'flex', flexDirection: 'column', minHeight: 380 }}>
                      {!activeConvoId && <p className="match-detail">Pick a conversation.</p>}
                      {!!activeConvoId && (
                        <>
                          <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12, maxHeight: 420 }}>
                            {threadMsgs.map((m: any) => {
                              const mine = m.sender_name === user?.username
                              return <div key={m.id} style={{ alignSelf: mine ? 'flex-end' : 'flex-start', background: mine ? '#195c4b' : '#f3f7f4', color: mine ? '#fff' : '#375149', borderRadius: 10, padding: '8px 12px', fontSize: 12, maxWidth: '80%' }}>{m.body}</div>
                            })}
                            {!threadMsgs.length && <p className="match-detail">Say hello to start the conversation.</p>}
                          </div>
                          <form onSubmit={sendMsg} style={{ display: 'flex', gap: 8 }}>
                            <input value={msgBody} onChange={(e) => setMsgBody(e.target.value)} placeholder="Write a message…" style={{ flex: 1, border: '1px solid #cbd9cf', borderRadius: 9, padding: '10px 12px', fontSize: 13 }} />
                            <button className="connect-btn" type="submit" disabled={sendingMsg}><Send size={15} /> {sendingMsg ? '…' : 'Send'}</button>
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
            <h2 className="accepted-modal-title">Partnership accepted!</h2>
            <p className="accepted-modal-sub">You have confirmed a new connection on Linka.</p>
            <div className="accepted-modal-pair">
              <span>{acceptedModal.fromName}</span>
              <span className="accepted-modal-arrow">↔</span>
              <span>{acceptedModal.toName}</span>
            </div>
            <div className="accepted-modal-steps">
              <p className="eyebrow" style={{ marginBottom: 10 }}>What&apos;s next</p>
              <button className="accepted-modal-action" onClick={() => { setAcceptedModal(null); setActiveNav('Messages') }}>💬 Send a message</button>
              <button className="accepted-modal-action" onClick={() => { setAcceptedModal(null); setActiveNav('Partnerships') }}>📜 Draft an MOU</button>
            </div>
            <button className="ghost-btn" style={{ marginTop: 16, alignSelf: 'center' }} onClick={() => setAcceptedModal(null)}>Close</button>
          </div>
        </div>
      )}
    </main>
  )
}
