"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Globe2, Sparkles } from "lucide-react";
import { api, saveTokens } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
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
      setError("Login failed. Check your credentials and that the Django API is running on port 8000.");
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
          <h2>Africa&apos;s capabilities, <em>connected.</em></h2>
          <p>Describe what you have and what you need — linka&apos;s AI finds complementary partners across the continent and explains why they fit.</p>
        </div>
        <div className="auth-stats"><div><strong>5+</strong><span>countries live</span></div><div><strong>AI</strong><span>intent matching</span></div><div><strong>🤝</strong><span>structured requests</span></div></div>
      </section>
      <section className="auth-form-col">
        <div className="auth-card">
          <h1>Welcome back</h1>
          <p>Log in to continue to your business workspace.</p>
          <form className="auth-form" onSubmit={onSubmit}>
            <label>Username<input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="e.g. amara" required /></label>
            <label>Password<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required /></label>
            {error && <p className="auth-error">{error}</p>}
            <button className="auth-submit" type="submit" disabled={loading}>{loading ? "Logging in…" : <>Log in <ArrowRight size={16} /></>}</button>
          </form>
          <p className="auth-demo"><Sparkles size={12} /> Hackathon demo? <button type="button" onClick={() => { setUsername("demo"); setPassword("demo12345") }}>Autofill demo/demo12345</button></p>
          <p className="auth-switch">No account yet? <Link href="/register">Create one</Link></p>
        </div>
      </section>
    </main>
  );
}
