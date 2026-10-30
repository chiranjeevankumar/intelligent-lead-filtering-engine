import React, { useState, useRef } from 'react';
import { 
  Upload, 
  FileSpreadsheet, 
  CheckCircle2, 
  AlertCircle, 
  ArrowRight, 
  Download, 
  RefreshCw, 
  Layers, 
  FileText, 
  FileCode,
  Sparkles,
  ListFilter
} from 'lucide-react';
import { 
  parseFile, 
  transformAndPrevalidateRows, 
  TARGET_CRM_FIELDS, 
  ColumnMapping, 
  ParsedFileData 
} from '../utils/importHelper';
import { 
  exportToCSV, 
  exportToExcel, 
  generateProcessedLeadsData, 
  generateValidationErrorsData, 
  generateDuplicateReportData, 
  generateProcessingSummaryData 
} from '../utils/exportHelper';

interface FileImporterProps {
  onBatchProcessed: () => void;
}

export function FileImporter({ onBatchProcessed }: FileImporterProps) {
  const [step, setStep] = useState<'upload' | 'mapping' | 'processing' | 'complete'>('upload');
  const [fileError, setFileError] = useState<string | null>(null);
  const [parsedData, setParsedData] = useState<ParsedFileData | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [processedResults, setProcessedResults] = useState<any[]>([]);
  const [exportFormat, setExportFormat] = useState<'csv' | 'xlsx'>('xlsx');
  const [statusMessage, setStatusMessage] = useState<string>('Initializing processing...');
  const [batchErrors, setBatchErrors] = useState<any[]>([]);
  const abortControllerRef = useRef<AbortController | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await processSelectedFile(file);
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    await processSelectedFile(file);
  };

  const processSelectedFile = async (file: File) => {
    setFileError(null);
    try {
      const data = await parseFile(file);
      setParsedData(data);
      setMapping(data.initialMapping);
      setStep('mapping');
    } catch (err: any) {
      setFileError(err.message || 'Failed to parse file.');
    }
  };

  const handleMappingChange = (sourceHeader: string, targetField: string) => {
    setMapping(prev => ({ ...prev, [sourceHeader]: targetField }));
  };

  const cancelProcessing = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setIsProcessing(false);
    setStep('mapping');
    setFileError('Batch processing was cancelled by user.');
  };

  const runBatchImport = async () => {
    if (!parsedData || isProcessing) return;
    
    setIsProcessing(true);
    setStep('processing');
    setProgress(0);
    setStatusMessage('Preparing lead batch for processing...');
    setProcessedResults([]);
    setBatchErrors([]);
    setFileError(null);

    const abortCtrl = new AbortController();
    abortControllerRef.current = abortCtrl;

    try {
      const { transformedRows } = transformAndPrevalidateRows(parsedData.rows, mapping);
      if (transformedRows.length === 0) {
        throw new Error('No valid rows found in file to process.');
      }

      const chunkSize = 10;
      const totalChunks = Math.ceil(transformedRows.length / chunkSize);
      const allResults: any[] = [];
      const allErrors: any[] = [];

      for (let i = 0; i < totalChunks; i++) {
        if (abortCtrl.signal.aborted) {
          throw new Error('Processing cancelled.');
        }

        const chunk = transformedRows.slice(i * chunkSize, (i + 1) * chunkSize);
        const chunkIndex = i + 1;
        setStatusMessage(`Processing batch ${chunkIndex} of ${totalChunks} (leads ${i * chunkSize + 1} to ${Math.min((i + 1) * chunkSize, transformedRows.length)} of ${transformedRows.length})...`);

        try {
          // Timeout each chunk request after 25 seconds
          const chunkAbortCtrl = new AbortController();
          const timer = setTimeout(() => chunkAbortCtrl.abort(), 25000);

          const response = await fetch('/api/leads/batch', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': 'Bearer mock-token'
            },
            body: JSON.stringify({
              leadsList: chunk
            }),
            signal: chunkAbortCtrl.signal
          });
          clearTimeout(timer);

          if (response.ok) {
            const resData = await response.json();
            if (resData.results && Array.isArray(resData.results)) {
              allResults.push(...resData.results);
            }
            if (resData.errors && Array.isArray(resData.errors)) {
              allErrors.push(...resData.errors);
            }
          } else {
            const errData = await response.json().catch(() => ({}));
            const errMsg = errData.error || `HTTP ${response.status}: Failed to process chunk ${chunkIndex}`;
            console.error(`Chunk ${chunkIndex} failed:`, errMsg);
            allErrors.push({ chunk: chunkIndex, error: errMsg });
          }
        } catch (err: any) {
          const isTimeout = err.name === 'AbortError';
          const errMsg = isTimeout ? `Batch chunk ${chunkIndex} timed out after 25s` : (err.message || `Batch chunk ${chunkIndex} network error`);
          console.error(`Chunk ${chunkIndex} exception:`, err);
          allErrors.push({ chunk: chunkIndex, error: errMsg });
        }

        const processedCount = Math.min(transformedRows.length, (i + 1) * chunkSize);
        const currentProgress = Math.round((processedCount / transformedRows.length) * 100);
        setProgress(currentProgress);
        setStatusMessage(`Processed ${processedCount} of ${transformedRows.length} leads (${allResults.length} succeeded, ${allErrors.length} errors)...`);
      }

      setProcessedResults(allResults);
      setBatchErrors(allErrors);

      if (allResults.length === 0 && allErrors.length > 0) {
        setFileError(`Batch processing failed for all records: ${allErrors[0]?.error || 'Unknown error'}`);
        setStep('mapping');
      } else {
        setStep('complete');
        onBatchProcessed();
      }
    } catch (globalErr: any) {
      console.error('Batch import failed:', globalErr);
      setFileError(globalErr.message || 'Batch processing encountered an unexpected error.');
      setStep('mapping');
    } finally {
      setIsProcessing(false);
      abortControllerRef.current = null;
    }
  };

  const prevalidation = parsedData ? transformAndPrevalidateRows(parsedData.rows, mapping) : null;

  // Export Trigger Handlers
  const triggerExport = (type: 'processed' | 'validation_errors' | 'duplicates' | 'summary') => {
    const filenameBase = `${parsedData?.filename.split('.')[0] || 'lead_pipeline'}_${type}`;
    
    let exportData: any[] = [];
    if (type === 'processed') {
      exportData = generateProcessedLeadsData(processedResults);
    } else if (type === 'validation_errors') {
      exportData = generateValidationErrorsData(processedResults);
    } else if (type === 'duplicates') {
      exportData = generateDuplicateReportData(processedResults);
    } else if (type === 'summary') {
      exportData = generateProcessingSummaryData(processedResults);
    }

    if (exportFormat === 'csv') {
      exportToCSV(exportData, filenameBase);
    } else {
      exportToExcel(exportData, filenameBase, type.replace('_', ' ').toUpperCase());
    }
  };

  return (
    <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 shadow-sm space-y-6">
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-600/20 text-indigo-400 p-2.5 rounded-xl border border-indigo-500/30">
            <FileSpreadsheet size={22} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-100">Batch File Importer & Column Mapper</h3>
            <p className="text-xs text-slate-400">Upload CSV (.csv) or Excel (.xlsx, .xls) files up to 10MB.</p>
          </div>
        </div>

        {/* Step Indicator */}
        <div className="flex items-center gap-2 text-xs font-semibold">
          <span className={`px-2.5 py-1 rounded-full border ${step === 'upload' ? 'bg-indigo-600 text-white border-indigo-500' : 'bg-slate-900 text-slate-400 border-slate-800'}`}>1. Upload</span>
          <ArrowRight size={14} className="text-slate-600" />
          <span className={`px-2.5 py-1 rounded-full border ${step === 'mapping' ? 'bg-indigo-600 text-white border-indigo-500' : 'bg-slate-900 text-slate-400 border-slate-800'}`}>2. Map Columns</span>
          <ArrowRight size={14} className="text-slate-600" />
          <span className={`px-2.5 py-1 rounded-full border ${step === 'processing' ? 'bg-indigo-600 text-white border-indigo-500' : 'bg-slate-900 text-slate-400 border-slate-800'}`}>3. Batch Run</span>
          <ArrowRight size={14} className="text-slate-600" />
          <span className={`px-2.5 py-1 rounded-full border ${step === 'complete' ? 'bg-emerald-600 text-white border-emerald-500' : 'bg-slate-900 text-slate-400 border-slate-800'}`}>4. Export</span>
        </div>
      </div>

      {fileError && (
        <div className="bg-red-950/50 border border-red-800 text-red-200 p-4 rounded-xl flex items-center gap-3 text-sm">
          <AlertCircle size={18} className="text-red-400 shrink-0" />
          <span>{fileError}</span>
        </div>
      )}

      {/* STEP 1: UPLOAD */}
      {step === 'upload' && (
        <div 
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-slate-800 hover:border-indigo-500/50 rounded-2xl p-12 text-center bg-slate-900/30 hover:bg-slate-900/60 transition-all cursor-pointer group"
        >
          <input 
            type="file" 
            ref={fileInputRef}
            onChange={handleFileSelect}
            accept=".csv,.xlsx,.xls"
            className="hidden" 
          />
          <div className="w-16 h-16 bg-indigo-600/10 text-indigo-400 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-indigo-500/20 group-hover:scale-110 transition-transform">
            <Upload size={28} />
          </div>
          <p className="font-semibold text-slate-200 mb-1">Click to browse or drag and drop lead dataset</p>
          <p className="text-xs text-slate-400 max-w-md mx-auto">Supports CSV, XLSX, XLS with full UTF-8 Unicode, commas, quotes, and empty cell handling. Max file size: 10MB.</p>
        </div>
      )}

      {/* STEP 2: COLUMN MAPPING & PREVIEW */}
      {step === 'mapping' && parsedData && (
        <div className="space-y-6">
          <div className="flex justify-between items-center bg-slate-900 p-4 rounded-xl border border-slate-800">
            <div>
              <p className="font-semibold text-slate-200">{parsedData.filename}</p>
              <p className="text-xs text-slate-400">{parsedData.rows.length} records parsed ({parsedData.fileSizeMB.toFixed(2)} MB)</p>
            </div>
            <button 
              onClick={() => { setStep('upload'); setParsedData(null); }}
              className="text-xs text-slate-400 hover:text-slate-200 underline"
            >
              Choose different file
            </button>
          </div>

          {/* Prevalidation Summary Box */}
          {prevalidation && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
                <p className="text-xs text-slate-400">Total Rows Detected</p>
                <p className="text-2xl font-bold text-slate-100 mt-1">{prevalidation.totalRows}</p>
              </div>
              <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
                <p className="text-xs text-slate-400">Duplicate Rows in File</p>
                <p className="text-2xl font-bold text-amber-400 mt-1">{prevalidation.duplicateCountInFile}</p>
              </div>
              <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
                <p className="text-xs text-slate-400">Incomplete / Missing Keys</p>
                <p className="text-2xl font-bold text-red-400 mt-1">{prevalidation.missingRequiredCount}</p>
              </div>
            </div>
          )}

          {/* Column Mapping Table */}
          <div className="space-y-3">
            <h4 className="font-semibold text-sm text-slate-200">Map File Headers to Target CRM Fields</h4>
            <div className="max-h-64 overflow-y-auto border border-slate-800 rounded-xl">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-900 border-b border-slate-800 text-xs text-slate-400 uppercase">
                  <tr>
                    <th className="p-3">Source Header</th>
                    <th className="p-3">Sample Value</th>
                    <th className="p-3">Target CRM Lead Field</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 bg-slate-950">
                  {parsedData.headers.map((header) => {
                    const sampleVal = parsedData.rows[0]?.[header] || '';
                    const currentTarget = mapping[header] || '';
                    return (
                      <tr key={header}>
                        <td className="p-3 font-medium text-slate-300">{header}</td>
                        <td className="p-3 text-slate-400 truncate max-w-xs">{String(sampleVal)}</td>
                        <td className="p-3">
                          <select 
                            value={currentTarget}
                            onChange={(e) => handleMappingChange(header, e.target.value)}
                            className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 w-full"
                          >
                            <option value="">-- Do Not Import --</option>
                            {TARGET_CRM_FIELDS.map(f => (
                              <option key={f.key} value={f.key}>
                                {f.label} {f.required ? '*' : ''}
                              </option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Preview First 5 Rows */}
          <div className="space-y-3">
            <h4 className="font-semibold text-sm text-slate-200">Mapped Row Preview (First 5 Rows)</h4>
            <div className="overflow-x-auto border border-slate-800 rounded-xl">
              <table className="w-full text-left text-xs bg-slate-900/50">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400">
                    <th className="p-2.5">Row #</th>
                    <th className="p-2.5">Company</th>
                    <th className="p-2.5">Email</th>
                    <th className="p-2.5">Phone</th>
                    <th className="p-2.5">Domain</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {prevalidation?.transformedRows.slice(0, 5).map((row, idx) => (
                    <tr key={idx}>
                      <td className="p-2.5 text-slate-500">#{row._originalIndex}</td>
                      <td className="p-2.5 text-slate-200 font-medium">{row.companyName || '-'}</td>
                      <td className="p-2.5 text-slate-300">{row.email || '-'}</td>
                      <td className="p-2.5 text-slate-400">{row.phone || '-'}</td>
                      <td className="p-2.5 text-slate-400">{row.domain || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <button 
            onClick={runBatchImport}
            disabled={isProcessing}
            className={`w-full font-medium py-3 rounded-xl transition-colors shadow-lg ${
              isProcessing 
                ? 'bg-indigo-900/40 text-indigo-300 border border-indigo-700/50 cursor-not-allowed' 
                : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/20'
            }`}
          >
            {isProcessing ? 'Processing Batch...' : `Start Batch Pipeline Processing (${parsedData.rows.length} Leads)`}
          </button>
        </div>
      )}


      {/* STEP 3: BATCH PROCESSING RUNNING */}
      {step === 'processing' && (
        <div className="py-12 text-center space-y-6">
          <div className="w-16 h-16 bg-indigo-600/10 text-indigo-400 rounded-full flex items-center justify-center mx-auto border border-indigo-500/20">
            <RefreshCw size={28} className="animate-spin" />
          </div>
          <div>
            <h4 className="text-xl font-bold text-slate-100">Executing Lead Processing Pipeline...</h4>
            <p className="text-sm text-slate-400 mt-1 max-w-lg mx-auto">{statusMessage}</p>
          </div>

          <div className="max-w-md mx-auto space-y-2">
            <div className="w-full bg-slate-900 border border-slate-800 rounded-full h-3 overflow-hidden">
              <div 
                className="bg-indigo-600 h-full transition-all duration-300 rounded-full"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-xs font-semibold text-indigo-400">{progress}% Complete</p>
          </div>

          <div>
            <button
              onClick={cancelProcessing}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 text-xs font-medium rounded-lg transition-colors"
            >
              Cancel Processing
            </button>
          </div>
        </div>
      )}

      {/* STEP 4: COMPLETED & EXPORT HUB */}
      {step === 'complete' && (
        <div className="space-y-6">
          <div className="bg-emerald-950/40 border border-emerald-800 text-emerald-200 p-6 rounded-xl flex items-center gap-4">
            <CheckCircle2 size={32} className="text-emerald-400 shrink-0" />
            <div>
              <h4 className="text-lg font-bold">Batch Processing Complete!</h4>
              <p className="text-xs text-emerald-300 mt-0.5">
                Successfully processed {processedResults.length} leads through the full quality and AI enrichment engine.
              </p>
            </div>
          </div>

          {batchErrors.length > 0 && (
            <div className="bg-amber-950/40 border border-amber-800 text-amber-200 p-4 rounded-xl text-xs space-y-1">
              <p className="font-semibold text-amber-300">Note: {batchErrors.length} record(s) had warnings or issues during processing:</p>
              <p className="text-amber-400/90">{batchErrors.map(e => e.error).filter(Boolean).slice(0, 3).join('; ')}</p>
            </div>
          )}

          {/* Export Format Toggle */}
          <div className="flex justify-between items-center bg-slate-900 p-4 rounded-xl border border-slate-800">
            <div>
              <p className="font-semibold text-sm text-slate-200">Export Format Choice</p>
              <p className="text-xs text-slate-400">Download results in Microsoft Excel (.xlsx) or Standard CSV (.csv) format.</p>
            </div>
            <div className="flex gap-2">
              <button 
                onClick={() => setExportFormat('xlsx')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${exportFormat === 'xlsx' ? 'bg-emerald-600 text-white border-emerald-500' : 'bg-slate-950 text-slate-400 border-slate-800'}`}
              >
                Excel (.xlsx)
              </button>
              <button 
                onClick={() => setExportFormat('csv')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${exportFormat === 'csv' ? 'bg-indigo-600 text-white border-indigo-500' : 'bg-slate-950 text-slate-400 border-slate-800'}`}
              >
                CSV (.csv)
              </button>
            </div>
          </div>

          {/* Download 4 Separate Export Files */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button 
              onClick={() => triggerExport('processed')}
              className="p-4 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-xl text-left flex items-start justify-between transition-colors group"
            >
              <div>
                <p className="font-bold text-slate-200 group-hover:text-indigo-400 transition-colors">1. Processed Leads Export</p>
                <p className="text-xs text-slate-400 mt-1">Full lead records including score, score reason, normalized contacts, tags, status, and AI enrichment.</p>
              </div>
              <Download size={18} className="text-indigo-400 shrink-0 mt-1" />
            </button>

            <button 
              onClick={() => triggerExport('validation_errors')}
              className="p-4 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-xl text-left flex items-start justify-between transition-colors group"
            >
              <div>
                <p className="font-bold text-slate-200 group-hover:text-amber-400 transition-colors">2. Validation Errors Report</p>
                <p className="text-xs text-slate-400 mt-1">Detailed list of leads containing invalid email formats, missing required fields, or domain issues.</p>
              </div>
              <Download size={18} className="text-amber-400 shrink-0 mt-1" />
            </button>

            <button 
              onClick={() => triggerExport('duplicates')}
              className="p-4 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-xl text-left flex items-start justify-between transition-colors group"
            >
              <div>
                <p className="font-bold text-slate-200 group-hover:text-amber-400 transition-colors">3. Duplicate Matching Report</p>
                <p className="text-xs text-slate-400 mt-1">Identified exact and fuzzy duplicate matches with match details and similarity ratings.</p>
              </div>
              <Download size={18} className="text-amber-400 shrink-0 mt-1" />
            </button>

            <button 
              onClick={() => triggerExport('summary')}
              className="p-4 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-xl text-left flex items-start justify-between transition-colors group"
            >
              <div>
                <p className="font-bold text-slate-200 group-hover:text-emerald-400 transition-colors">4. Processing Summary Audit</p>
                <p className="text-xs text-slate-400 mt-1">Pipeline execution overview including total processed, valid percentage, average score, and timestamp.</p>
              </div>
              <Download size={18} className="text-emerald-400 shrink-0 mt-1" />
            </button>
          </div>

          <button 
            onClick={() => { setStep('upload'); setParsedData(null); }}
            className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-slate-300 font-medium rounded-xl border border-slate-800 transition-colors"
          >
            Process Another File
          </button>
        </div>
      )}
    </div>
  );
}
