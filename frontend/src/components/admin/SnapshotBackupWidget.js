/**
 * SnapshotBackupWidget — admin sticky banner that shows last backup time and
 * lets the admin force an immediate snapshot before redeploying.
 *
 * Placement: rendered at the top of the AdminDashboard (and any heavy admin
 * page) so the "back up before deploy" workflow is one click away.
 */
import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { Cloud, Loader2, CheckCircle2, AlertTriangle, RefreshCw, RotateCcw } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

export default function SnapshotBackupWidget({ token }) {
  const auth = { headers: { 'X-Admin-Token': token } };
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);
  const [justSucceeded, setJustSucceeded] = useState(false);
  const [error, setError] = useState('');

  const fetchStatus = useCallback(async () => {
    try {
      const r = await axios.get(`${API}/api/admin/catalog/backup/status`, auth);
      setStatus(r.data);
    } catch (e) {
      // silent; the widget is best-effort
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => { fetchStatus(); }, [fetchStatus]);

  const minutesAgo = (() => {
    const iso = status?.remote_snapshot_created_at;
    if (!iso) return null;
    const ms = Date.now() - new Date(iso).getTime();
    return Math.max(0, Math.round(ms / 60000));
  })();

  const snapshotNow = async () => {
    if (busy) return;
    setBusy(true); setError(''); setJustSucceeded(false);
    try {
      await axios.post(`${API}/api/admin/catalog/backup/snapshot`, {}, auth);
      setJustSucceeded(true);
      setTimeout(() => setJustSucceeded(false), 4000);
      // Refetch to update timestamp
      setTimeout(fetchStatus, 800);
    } catch (e) {
      setError(e?.response?.data?.detail || e?.message || 'Snapshot failed');
    } finally {
      setBusy(false);
    }
  };

  const restoreNow = async () => {
    if (busy) return;
    if (!window.confirm(
      'Restore from the last backup?\n\n' +
      'This will REPLACE existing taxonomy / catalog / orders / customers etc. with the last snapshot. ' +
      'Existing records with the same slug/id are overwritten. New records added after the snapshot are kept as-is.\n\n' +
      'Use this only after a redeploy if data looks wrong, or to recover from an accidental bulk delete.'
    )) return;
    setBusy(true); setError(''); setJustSucceeded(false);
    try {
      const r = await axios.post(`${API}/api/admin/catalog/backup/restore`, {}, auth);
      const counts = r.data?.counts || {};
      const summary = Object.entries(counts)
        .filter(([, v]) => typeof v === 'number' && v > 0)
        .map(([k, v]) => `${k}: ${v}`)
        .join(' · ');
      alert(`Restore complete!\n\nRestored:\n${summary || '(nothing — snapshot was empty)'}\n\nSnapshot from: ${r.data?.snapshot_created_at || 'unknown'}`);
      setJustSucceeded(true);
      setTimeout(() => setJustSucceeded(false), 4000);
      setTimeout(fetchStatus, 800);
    } catch (e) {
      setError(e?.response?.data?.detail || e?.message || 'Restore failed');
    } finally {
      setBusy(false);
    }
  };

  // State styling
  const isFresh = minutesAgo != null && minutesAgo < 5;
  const isStale = minutesAgo != null && minutesAgo >= 5;
  const isMissing = !status?.remote_snapshot_available;

  let banner = 'bg-amber-50 ring-amber-200 text-amber-900';
  let Icon = AlertTriangle;
  let iconClass = 'text-amber-600';
  let label = 'No backup yet — click "Backup now" before your next redeploy';
  if (isFresh) {
    banner = 'bg-emerald-50 ring-emerald-200 text-emerald-900';
    Icon = CheckCircle2;
    iconClass = 'text-emerald-600';
    label = `Data backed up ${minutesAgo === 0 ? 'just now' : `${minutesAgo} min ago`} — safe to redeploy`;
  } else if (isStale) {
    banner = 'bg-amber-50 ring-amber-200 text-amber-900';
    Icon = AlertTriangle;
    iconClass = 'text-amber-600';
    label = `Backup is ${minutesAgo} min old — refresh before redeploy if you made changes`;
  }

  return (
    <div className={`ring-2 rounded-2xl px-4 py-3 flex flex-wrap items-center gap-3 mb-5 ${banner}`} data-testid="snapshot-backup-widget">
      <Cloud size={18} className={iconClass} />
      <Icon size={16} className={iconClass} />
      <div className="flex-1 min-w-[200px]">
        <p className="text-xs font-black leading-tight">{label}</p>
        {status?.remote_counts && (
          <p className="text-[10px] mt-0.5 opacity-80">
            In last backup: {status.remote_counts.products || 0} products · {status.remote_counts.orders || 0} orders · {status.remote_counts.subcategories || 0} subcategories · {status.remote_counts.customers || status.remote_counts.users || 0} customers
          </p>
        )}
        {error && <p className="text-[10px] mt-0.5 text-red-700 font-bold">⚠ {error}</p>}
        {!status?.cloudinary_configured && (
          <p className="text-[10px] mt-0.5 text-red-700 font-bold">⚠ Cloudinary not configured — backups disabled. Add credentials in Admin → Settings.</p>
        )}
      </div>
      <button
        onClick={fetchStatus}
        className="text-[11px] font-bold px-2.5 py-1.5 rounded-lg bg-white/70 hover:bg-white"
        title="Refresh status"
        data-testid="backup-refresh"
      >
        <RefreshCw size={12} />
      </button>
      <button
        onClick={snapshotNow}
        disabled={busy || !status?.cloudinary_configured}
        className="text-xs font-black px-3.5 py-2 rounded-lg bg-stone-900 hover:bg-stone-800 disabled:opacity-60 text-white inline-flex items-center gap-1.5 shadow"
        data-testid="backup-now-button"
      >
        {busy ? <><Loader2 size={13} className="animate-spin" /> Working…</>
        : justSucceeded ? <><CheckCircle2 size={13} /> Done!</>
        : <><Cloud size={13} /> Backup now</>}
      </button>
      <button
        onClick={restoreNow}
        disabled={busy || !status?.remote_snapshot_available}
        title={!status?.remote_snapshot_available ? 'No backup available yet — click Backup now first' : 'Restore data from the last backup'}
        className="text-xs font-black px-3.5 py-2 rounded-lg bg-white ring-1 ring-stone-300 hover:bg-stone-50 disabled:opacity-50 text-stone-900 inline-flex items-center gap-1.5"
        data-testid="restore-now-button"
      >
        <RotateCcw size={13} /> Restore
      </button>
    </div>
  );
}
