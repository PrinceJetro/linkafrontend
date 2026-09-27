"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Globe2, Sparkles } from "lucide-react";
import { api, saveTokens } from "@/lib/api";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import LanguageSwitcher from "@/components/LanguageSwitcher";

export default function LoginPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const [mounted, setMounted] = useState(false);
  const [username, setUsername] = useState("demo");
  const [password, setPassword] = useState("demo12345");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => { setMounted(true) }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = await api.login(username, password);
      saveTokens(data.access, data.refresh);
      router.push("/");
    } catch {
      setError(t("auth.loginFail"));
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
          <h2>{t("auth.heroTitle1")} <em>{t("auth.heroTitle2")}</em></h2>
          <p>{t("auth.heroSub")}</p>
        </div>
        <div className="auth-stats"><div><strong>5+</strong><span>{t("auth.statCountries")}</span></div><div><strong>{t("auth.statAiTop")}</strong><span>{t("auth.statAi")}</span></div><div><strong>🤝</strong><span>{t("auth.statReq")}</span></div></div>
      </section>
      <section className="auth-form-col">
        <div className="auth-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h1>{t("auth.loginTitle")}</h1>
            <LanguageSwitcher compact />
          </div>
          <p>{t("auth.loginSub")}</p>
          <form className="auth-form" onSubmit={onSubmit}>
            <label>{t("auth.username")}<input value={username} onChange={(e) => setUsername(e.target.value)} placeholder={t("auth.usernamePh")} required /></label>
            <label>{t("auth.password")}<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required /></label>
            {error && <p className="auth-error">{error}</p>}
            <button className="auth-submit" type="submit" disabled={loading}>{loading ? t("auth.loggingIn") : <>{t("auth.loginBtn")} <ArrowRight size={16} /></>}</button>
          </form>
          <p className="auth-demo"><Sparkles size={12} /> {t("auth.demo")} <button type="button" onClick={() => { setUsername("demo"); setPassword("demo12345") }}>{t("auth.autofill")}</button></p>
          <p className="auth-switch">{t("auth.noAccount")} <Link href="/register">{t("auth.createOne")}</Link></p>
        </div>
      </section>
    </main>
  );
}
