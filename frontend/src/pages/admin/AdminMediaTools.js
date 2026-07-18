import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  ChevronLeft, Loader2, Check, Upload, X, Search, Tag as TagIcon,
  ShieldCheck, Sparkles, Image as ImageIcon,
} from 'lucide-react';
import { useAdminAuth } from '../../utils/adminAuth';

const API = process.env.REACT_APP_BACKEND_URL;

/**
 * AdminMediaTools — one admin page, two related workflows:
 *
 *  Tab A: Test Reports
 *   Per-product uploader for the dermatologist / lab test-report certificate.
 *   Saves `test_report_image`, `test_report_lab`, `test_report_date`, and
 *   flips `is_dermat_tested=true`. The storefront renders a green "Dermat
 *   Tested" badge on every product that has a report on file.
 *
 *  Tab B: SEO Keywords
 *   Per-product alt-text + multi-keyword injector. Press Enter to add each
 *   keyword as a chip. Saves `image_alt_text` and `seo_keywords[]`. These
 *   get emitted as <img alt> and a JSON-LD keywords block on public pages.
 */
export default function AdminMediaTools() {
  const navigate = useNavigate();
  const { adminToken, isLoading, isAuthenticated } = useAdminAuth(navigate);
  const auth = useMemo(() => ({ headers: { 'X-Admin-Token': adminToken } }), [adminToken]);

  const [tab, setTab] = useState('reports');
  const [products, setProducts] = useState([]);
  const [q, setQ] = useState('');
  const [selectedSlug, setSelectedSlug] = useState(null);

  useEffect(() => {
    if (!adminToken) return;
    axios.get(`${API}/api/admin/products?page=1&limit=200`, auth)
      .then((r) => {
        const items = Array.isArray(r.data) ? r.data : (r.data.items || r.data.products || []);
        setProducts(items);
      })
      .catch(() => setProducts([]));
  }, [adminToken, auth]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return products;
    return products.filter((p) =>
      (p.short_name || p.name || '').toLowerCase().includes(needle)
      || (p.slug || '').toLowerCase().includes(needle),
    );
  }, [products, q]);

  const selected = useMemo(
    () => products.find((p) => p.slug === selectedSlug) || null,
    [products, selectedSlug],
  );

  const saveProduct = async (patch) => {
    if (!selectedSlug) return;
    const r = await axios.put(`${API}/api/admin/products/${selectedSlug}`, patch, auth);
    if (r.data?.success) {
      setProducts((prev) => prev.map((p) => (p.slug === selectedSlug ? { ...p, ...patch } : p)));
    }
    return r.data;
  };

  if (isLoading || !isAuthenticated) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin w-6 h-6 text-emerald-500" /></div>;
  }

  return (
    <div className="min-h-screen bg-stone-50">
      <div className="bg-white border-b border-stone-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-3">
          <Link to="/admin/dashboard" className="p-2 -ml-2 rounded-lg hover:bg-stone-100" data-testid="back-to-admin">
            <ChevronLeft size={18} />
          </Link>
          <div>
            <h1 className="text-lg sm:text-xl font-black text-stone-900">Media &amp; SEO Tools</h1>
            <p className="text-xs text-stone-500">Test reports · Alt text · Keyword injector</p>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex gap-1">
          <TabButton active={tab === 'reports'} onClick={() => setTab('reports')} testId="tab-reports">
            <ShieldCheck size={14} /> Test Reports
          </TabButton>
          <TabButton active={tab === 'seo'} onClick={() => setTab('seo')} testId="tab-seo">
            <TagIcon size={14} /> SEO Keywords
          </TabButton>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left: product list */}
        <div className="lg:col-span-4 bg-white rounded-2xl ring-1 ring-stone-200 overflow-hidden">
          <div className="p-3 border-b border-stone-100">
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-400" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search products…"
                className="w-full pl-8 pr-3 py-2 text-sm rounded-lg border border-stone-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                data-testid="product-search-input"
              />
            </div>
          </div>
          <div className="max-h-[70vh] overflow-y-auto divide-y divide-stone-100">
            {filtered.map((p) => {
              const hasReport = !!p.test_report_image;
              const hasSeo = !!(p.image_alt_text || (p.seo_keywords && p.seo_keywords.length));
              const active = p.slug === selectedSlug;
              return (
                <button
                  key={p.slug}
                  onClick={() => setSelectedSlug(p.slug)}
                  className={`w-full flex items-center gap-3 p-3 text-left transition-colors ${active ? 'bg-emerald-50' : 'hover:bg-stone-50'}`}
                  data-testid={`product-row-${p.slug}`}
                >
                  <div className="w-10 h-10 rounded-lg overflow-hidden bg-stone-100 flex-shrink-0">
                    {p.image && <img src={p.image} alt="" className="w-full h-full object-cover" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-stone-900 truncate">{p.short_name || p.name}</p>
                    <p className="text-[11px] text-stone-500 truncate">{p.slug}</p>
                  </div>
                  <div className="flex flex-col gap-1">
                    {hasReport && <span className="text-[9px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded-full">RPT</span>}
                    {hasSeo && <span className="text-[9px] font-bold text-purple-700 bg-purple-100 px-1.5 py-0.5 rounded-full">SEO</span>}
                  </div>
                </button>
              );
            })}
            {filtered.length === 0 && (
              <div className="p-6 text-center text-sm text-stone-500">No products found</div>
            )}
          </div>
        </div>

        {/* Right: editor pane */}
        <div className="lg:col-span-8">
          {!selected && (
            <div className="bg-white rounded-2xl ring-1 ring-stone-200 p-10 text-center">
              <ImageIcon size={28} className="mx-auto text-stone-300 mb-3" />
              <p className="text-sm text-stone-500">Select a product on the left to edit its {tab === 'reports' ? 'test report' : 'SEO metadata'}.</p>
            </div>
          )}
          {selected && tab === 'reports' && (
            <TestReportEditor product={selected} onSave={saveProduct} auth={auth} />
          )}
          {selected && tab === 'seo' && (
            <SeoEditor product={selected} onSave={saveProduct} />
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Tab A — Test Report editor
// ─────────────────────────────────────────────────────────────────────────

function TestReportEditor({ product, onSave, auth }) {
  const [image, setImage] = useState(product.test_report_image || '');
  const [lab, setLab] = useState(product.test_report_lab || '');
  const [date, setDate] = useState(product.test_report_date || '');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setImage(product.test_report_image || '');
    setLab(product.test_report_lab || '');
    setDate(product.test_report_date || '');
    setSaved(false);
  }, [product]);

  const handleUpload = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('folder', 'test-reports');
      const r = await axios.post(`${API}/api/admin/upload-image`, fd, auth);
      setImage(r.data.url || r.data.secure_url || '');
    } catch (e) {
      alert('Upload failed: ' + (e.response?.data?.detail || e.message));
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({
        test_report_image: image || null,
        test_report_lab: lab || null,
        test_report_date: date || null,
        is_dermat_tested: !!image,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl ring-1 ring-stone-200 p-5 sm:p-6" data-testid="test-report-editor">
      <div className="flex items-center gap-2 mb-4">
        <ShieldCheck size={16} className="text-emerald-600" />
        <h2 className="text-base font-black text-stone-900">Dermatologist Test Report</h2>
      </div>

      <p className="text-xs text-stone-500 mb-5">Upload the certificate PDF or image. The badge auto-appears on {product.short_name || product.name}&apos;s card and detail page.</p>

      {/* Preview + upload */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
        <div className="aspect-[3/4] rounded-xl overflow-hidden ring-1 ring-stone-200 bg-stone-50 flex items-center justify-center">
          {image ? (
            <img src={image} alt="Test report" className="w-full h-full object-contain" />
          ) : (
            <div className="text-center text-stone-400">
              <ImageIcon size={28} className="mx-auto mb-2" />
              <p className="text-xs">No report uploaded yet</p>
            </div>
          )}
        </div>
        <div className="space-y-3">
          <label className="block">
            <span className="text-xs font-bold text-stone-700 uppercase tracking-wide">Upload Report</span>
            <label className="mt-1.5 flex items-center justify-center gap-2 py-3 px-4 border-2 border-dashed border-stone-300 rounded-xl cursor-pointer hover:border-emerald-500 hover:bg-emerald-50/30 transition-colors">
              <Upload size={14} />
              <span className="text-sm">{uploading ? 'Uploading…' : 'Choose file'}</span>
              <input
                type="file"
                accept="image/*,.pdf"
                onChange={(e) => handleUpload(e.target.files?.[0])}
                className="hidden"
                data-testid="test-report-upload-input"
              />
            </label>
          </label>
          {image && (
            <button
              onClick={() => setImage('')}
              className="text-xs text-red-600 flex items-center gap-1 hover:underline"
              data-testid="test-report-remove"
            >
              <X size={12} /> Remove uploaded report
            </button>
          )}
          <label className="block">
            <span className="text-xs font-bold text-stone-700 uppercase tracking-wide">Lab / Dermatologist</span>
            <input
              value={lab}
              onChange={(e) => setLab(e.target.value)}
              placeholder="e.g. Cosmoderm Labs · Bangalore"
              className="mt-1.5 w-full px-3 py-2 text-sm rounded-lg border border-stone-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
              data-testid="test-report-lab-input"
            />
          </label>
          <label className="block">
            <span className="text-xs font-bold text-stone-700 uppercase tracking-wide">Tested On</span>
            <input
              type="date"
              value={date ? date.slice(0, 10) : ''}
              onChange={(e) => setDate(e.target.value)}
              className="mt-1.5 w-full px-3 py-2 text-sm rounded-lg border border-stone-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
              data-testid="test-report-date-input"
            />
          </label>
        </div>
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="inline-flex items-center gap-2 bg-emerald-600 text-white font-bold text-sm px-5 py-2.5 rounded-full hover:bg-emerald-700 disabled:opacity-50"
        data-testid="test-report-save"
      >
        {saving ? <Loader2 size={14} className="animate-spin" /> : (saved ? <Check size={14} /> : null)}
        {saved ? 'Saved!' : (saving ? 'Saving…' : 'Save Report')}
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Tab B — SEO Keywords editor
// ─────────────────────────────────────────────────────────────────────────

function SeoEditor({ product, onSave }) {
  const [alt, setAlt] = useState(product.image_alt_text || '');
  const [keywords, setKeywords] = useState(product.seo_keywords || []);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setAlt(product.image_alt_text || '');
    setKeywords(product.seo_keywords || []);
    setDraft('');
    setSaved(false);
  }, [product]);

  const addDraft = () => {
    const cleaned = draft.trim().toLowerCase();
    if (!cleaned || keywords.includes(cleaned)) {
      setDraft('');
      return;
    }
    setKeywords((prev) => [...prev, cleaned]);
    setDraft('');
  };

  const remove = (kw) => setKeywords((prev) => prev.filter((k) => k !== kw));

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({
        image_alt_text: alt || null,
        seo_keywords: keywords,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl ring-1 ring-stone-200 p-5 sm:p-6" data-testid="seo-editor">
      <div className="flex items-center gap-2 mb-4">
        <Sparkles size={16} className="text-purple-600" />
        <h2 className="text-base font-black text-stone-900">SEO · Alt Text &amp; Keywords</h2>
      </div>
      <p className="text-xs text-stone-500 mb-5">
        Alt text goes into every &lt;img&gt; tag on {product.short_name || product.name}&apos;s public pages.
        Keywords are emitted as a JSON-LD block for search engines to widen your organic reach.
      </p>

      <label className="block mb-5">
        <span className="text-xs font-bold text-stone-700 uppercase tracking-wide">Image Alt Text</span>
        <input
          value={alt}
          onChange={(e) => setAlt(e.target.value)}
          placeholder="e.g. Celesta Glow Anti-Aging Serum bottle with Retinol formula"
          className="mt-1.5 w-full px-3 py-2 text-sm rounded-lg border border-stone-200 focus:outline-none focus:ring-2 focus:ring-purple-500/30"
          data-testid="seo-alt-input"
        />
        <p className="mt-1 text-[10px] text-stone-400">Aim for 80–120 characters, describe the visible product + main benefit.</p>
      </label>

      <label className="block mb-3">
        <span className="text-xs font-bold text-stone-700 uppercase tracking-wide">Keywords</span>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5 p-2 rounded-lg border border-stone-200 focus-within:ring-2 focus-within:ring-purple-500/30">
          {keywords.map((kw) => (
            <span key={kw} className="inline-flex items-center gap-1 pl-2.5 pr-1 py-1 bg-purple-100 text-purple-800 text-xs font-semibold rounded-full">
              {kw}
              <button
                onClick={() => remove(kw)}
                className="w-4 h-4 rounded-full hover:bg-purple-200 flex items-center justify-center"
                data-testid={`seo-remove-${kw}`}
              >
                <X size={10} />
              </button>
            </span>
          ))}
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ',') {
                e.preventDefault();
                addDraft();
              } else if (e.key === 'Backspace' && draft === '' && keywords.length) {
                setKeywords((prev) => prev.slice(0, -1));
              }
            }}
            onBlur={() => draft && addDraft()}
            placeholder={keywords.length ? 'Add another…' : 'Type a keyword then press Enter'}
            className="flex-1 min-w-[140px] px-1 py-1 text-sm bg-transparent focus:outline-none"
            data-testid="seo-keyword-input"
          />
        </div>
        <p className="mt-1 text-[10px] text-stone-400">Press Enter or comma to add each keyword.  Backspace with empty input removes the last chip.</p>
      </label>

      <button
        onClick={handleSave}
        disabled={saving}
        className="inline-flex items-center gap-2 bg-purple-600 text-white font-bold text-sm px-5 py-2.5 rounded-full hover:bg-purple-700 disabled:opacity-50"
        data-testid="seo-save"
      >
        {saving ? <Loader2 size={14} className="animate-spin" /> : (saved ? <Check size={14} /> : null)}
        {saved ? 'Saved!' : (saving ? 'Saving…' : 'Save SEO')}
      </button>
    </div>
  );
}

function TabButton({ active, onClick, children, testId }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2.5 -mb-px inline-flex items-center gap-2 text-sm font-bold border-b-2 transition-colors ${
        active ? 'text-emerald-700 border-emerald-600' : 'text-stone-500 border-transparent hover:text-stone-800'
      }`}
      data-testid={testId}
    >
      {children}
    </button>
  );
}
