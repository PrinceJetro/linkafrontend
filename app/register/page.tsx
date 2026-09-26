"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Globe2 } from "lucide-react";
import { api, saveTokens } from "@/lib/api";

const COUNTRIES = [
  ["NG", "Nigeria"], ["GH", "Ghana"], ["KE", "Kenya"],
  ["RW", "Rwanda"], ["ZA", "South Africa"], ["EG", "Egypt"], ["OTHER", "Other"],
];
const INDUSTRIES = ["Agriculture", "Technology", "Manufacturing", "Logistics", "Healthcare", "Education", "Finance", "Creative", "Research", "Natural resources"];
const ACCOUNT_TYPES = ["Business", "Distributor", "Manufacturer", "Investor", "Researcher", "Other"];

export default function RegisterPage() {
  const router = useRouter();
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
      setError("Registration failed: " + String(err.message || err).slice(0, 300));
    } finally {
      setLoading(false);
    }
  }

  if (!mounted) return <main className="auth-wrap" suppressHydrationWarning />;

  return (
    <main className="auth-wrap" suppressHydrationWarning>
      <section className="auth-panel">
        <div className="auth-brand"><div className="brand-symbol"><Globe2 size={21} /></div><div><strong>linka</strong><span>Africa&apos;s partnership network</span></div></div>
        <div className="auth-hero">
          <h2>What can you offer Africa, <em>and what do you need?</em></h2>
          <p>Your answers seed your first capability profile instantly — so you can match and connect from minute one.</p>
        </div>
        <div className="auth-stats"><div><strong>1 min</strong><span>to join</span></div><div><strong>Free</strong><span>hackathon MVP</span></div><div><strong>🌍</strong><span>pan-African</span></div></div>
      </section>
      <section className="auth-form-col">
        <div className="auth-card" style={{ maxWidth: 520 }}>
          <h1>Join linka</h1>
          <p>Create your account and your first capability profile in one step.</p>
          <form className="auth-form" onSubmit={onSubmit}>
            <div className="auth-row">
              <label>Full name<input value={form.first_name} onChange={set("first_name")} placeholder="Amara Okafor" /></label>
              <label>Username *<input value={form.username} onChange={set("username")} placeholder="amara" required /></label>
            </div>
            <label>Email *<input type="email" value={form.email} onChange={set("email")} placeholder="you@company.com" required /></label>
            <label>Password (min 8 chars) *<input type="password" value={form.password} minLength={8} onChange={set("password")} placeholder="••••••••" required /></label>
            <div className="auth-row">
              <label>Organization / business<input value={form.organization} onChange={set("organization")} placeholder="AgroLink Nigeria" /></label>
              <label>I am a…<select value={form.account_type} onChange={set("account_type")}>{ACCOUNT_TYPES.map((t) => <option key={t}>{t}</option>)}</select></label>
            </div>
            <div className="auth-row">
              <label>Country *<select value={form.country} onChange={set("country")}>{COUNTRIES.map(([c, n]) => <option key={c} value={c}>{n}</option>)}</select></label>
              <label>City<input value={form.city} onChange={set("city")} placeholder="Lagos" /></label>
            </div>
            <label>Primary sector *<select value={form.industry} onChange={set("industry")}>{INDUSTRIES.map((i) => <option key={i}>{i}</option>)}</select></label>
            {error && <p className="auth-error">{error}</p>}
            <button className="auth-submit" type="submit" disabled={loading}>{loading ? "Creating…" : <>Create account & profile <ArrowRight size={16} /></>}</button>
          </form>
          <p className="auth-switch">Have an account? <Link href="/login">Log in</Link></p>
        </div>
      </section>
    </main>
  );
}
