import csv
import os
import sys

def main():
    ml_dir = os.path.join(os.path.dirname(__file__), '..')
    manifest_path = os.path.join(ml_dir, 'manifests', 'resume_labels.csv')
    
    if not os.path.exists(manifest_path):
        print(f"Error: Manifest not found at {manifest_path}")
        sys.exit(1)
        
    allowed_labels = {'good_intern', 'bad_intern', 'exclude', 'unreviewed'}
    
    total = 0
    parsed_successfully = 0
    manual_review_required = 0
    failed = 0
    duplicates = 0
    unreviewed = 0
    good_intern = 0
    bad_intern = 0
    excluded = 0
    eligible_for_ml = 0
    
    seen_ids = set()
    errors = []
    
    with open(manifest_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            total += 1
            resume_id = row.get('resume_id')
            label = row.get('label')
            status = row.get('parse_status')
            
            if not resume_id:
                errors.append(f"Row {total} is missing resume_id.")
                continue
                
            if resume_id in seen_ids:
                errors.append(f"Duplicate resume_id record found in CSV: {resume_id}")
            seen_ids.add(resume_id)
            
            if label not in allowed_labels:
                errors.append(f"Invalid label '{label}' on resume {resume_id}")
                
            if label == 'unreviewed':
                unreviewed += 1
            elif label == 'good_intern':
                good_intern += 1
            elif label == 'bad_intern':
                bad_intern += 1
            elif label == 'exclude':
                excluded += 1
                
            if status == 'success':
                parsed_successfully += 1
            elif status == 'manual_review_required':
                manual_review_required += 1
            elif status in ['failed', 'unsupported']:
                failed += 1
                
            if row.get('is_duplicate') == 'True':
                duplicates += 1
                
            # Check ML eligibility
            if row.get('include_in_training') == 'True' and label in ['good_intern', 'bad_intern']:
                if status == 'failed':
                    errors.append(f"Resume {resume_id} failed parsing but is marked include_in_training.")
                else:
                    eligible_for_ml += 1
                    
    print("\n--- Label Validation Summary ---")
    print(f"Total resumes: {total}")
    print(f"Parsed successfully: {parsed_successfully}")
    print(f"Manual review required: {manual_review_required}")
    print(f"Failed: {failed}")
    print(f"Duplicates: {duplicates}")
    print(f"Unreviewed: {unreviewed}")
    print(f"Good intern: {good_intern}")
    print(f"Bad intern: {bad_intern}")
    print(f"Excluded: {excluded}")
    print(f"Eligible for ML: {eligible_for_ml}")
    
    if errors:
        print("\nERRORS DETECTED:")
        for e in errors[:10]:
            print(f"- {e}")
        if len(errors) > 10:
            print(f"...and {len(errors) - 10} more errors.")
        sys.exit(1)
    else:
        print("\nValidation passed. No structural errors found.")

if __name__ == "__main__":
    main()
