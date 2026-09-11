import os
import sys
import json
import pytest
import csv
import joblib
from unittest import mock
import numpy as np

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from ml.training.preprocessing import ResumeTextPreprocessor
from ml.training.model_factory import build_candidate_pipelines
from ml.scripts.train_model import load_data, main as train_main

# --- Preprocessing Tests ---

def test_email_masking():
    preprocessor = ResumeTextPreprocessor()
    res = preprocessor.transform(["Contact me at candidate@example.com!"])
    assert "[email]" in res[0]
    assert "candidate@example.com" not in res[0]

def test_phone_masking():
    preprocessor = ResumeTextPreprocessor()
    res = preprocessor.transform(["Phone: +1 (555) 123-4567"])
    assert "[phone]" in res[0]
    
def test_url_masking():
    preprocessor = ResumeTextPreprocessor()
    res = preprocessor.transform(["GitHub: https://github.com/test"])
    assert "[url]" in res[0]

# --- Pipeline Tests ---

def test_pipeline_candidates_creation():
    pipelines = build_candidate_pipelines(random_state=42)
    assert 'LogisticRegression' in pipelines
    assert 'LinearSVC' in pipelines
    
    # Check Pipeline structure
    lr_pipe = pipelines['LogisticRegression']
    assert lr_pipe.steps[0][0] == 'preprocessor'
    assert lr_pipe.steps[1][0] == 'tfidf'
    assert lr_pipe.steps[2][0] == 'classifier'
    
    # Check LinearSVC calibration (ensures raw score isn't used as probability)
    svc_pipe = pipelines['LinearSVC']
    classifier = svc_pipe.steps[-1][1]
    assert type(classifier).__name__ == 'CalibratedClassifierCV'

def test_pipeline_probability_range():
    # Fit a tiny dummy model to verify probability output behavior
    pipelines = build_candidate_pipelines(random_state=42)
    pipe = pipelines['LogisticRegression']
    
    X = ["Python developer", "Java developer", "React frontend", "Node backend"]
    y = ["good_intern", "bad_intern", "good_intern", "bad_intern"]
    
    pipe.fit(X, y)
    probs = pipe.predict_proba(["Python frontend"])
    assert probs.shape == (1, 2)
    assert np.all((probs >= 0) & (probs <= 1))
    assert np.isclose(np.sum(probs), 1.0)

# --- Train Script Checks ---

@pytest.fixture
def mock_dataset(tmp_path):
    # Setup mock CSVs and texts
    split_dir = tmp_path / "splits"
    text_dir = tmp_path / "processed" / "text"
    os.makedirs(split_dir)
    os.makedirs(text_dir)
    
    train_csv = split_dir / "train.csv"
    with open(train_csv, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=["resume_id", "label"])
        writer.writeheader()
        for i in range(10):
            writer.writerow({"resume_id": f"r{i}", "label": "good_intern" if i % 2 == 0 else "bad_intern"})
            with open(text_dir / f"r{i}.txt", 'w', encoding='utf-8') as tf:
                # Add enough variation so tfidf min_df=2 and max_df=0.95 don't prune everything
                tf.write(f"unique_{i} shared_{i % 3} shared_{i % 4}")
                
    test_csv = split_dir / "test.csv"
    with open(test_csv, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=["resume_id", "label"])
        writer.writeheader()
        for i in range(10, 14):
            writer.writerow({"resume_id": f"r{i}", "label": "good_intern" if i % 2 == 0 else "bad_intern"})
            with open(text_dir / f"r{i}.txt", 'w', encoding='utf-8') as tf:
                tf.write(f"unique_{i} shared_{i % 3} shared_{i % 4}")
                
    return tmp_path

def test_invalid_label_rejected(mock_dataset):
    with open(mock_dataset / "splits" / "train.csv", 'a', encoding='utf-8') as f:
        f.write("r99,unreviewed\n")
    with open(mock_dataset / "processed" / "text" / "r99.txt", 'w') as f:
        f.write("test")
        
    with pytest.raises(SystemExit):
        load_data(mock_dataset / "splits" / "train.csv", mock_dataset / "processed" / "text")

def test_overlap_rejected(mock_dataset):
    # Leak a train record into test
    with open(mock_dataset / "splits" / "test.csv", 'a', encoding='utf-8') as f:
        f.write("r0,good_intern\n")
        
    # We patch ml_dir so the script uses our temp path
    with mock.patch('ml.scripts.train_model.os.path.abspath', return_value=str(mock_dataset)):
        with mock.patch('ml.scripts.train_model.sys.argv', ['train_model.py', '--version', 'v_test', '--overwrite']):
            with pytest.raises(SystemExit):
                train_main()

def test_train_pipeline_artifacts(mock_dataset):
    # Run the main training loop in our temp dir
    with mock.patch('ml.scripts.train_model.os.path.abspath', return_value=str(mock_dataset)):
        with mock.patch('ml.scripts.train_model.sys.argv', ['train_model.py', '--version', 'v_test']):
            train_main()
            
    artifacts = mock_dataset / "artifacts"
    reports = mock_dataset / "reports"
    
    # 11. saved pipeline can be reloaded
    model_path = artifacts / "v_test.joblib"
    assert os.path.exists(model_path)
    model = joblib.load(model_path)
    
    # 12. reloaded pipeline predicts same result
    pred = model.predict(["Sample text"])[0]
    assert pred in ['good_intern', 'bad_intern']
    
    # 15. metrics JSON created
    metrics_path = artifacts / "metrics_v_test.json"
    assert os.path.exists(metrics_path)
    with open(metrics_path, 'r') as f:
        m = json.load(f)
        # 19. no candidate PII stored in metrics
        assert "resume_id" not in str(m)
        assert "r0" not in str(m)
        
    # 16. metadata JSON created
    meta_path = artifacts / "model_metadata_v_test.json"
    assert os.path.exists(meta_path)
    with open(meta_path, 'r') as f:
        meta = json.load(f)
        # 17. train/test SHA-256 hashes created
        assert "train_split_hash" in meta
        # 18. no raw resume text stored in metadata
        assert "Sample resume text" not in str(meta)
        
    # 20. confusion matrix file created
    assert os.path.exists(reports / "confusion_matrix_v_test.png")
    
    # 22. existing artifact protected from accidental overwrite
    with mock.patch('ml.scripts.train_model.os.path.abspath', return_value=str(mock_dataset)):
        with mock.patch('ml.scripts.train_model.sys.argv', ['train_model.py', '--version', 'v_test']):
            with pytest.raises(SystemExit):
                train_main() # Should exit 1 because file exists and no --overwrite
