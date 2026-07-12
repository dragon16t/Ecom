import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { ArrowLeft, Users, Layers, Percent, Copy, ExternalLink, Loader2, Save, Trash2, Plus, Image as ImageIcon, Handshake, TrendingUp, HeartPulse, Phone, Mail } from 'lucide-react';
import { useAdminAuth } from '../../utils/adminAuth';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function AdminExtras() {
  const navigate = useNavigate();
  const { adminToken, isLoading, isAuthenticated } = useAdminAuth(navigate);
  const [tab, setTab] = useState('tiles');
  const auth = useMemo(() => adminToken ? { headers: { 'X-Admin-Token': adminToken } } : {}, [adminToken]);
  if (isLoading || !isAuthenticated) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-emerald-500" /></div>;

  return (
    <div className="min-h-screen bg-gray-50 pb-10">
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3 mb-4">
            <Link to="/admin/dashboard" className="p-2 -ml-2 rounded-full hover:bg-gray-100"><ArrowLeft size={20} /></Link>
            <h1 className="text-xl font-bold">Growth & Sale Manager</h1>
          </div>
          <div className="flex gap-2 overflow-x-auto">
            {[
              { k: 'tiles', label: 'Shop by Category Tiles', icon: Layers },
              { k: 'leads', label: 'Leads', icon: Users },
              { k: 'sales', label: 'Sale Campaigns', icon: Percent },
            ].map(t => (
              <button key={t.k} onClick={() => setTab(t.k)}
                className={`px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap flex items-center gap-1.5 ${tab === t.k ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                data-testid={`extras-tab-${t.k}`}>
                <t.icon size={15} /> {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="max-w-6xl mx-auto px-4 py-5">
        {tab === 'tiles' && <TilesTab auth={auth} />}
        {tab === 'leads' && <LeadsTab auth={auth} />}
        {tab === 'sales' && <SalesTab auth={auth} />}
      </div>
    </div>
  );
}

function TilesTab({ auth }) {
  const [tiles, setTiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState({ slug: '', name: '', niche: 'skincare', sort_order: 0 });

  const load = async () => {
    try { const r = await axios.get(`${API}/admin/shop-by-category?niche=skincare`, auth); setTiles(r.data || []); } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []); // eslint-disable-line

  const create = async () => {
    if (!creating.slug || !creating.name) return alert('Slug and Name required');
    try {
      await axios.post(`${API}/admin/shop-by-category`, { ...creating, is_active: true }, auth);
      setCreating({ slug: '', name: '', niche: 'skincare', sort_order: 0 });
      load();
    } catch (e) { alert(e?.response?.data?.detail || 'Create failed'); }
  };
  const uploadImg = async (slug, file) => {
    const fd = new FormData(); fd.append('file', file);
    try { await axios.post(`${API}/admin/shop-by-category/${slug}/image`, fd, { ...auth, headers: { ...auth.headers, 'Content-Type': 'multipart/form-data' } }); load(); }
    catch (e) { alert(e?.response?.data?.detail || 'Upload failed'); }
  };
  const del = async (slug) => {
    if (!confirm(`Delete tile "${slug}"?`)) return;
    await axios.delete(`${API}/admin/shop-by-category/${slug}`, auth); load();
  };
  const patch = async (t, upd) => {
    await axios.put(`${API}/admin/shop-by-category/${t.slug}`, { ...t, ...upd }, auth); load();
  };

  if (loading) return <Loader2 className="w-6 h-6 animate-spin mx-auto text-emerald-500" />;

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl p-4 border border-gray-100">
        <h3 className="font-semibold mb-3 text-sm">Add a new tile (Skincare &quot;Shop by Category&quot;)</h3>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
          <input placeholder="slug (sunscreens)" value={creating.slug} onChange={e => setCreating({ ...creating, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') })} className="input" data-testid="tile-slug-input" />
          <input placeholder="Display name" value={creating.name} onChange={e => setCreating({ ...creating, name: e.target.value })} className="input" data-testid="tile-name-input" />
          <input type="number" placeholder="sort" value={creating.sort_order} onChange={e => setCreating({ ...creating, sort_order: Number(e.target.value) })} className="input" />
          <button onClick={create} className="bg-emerald-600 text-white rounded-xl font-semibold hover:bg-emerald-700" data-testid="tile-create-btn"><Plus size={15} className="inline mr-1" />Add</button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {tiles.map(t => (
          <div key={t.slug} className="bg-white rounded-2xl border border-gray-100 p-3" data-testid={`tile-row-${t.slug}`}>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-16 h-16 rounded-full bg-gray-100 overflow-hidden border">
                {t.image ? <img src={t.image} alt={t.name} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-gray-300"><ImageIcon size={20} /></div>}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm truncate">{t.name}</p>
                <p className="text-xs text-gray-400 truncate">{t.slug}</p>
              </div>
            </div>
            <label className="text-xs inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-100 text-emerald-700 rounded-full cursor-pointer font-semibold">
              <ImageIcon size={11} /> Upload image
              <input type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && uploadImg(t.slug, e.target.files[0])} />
            </label>
            <label className="text-xs ml-2 inline-flex items-center gap-1"><input type="checkbox" checked={t.is_active !== false} onChange={e => patch(t, { is_active: e.target.checked })} />Active</label>
            <button onClick={() => del(t.slug)} className="text-xs text-red-600 ml-2 hover:underline"><Trash2 size={11} className="inline" /> Delete</button>
          </div>
        ))}
        {tiles.length === 0 && <p className="col-span-full text-center text-sm text-gray-500 py-8">No tiles yet. Add your first Skincare category tile above.</p>}
      </div>
      <style>{`.input{padding:0.55rem 0.8rem;border:1px solid #e5e7eb;border-radius:0.6rem;font-size:0.85rem;outline:none}.input:focus{border-color:#10b981;box-shadow:0 0 0 3px rgba(16,185,129,0.2)}`}</style>
    </div>
  );
}

function LeadsTab({ auth }) {
  const [data, setData] = useState({ leads: [], counts: {} });
  const [type, setType] = useState('all');
  const load = async () => {
    const r = await axios.get(`${API}/admin/leads${type !== 'all' ? `?type=${type}` : ''}`, auth); setData(r.data || { leads: [], counts: {} });
  };
  useEffect(() => { load(); }, [type]); // eslint-disable-line

  const setStatus = async (id, status) => {
    await axios.patch(`${API}/admin/leads/${id}`, { status }, auth); load();
  };

  const iconFor = (t) => t === 'partner' ? Handshake : t === 'invest' ? TrendingUp : HeartPulse;
  return (
    <div>
      <div className="flex gap-1.5 mb-3 overflow-x-auto">
        {[['all', 'All'], ['partner', 'Partner'], ['invest', 'Invest'], ['skin_concern', 'Skin Concern']].map(([k, l]) => (
          <button key={k} onClick={() => setType(k)} className={`px-3 py-1.5 rounded-full text-xs font-semibold ${type === k ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-700'}`} data-testid={`lead-filter-${k}`}>
            {l} {data.counts[k] > 0 && <span className="opacity-80">({data.counts[k]})</span>}
          </button>
        ))}
      </div>
      <div className="space-y-2">
        {data.leads.map(l => {
          const I = iconFor(l.type);
          return (
            <div key={l.id} className="bg-white rounded-xl border border-gray-100 p-3 flex items-center gap-3" data-testid={`lead-row-${l.id}`}>
              <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0"><I size={18} /></div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-sm">{l.name}</p>
                  <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 font-semibold">{l.type}</span>
                  <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-gray-100 text-gray-700 font-semibold">{l.status}</span>
                </div>
                <div className="text-xs text-gray-500 mt-0.5 flex flex-wrap gap-x-3">
                  <span className="inline-flex items-center gap-1"><Phone size={10} />+91 {l.phone}</span>
                  {l.email && <span className="inline-flex items-center gap-1"><Mail size={10} />{l.email}</span>}
                  {l.investment_amount && <span>💰 ₹{l.investment_amount}</span>}
                  {l.concern && <span>🩺 {l.concern}</span>}
                  {l.business_name && <span>🏢 {l.business_name}</span>}
                </div>
                {l.message && <p className="text-xs text-gray-600 mt-1 italic">&quot;{l.message}&quot;</p>}
              </div>
              <select value={l.status} onChange={e => setStatus(l.id, e.target.value)} className="text-xs border border-gray-200 rounded-md px-2 py-1" data-testid={`lead-status-${l.id}`}>
                {['new', 'contacted', 'qualified', 'converted', 'closed'].map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
          );
        })}
        {data.leads.length === 0 && <p className="text-center text-sm text-gray-500 py-8">No leads yet.</p>}
      </div>
    </div>
  );
}

function SalesTab({ auth }) {
  const [rows, setRows] = useState([]);
  const [creating, setCreating] = useState({ slug: '', title: '', discount_percent: 50 });
  const load = async () => { const r = await axios.get(`${API}/admin/sale-campaigns`, auth); setRows(r.data || []); };
  useEffect(() => { load(); }, []); // eslint-disable-line
  const origin = window.location.origin;
  const create = async () => {
    if (!creating.slug || !creating.title) return alert('Slug and Title required');
    try { await axios.post(`${API}/admin/sale-campaigns`, { ...creating, is_active: true }, auth); setCreating({ slug: '', title: '', discount_percent: 50 }); load(); }
    catch (e) { alert(e?.response?.data?.detail || 'Create failed'); }
  };
  const del = async (slug) => { if (confirm(`Delete campaign "${slug}"?`)) { await axios.delete(`${API}/admin/sale-campaigns/${slug}`, auth); load(); } };
  const patch = async (r, upd) => { await axios.put(`${API}/admin/sale-campaigns/${r.slug}`, { ...r, ...upd }, auth); load(); };
  const copy = (t) => { navigator.clipboard.writeText(t); alert('Link copied!'); };

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl p-4 border border-gray-100">
        <h3 className="font-semibold mb-3 text-sm">Create a new sale campaign</h3>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
          <input placeholder="slug (flat-50)" value={creating.slug} onChange={e => setCreating({ ...creating, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') })} className="input" data-testid="sale-slug-input" />
          <input placeholder="Title (e.g. Anti-Aging Kit)" value={creating.title} onChange={e => setCreating({ ...creating, title: e.target.value })} className="input" data-testid="sale-title-input" />
          <input type="number" min="1" max="95" placeholder="% off" value={creating.discount_percent} onChange={e => setCreating({ ...creating, discount_percent: Number(e.target.value) })} className="input" data-testid="sale-pct-input" />
          <button onClick={create} className="bg-emerald-600 text-white rounded-xl font-semibold hover:bg-emerald-700" data-testid="sale-create-btn"><Plus size={15} className="inline mr-1" />Create</button>
        </div>
      </div>

      <div className="space-y-2">
        {rows.map(r => {
          const url = `${origin}/sale/${r.slug}`;
          return (
            <div key={r.slug} className="bg-white rounded-2xl border border-gray-100 p-4" data-testid={`sale-row-${r.slug}`}>
              <div className="flex items-center gap-3 mb-2 flex-wrap">
                <span className="text-2xl font-black text-emerald-700">{r.discount_percent}%</span>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold">{r.title}</p>
                  <p className="text-xs text-gray-500">/sale/{r.slug}</p>
                </div>
                <label className="text-xs inline-flex items-center gap-1"><input type="checkbox" checked={r.is_active} onChange={e => patch(r, { is_active: e.target.checked })} />Active</label>
                <button onClick={() => del(r.slug)} className="text-xs text-red-600 hover:underline"><Trash2 size={11} className="inline" /></button>
              </div>
              <div className="flex items-center gap-2 flex-wrap text-xs">
                <button onClick={() => copy(url)} className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 rounded hover:bg-gray-200 font-mono" data-testid={`copy-link-${r.slug}`}><Copy size={11} /> Copy link</button>
                <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-50 text-emerald-700 rounded hover:bg-emerald-100"><ExternalLink size={11} /> Preview</a>
                <span className="ml-auto text-gray-500">Orders: <b>{r.orders_count || 0}</b> · Revenue: <b>₹{Math.round(r.revenue || 0).toLocaleString('en-IN')}</b></span>
              </div>
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input placeholder="Subtitle" defaultValue={r.subtitle || ''} onBlur={e => e.target.value !== (r.subtitle || '') && patch(r, { subtitle: e.target.value })} className="input" />
                <input placeholder="Trust line" defaultValue={r.trust_line || ''} onBlur={e => e.target.value !== (r.trust_line || '') && patch(r, { trust_line: e.target.value })} className="input" />
                <input placeholder="Featured slugs (comma-separated)" defaultValue={(r.featured_slugs || []).join(',')} onBlur={e => { const arr = e.target.value.split(',').map(s => s.trim()).filter(Boolean); if (arr.join(',') !== (r.featured_slugs || []).join(',')) patch(r, { featured_slugs: arr }); }} className="input sm:col-span-2" />
              </div>
            </div>
          );
        })}
        {rows.length === 0 && <p className="text-center text-sm text-gray-500 py-8">No campaigns yet.</p>}
      </div>
      <style>{`.input{padding:0.55rem 0.8rem;border:1px solid #e5e7eb;border-radius:0.6rem;font-size:0.85rem;outline:none}.input:focus{border-color:#10b981;box-shadow:0 0 0 3px rgba(16,185,129,0.2)}`}</style>
    </div>
  );
}
