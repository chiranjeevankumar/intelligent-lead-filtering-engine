import React, { useState, useEffect } from 'react';
import { 
  Building, 
  ShieldCheck, 
  AlertTriangle, 
  RefreshCw, 
  Send, 
  Eye, 
  CheckCircle2, 
  XCircle, 
  GitCompare, 
  Key, 
  Tag as TagIcon,
  Layers
} from 'lucide-react';

export function CrmIntegrationHub() {
  const [status, setStatus] = useState<any>(null);
  const [preview, setPreview] = useState<any>(null);
  const [syncResults, setSyncResults] = useState<any[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchCrmStatus();
  }, []);

  const fetchCrmStatus = async () => {
    try {
      const res = await fetch('/api/crm/status', {
        headers: { 'Authorization': 'Bearer mock-token' }
      });
      if (res.ok) {
        setStatus(await res.json());
      }
    } catch (err: any) {
      console.error('Failed to fetch CRM status:', err);
    }
  };

  const handleRunPreview = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/crm/preview', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer mock-token'
        },
        body: JSON.stringify({})
      });

      if (!res.ok) throw new Error('Failed to generate sync preview.');
      const data = await res.json();
      setPreview(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleExecuteSync = async (dryRun = false) => {
    if (!dryRun && !confirm('Are you sure you want to execute CRM record creation for all eligible leads?')) {
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/crm/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer mock-token'
        },
        body: JSON.stringify({ dryRun })
      });

      if (!res.ok) throw new Error('Failed to execute CRM sync.');
      const data = await res.json();
      setSyncResults(data.syncResults || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Connection Status Banner */}
      <div className={`p-6 rounded-2xl border flex flex-col md:flex-row justify-between items-start md:items-center gap-4 ${
        status?.isConnected 
          ? 'bg-emerald-950/40 border-emerald-800 text-emerald-200' 
          : 'bg-amber-950/30 border-amber-800 text-amber-200'
      }`}>
        <div className="flex items-center gap-4">
          <div className={`p-3 rounded-xl border ${
            status?.isConnected ? 'bg-emerald-600/20 border-emerald-500/30 text-emerald-400' : 'bg-amber-600/20 border-amber-500/30 text-amber-400'
          }`}>
            <Building size={24} />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h3 className="text-lg font-bold">SalesForge CRM Integration</h3>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase border ${
                status?.isConnected ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
              }`}>
                {status?.mode === 'salesforge_live' ? 'Live CRM Connected' : 'Mock / Offline Mode'}
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-1 max-w-2xl">
              {status?.message || 'Checking SalesForge CRM connection status...'}
            </p>
          </div>
        </div>

        <button 
          onClick={fetchCrmStatus}
          className="p-2 bg-slate-900 hover:bg-slate-800 rounded-lg text-slate-300 border border-slate-700 transition-colors shrink-0"
          title="Refresh Connection Status"
        >
          <RefreshCw size={16} />
        </button>
      </div>

      {error && (
        <div className="bg-red-950/50 border border-red-800 text-red-200 p-4 rounded-xl text-sm">
          {error}
        </div>
      )}

      {/* 2. Control Panel & Actions */}
      <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-800 pb-4">
          <div>
            <h4 className="font-bold text-slate-100">CRM Sync Actions & Dry-Run Preview</h4>
            <p className="text-xs text-slate-400 mt-0.5">Dry-run preview simulates CRM creation without altering existing data. Explicit action is required to sync.</p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button 
              onClick={handleRunPreview}
              disabled={loading}
              className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 px-4 py-2.5 rounded-xl text-xs font-semibold transition-colors"
            >
              <Eye size={16} /> Dry-Run Preview
            </button>
            <button 
              onClick={() => handleExecuteSync(false)}
              disabled={loading}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-xl text-xs font-semibold transition-colors shadow-lg shadow-indigo-600/20"
            >
              <Send size={16} /> Sync Eligible Leads to CRM
            </button>
          </div>
        </div>

        {/* Preview Summary */}
        {preview && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
              <p className="text-xs text-slate-400">Total Submitted</p>
              <p className="text-2xl font-bold text-slate-100 mt-1">{preview.totalSubmitted}</p>
            </div>
            <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
              <p className="text-xs text-slate-400">Ready to Create</p>
              <p className="text-2xl font-bold text-emerald-400 mt-1">{preview.readyToCreateCount}</p>
            </div>
            <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
              <p className="text-xs text-slate-400">Skipped Duplicates</p>
              <p className="text-2xl font-bold text-amber-400 mt-1">{preview.duplicateCount}</p>
            </div>
            <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
              <p className="text-xs text-slate-400">Rejected Validation</p>
              <p className="text-2xl font-bold text-red-400 mt-1">{preview.invalidCount}</p>
            </div>
          </div>
        )}

        {/* 3. Per-Record Sync Results Table */}
        {syncResults && (
          <div className="space-y-3">
            <h4 className="font-semibold text-sm text-slate-200">Per-Record Sync Execution Results</h4>
            <div className="overflow-x-auto border border-slate-800 rounded-xl">
              <table className="w-full text-left text-xs bg-slate-900/50">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400">
                    <th className="p-3">Company / Email</th>
                    <th className="p-3">Sync Result</th>
                    <th className="p-3">CRM Record ID</th>
                    <th className="p-3">Idempotency Key</th>
                    <th className="p-3">Associated Tags</th>
                    <th className="p-3">Reason / Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {syncResults.map((rec, idx) => (
                    <tr key={idx} className="hover:bg-slate-900/40">
                      <td className="p-3">
                        <p className="font-semibold text-slate-200">{rec.companyName}</p>
                        <p className="text-slate-400">{rec.email}</p>
                      </td>
                      <td className="p-3">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold capitalize border ${
                          rec.result === 'created' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                          rec.result === 'skipped_duplicate' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                          'bg-red-500/10 text-red-400 border-red-500/20'
                        }`}>
                          {rec.result.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="p-3 font-mono text-slate-300">{rec.crmRecordId || 'N/A'}</td>
                      <td className="p-3 font-mono text-slate-400 truncate max-w-xs">{rec.idempotencyKey}</td>
                      <td className="p-3">
                        <div className="flex flex-wrap gap-1">
                          {(rec.tagsAssociated || []).map((t: string, i: number) => (
                            <span key={i} className="px-2 py-0.5 bg-slate-950 text-slate-300 border border-slate-800 text-[10px] rounded">
                              {t}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="p-3 text-slate-400">{rec.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
