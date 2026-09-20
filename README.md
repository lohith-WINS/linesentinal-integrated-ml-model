<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/5278371f-2432-4a7c-9b04-7b826e694423

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Quality ML Report (Engineer)

The Engineer workspace now includes a **Quality ML Report** tab that uses a trained Random Forest model built from the organizer-provided Product Quality Control dataset.

### What it does

```text
Upload CSV
   ↓
Schema validation + preprocessing
   ↓
Saved Random Forest model
   ↓
PASS / FAIL prediction + confidence
   ↓
Observed defect mix + line-level quality patterns
   ↓
Engineer quality report
```

### Model

The current baseline is a scikit-learn Random Forest classifier. It was trained on 907 labelled PASS/FAIL rows from the provided quality-control dataset. The model intentionally excludes outcome-derived fields such as `defect_count`, `units_passed`, `defect_type`, and `qc_result` from prediction features to reduce target leakage.

Baseline validation metrics:

- Accuracy: 72.5%
- FAIL precision: 24.0%
- FAIL recall: 16.2%
- FAIL F1: 19.4%

These are baseline validation metrics, not a claim of physical defect-detection accuracy or 3 mm defect localization.

### Local ML setup

Install Python 3, then from the project root run:

```bash
pip install -r ml/requirements.txt
npm install
npm run dev
```

The Node/Express server invokes `ml/qc_model_infer.py` for CSV inference. On Windows, the server will try `python`, `py`, and `python3`.

### Engineer workflow

Open **Engineer → Quality ML Report**.

Upload the organizer Product Quality Control CSV and choose **Analyze with trained model**. The report shows dataset size, predicted PASS/FAIL counts, risk/uncertainty counts, observed defect categories, line-level failure patterns, and data-quality issues.

The existing visual defect workflow remains separate. The tabular model should not be presented as visual defect localization or physical defect-size detection.
