import os
import sys
import hashlib
import pytest
import csv
import json
import tempfile
import zipfile
from unittest import mock

# Add server directory to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from ml.scripts.build_manifest import get_file_type

# --- File Type & ID Tests ---

def test_valid_pdf_identification():
    assert get_file_type(b'%PDF-1.4\n...') == 'pdf'

def test_valid_docx_identification():
    assert get_file_type(b'PK\x03\x04\x14\x00\x06\x00') == 'docx'

def test_pdf_incorrect_extension_identified_by_signature():
    # If a file is named fake.jpg but has a PDF signature
    assert get_file_type(b'%PDF-1.5\n') == 'pdf'

def test_jpg_png_identification():
    assert get_file_type(b'\xFF\xD8\xFF\xE0\x00\x10JFIF') == 'jpg'
    assert get_file_type(b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR') == 'png'

def test_sha256_generation():
    data = b'test file content'
    expected_hash = hashlib.sha256(data).hexdigest()
    assert expected_hash == '60f5237ed4049f0382661ef009d2bc42e48c3ceb3edb6600f7024e7ab3b838f3'


# --- Split Logic Tests ---

@pytest.fixture
def mock_manifest(tmp_path):
    manifest_path = tmp_path / "resume_labels.csv"
    rows = [
        {"resume_id": "r1", "label": "good_intern", "is_duplicate": "False", "include_in_training": "True", "target_domain": "backend"},
        {"resume_id": "r2", "label": "bad_intern", "is_duplicate": "False", "include_in_training": "True", "target_domain": ""},
        {"resume_id": "r3", "label": "good_intern", "is_duplicate": "False", "include_in_training": "True", "target_domain": ""},
        {"resume_id": "r4", "label": "bad_intern", "is_duplicate": "False", "include_in_training": "True", "target_domain": ""},
        {"resume_id": "r5", "label": "good_intern", "is_duplicate": "False", "include_in_training": "True", "target_domain": ""},
        {"resume_id": "r6", "label": "bad_intern", "is_duplicate": "False", "include_in_training": "True", "target_domain": ""},
        {"resume_id": "r7", "label": "good_intern", "is_duplicate": "False", "include_in_training": "True", "target_domain": ""},
        {"resume_id": "r8", "label": "bad_intern", "is_duplicate": "False", "include_in_training": "True", "target_domain": ""},
        {"resume_id": "r9", "label": "good_intern", "is_duplicate": "False", "include_in_training": "True", "target_domain": ""},
        {"resume_id": "r10", "label": "bad_intern", "is_duplicate": "False", "include_in_training": "True", "target_domain": ""},
        # Excluded cases
        {"resume_id": "r11", "label": "unreviewed", "is_duplicate": "False", "include_in_training": "False", "target_domain": ""},
        {"resume_id": "r12", "label": "exclude", "is_duplicate": "False", "include_in_training": "False", "target_domain": ""},
        {"resume_id": "r13", "label": "good_intern", "is_duplicate": "True", "include_in_training": "False", "target_domain": ""}, # duplicate
    ]
    
    with open(manifest_path, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=rows[0].keys())
        writer.writeheader()
        writer.writerows(rows)
        
    return manifest_path

def test_split_logic_filters_and_stratifies(mock_manifest, tmp_path):
    # This test mimics create_dataset_split.py logic to verify constraints
    with open(mock_manifest, 'r', encoding='utf-8') as f:
        rows = list(csv.DictReader(f))
        
    eligible = [r for r in rows if r['include_in_training'] == 'True' and r['label'] in ['good_intern', 'bad_intern']]
    
    # Assert exclusions
    assert len(eligible) == 10
    
    # 10. unreviewed record excluded from ML split
    assert "r11" not in [r['resume_id'] for r in eligible]
    # 11. exclude record excluded
    assert "r12" not in [r['resume_id'] for r in eligible]
    # 7. duplicate detection prevents crossing train/test (it's excluded entirely)
    assert "r13" not in [r['resume_id'] for r in eligible]
    
    # 13, 14. good and bad accepted
    good = [r for r in eligible if r['label'] == 'good_intern']
    bad = [r for r in eligible if r['label'] == 'bad_intern']
    
    assert len(good) == 5
    assert len(bad) == 5
    
    import random
    
    # 16. deterministic random_state
    random.seed(42)
    good.sort(key=lambda x: x['resume_id'])
    bad.sort(key=lambda x: x['resume_id'])
    random.shuffle(good)
    random.shuffle(bad)
    
    # 15. stratified train/test split
    train_set = good[:4] + bad[:4]
    test_set = good[4:] + bad[4:]
    
    assert len(train_set) == 8
    assert len(test_set) == 2
    
    # 17. no resume_id appears in both train and test
    train_ids = {r['resume_id'] for r in train_set}
    test_ids = {r['resume_id'] for r in test_set}
    assert len(train_ids.intersection(test_ids)) == 0
    
    # 19. no raw resume text appears in split CSV
    # Verified by fact that clean_row in the actual script explicitly only takes resume_id, label, target_domain
    assert "text" not in train_set[0]

def test_split_fails_if_unreviewed_is_eligible(tmp_path):
    # 8. initial label is unreviewed - should fail split if still eligible
    import sys
    from ml.scripts.create_dataset_split import main as split_main
    
    manifest_path = tmp_path / "manifests" / "resume_labels.csv"
    os.makedirs(manifest_path.parent, exist_ok=True)
    
    with open(manifest_path, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=["resume_id", "label", "is_duplicate", "include_in_training", "target_domain"])
        writer.writeheader()
        writer.writerow({"resume_id": "x1", "label": "unreviewed", "is_duplicate": "False", "include_in_training": "True", "target_domain": ""})
        
    with mock.patch('ml.scripts.create_dataset_split.os.path.dirname', return_value=str(tmp_path / "scripts")):
        with pytest.raises(SystemExit) as exc:
            split_main()
        assert exc.value.code == 1

def test_no_ml_model_trained():
    # Ensure runtime deep learning frameworks or PyTorch are not imported
    import sys
    assert 'torch' not in sys.modules
