/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  ListFilter, 
  Users, 
  GitCompare, 
  Sparkles, 
  MessageSquare, 
  BarChart3, 
  Settings, 
  Upload, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  Search, 
  Download, 
  RefreshCw,
  Sliders,
  ShieldCheck,
  Building,
  Mail,
  Phone,
  Globe,
  Tag as TagIcon,
  FileSpreadsheet,
  PanelLeftClose,
  PanelLeft,
  Menu,
  X
} from 'lucide-react';
import { FileImporter } from './components/FileImporter';
import { CrmIntegrationHub } from './components/CrmIntegrationHub';
import { 
  exportToCSV, 
  exportToExcel, 
  generateProcessedLeadsData, 
  generateValidationErrorsData, 
  generateDuplicateReportData, 
  generateProcessingSummaryData 
} from './utils/exportHelper';

export default function App() {
  const [activeTab, setActiveTab] = useState<'overview' | 'processing' | 'leads' | 'duplicates' | 'enrichment' | 'feedback' | 'analytics' | 'crm' | 'settings'>('overview');
  const [overview, setOverview] = useState<any>(null);
  const [leads, setLeads] = useState<any[]>([]);
  const [sources, setSources] = useState<any[]>([]);
  const [mlStatus, setMlStatus] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sidebar toggle state with LocalStorage preference persistence
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('leadpulse_sidebar_open');
      return saved !== null ? JSON.parse(saved) : true;
    } catch {
      return true;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('leadpulse_sidebar_open', JSON.stringify(sidebarOpen));
    } catch {
      // Ignore storage error
    }
  }, [sidebarOpen]);

  // Close mobile sidebar on Escape key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && sidebarOpen) {
        setSidebarOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [sidebarOpen]);

  // Search & Filter state for Processed Leads
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Single Lead Processing Form State
  const [newLeadEmail, setNewLeadEmail] = useState('');
  const [newLeadCompany, setNewLeadCompany] = useState('');
  const [newLeadPhone, setNewLeadPhone] = useState('');
  const [newLeadDomain, setNewLeadDomain] = useState('');
  const [newLeadSource, setNewLeadSource] = useState('Manual Upload');

  // Settings state
  const [scoringWeights, setScoringWeights] = useState({
    email_validity: 20,
    phone_validity: 15,
    domain_availability: 15,
    company_information: 20,
    data_completeness: 30,
  });

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = 'mock-token'; // In production, retrieved from Firebase Auth
      const headers = { 'Authorization': `Bearer ${token}` };

      if (activeTab === 'overview' || activeTab === 'analytics') {
        const resOverview = await fetch('/api/analytics/overview', { headers });
        if (resOverview.ok) setOverview(await resOverview.json());

        const resSources = await fetch('/api/analytics/sources', { headers });
        if (resSources.ok) setSources(await resSources.json());

        const resMl = await fetch('/api/ml/status', { headers });
        if (resMl.ok) setMlStatus(await resMl.json());
      }

      if (activeTab === 'leads' || activeTab === 'duplicates' || activeTab === 'enrichment' || activeTab === 'feedback' || activeTab === 'overview' || activeTab === 'crm') {
        const resLeads = await fetch('/api/leads', { headers });
        if (resLeads.ok) setLeads(await resLeads.json());
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  const handleProcessSingleLead = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer mock-token`,
        },
        body: JSON.stringify({
          leadData: {
            email: newLeadEmail,
            companyName: newLeadCompany,
            phone: newLeadPhone,
            domain: newLeadDomain,
            source: newLeadSource,
          }
        }),
      });

      if (!res.ok) throw new Error('Failed to process lead');
      
      setNewLeadEmail('');
      setNewLeadCompany('');
      setNewLeadPhone('');
      setNewLeadDomain('');
      alert('Lead successfully processed and enriched!');
      fetchData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleFeedback = async (leadId: number, decision: string, rejectionReason?: string) => {
    try {
      const res = await fetch(`/api/leads/${leadId}/feedback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer mock-token`,
        },
        body: JSON.stringify({ decision, rejectionReason }),
      });

      if (!res.ok) throw new Error('Failed to submit feedback');
      fetchData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Filter leads based on search & status
  const filteredLeads = leads.filter(lead => {
    const pd = lead.processed_data || {};
    const company = (pd.companyName || '').toLowerCase();
    const email = (pd.email || '').toLowerCase();
    const search = searchTerm.toLowerCase();

    const matchesSearch = company.includes(search) || email.includes(search);
    const matchesStatus = statusFilter === 'all' || lead.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const exportAllLeads = (format: 'csv' | 'xlsx', type: 'processed' | 'errors' | 'duplicates' | 'summary') => {
    const filename = `leads_${type}_${new Date().toISOString().split('T')[0]}`;
    let data: any[] = [];

    if (type === 'processed') {
      data = generateProcessedLeadsData(leads);
    } else if (type === 'errors') {
      data = generateValidationErrorsData(leads);
    } else if (type === 'duplicates') {
      data = generateDuplicateReportData(leads);
    } else if (type === 'summary') {
      data = generateProcessingSummaryData(leads, overview);
    }

    if (format === 'csv') {
      exportToCSV(data, filename);
    } else {
      exportToExcel(data, filename, type.toUpperCase());
    }
  };

  return (
    <div className="flex h-screen bg-slate-900 text-slate-100 font-sans overflow-x-hidden relative">
      {/* Mobile Drawer Overlay Backdrop */}
      <div 
        className={`fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-40 md:hidden transition-opacity duration-300 ${
          sidebarOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setSidebarOpen(false)}
        aria-hidden="true"
      />

      {/* Sidebar Drawer / Collapsible Menu */}
      <aside 
        className={`
          fixed inset-y-0 left-0 z-50 md:static md:z-auto
          bg-slate-950 border-r border-slate-800 flex flex-col shrink-0
          transition-all duration-300 ease-in-out
          ${sidebarOpen 
            ? 'w-64 translate-x-0 opacity-100' 
            : '-translate-x-full md:translate-x-0 md:w-0 md:border-none opacity-0 md:opacity-0 pointer-events-none'
          }
        `}
      >
        <div className="p-6 border-b border-slate-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 truncate">
            <div className="bg-indigo-600 p-2 rounded-lg text-white shadow-lg shadow-indigo-600/30 shrink-0">
              <Sparkles size={20} />
            </div>
            <div className="truncate">
              <h1 className="font-bold text-lg tracking-tight truncate">LeadPulse AI</h1>
              <p className="text-xs text-slate-400 truncate">Intelligent Filtering Engine</p>
            </div>
          </div>
          <button 
            onClick={() => setSidebarOpen(false)}
            className="md:hidden p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-900 rounded-lg transition-colors shrink-0"
            aria-label="Close menu"
          >
            <X size={18} />
          </button>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {[
            { id: 'overview', label: 'Overview', icon: LayoutDashboard },
            { id: 'processing', label: 'Lead Processing', icon: ListFilter },
            { id: 'leads', label: 'Processed Leads', icon: Users },
            { id: 'duplicates', label: 'Duplicate Review', icon: GitCompare },
            { id: 'enrichment', label: 'Enrichment Review', icon: Sparkles },
            { id: 'feedback', label: 'Feedback & Audit', icon: MessageSquare },
            { id: 'analytics', label: 'Source Analytics', icon: BarChart3 },
            { id: 'crm', label: 'CRM Sync Hub', icon: Building },
            { id: 'settings', label: 'Engine Settings', icon: Settings },
          ].map(item => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id as any);
                  if (typeof window !== 'undefined' && window.innerWidth < 768) {
                    setSidebarOpen(false);
                  }
                }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                  active 
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30' 
                    : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'
                }`}
              >
                <Icon size={18} className="shrink-0" />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-800 text-xs text-slate-500 text-center truncate">
          Enterprise Engine v2.4
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden transition-all duration-300">
        {/* Top Header */}
        <header className="h-16 bg-slate-950 border-b border-slate-800 px-4 md:px-8 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3 md:gap-4 truncate">
            {/* Sidebar Toggle Button */}
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              aria-label={sidebarOpen ? "Close dashboard menu" : "Open dashboard menu"}
              title={sidebarOpen ? "Close dashboard menu" : "Open dashboard menu"}
              className="p-2 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white rounded-xl border border-slate-800 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 flex items-center justify-center shrink-0"
            >
              {sidebarOpen ? <PanelLeftClose size={20} /> : <PanelLeft size={20} />}
            </button>

            <h2 className="text-lg md:text-xl font-bold capitalize text-slate-100 truncate">
              {activeTab.replace('-', ' ')}
            </h2>
          </div>

          <div className="flex items-center gap-3 md:gap-4 shrink-0">
            <button 
              onClick={fetchData}
              className="p-2 bg-slate-900 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-200 transition-colors border border-slate-800"
              title="Refresh Data"
            >
              <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
            </button>
            <div className="hidden sm:flex items-center gap-3 bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-800">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-medium text-slate-300">Engine Active</span>
            </div>
          </div>
        </header>

        {/* Dynamic Content */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8">
          {error && (
            <div className="mb-6 bg-red-950/50 border border-red-800 text-red-200 p-4 rounded-xl flex items-center gap-3">
              <AlertCircle size={20} />
              <span>{error}</span>
            </div>
          )}

          {/* A. OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                {[
                  { label: 'Total Processed', value: overview?.totalProcessed || leads.length, icon: Users, color: 'text-blue-400' },
                  { label: 'Valid Contacts', value: `${overview?.validContactPercentage || 0}%`, icon: ShieldCheck, color: 'text-emerald-400' },
                  { label: 'Duplicates Detected', value: overview?.duplicateCount || 0, icon: GitCompare, color: 'text-amber-400' },
                  { label: 'Eligible Leads', value: overview?.eligibleCount || 0, icon: CheckCircle2, color: 'text-indigo-400' },
                ].map((stat, i) => {
                  const Icon = stat.icon;
                  return (
                    <div key={i} className="bg-slate-950 border border-slate-800 rounded-2xl p-6 shadow-sm">
                      <div className="flex items-center justify-between mb-4">
                        <span className="text-sm font-medium text-slate-400">{stat.label}</span>
                        <Icon className={stat.color} size={20} />
                      </div>
                      <p className="text-3xl font-bold text-slate-100">{stat.value}</p>
                    </div>
                  );
                })}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6">
                  <h3 className="text-lg font-semibold mb-4 text-slate-200">AI Enrichment & ML Status</h3>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center p-4 bg-slate-900 rounded-xl border border-slate-800">
                      <div>
                        <p className="font-medium text-slate-200">Gemini AI Enrichment</p>
                        <p className="text-xs text-slate-400">Structured extraction & tag normalization</p>
                      </div>
                      <span className="px-3 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-semibold rounded-full">
                        Operational
                      </span>
                    </div>
                    <div className="flex justify-between items-center p-4 bg-slate-900 rounded-xl border border-slate-800">
                      <div>
                        <p className="font-medium text-slate-200">ML Acceptance Prediction</p>
                        <p className="text-xs text-slate-400">{mlStatus?.message || 'Collecting feedback...'}</p>
                      </div>
                      <span className={`px-3 py-1 text-xs font-semibold rounded-full border ${
                        mlStatus?.isAvailable 
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                          : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                      }`}>
                        {mlStatus?.isAvailable ? 'Active' : 'Cold Start'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6">
                  <h3 className="text-lg font-semibold mb-4 text-slate-200">Recommendation Summary</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 text-center">
                      <p className="text-sm text-slate-400 mb-1">Accepted Leads</p>
                      <p className="text-3xl font-bold text-emerald-400">{overview?.acceptedCount || 0}</p>
                    </div>
                    <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 text-center">
                      <p className="text-sm text-slate-400 mb-1">Rejected Leads</p>
                      <p className="text-3xl font-bold text-red-400">{overview?.rejectedCount || 0}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* B. LEAD PROCESSING (BATCH IMPORTER & SINGLE FORM) */}
          {activeTab === 'processing' && (
            <div className="max-w-4xl mx-auto space-y-8">
              {/* Batch File Importer */}
              <FileImporter onBatchProcessed={fetchData} />

              {/* Single Lead Manual Form */}
              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-8 shadow-sm">
                <h3 className="text-lg font-bold mb-2 text-slate-100">Process Single Test Lead</h3>
                <p className="text-sm text-slate-400 mb-6">Test individual contact normalization, rule quality scoring, and AI company enrichment instantly.</p>
                
                <form onSubmit={handleProcessSingleLead} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1">Company Name *</label>
                      <input 
                        type="text" 
                        required 
                        value={newLeadCompany}
                        onChange={e => setNewLeadCompany(e.target.value)}
                        placeholder="Acme Corp" 
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-200 focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1">Email Address *</label>
                      <input 
                        type="email" 
                        required 
                        value={newLeadEmail}
                        onChange={e => setNewLeadEmail(e.target.value)}
                        placeholder="contact@acme.com" 
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-200 focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1">Phone Number</label>
                      <input 
                        type="text" 
                        value={newLeadPhone}
                        onChange={e => setNewLeadPhone(e.target.value)}
                        placeholder="+1 555-0199" 
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-200 focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1">Domain / Website</label>
                      <input 
                        type="text" 
                        value={newLeadDomain}
                        onChange={e => setNewLeadDomain(e.target.value)}
                        placeholder="https://acme.com" 
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-200 focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Lead Source</label>
                    <input 
                      type="text" 
                      value={newLeadSource}
                      onChange={e => setNewLeadSource(e.target.value)}
                      placeholder="LinkedIn Scraper" 
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-200 focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <button 
                    type="submit" 
                    disabled={loading}
                    className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-3 rounded-xl transition-colors shadow-lg shadow-indigo-600/20"
                  >
                    {loading ? 'Processing Pipeline...' : 'Run Pipeline & Enrich Single Lead'}
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* C. PROCESSED LEADS */}
          {activeTab === 'leads' && (
            <div className="space-y-6">
              {/* Header Controls */}
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="flex items-center gap-3 w-full md:w-auto">
                  <div className="relative flex-1 md:w-64">
                    <Search size={16} className="absolute left-3 top-3 text-slate-500" />
                    <input 
                      type="text" 
                      placeholder="Search company or email..."
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <select 
                    value={statusFilter}
                    onChange={e => setStatusFilter(e.target.value)}
                    className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="all">All Statuses</option>
                    <option value="validated">Validated</option>
                    <option value="accepted">Accepted</option>
                    <option value="rejected">Rejected</option>
                    <option value="review">Review / Duplicate</option>
                  </select>
                </div>

                {/* 4 Download Export Options */}
                <div className="flex flex-wrap gap-2">
                  <button 
                    onClick={() => exportAllLeads('xlsx', 'processed')}
                    className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-2 rounded-xl text-xs font-semibold transition-colors"
                  >
                    <Download size={14} /> Export Leads (.xlsx)
                  </button>
                  <button 
                    onClick={() => exportAllLeads('csv', 'processed')}
                    className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-2 rounded-xl text-xs font-semibold transition-colors"
                  >
                    <Download size={14} /> Export Leads (.csv)
                  </button>
                  <button 
                    onClick={() => exportAllLeads('xlsx', 'errors')}
                    className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 px-3 py-2 rounded-xl text-xs font-semibold transition-colors"
                  >
                    <Download size={14} /> Validation Errors
                  </button>
                  <button 
                    onClick={() => exportAllLeads('xlsx', 'duplicates')}
                    className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 px-3 py-2 rounded-xl text-xs font-semibold transition-colors"
                  >
                    <Download size={14} /> Duplicate Report
                  </button>
                </div>
              </div>

              <div className="bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-900/50 text-slate-400 text-xs uppercase tracking-wider">
                      <th className="p-4 font-medium">Company / Domain</th>
                      <th className="p-4 font-medium">Email / Phone</th>
                      <th className="p-4 font-medium">Quality Score</th>
                      <th className="p-4 font-medium">Relevance</th>
                      <th className="p-4 font-medium">Status</th>
                      <th className="p-4 font-medium">Tags</th>
                      <th className="p-4 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 text-sm">
                    {filteredLeads.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-8 text-center text-slate-500">No matching processed leads found.</td>
                      </tr>
                    ) : (
                      filteredLeads.map((lead) => {
                        const pd = lead.processed_data || {};
                        const relevance = pd.relevance || pd.icpFit; // Backwards compatible check
                        return (
                          <tr key={lead.id} className="hover:bg-slate-900/40 transition-colors">
                            <td className="p-4">
                              <p className="font-semibold text-slate-200">{pd.companyName || 'Unknown Company'}</p>
                              <p className="text-xs text-slate-400">{pd.domain || 'No domain'}</p>
                            </td>
                            <td className="p-4">
                              <p className="text-slate-300">{pd.email || 'No email'}</p>
                              <p className="text-xs text-slate-500">{pd.phone || 'No phone'}</p>
                            </td>
                            <td className="p-4">
                              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20" title={pd.scoring?.reason}>
                                {lead.score || pd.scoring?.quality_score || 0}%
                              </span>
                            </td>
                            <td className="p-4">
                              <span className={`text-xs font-semibold ${relevance ? 'text-slate-200' : 'text-slate-500'}`}>
                                {relevance ? `${relevance.relevanceScore ?? relevance.fitScore}%` : 'Not Evaluated'}
                              </span>
                              {relevance && (
                                <p className="text-[10px] text-slate-500 truncate max-w-[120px]" title={relevance.explanation}>
                                  {relevance.explanation}
                                </p>
                              )}
                            </td>
                            <td className="p-4">
                              <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold capitalize ${
                                lead.status === 'accepted' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                                lead.status === 'rejected' ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                                lead.status === 'review' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                                'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                              }`}>
                                {lead.status}
                              </span>
                            </td>
                            <td className="p-4">
                              <div className="flex flex-wrap gap-1">
                                {(lead.tags || []).slice(0, 3).map((tag: string, i: number) => (
                                  <span key={i} className="px-2 py-0.5 bg-slate-900 text-slate-300 border border-slate-800 text-xs rounded-md">
                                    {tag}
                                  </span>
                                ))}
                              </div>
                            </td>
                            <td className="p-4 text-right space-x-2">
                              <button 
                                onClick={() => handleFeedback(lead.id, 'accepted')}
                                className="px-3 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 rounded-lg text-xs font-medium transition-colors"
                              >
                                Accept
                              </button>
                              <button 
                                onClick={() => {
                                  const reason = prompt('Enter rejection reason:');
                                  if (reason) handleFeedback(lead.id, 'rejected', reason);
                                }}
                                className="px-3 py-1.5 bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-500/30 rounded-lg text-xs font-medium transition-colors"
                              >
                                Reject
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}


          {/* D. DUPLICATE REVIEW */}
          {activeTab === 'duplicates' && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-slate-200">Duplicate Detection Review</h3>
              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6">
                {leads.filter(l => l.processed_data?.duplicates?.length > 0).length === 0 ? (
                  <p className="text-slate-500 text-center py-8">No duplicate conflicts detected in current leads.</p>
                ) : (
                  leads.filter(l => l.processed_data?.duplicates?.length > 0).map(lead => (
                    <div key={lead.id} className="p-4 bg-slate-900 rounded-xl border border-slate-800 mb-4">
                      <p className="font-bold text-slate-200 mb-2">Lead ID #{lead.id} — {lead.processed_data?.companyName}</p>
                      <div className="space-y-2">
                        {lead.processed_data.duplicates.map((dup: any, i: number) => (
                          <div key={i} className="flex justify-between items-center text-sm bg-slate-950 p-3 rounded-lg border border-slate-800">
                            <div>
                              <span className="font-semibold text-amber-400 capitalize">{dup.matchLevel} Match</span>
                              <span className="text-slate-400 ml-2">({dup.details})</span>
                            </div>
                            <div className="space-x-2">
                              <button 
                                onClick={() => handleFeedback(lead.id, 'mark_duplicate')}
                                className="px-3 py-1 bg-amber-600/20 text-amber-400 rounded-lg text-xs font-medium border border-amber-500/30"
                              >
                                Confirm Duplicate
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* E. ENRICHMENT REVIEW */}
          {activeTab === 'enrichment' && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-slate-200">AI Enrichment Inspector</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {leads.map(lead => {
                  const ai = lead.processed_data?.aiEnrichment;
                  if (!ai) return null;
                  return (
                    <div key={lead.id} className="bg-slate-950 border border-slate-800 rounded-2xl p-6 space-y-4">
                      <div className="flex justify-between items-start">
                        <h4 className="font-bold text-slate-200">{lead.processed_data.companyName}</h4>
                        <span className="text-xs bg-indigo-500/10 text-indigo-400 px-2 py-0.5 rounded-md border border-indigo-500/20">
                          Score: {lead.score}
                        </span>
                      </div>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                          <span className="text-slate-400">Industry:</span>
                          <span className="font-medium text-slate-200">{ai.industry?.value || 'Unknown'} (Conf: {ai.industry?.confidence})</span>
                        </div>
                        <div className="flex justify-between bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                          <span className="text-slate-400">Location:</span>
                          <span className="font-medium text-slate-200">{ai.location?.value || 'Unknown'}</span>
                        </div>
                        <div>
                          <p className="text-xs font-medium text-slate-400 mb-1">Extracted Evidence:</p>
                          <p className="text-xs bg-slate-900 p-3 rounded-lg text-slate-300 border border-slate-800 italic">
                            "{ai.industry?.evidence || 'No evidence provided.'}"
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* F. FEEDBACK */}
          {activeTab === 'feedback' && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-slate-200">Feedback & Decision Audit Log</h3>
              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 text-slate-400 text-center">
                <p>All user decisions and rejection reasons are durably logged to train future ML acceptance prediction models.</p>
              </div>
            </div>
          )}

          {/* G. ANALYTICS */}
          {activeTab === 'analytics' && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-slate-200">Source Reliability Analytics</h3>
              <div className="bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-900/50 text-slate-400 text-xs uppercase tracking-wider">
                      <th className="p-4 font-medium">Source Name</th>
                      <th className="p-4 font-medium">Processed</th>
                      <th className="p-4 font-medium">Valid Contact %</th>
                      <th className="p-4 font-medium">Duplicate Rate</th>
                      <th className="p-4 font-medium">Acceptance Rate</th>
                      <th className="p-4 font-medium">Confidence Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 text-sm">
                    {sources.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-slate-500">No source analytics data available yet.</td>
                      </tr>
                    ) : (
                      sources.map((s, i) => (
                        <tr key={i} className="hover:bg-slate-900/40">
                          <td className="p-4 font-semibold text-slate-200">{s.sourceName}</td>
                          <td className="p-4 text-slate-300">{s.totalProcessed}</td>
                          <td className="p-4 text-slate-300">{s.validContactPercentage}%</td>
                          <td className="p-4 text-slate-300">{s.duplicateRate}%</td>
                          <td className="p-4 text-slate-300">{s.acceptanceRate}%</td>
                          <td className="p-4">
                            <span className={`px-2 py-1 rounded-full text-xs font-semibold uppercase ${
                              s.status === 'preliminary' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            }`}>
                              {s.status}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* CRM INTEGRATION HUB */}
          {activeTab === 'crm' && (
            <div className="max-w-4xl mx-auto space-y-6">
              <CrmIntegrationHub />
            </div>
          )}

          {/* H. SETTINGS */}
          {activeTab === 'settings' && (
            <div className="max-w-2xl mx-auto space-y-6">
              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-8 space-y-6">
                <h3 className="text-xl font-bold text-slate-100">Engine Configuration Settings</h3>
                <p className="text-sm text-slate-400">Configure scoring weights and duplicate detection parameters without exposing API keys.</p>

                <div className="space-y-4">
                  <h4 className="font-semibold text-sm text-slate-200">Rule-Based Scoring Weights (Sum = 100)</h4>
                  {Object.entries(scoringWeights).map(([key, val]) => (
                    <div key={key} className="flex justify-between items-center bg-slate-900 p-3 rounded-xl border border-slate-800">
                      <span className="text-sm capitalize text-slate-300">{key.replace('_', ' ')}</span>
                      <input 
                        type="number" 
                        value={val} 
                        onChange={e => setScoringWeights({ ...scoringWeights, [key]: Number(e.target.value) })}
                        className="w-20 bg-slate-955 border border-slate-800 rounded-lg px-3 py-1 text-right text-slate-200" 
                      />
                    </div>
                  ))}
                </div>

                <button 
                  onClick={() => alert('Settings saved successfully.')}
                  className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-3 rounded-xl transition-colors"
                >
                  Save Configuration
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
