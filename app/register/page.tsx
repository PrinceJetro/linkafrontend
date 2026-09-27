"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Globe2 } from "lucide-react";
import { api, saveTokens } from "@/lib/api";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import LanguageSwitcher from "@/components/LanguageSwitcher";

const COUNTRIES = [
  ["NG", "Nigeria"], ["GH", "Ghana"], ["KE", "Kenya"],
  ["RW", "Rwanda"], ["ZA", "South Africa"], ["EG", "Egypt"], ["OTHER", "Other"],
];
const INDUSTRIES = ["Agriculture", "Technology", "Manufacturing", "Logistics", "Healthcare", "Education", "Finance", "Creative", "Research", "Natural resources"];
const ACCOUNT_TYPES = ["Business", "Distributor", "Manufacturer", "Investor", "Researcher", "Other"];

export default function RegisterPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const [mounted, setMounted] = useState(false);
  const [form, setForm] = useState({
    username: "", email: "", password: "", first_name: "",
    organization: "", account_type: "Business",
    country: "NG", city: "", industry: "Agriculture",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => { setMounted(true) }, []);

  const set = (k: string) => (e: any) => setForm({ ...form, [k]: e.target.value });

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = await api.register(form);
      saveTokens(data.access, data.refresh);
      router.push("/?onboarding=1");
    } catch (err: any) {
      setError(String(err.message || err).slice(0, 300));
    } finally {
      setLoading(false);
    }
  }

  if (!mounted) return <main className="auth-wrap" suppressHydrationWarning />;

  return (
    <main className="auth-wrap" suppressHydrationWarning>
      <section className="auth-panel">
        <div className="auth-brand"><div className="brand-symbol"><Globe2 size={21} /></div><div><strong>linka</strong><span>{t("brand.tagline")}</span></div></div>
        <div className="auth-hero">
          <h2>{t("auth.heroJoin1")} <em>{t("auth.heroJoin2")}</em></h2>
          <p>{t("auth.heroJoinSub")}</p>
        </div>
        <div className="auth-stats"><div><strong>1 min</strong><span>{t("auth.statMin")}</span></div><div><strong>Free</strong><span>{t("auth.statFree")}</span></div><div><strong>🌍</strong><span>pan-African</span></div></div>
      </section>
      <section className="auth-form-col">
        <div className="auth-card" style={{ maxWidth: 520 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h1>{t("auth.joinTitle")}</h1>
            <LanguageSwitcher compact />
          </div>
          <p>{t("auth.joinSub")}</p>
          <form className="auth-form" onSubmit={onSubmit}>
            <div className="auth-row">
              <label>{t("auth.fullName")}<input value={form.first_name} onChange={set("first_name")} placeholder="Amara Okafor" /></label>
              <label>{t("auth.username")} *<input value={form.username} onChange={set("username")} placeholder="amara" required /></label>
            </div>
            <label>{t("auth.email")} *<input type="email" value={form.email} onChange={set("email")} placeholder="you@company.com" required /></label>
            <label>{t("auth.pwMin")} *<input type="password" value={form.password} minLength={8} onChange={set("password")} placeholder="••••••••" required /></label>
            <div className="auth-row">
              <label>{t("auth.org")}<input value={form.organization} onChange={set("organization")} placeholder="AgroLink Nigeria" /></label>
              <label>{t("auth.iAm")}<select value={form.account_type} onChange={set("account_type")}>{ACCOUNT_TYPES.map((at) => <option key={at}>{at}</option>)}</select></label>
            </div>
            <div className="auth-row">
              <label>{t("auth.country")} *<select value={form.country} onChange={set("country")}>{COUNTRIES.map(([c, n]) => <option key={c} value={c}>{n}</option>)}</select></label>
              <label>{t("auth.city")}<input value={form.city} onChange={set("city")} placeholder="Lagos" /></label>
            </div>
            <label>{t("auth.sector")} *<select value={form.industry} onChange={set("industry")}>{INDUSTRIES.map((i) => <option key={i}>{i}</option>)}</select></label>
            {error && <p className="auth-error">{error}</p>}
            <button className="auth-submit" type="submit" disabled={loading}>{loading ? t("auth.creating") : <>{t("auth.createBtn")} <ArrowRight size={16} /></>}</button>
          </form>
          <p className="auth-switch">{t("auth.haveAccount")} <Link href="/login">{t("auth.loginLink")}</Link></p>
        </div>
      </section>
    </main>
  );
}
