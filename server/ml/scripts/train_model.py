import argparse
import csv
import json
import os
import sys
import hashlib
from datetime import datetime

import joblib
import numpy as np
import matplotlib.pyplot as plt

from sklearn.model_selection import StratifiedKFold, cross_val_score
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score, f1_score,
    confusion_matrix, classification_report, roc_auc_score
)

# Add server directory to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')))
from ml.training.model_factory import build_candidate_pipelines

def load_data(split_path, text_dir):
    if not os.path.exists(split_path):
        return None, None, None
        
    texts = []
    labels = []
    ids = []
    
    with open(split_path, 'r', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        for row in reader:
            resume_id = row['resume_id']
            label = row['label']
            
            if label not in ['good_intern', 'bad_intern']:
                print(f"Error: Invalid label '{label}' found in {split_path}")
                sys.exit(1)
                
            text_path = os.path.join(text_dir, f"{resume_id}.txt")
            if not os.path.exists(text_path):
                print(f"Error: Missing extracted text for {resume_id}")
                sys.exit(1)
                
            with open(text_path, 'r', encoding='utf-8') as tf:
                text = tf.read().strip()
                if not text:
                    print(f"Error: Empty text for {resume_id}")
                    sys.exit(1)
                    
            texts.append(text)
            labels.append(label)
            ids.append(resume_id)
            
    return texts, labels, ids

def calculate_sha256(filepath):
    sha256_hash = hashlib.sha256()
    with open(filepath, "rb") as f:
        for byte_block in iter(lambda: f.read(4096), b""):
            sha256_hash.update(byte_block)
    return sha256_hash.hexdigest()

def plot_confusion_matrix(cm, labels, save_path):
    fig, ax = plt.subplots(figsize=(6, 6))
    cax = ax.matshow(cm, cmap=plt.cm.Blues)
    plt.title('Confusion Matrix')
    fig.colorbar(cax)
    
    ax.set_xticks(np.arange(len(labels)))
    ax.set_yticks(np.arange(len(labels)))
    ax.set_xticklabels(labels)
    ax.set_yticklabels(labels)
    plt.xlabel('Predicted')
    plt.ylabel('Actual')
    
    for i in range(len(labels)):
        for j in range(len(labels)):
            ax.text(j, i, str(cm[i, j]), va='center', ha='center',
                    color='white' if cm[i, j] > cm.max() / 2 else 'black')
            
    plt.savefig(save_path)
    plt.close()

def main():
    parser = argparse.ArgumentParser(description="Train and Validate Resume Classifier")
    parser.add_argument("--version", default="resume_classifier_v1", help="Model version name")
    parser.add_argument("--random-state", type=int, default=42)
    parser.add_argument("--overwrite", action="store_true", help="Overwrite existing model artifacts")
    args = parser.parse_args()
    
    ml_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
    
    artifacts_dir = os.path.join(ml_dir, 'artifacts')
    reports_dir = os.path.join(ml_dir, 'reports')
    os.makedirs(artifacts_dir, exist_ok=True)
    os.makedirs(reports_dir, exist_ok=True)
    
    model_path = os.path.join(artifacts_dir, f"{args.version}.joblib")
    if os.path.exists(model_path) and not args.overwrite:
        print(f"Error: Model artifact {args.version} already exists. Use --overwrite to replace.")
        sys.exit(1)
        
    train_path = os.path.join(ml_dir, 'splits', 'train.csv')
    test_path = os.path.join(ml_dir, 'splits', 'test.csv')
    text_dir = os.path.join(ml_dir, 'processed', 'text')
    
    X_train, y_train, ids_train = load_data(train_path, text_dir)
    X_test, y_test, ids_test = load_data(test_path, text_dir)
    
    if not X_train or not X_test:
        print("Error: Train or test splits are missing.")
        sys.exit(1)
        
    if set(ids_train).intersection(set(ids_test)):
        print("CRITICAL ERROR: Train and Test sets have overlapping resume IDs!")
        sys.exit(1)
        
    print(f"Train size: {len(X_train)}")
    print(f"Test size: {len(X_test)}")
    
    train_counts = {lbl: y_train.count(lbl) for lbl in set(y_train)}
    print(f"Train class distribution: {train_counts}")
    
    if len(train_counts) < 2:
        print("Error: Training data lacks multiple classes.")
        sys.exit(1)
        
    # --- CROSS VALIDATION (TRAINING SET ONLY) ---
    pipelines = build_candidate_pipelines(args.random_state)
    
    min_class_count = min(train_counts.values())
    cv_folds = 5
    if min_class_count < 5:
        cv_folds = min_class_count
        print(f"Warning: Reduced CV folds to {cv_folds} due to small class count.")
        
    if cv_folds < 2:
        print("Error: Dataset too small for cross-validation.")
        sys.exit(1)
        
    cv = StratifiedKFold(n_splits=cv_folds, shuffle=True, random_state=args.random_state)
    
    best_score = -1
    best_model_name = None
    cv_results = {}
    
    print("\nStarting Cross-Validation Model Comparison...")
    for name, pipeline in pipelines.items():
        scores = cross_val_score(pipeline, X_train, y_train, cv=cv, scoring='f1_macro', n_jobs=1)
        mean_score = np.mean(scores)
        std_score = np.std(scores)
        cv_results[name] = {"mean_f1_macro": float(mean_score), "std": float(std_score)}
        print(f"  {name}: Macro F1 = {mean_score:.4f} (+/- {std_score:.4f})")
        
        # Deterministic selection
        if mean_score > best_score:
            best_score = mean_score
            best_model_name = name
            
    print(f"\nSelected Model: {best_model_name}")
    
    # --- FINAL TRAINING ---
    final_pipeline = pipelines[best_model_name]
    final_pipeline.fit(X_train, y_train)
    
    # --- HELD OUT EVALUATION ---
    print("\nRunning final held-out evaluation on test.csv...")
    y_pred = final_pipeline.predict(X_test)
    
    acc = accuracy_score(y_test, y_pred)
    macro_p = precision_score(y_test, y_pred, average='macro', zero_division=0)
    macro_r = recall_score(y_test, y_pred, average='macro', zero_division=0)
    macro_f1 = f1_score(y_test, y_pred, average='macro', zero_division=0)
    weighted_f1 = f1_score(y_test, y_pred, average='weighted', zero_division=0)
    
    y_prob = None
    roc_auc = None
    classes = final_pipeline.classes_.tolist()
    if hasattr(final_pipeline, "predict_proba"):
        y_prob = final_pipeline.predict_proba(X_test)
        if len(classes) == 2:
            roc_auc = roc_auc_score(y_test, y_prob[:, 1])
            
    print(f"Held-out Accuracy: {acc:.4f}")
    print(f"Held-out Macro F1: {macro_f1:.4f}")
    if roc_auc is not None:
        print(f"Held-out ROC-AUC:  {roc_auc:.4f}")
        
    if macro_f1 < (best_score - 0.15):
        print("\nWARNING: Held-out performance is significantly worse than CV performance. Possible overfitting or data shift.")
        
    # --- SAVE ARTIFACTS ---
    joblib.dump(final_pipeline, model_path)
    
    cm = confusion_matrix(y_test, y_pred, labels=classes)
    cm_path = os.path.join(reports_dir, f"confusion_matrix_{args.version}.png")
    plot_confusion_matrix(cm, classes, cm_path)
    
    class_report_str = classification_report(y_test, y_pred, zero_division=0)
    report_path = os.path.join(reports_dir, f"classification_report_{args.version}.txt")
    
    with open(report_path, 'w') as f:
        f.write(f"Dataset Version Hash: {calculate_sha256(train_path)[:8]}\n")
        f.write(f"Model: {best_model_name}\n")
        f.write(f"Train Size: {len(X_train)} | Test Size: {len(X_test)}\n")
        f.write("\n--- Cross Validation (Train) ---\n")
        for k, v in cv_results.items():
            f.write(f"{k}: {v['mean_f1_macro']:.4f}\n")
        f.write("\n--- Held-Out Test Report ---\n")
        f.write(class_report_str)
        if roc_auc is not None:
            f.write(f"\nROC-AUC: {roc_auc:.4f}\n")
            
    # Metrics JSON
    metrics = {
        "accuracy": float(acc),
        "macro_precision": float(macro_p),
        "macro_recall": float(macro_r),
        "macro_f1": float(macro_f1),
        "weighted_f1": float(weighted_f1),
        "roc_auc": float(roc_auc) if roc_auc else None,
        "confusion_matrix": cm.tolist(),
        "classes": classes
    }
    with open(os.path.join(artifacts_dir, f"metrics_{args.version}.json"), 'w') as f:
        json.dump(metrics, f, indent=2)
        
    # Metadata
    metadata = {
        "model_version": args.version,
        "created_at": datetime.utcnow().isoformat(),
        "algorithm": best_model_name,
        "labels": classes,
        "random_state": args.random_state,
        "training_records": len(X_train),
        "testing_records": len(X_test),
        "train_class_distribution": train_counts,
        "test_class_distribution": {lbl: y_test.count(lbl) for lbl in set(y_test)},
        "cv_macro_f1_mean": float(best_score),
        "test_macro_f1": float(macro_f1),
        "train_split_hash": calculate_sha256(train_path),
        "test_split_hash": calculate_sha256(test_path),
    }
    with open(os.path.join(artifacts_dir, f"model_metadata_{args.version}.json"), 'w') as f:
        json.dump(metadata, f, indent=2)
        
    print(f"\nModel artifacts saved to {artifacts_dir}")
    print(f"Reports saved to {reports_dir}")

if __name__ == "__main__":
    main()
