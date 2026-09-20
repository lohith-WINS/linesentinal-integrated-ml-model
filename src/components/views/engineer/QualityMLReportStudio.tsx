import React, { useMemo, useState } from 'react';
import {
  Upload,
  BrainCircuit,
  FileSpreadsheet,
  AlertTriangle,
  CheckCircle2,
  BarChart3,
  ShieldCheck,
  RefreshCw,
  Download,
  Info,
  Database,
  Activity,
} from 'lucide-react';

interface QualityMLReportStudioProps {
  onNavigateToRootCause?: () => void;
}

interface ModelInfo {
  name: string;
  type: string;
  target: string;
  features: string[];
  metrics?: {
    accuracy?: number;
    precision_fail?: number;
    recall_fail?: number;
    f1_fail?: number;
  };
}

interface AnalysisResult {
  success: boolean;
  model: {
    name: string;
    type: string;
    target: string;
    trainingNotes?: string;
  };
  dataset: {
    rows: number;
    columns: number;
    filename: string;
    requiredFeatures: string[];
  };
  prediction: {
    predictedPass: number;
    predictedFail: number;
    predictedFailRate: number;
    averageFailProbability: number;
    highRiskCount: number;
    needsReviewCount: number;
  };
  observed: {
    qcResultCounts: Record<string, number>;
    defectTypeCounts: Record<string, number>;
    topLinesByFailRate: Array<{ lineId: string; records: number; failRate: number }>;
  };
  quality: {
    missingValues: number;
    duplicateRows: number;
  };
  rows: Array<{
    index: number;
    prediction: 'PASS' | 'FAIL';
    failProbability: number;
    confidence: number;
  }>;
}

const formatPct = (value?: number) =>
  typeof value === 'number' ? `${(value * 100).toFixed(1)}%` : '—';

