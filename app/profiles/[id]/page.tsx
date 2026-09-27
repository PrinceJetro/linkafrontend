'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  Globe2,
  Handshake,
  Landmark,
  Languages,
  MessageSquare,
  Package,
  Send,
  ShieldCheck,
  Sparkles,
  Star,
  X,
} from 'lucide-react'
import { api, clearTokens, isLoggedIn } from '@/lib/api'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import LanguageSwitcher from '@/components/LanguageSwitcher'

const COUNTRY_NAMES: Record<string, string> = { NG: 'Nigeria', GH: 'Ghana', KE: 'Kenya', RW: 'Rwanda', ZA: 'South Africa', EG: 'Egypt', OTHER: 'Other' }

function initialsOf(name: string) {
  return (name || '?').split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
}

function Field({ label, value }: { label: string; value?: string }) {  if (!value) return null
  return (
    <div style={{ marginBottom: 14 }}>
      <p className="eyebrow" style={{ marginBottom: 6 }}>{label}</p>
      <p className="match-detail" style={{ margin: 0, minHeight: 0, fontSize: 12 }}>{value}</p>
    </div>
  )
}

export default function ProfilePage() {
  const params = useParams()
  const router = useRouter()
  const { t } = useLanguage()
  const id = String(params.id)
  const [mounted, setMounted] = useState(false)
  const [ready, setReady] = useState(false)
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [myProfiles, setMyProfiles] = useState<any[]>([])
  const [overlay, setOverlay] = useState<any>(null)
  const [query, setQuery] = useState('')
  const [brief, setBrief] = useState<any>(null)
  const [briefLoading, setBriefLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [toast, setToast] = useState<{ title: string; body: string } | null>(null)
  const [failed, setFailed] = useState(false)
  const [milestones, setMilestones] = useState<any[]>([])
  const [endorsements, setEndorsements] = useState<any[]>([])
  const [msTitle, setMsTitle] = useState('')
  const [msKind, setMsKind] = useState('milestone')
  const [msDetail, setMsDetail] = useState('')
  const [trade, setTrade] = useState<any>(null)
  const [briefLang, setBriefLang] = useState('English')

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    if (!mounted) return
    if (!isLoggedIn()) { router.replace('/login'); return }
    api.me().then(setUser).catch(() => { clearTokens(); router.replace('/login') })
    api.myProfiles().then((d: any) => setMyProfiles(Array.isArray(d) ? d : d.results ?? [])).catch(() => {})
    api.profiles(`${id}/`).then((p: any) => { setProfile(p); setReady(true) }).catch(() => setFailed(true))
    api.milestones(Number(id)).then((d: any) => setMilestones(Array.isArray(d) ? d : d.results ?? [])).catch(() => {})
    api.endorsements(Number(id)).then((d: any) => setEndorsements(Array.isArray(d) ? d : d.results ?? [])).catch(() => {})
    try {
      const last = JSON.parse(localStorage.getItem('linka_last_match') || 'null')
      if (last) {
        setQuery(last.query || '')
        const hit = (last.results || []).find((r: any) => String(r.id) === id)
        if (hit) setOverlay(hit)
      }
    } catch { /* no cached match */ }
  }, [mounted, router, id])

  useEffect(() => {
    if (!toast) return
    const t = window.setTimeout(() => setToast(null), 4000)
    return () => window.clearTimeout(t)
  }, [toast])

  const isOwn = !!user && !!profile && profile.owner === user.id

  async function connect() {
    if (!myProfiles.length) {
      router.push('/#capability')
      return
    }
    setSending(true)
    try {
      await api.sendRequest({
        from_profile: myProfiles[0].id,
        to_profile: profile.id,
        partnership_type: profile.partnership_type || 'Distribution',
        message: `${myProfiles[0].name} is interested in a partnership${query ? ` around: ${query.slice(0, 200)}` : '.'}`,
      })
      setToast({ title: t('pf.reqSent'), body: t('toast.reqSentBody', { name: profile.name }) })
    } catch {
      setToast({ title: t('toast.reqFail'), body: t('toast.reqFailBody') })
    } finally {
      setSending(false)
    }
  }

  async function message() {
    try {
      await api.startConversation({ user_id: profile.owner })
      router.push('/#messages')
    } catch {
      setToast({ title: t('pf.msgFail'), body: t('pf.msgFailBody') })
    }
  }

  async function generateBrief() {
    if (!myProfiles.length) {
      setToast({ title: t('pf.noProfile'), body: t('pf.noProfileBody') })
      return
    }
    setBriefLoading(true)
    try {
      setBrief(await api.brief(myProfiles[0].id, profile.id, query.slice(0, 200), briefLang))
    } catch {
      setToast({ title: t('pf.briefFail'), body: t('toast.backendBody') })
    } finally {
      setBriefLoading(false)
    }
  }

  async function postMilestone(e: React.FormEvent) {
    e.preventDefault()
    if (!msTitle.trim()) return
    try {
      const ms = await api.postMilestone({ profile_id: profile.id, kind: msKind, title: msTitle.trim(), detail: msDetail.trim() })
      setMilestones([ms, ...milestones])
      setMsTitle('')
      setMsDetail('')
    } catch {
      setToast({ title: t('pf.msFail'), body: t('pf.msFailBody') })
    }
  }

  // AfCFTA lane: your home profile → this profile
  useEffect(() => {
    if (!ready || !profile || !myProfiles.length || isOwn) return
    api.tradeInfo(myProfiles[0].country, profile.country, profile.industry).then(setTrade).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, myProfiles])

  if (!mounted || (!ready && !failed)) return <main className="app-shell" suppressHydrationWarning />

  if (failed || !profile) {
    return (
      <main className="app-shell" suppressHydrationWarning>
        <section className="main-area"><div className="content-wrap">
          <div className="match-card"><h2 className="section-title">{t('pf.notFound')}</h2>
            <p className="match-detail">{t('pf.notFoundBody')}</p>
            <div className="match-actions"><Link className="connect-btn" href="/">{t('pf.backToWs')}</Link></div></div>
        </div></section>
      </main>
    )
  }

  return (
    <main className="app-shell" suppressHydrationWarning>
      <section className="main-area">
        <header className="topbar">
          <button className="ghost-btn" onClick={() => router.back()}><ArrowLeft size={15} /> {t('pf.back')}</button>
          <div className="crumb"><span>{t('pf.network')}</span><ChevronRight size={14} /><strong>{t('pf.capProfile')}</strong></div>
          <div className="top-actions"><LanguageSwitcher compact /><Link className="top-avatar" href="/" title={t('nav.workspace')} style={{ display: 'grid', placeItems: 'center', textDecoration: 'none' }}><Globe2 size={15} /></Link></div>
        </header>
        <div className="content-wrap" style={{ maxWidth: 900 }}>
          {/* 1 — Identity */}
          <div className="match-card" style={{ padding: 26, marginBottom: 14 }}>
            <div className="match-topline">
              <div className="profile-mark orange" style={{ width: 56, height: 56, fontSize: 16, ...(profile.avatar_url ? { padding: 0, overflow: 'hidden' } : {}) }}>{profile.avatar_url ? <img src={profile.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : initialsOf(profile.name)}</div>
              <div className="match-copy">
                <div className="match-name-row"><h3 style={{ fontSize: 20 }}>{profile.name}</h3>
                  {profile.is_verified && <span className="verified"><ShieldCheck size={10} /> {t('card.verified')}</span>}
                  {isOwn && <span className="tag">{t('pf.yourProfile')}</span>}
                </div>
                <p style={{ fontSize: 12 }}>{COUNTRY_NAMES[profile.country] ?? profile.country}{profile.city ? `, ${profile.city}` : ''} <span className="dot-sep">·</span> {profile.industry}</p>
                <div className="tag-row" style={{ marginTop: 8, flexWrap: 'wrap' }}>
                  {profile.registry_verified && <span className="tag" style={{ background: '#eaf6ed', color: '#195c4b', fontWeight: 700 }}><Landmark size={10} /> {t('pf.officialReg')}{profile.registry_name ? ` · ${profile.registry_name}` : ''}</span>}
                  {!profile.registry_verified && profile.registry_name && <span className="tag">{t('pf.regFiled')}: {profile.registry_name}{profile.registration_number ? ` ${profile.registration_number}` : ''}</span>}
                  {profile.rating?.average && <span className="tag" style={{ background: '#fff2e8', color: '#c26a36', fontWeight: 700 }}><Star size={10} /> {profile.rating.average} · {profile.rating.count} {t('pf.deals')}</span>}
                </div>
              </div>
              {overlay && <div className="score"><strong>{overlay.match_score}%</strong><span>{t('card.match')}</span></div>}
            </div>
            {overlay && (
              <div style={{ marginTop: 18, background: '#f5f8f5', borderRadius: 10, padding: 14 }}>
                <p className="eyebrow">{t('pf.whyMatch')}</p>
                {(overlay.why ?? []).map((w: string) => <p key={w} className="match-detail" style={{ margin: '4px 0', minHeight: 0 }}><CheckCircle2 size={12} /> {w}</p>)}
              </div>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 14 }}>
            <div>
              {/* 2 — What they have */}
              <div className="match-card" style={{ marginBottom: 14 }}>
                <p className="eyebrow">{t('pf.whatHave')}</p>
                <Field label={t('pf.prodServ')} value={profile.products_services} />
                <Field label={t('pf.skills')} value={profile.skills_expertise} />
                <Field label={t('pf.offersCap')} value={profile.offers} />
              </div>
              {/* 3 — What they need */}
              <div className="match-card" style={{ marginBottom: 14 }}>
                <p className="eyebrow">{t('pf.whatNeed')}</p>
                <Field label={t('pf.needs')} value={profile.needs} />
                {!!(profile.target_countries ?? []).length && (
                  <div><p className="eyebrow" style={{ marginBottom: 6 }}>{t('pf.targetC')}</p>
                    <div className="tag-row" style={{ flexWrap: 'wrap' }}>{profile.target_countries.map((c: string) => <span key={c} className="tag">{COUNTRY_NAMES[c] ?? c}</span>)}</div>
                  </div>
                )}
              </div>
              {/* 4 — Partnership brief */}
              <div className="match-card" style={{ marginBottom: 14 }}>
                <div className="section-header compact"><div><p className="eyebrow">{t('pf.brief')}</p><h2 className="section-title">{t('pf.whyTogether')}</h2></div>
                  <span style={{ display: 'flex', gap: 6 }}>
                    <select value={briefLang} onChange={(e) => setBriefLang(e.target.value)} title={t('pf.brief')} style={{ borderRadius: 20, border: '1px solid #e1e9e3', padding: '6px 8px', fontSize: 11 }}>{['English', 'French', 'Swahili', 'Portuguese'].map((l) => <option key={l}>{l}</option>)}</select>
                    <button className="ghost-btn" onClick={generateBrief} disabled={briefLoading}>{briefLoading ? t('pf.briefing') : t('pf.genBrief')}</button>
                  </span></div>
                {!brief && <p className="match-detail">{t('pf.briefEmpty')}</p>}
                {brief && (
                  <div>
                    <p className="match-detail"><strong>{t('pf.opportunity')}</strong> {brief.opportunity}</p>
                    <p className="match-detail"><strong>{t('pf.benefits')}</strong> {(brief.benefits ?? []).join(' · ')}</p>
                    <p className="match-detail"><strong>{t('pf.verifyLabel')}</strong> {(brief.things_to_verify ?? []).join(' · ')}</p>
                  </div>
                )}
              </div>
              {/* Proof-of-capability timeline */}
              <div className="match-card" style={{ marginBottom: 14 }}>
                <div className="section-header compact"><div><p className="eyebrow">{t('pf.timeline')}</p><h2 className="section-title">{t('pf.execTimeline')}</h2></div></div>
                {!milestones.length && <p className="match-detail">{t('pf.timelineEmpty')}</p>}
                {milestones.map((m: any) => (
                  <div key={m.id} className="journey-step" style={{ alignItems: 'flex-start', marginBottom: 10 }}>
                    <span><Package size={14} /></span>
                    <div style={{ flex: 1 }}><strong style={{ fontSize: 12 }}>{m.title}</strong>
                      {m.detail && <small style={{ display: 'block', fontSize: 11, color: '#75857e' }}>{m.detail}</small>}
                      <small style={{ color: '#95a19c', fontSize: 10 }}>{m.kind}{m.is_verified ? ` · ✓ ${t('card.verified').toLowerCase()}` : ''}</small></div>
                  </div>
                ))}
                {isOwn && (
                  <form onSubmit={postMilestone} style={{ display: 'grid', gap: 8, marginTop: 12 }}>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <select value={msKind} onChange={(e) => setMsKind(e.target.value)} style={{ borderRadius: 9, border: '1px solid #cbd9cf', padding: '9px', fontSize: 12 }}>{['milestone', 'shipment', 'certification', 'partnership'].map((k) => <option key={k}>{k}</option>)}</select>
                      <input value={msTitle} onChange={(e) => setMsTitle(e.target.value)} placeholder={t('pf.msTitlePh')} required style={{ flex: 1, border: '1px solid #cbd9cf', borderRadius: 9, padding: '9px 10px', fontSize: 12 }} />
                    </div>
                    <input value={msDetail} onChange={(e) => setMsDetail(e.target.value)} placeholder={t('pf.msDetailPh')} style={{ border: '1px solid #cbd9cf', borderRadius: 9, padding: '9px 10px', fontSize: 12 }} />
                    <div><button className="ghost-btn" type="submit">{t('pf.postMs')}</button></div>
                  </form>
                )}
              </div>
              {/* Verified endorsements */}
              {!!endorsements.length && (
                <div className="match-card" style={{ marginBottom: 14 }}>
                  <div className="section-header compact"><div><p className="eyebrow">{t('pf.verifiedLedger')}</p><h2 className="section-title">{t('pf.endorsements')}</h2></div></div>
                  {endorsements.map((e: any) => (
                    <p key={e.id} className="match-detail" style={{ minHeight: 0 }}><Star size={11} /> <strong>{e.rating}/5</strong> — {e.comment || '—'} <small style={{ color: '#95a19c' }}>· {e.reviewer_name}</small></p>
                  ))}
                </div>
              )}
              {/* AfCFTA trade lane */}
              {trade && (
                <div className="match-card" style={{ marginBottom: 14 }}>
                  <div className="section-header compact"><div><p className="eyebrow">{t('pf.lane')} {trade.ai ? '✨' : ''}</p><h2 className="section-title">{trade.lane}</h2></div></div>
                  <p className="match-detail"><strong>{t('pf.tariffs')}</strong> {trade.tariff_note}</p>
                  <p className="match-detail"><strong>{t('pf.certs')}</strong> {(trade.certifications ?? []).join(' · ')}</p>
                  <p className="match-detail"><strong>{t('pf.payments')}</strong> {(trade.payments ?? []).join(' · ')}</p>
                </div>
              )}
            </div>
            <div>
              {/* 5 — Partnership parameters + actions */}
              <div className="match-card" style={{ marginBottom: 14, position: 'sticky', top: 16 }}>
                <p className="eyebrow">{t('pf.params')}</p>
                <Field label={t('pf.ptype')} value={profile.partnership_type || t('pf.openTo')} />
                <Field label={t('pf.industry')} value={profile.industry} />
                {(profile.registry_name || profile.registration_number) && (
                  <Field label={t('pf.registryBiz')} value={`${profile.registry_name || ''}${profile.registration_number ? ` · ${profile.registration_number}` : ''}${profile.registry_verified ? ' ✓' : ''}`} />
                )}
                <div className="match-actions" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
                  {isOwn ? (
                    <Link className="connect-btn" href="/#capability" style={{ justifyContent: 'center', textDecoration: 'none' }}>{t('pf.editInWs')}</Link>
                  ) : (
                    <>
                      <button className="connect-btn" onClick={connect} disabled={sending} style={{ justifyContent: 'center' }}><Send size={15} /> {sending ? t('pf.sending') : t('pf.sendReq')}</button>
                      <button className="ghost-btn" onClick={message} style={{ justifyContent: 'center' }}><MessageSquare size={15} /> {t('pf.message')}</button>
                    </>
                  )}
                </div>
                <p className="match-detail" style={{ marginTop: 12, minHeight: 0 }}><Sparkles size={12} /> {t('pf.intentTag')}</p>
              </div>
            </div>
          </div>
        </div>
      </section>
      {toast && <div className="toast"><span><Handshake size={16} /></span><div><strong>{toast.title}</strong><p>{toast.body}</p></div><button onClick={() => setToast(null)}><X size={15} /></button></div>}
    </main>
  )
}
