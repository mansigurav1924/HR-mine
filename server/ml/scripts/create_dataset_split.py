import csv
import json
import os
import random
import sys

def main():
    ml_dir = os.path.join(os.path.dirname(__file__), '..')
    manifest_path = os.path.join(ml_dir, 'manifests', 'resume_labels.csv')
    
    if not os.path.exists(manifest_path):
        print("Manifest not found.")
        sys.exit(1)
        
    eligible_records = []
    excluded_count = 0
    duplicate_count = 0
    
    with open(manifest_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            if row['is_duplicate'] == 'True':
                duplicate_count += 1
                
            if row['include_in_training'] == 'True':
                if row['label'] == 'unreviewed':
                    print(f"Error: Eligible record {row['resume_id']} is still 'unreviewed'.")
                    print("Please complete manual labeling before splitting the dataset.")
                    sys.exit(1)
                elif row['label'] in ['good_intern', 'bad_intern']:
                    # Filter columns to drop PII, keep only ML features
                    clean_row = {
                        "resume_id": row["resume_id"],
                        "label": row["label"],
                        "target_domain": row["target_domain"]
                    }
                    eligible_records.append(clean_row)
                else:
                    excluded_count += 1
            else:
                excluded_count += 1
                
    good = [r for r in eligible_records if r['label'] == 'good_intern']
    bad = [r for r in eligible_records if r['label'] == 'bad_intern']
    
    if len(good) < 2 or len(bad) < 2:
        print("Error: Not enough records in one or more classes to perform a stratified split safely.")
        sys.exit(1)
        
    # Deterministic split
    random.seed(42)
    
    # Sort lists before shuffling to ensure absolute determinism across different environments
    good.sort(key=lambda x: x['resume_id'])
    bad.sort(key=lambda x: x['resume_id'])
    
    random.shuffle(good)
    random.shuffle(bad)
    
    # 80/20 split
    good_split = int(len(good) * 0.8)
    bad_split = int(len(bad) * 0.8)
    
    train_set = good[:good_split] + bad[:bad_split]
    test_set = good[good_split:] + bad[bad_split:]
    
    # Verify leakage
    train_ids = {r['resume_id'] for r in train_set}
    test_ids = {r['resume_id'] for r in test_set}
    
    if train_ids.intersection(test_ids):
        print("CRITICAL ERROR: Data leakage detected! Resume IDs overlap between train and test.")
        sys.exit(1)
        
    os.makedirs(os.path.join(ml_dir, 'splits'), exist_ok=True)
    
    # Write train
    with open(os.path.join(ml_dir, 'splits', 'train.csv'), 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=['resume_id', 'label', 'target_domain'])
        writer.writeheader()
        writer.writerows(train_set)
        
    # Write test
    with open(os.path.join(ml_dir, 'splits', 'test.csv'), 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=['resume_id', 'label', 'target_domain'])
        writer.writeheader()
        writer.writerows(test_set)
        
    summary = {
        "random_state": 42,
        "train_ratio": 0.8,
        "test_ratio": 0.2,
        "total_records": len(train_set) + len(test_set),
        "train_records": len(train_set),
        "test_records": len(test_set),
        "train_good_intern": len([r for r in train_set if r['label'] == 'good_intern']),
        "train_bad_intern": len([r for r in train_set if r['label'] == 'bad_intern']),
        "test_good_intern": len([r for r in test_set if r['label'] == 'good_intern']),
        "test_bad_intern": len([r for r in test_set if r['label'] == 'bad_intern']),
        "excluded_records": excluded_count,
        "duplicate_records": duplicate_count
    }
    
    with open(os.path.join(ml_dir, 'splits', 'split_summary.json'), 'w', encoding='utf-8') as f:
        json.dump(summary, f, indent=2)
        
    print("Stratified train/test split completed successfully.")
    print(f"Train size: {summary['train_records']}, Test size: {summary['test_records']}")

if __name__ == "__main__":
    main()