export const QualityMLReportStudio: React.FC<QualityMLReportStudioProps> = () => {
  const [file, setFile] = useState<File | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [modelInfo, setModelInfo] = useState<ModelInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const failRate = useMemo(() => result?.prediction.predictedFailRate ?? 0, [result]);

  const loadModelInfo = async () => {
    try {
      const response = await fetch('/api/model-info');
      if (!response.ok) throw new Error('Model information unavailable');
      const data = await response.json();
      if (data.success) setModelInfo(data.model);
    } catch {
      // The main analysis endpoint will return a more useful error if Python/model setup is missing.
    }
  };

  React.useEffect(() => {
    loadModelInfo();
  }, []);

  const handleFile = (selected: File | null) => {
    if (!selected) return;
    setError(null);
    setResult(null);
    if (!selected.name.toLowerCase().endsWith('.csv')) {
      setError('Please upload the Product Quality Control CSV file.');
      return;
    }
    setFile(selected);
  };

  const handleAnalyze = async () => {
    if (!file) {
      setError('Choose a CSV file first.');
      return;
    }

    setIsAnalyzing(true);
    setError(null);
    setResult(null);

    try {
      const csvText = await file.text();
      const response = await fetch('/api/analyze-quality', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csvText, filename: file.name }),
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Quality analysis failed.');
      }
      setResult(data);
    } catch (err: any) {
      setError(err?.message || 'Could not analyze this dataset.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const downloadReport = () => {
    if (!result) return;
    const report = {
      generatedAt: new Date().toISOString(),
      dataset: result.dataset,
      model: result.model,
      prediction: result.prediction,
      dataQuality: result.quality,
      notes: [
        'This is an inference report from the trained baseline Random Forest model.',
        'Model metrics are validation metrics from the provided training dataset.',
        'This tabular model does not establish physical defect size or visual localization.',
      ],
    };
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${result.dataset.filename.replace(/\.csv$/i, '')}-quality-report.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      <div className="rounded-2xl border border-slate-800 bg-slate-950 p-6 text-white shadow-xl">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1 text-[10px] font-mono font-bold uppercase tracking-wider text-emerald-300">
              <BrainCircuit size={13} />
              Trained Quality ML Engine
            </div>
            <h2 className="mt-3 text-xl font-black tracking-tight">Product Quality Dataset Analysis</h2>
            <p className="mt-1 max-w-3xl text-xs leading-relaxed text-slate-400">
              Upload the organizer-provided Product Quality Control CSV, run the saved Random Forest model,
              and generate an engineer-readable quality report without retraining the model on every upload.
            </p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[10px] font-mono text-slate-300">
            <div>MODEL: {modelInfo?.type || 'Random Forest Classifier'}</div>
            <div className="mt-1">TARGET: {modelInfo?.target || 'qc_result'}</div>
          </div>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <Database size={17} className="text-blue-600" />
            <div>
              <h3 className="text-sm font-black text-slate-900">1. Upload quality dataset</h3>
              <p className="text-[11px] text-slate-500">CSV only • schema-validated before inference</p>
            </div>
          </div>

          <label
            onDragOver={(event) => {
              event.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDragActive(false);
              handleFile(event.dataTransfer.files?.[0] || null);
            }}
            className={`flex min-h-[220px] cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 text-center transition ${
              dragActive ? 'border-blue-500 bg-blue-50' : 'border-slate-200 bg-slate-50 hover:border-slate-300'
            }`}
          >
            <input
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(event) => handleFile(event.target.files?.[0] || null)}
            />
            <div className="mb-3 rounded-xl bg-blue-100 p-3 text-blue-700">
              <Upload size={22} />
            </div>
            <div className="text-sm font-bold text-slate-800">Drop CSV here or browse</div>
            <div className="mt-1 max-w-xs text-[11px] leading-relaxed text-slate-500">
              Use the provided Product Quality Control dataset or another CSV with the same required features.
            </div>
            {file && (
              <div className="mt-4 inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[11px] font-mono font-bold text-emerald-800">
                <FileSpreadsheet size={14} />
                {file.name}
              </div>
            )}
          </label>

          <div className="mt-4 flex gap-2">
            <button
              onClick={handleAnalyze}
              disabled={!file || isAnalyzing}
              className="flex-1 rounded-xl bg-blue-600 px-4 py-3 text-xs font-black uppercase tracking-wide text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isAnalyzing ? 'Running model…' : 'Analyze with trained model'}
            </button>
            <button
              onClick={() => {
                setFile(null);
                setResult(null);
                setError(null);
              }}
              className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-slate-600 hover:bg-slate-50"
              title="Reset"
            >
              <RefreshCw size={16} />
            </button>
          </div>

          {error && (
            <div className="mt-4 flex gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-800">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />
              <div>{error}</div>
            </div>
          )}

          {modelInfo && (
            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                <ShieldCheck size={15} className="text-emerald-600" />
                Current trained model
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2 text-[10px] font-mono text-slate-600">
                <div>Accuracy: {formatPct(modelInfo.metrics?.accuracy)}</div>
                <div>FAIL precision: {formatPct(modelInfo.metrics?.precision_fail)}</div>
                <div>FAIL recall: {formatPct(modelInfo.metrics?.recall_fail)}</div>
                <div>FAIL F1: {formatPct(modelInfo.metrics?.f1_fail)}</div>
              </div>
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <BarChart3 size={17} className="text-blue-600" />
              <div>
                <h3 className="text-sm font-black text-slate-900">2. Quality report</h3>
                <p className="text-[11px] text-slate-500">Inference results from the saved model</p>
              </div>
            </div>
            {result && (
              <button
                onClick={downloadReport}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-[10px] font-bold text-slate-700 hover:bg-slate-50"
              >
                <Download size={13} /> Export
              </button>
            )}
          </div>

          {!result ? (
            <div className="flex min-h-[420px] items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-6 text-center">
              <div className="max-w-sm">
                <Activity size={28} className="mx-auto text-slate-300" />
                <div className="mt-3 text-sm font-bold text-slate-500">No dataset analyzed yet</div>
                <div className="mt-1 text-[11px] leading-relaxed text-slate-400">
                  Upload the CSV on the left. The backend will validate the required schema and run the saved model.
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                {[
                  ['Records', result.dataset.rows.toLocaleString(), 'text-slate-900'],
                  ['Predicted FAIL', `${result.prediction.predictedFail.toLocaleString()} (${failRate.toFixed(1)}%)`, 'text-red-700'],
                  ['High risk', result.prediction.highRiskCount.toLocaleString(), 'text-amber-700'],
                  ['Needs review', result.prediction.needsReviewCount.toLocaleString(), 'text-blue-700'],
                ].map(([label, value, color]) => (
                  <div key={label} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <div className="text-[9px] font-mono uppercase tracking-wide text-slate-400">{label}</div>
                    <div className={`mt-1 text-sm font-black ${color}`}>{value}</div>
                  </div>
                ))}
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-xl border border-slate-200 p-4">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                    <AlertTriangle size={15} className="text-amber-600" /> Observed defect mix
                  </div>
                  {Object.keys(result.observed.defectTypeCounts).length ? (
                    <div className="mt-3 space-y-2">
                      {Object.entries(result.observed.defectTypeCounts).slice(0, 6).map(([name, count]) => (
                        <div key={name} className="flex items-center justify-between text-[11px]">
                          <span className="truncate text-slate-600">{name}</span>
                          <span className="font-mono font-bold text-slate-900">{count}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-3 text-[11px] text-slate-400">No defect-type labels were present in this file.</div>
                  )}
                </div>

                <div className="rounded-xl border border-slate-200 p-4">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                    <Activity size={15} className="text-blue-600" /> Lines needing attention
                  </div>
                  <div className="mt-3 space-y-2">
                    {result.observed.topLinesByFailRate.length ? result.observed.topLinesByFailRate.map((line) => (
                      <div key={line.lineId} className="flex items-center justify-between text-[11px]">
                        <span className="font-mono text-slate-700">{line.lineId}</span>
                        <span className="font-mono font-bold text-red-700">{line.failRate.toFixed(1)}% fail</span>
                      </div>
                    )) : (
                      <div className="text-[11px] text-slate-400">Line-level QC data not available.</div>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-xl border border-slate-200 p-4">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                    <CheckCircle2 size={15} className="text-emerald-600" /> PASS vs FAIL
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 font-mono text-xs">
                    <div className="rounded-lg bg-emerald-50 p-3 text-emerald-800">PASS<br /><b>{result.prediction.predictedPass}</b></div>
                    <div className="rounded-lg bg-red-50 p-3 text-red-800">FAIL<br /><b>{result.prediction.predictedFail}</b></div>
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200 p-4">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                    <Info size={15} className="text-blue-600" /> Data quality
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 font-mono text-xs">
                    <div>Missing values: <b>{result.quality.missingValues}</b></div>
                    <div>Duplicate rows: <b>{result.quality.duplicateRows}</b></div>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-[11px] leading-relaxed text-amber-900">
                <b>Model limitation:</b> this is a tabular quality-risk classifier. It does not prove physical defect size, visual localization, or a manufacturing root cause.
              </div>

              <div className="max-h-[210px] overflow-auto rounded-xl border border-slate-200">
                <table className="w-full text-left text-[10px] font-mono">
                  <thead className="sticky top-0 bg-slate-50 text-slate-500">
                    <tr>
                      <th className="px-3 py-2">Row</th>
                      <th className="px-3 py-2">Prediction</th>
                      <th className="px-3 py-2">FAIL probability</th>
                      <th className="px-3 py-2">Confidence</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {result.rows.slice(0, 100).map((row) => (
                      <tr key={row.index}>
                        <td className="px-3 py-2">{row.index + 1}</td>
                        <td className={`px-3 py-2 font-black ${row.prediction === 'FAIL' ? 'text-red-700' : 'text-emerald-700'}`}>{row.prediction}</td>
                        <td className="px-3 py-2">{(row.failProbability * 100).toFixed(1)}%</td>
                        <td className="px-3 py-2">{(row.confidence * 100).toFixed(1)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
