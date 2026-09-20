# LineSentinel Quality ML

This directory contains the trained baseline quality model and its inference helper.

## Files

- `qc_random_forest.joblib` — trained scikit-learn pipeline and metadata
- `qc_model_infer.py` — reads JSON from stdin and returns a JSON analysis report
- `metrics.json` — training/validation metrics
- `training_report.txt` — human-readable training report
- `requirements.txt` — Python dependencies

## Inference contract

Input on stdin:

```json
{"csvText":"...", "filename":"product-quality-control.csv"}
```

Output is JSON with model metadata, predictions, observed quality/defect statistics, and data-quality checks.
