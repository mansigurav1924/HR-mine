# HR Recruitment ML Dataset Preparation

This directory contains the pipeline for processing an external archive of resumes, generating a labeling manifest, extracting text deterministically, validating manual human labels, and constructing a data leakage-free train/test split.

## CRITICAL PRIVACY RULES

1. **NO REAL RESUMES IN GIT**: Original PDF/DOCX/image resumes must never be tracked in source control.
2. **NO EXTRACTED TEXT IN GIT**: The extracted plaintext outputs in `processed/text/` contain sensitive PII and are strictly gitignored.
3. **NO MANIFESTS IN GIT**: The generated `resume_labels.csv` contains filenames and personal details, and must not be committed.
4. **NO MODEL TRAINING YET**: This stage ONLY prepares and splits the dataset. Do not use this directory to fit algorithms or interact with LLMs.

## 1. Building the Manifest

First, obtain the external dataset zip file. Extract the manifest (this does not extract the files permanently, it just inspects the archive stream):

```bash
python scripts/build_manifest.py --zip-path "path/to/resumes.zip"
```

This generates `manifests/resume_labels.csv`.

## 2. Text Extraction

To safely extract text into the local `processed/text/` directory:

```bash
python scripts/extract_dataset_text.py
```

## 3. Human Labeling

Open `manifests/resume_labels.csv`.
Manually change `label` from `unreviewed` to either:
- `good_intern`
- `bad_intern`
- `exclude`

Ensure you strictly follow the guidelines in `config/labeling_rubric.json`. DO NOT base decisions on protected characteristics.

## 4. Validating Labels

Once labeling is complete, run:

```bash
python scripts/validate_labels.py
```

## 5. Train / Test Split

Finally, create the stratified ML dataset splits:

```bash
python scripts/create_dataset_split.py
```

This will generate `splits/train.csv` and `splits/test.csv`.

## 6. Training the Model (Step 8)

Once the split is completed, you can train and cross-validate the candidate TF-IDF + Linear models using the training set. This script will select the best model, fit it entirely on the training set, and evaluate it **once** on the held-out test set.

```bash
python ml/scripts/train_model.py --version resume_classifier_v1
```

Generated artifacts:
- `artifacts/resume_classifier_v1.joblib`: The scikit-learn pipeline (Preprocessor -> TFIDF -> Classifier).
- `artifacts/model_metadata_v1.json`: Extensive telemetry and hyperparameter info.
- `artifacts/metrics_v1.json`: Programmatic machine evaluation metrics.
- `reports/classification_report_v1.txt`: Human readable model summary.
- `reports/confusion_matrix_v1.png`: Visual evaluation plot.

*(Note: Model artifacts and reports are `.gitignore`d to prevent accidentally committing sensitive weights or dataset references.)*

## 7. Evaluating an Existing Model

To re-run evaluation on the held-out test set without retraining:

```bash
python ml/scripts/evaluate_model.py --version resume_classifier_v1
```

---

*Note: This pipeline is strictly for Dataset Preparation (Step 7) and Offline Model Validation (Step 8). Integration of the model into the FastAPI live application is handled in Step 9.*
