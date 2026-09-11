import argparse
import csv
import os
import sys
import zipfile

# Add server directory to path so we can import app modules
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')))

from app.services.pdf_parser import extract_text_from_pdf, is_scanned_or_empty_pdf
from app.services.docx_parser import extract_text_from_docx

def main():
    parser = argparse.ArgumentParser(description="Extract text from dataset resumes.")
    parser.add_argument("--zip-path", help="Path to the resumes dataset ZIP.")
    parser.add_argument("--dir-path", help="Path to the resumes dataset directory.")
    args = parser.parse_args()

    zip_path = args.zip_path or os.environ.get("RESUME_DATASET_ZIP")
    dir_path = args.dir_path
    
    if not zip_path and not dir_path:
        print("Error: Dataset path not provided.")
        print("Use --zip-path or --dir-path, or set RESUME_DATASET_ZIP environment variable.")
        sys.exit(1)

    ml_dir = os.path.join(os.path.dirname(__file__), '..')
    manifest_path = os.path.join(ml_dir, 'manifests', 'resume_labels.csv')
    processed_dir = os.path.join(ml_dir, 'processed', 'text')
    
    if not os.path.exists(manifest_path):
        print(f"Error: Manifest not found at {manifest_path}. Run build_manifest.py first.")
        sys.exit(1)
        
    os.makedirs(processed_dir, exist_ok=True)
    
    # Read manifest
    rows = []
    with open(manifest_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            rows.append(row)
            
    # Process
    success_count = 0
    
    def process_row(row, get_bytes_func):
        nonlocal success_count
        
        if not row['include_in_training'] == 'True':
            return
            
        if row['parse_status'] in ['success', 'manual_review_required'] and os.path.exists(os.path.join(processed_dir, f"{row['resume_id']}.txt")):
            return # Already extracted
            
        source_file = row['source_file']
        file_type = row['file_type']
        resume_id = row['resume_id']
        
        if file_type not in ['pdf', 'docx']:
            return
            
        try:
            file_bytes = get_bytes_func(source_file)
            if not file_bytes:
                return
                
            text = ""
            if file_type == 'pdf':
                text = extract_text_from_pdf(file_bytes)
                if is_scanned_or_empty_pdf(text):
                    row['parse_status'] = 'manual_review_required'
                    row['review_notes'] = 'Scanned PDF or empty text'
                else:
                    row['parse_status'] = 'success'
                    
            elif file_type == 'docx':
                text = extract_text_from_docx(file_bytes)
                row['parse_status'] = 'success'
                
            # Save extracted text privately
            if text.strip():
                out_path = os.path.join(processed_dir, f"{resume_id}.txt")
                with open(out_path, 'w', encoding='utf-8') as tf:
                    tf.write(text)
                if row['parse_status'] == 'pending':
                    row['parse_status'] = 'success'
                success_count += 1
            else:
                row['parse_status'] = 'failed'
                row['review_notes'] = 'Extracted text is empty'
                row['include_in_training'] = 'False'
                
        except Exception as e:
            row['parse_status'] = 'failed'
            row['review_notes'] = 'Exception during extraction'
            row['include_in_training'] = 'False'

    if zip_path and os.path.exists(zip_path):
        with zipfile.ZipFile(zip_path, 'r') as z:
            def get_bytes_zip(src):
                with z.open(src) as f:
                    return f.read()
            for row in rows:
                process_row(row, get_bytes_zip)
                
    elif dir_path and os.path.exists(dir_path):
        def get_bytes_dir(src):
            path = os.path.join(dir_path, src)
            if os.path.exists(path):
                with open(path, 'rb') as f:
                    return f.read()
            return None
        for row in rows:
            process_row(row, get_bytes_dir)
                
    # Update manifest
    with open(manifest_path, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=rows[0].keys())
        writer.writeheader()
        writer.writerows(rows)
        
    print(f"Extraction complete. {success_count} files extracted safely to {processed_dir}")

if __name__ == "__main__":
    main()
