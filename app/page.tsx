 "use client";

import { useState } from "react";
import { ArrowDownToLine, ArrowUpRight, Check, Clipboard, Download, Instagram, Link2, ShieldCheck, Sparkles, Youtube, X } from "lucide-react";

type Format = { id: string; label: string; detail?: string; type?: string };
type Result = { title?: string; platform?: string; message?: string; formats?: Format[] };

export default function Home() {
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [selected, setSelected] = useState("");

  const platform = /instagram\.com/i.test(url) ? "Instagram" : /youtube\.com|youtu\.be/i.test(url) ? "YouTube" : "";
  const valid = /^https?:\/\/\S+/i.test(url.trim());

  async function submit(e?: React.FormEvent) {
    e?.preventDefault(); setError(""); setResult(null); setSelected("");
    if (!valid) { setError("Paste a valid public URL starting with https://"); return; }
    if (!platform) { setError("That link isn't recognized. Paste an Instagram or YouTube URL."); return; }
    setBusy(true);
    try {
      const res = await fetch("/api/resolve", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: url.trim() }) });
      const data = await res.json();
      if (!res.ok) throw new Error((typeof data.detail === "string" ? data.detail : data.error) || "This link could not be processed.");
      setResult(data);
      if (data.formats?.length) setSelected(data.formats[0].id);
    } catch (err) { setError(err instanceof Error ? err.message : "Something went wrong. Please try again."); }
    finally { setBusy(false); }
  }

  async function paste() {
    try { const text = await navigator.clipboard.readText(); if (text) { setUrl(text); setError(""); setResult(null); } }
    catch { setError("Clipboard access is blocked. Paste your link into the field."); }
  }

  const chosen = result?.formats?.find(f => f.id === selected);
  const [downloading, setDownloading] = useState(false);
  async function downloadSelected() {
    if (!chosen) return;
    setDownloading(true); setError("");
    try {
      const res = await fetch("/api/download", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim(), format_id: chosen.id })
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || data.error || "Download failed.");
      }
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = `${(result?.title || "cleandrop-media").replace(/[^a-z0-9-_ ]/gi, "").slice(0, 80) || "cleandrop-media"}.${chosen.detail?.match(/\b(MP4|WEBM|M4A|MP3|MKV|MOV)\b/i)?.[1]?.toLowerCase() || "mp4"}`;
      document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(objectUrl);
    } catch (err) { setError(err instanceof Error ? err.message : "Download failed."); }
    finally { setDownloading(false); }
  }

  return (
    <main>
      <nav className="nav wrap">
        <a className="brand" href="#"><span className="brand-mark"><ArrowDownToLine size={19}/></span> cleandrop<span className="brand-dot">.</span></a>
        <div className="nav-right"><span className="status-dot"/> Free forever <span className="nav-sep">·</span> No ads</div>
      </nav>
      <section className="hero wrap">
        <div className="eyebrow"><Sparkles size={13}/> THE INTERNET, LESS CLUTTERED</div>
        <h1>Your media.<br/><span>Your way.</span></h1>
        <p className="subhead">A simple place to save videos you love.<br className="desktop"/> No pop-ups. No bait buttons. Just the essentials.</p>
        <div className="platforms"><span className="platform"><Instagram size={16}/> Instagram</span><span className="platform"><Youtube size={17}/> YouTube</span></div>
        <form className="download-box" onSubmit={submit}>
          <div className="input-row">
            <Link2 className="link-icon" size={19}/>
            <input aria-label="Media URL" value={url} onChange={e => {setUrl(e.target.value); setError(""); setResult(null);}} placeholder="Paste your Instagram or YouTube link here…" />
            {url ? <button type="button" className="icon-btn" aria-label="Clear link" onClick={() => {setUrl("");setResult(null);setError("");}}><X size={17}/></button> : <button type="button" className="paste-btn" onClick={paste}><Clipboard size={15}/> Paste</button>}
          </div>
          <button className="download-btn" type="submit" disabled={busy}>{busy ? <><span className="spinner"/> Checking link…</> : <>Get download options <ArrowUpRight size={18}/></>}</button>
          {error && <div className="feedback error" role="alert">{error}</div>}
          {result && <div className="result-panel" aria-live="polite">
            <div className="result-heading"><div className="result-icon"><Check size={18}/></div><div className="result-copy"><strong>{result.title || `${result.platform || "Media"} link checked`}</strong><span>{result.message || "Choose an available quality below."}</span></div></div>
            {result.formats?.length ? <>
              <label className="quality-label" htmlFor="quality">VIDEO / AUDIO QUALITY</label>
              <div className="quality-list">
                {result.formats.map(f => <label className={`quality-option ${selected === f.id ? "active" : ""}`} key={f.id}>
                  <input type="radio" name="quality" value={f.id} checked={selected === f.id} onChange={() => setSelected(f.id)}/>
                  <span className="quality-main"><strong>{f.label}</strong><small>{f.detail || f.type || "Available format"}</small></span>
                  {selected === f.id && <Check size={17} className="quality-check"/>}
                </label>)}
              </div>
              {chosen ? <button type="button" className="result-download full-download" onClick={downloadSelected} disabled={downloading}><Download size={16}/>{downloading ? " Preparing download…" : `Download ${chosen.label}`}</button> : <p className="quality-note">Choose an available format above.</p>}
            </> : <p className="quality-note">No downloadable formats were returned. The link may be restricted or unsupported.</p>}
          </div>}
          <div className="form-foot"><ShieldCheck size={14}/> Only download content you have permission to save.</div>
        </form>
        <div className="trust-row">
          <div><span className="trust-icon"> <ShieldCheck size={17}/></span><span><b>Privacy first</b><small>We don't store links</small></span></div>
          <div><span className="trust-icon"><Sparkles size={17}/></span><span><b>Zero clutter</b><small>No ads, ever</small></span></div>
          <div><span className="trust-icon"><Download size={17}/></span><span><b>Quality choices</b><small>When available</small></span></div>
        </div>
      </section>
      <section className="how wrap">
        <div className="section-kicker">THREE STEPS. THAT'S IT.</div><h2>Made to get out of your way.</h2>
        <div className="steps">
          <article><span className="step-no">01</span><div className="step-icon"><Clipboard size={20}/></div><h3>Copy a link</h3><p>Grab the URL of public content you’re allowed to save.</p></article>
          <article><span className="step-no">02</span><div className="step-icon"><Link2 size={20}/></div><h3>Pick a quality</h3><p>Choose from the resolutions and formats actually provided for that media.</p></article>
          <article><span className="step-no">03</span><div className="step-icon"><Download size={20}/></div><h3>Save your media</h3><p>Download an available format, when supported by the connected provider.</p></article>
        </div>
      </section>
      <section className="note wrap"><ShieldCheck size={18}/><p><strong>Quality depends on the source</strong><br/>Options such as 144p, 360p, 480p, 720p, 1080p, 1440p, 4K, or audio-only will appear only if the authorized provider supplies them. Private posts, DRM, and access controls aren't bypassed.</p></section>
      <footer className="footer wrap"><a className="brand footer-brand" href="#"><span className="brand-mark"><ArrowDownToLine size={16}/></span> cleandrop<span className="brand-dot">.</span></a><span>Less noise. More of what you love.</span><span>© {new Date().getFullYear()} CleanDrop</span></footer>
    </main>
  );
}
