import json
import sys
from pathlib import Path
import pandas as pd
import joblib

BASE = Path(__file__).resolve().parent
MODEL_PATH = BASE / 'qc_random_forest.joblib'


def fail(message, code=1):
    print(json.dumps({'success': False, 'error': message}))
    raise SystemExit(code)


def main():
    if not MODEL_PATH.exists():
        fail(f'Model file not found: {MODEL_PATH}')

    payload = json.load(sys.stdin)
    csv_text = payload.get('csvText')
    if not isinstance(csv_text, str) or not csv_text.strip():
        fail('csvText is required')

    from io import StringIO
    try:
        df = pd.read_csv(StringIO(csv_text))
    except Exception as exc:
        fail(f'Could not read CSV: {exc}')

    package = joblib.load(MODEL_PATH)
    pipeline = package['pipeline']
    features = package['features']

    # Recreate the same date-derived features used during training.
    if 'inspection_date' in df.columns:
        dt = pd.to_datetime(df['inspection_date'], errors='coerce')
        df['inspection_year'] = dt.dt.year
        df['inspection_month'] = dt.dt.month
        df['inspection_dayofweek'] = dt.dt.dayofweek

    missing = [c for c in features if c not in df.columns]
    if missing:
        fail('Missing required features: ' + ', '.join(missing))

    X = df[features].copy()
    try:
        pred = pipeline.predict(X)
        proba = pipeline.predict_proba(X)[:, 1]
    except Exception as exc:
        fail(f'Model inference failed: {exc}')

    fail_count = int((pred == 1).sum())
    pass_count = int((pred == 0).sum())
    n = int(len(df))

    observed = {
        'qcResultCounts': {},
        'defectTypeCounts': {},
        'topLinesByFailRate': [],
    }
    if 'qc_result' in df.columns:
        observed['qcResultCounts'] = {str(k): int(v) for k, v in df['qc_result'].astype('string').str.strip().str.upper().value_counts(dropna=False).to_dict().items()}
    if 'defect_type' in df.columns:
        defect_series = df['defect_type'].astype('string').str.strip().replace({'': pd.NA})
        observed['defectTypeCounts'] = {str(k): int(v) for k, v in defect_series.dropna().value_counts().to_dict().items()}
    if 'line_id' in df.columns and 'qc_result' in df.columns:
        temp = df.copy()
        temp['_is_fail'] = temp['qc_result'].astype('string').str.strip().str.upper().eq('FAIL').fillna(False).astype(int)
        grouped = temp.groupby('line_id', dropna=False).agg(records=('_is_fail','size'), failRate=('_is_fail','mean')).reset_index()
        grouped = grouped.sort_values(['failRate','records'], ascending=[False, False]).head(5)
        observed['topLinesByFailRate'] = [
            {'lineId': str(r['line_id']), 'records': int(r['records']), 'failRate': round(float(r['failRate']) * 100, 2)}
            for _, r in grouped.iterrows()
        ]

    result = {
        'success': True,
        'model': {
            'name': 'qc_random_forest',
            'type': 'Random Forest Classifier',
            'target': package.get('target', 'qc_result'),
            'trainingNotes': package.get('training_notes', ''),
        },
        'dataset': {
            'rows': n,
            'columns': int(len(df.columns)),
            'filename': payload.get('filename', 'uploaded.csv'),
            'requiredFeatures': features,
        },
        'prediction': {
            'predictedPass': pass_count,
            'predictedFail': fail_count,
            'predictedFailRate': round((fail_count / n) * 100, 2) if n else 0.0,
            'averageFailProbability': round(float(proba.mean()) * 100, 2) if n else 0.0,
            'highRiskCount': int((proba >= 0.8).sum()),
            'needsReviewCount': int(((proba >= 0.4) & (proba < 0.8)).sum()),
        },
        'observed': observed,
        'quality': {
            'missingValues': int(df.isna().sum().sum()),
            'duplicateRows': int(df.duplicated().sum()),
        },
        'rows': [
            {
                'index': int(i),
                'prediction': 'FAIL' if int(p) == 1 else 'PASS',
                'failProbability': round(float(prob), 4),
                'confidence': round(max(float(prob), 1.0 - float(prob)), 4),
            }
            for i, (p, prob) in enumerate(zip(pred, proba))
        ],
    }
    print(json.dumps(result))


if __name__ == '__main__':
    main()
