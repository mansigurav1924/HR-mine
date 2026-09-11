import argparse
import os
import sys
import joblib

from sklearn.metrics import classification_report, accuracy_score, f1_score

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')))
from ml.scripts.train_model import load_data

def main():
    parser = argparse.ArgumentParser(description="Evaluate an existing Resume Classifier on the test set")
    parser.add_argument("--version", default="resume_classifier_v1", help="Model version name")
    args = parser.parse_args()
    
    ml_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
    model_path = os.path.join(ml_dir, 'artifacts', f"{args.version}.joblib")
    
    if not os.path.exists(model_path):
        print(f"Error: Model artifact not found at {model_path}")
        sys.exit(1)
        
    test_path = os.path.join(ml_dir, 'splits', 'test.csv')
    text_dir = os.path.join(ml_dir, 'processed', 'text')
    
    X_test, y_test, ids_test = load_data(test_path, text_dir)
    if not X_test:
        print("Error: Test split not found.")
        sys.exit(1)
        
    print(f"Loading model version: {args.version}")
    pipeline = joblib.load(model_path)
    
    print("Running evaluation on held-out test set...")
    y_pred = pipeline.predict(X_test)
    
    print("\n--- Evaluation Report ---")
    print(f"Accuracy: {accuracy_score(y_test, y_pred):.4f}")
    print(f"Macro F1: {f1_score(y_test, y_pred, average='macro', zero_division=0):.4f}")
    
    print("\nDetailed Report:")
    print(classification_report(y_test, y_pred, zero_division=0))

if __name__ == "__main__":
    main()
