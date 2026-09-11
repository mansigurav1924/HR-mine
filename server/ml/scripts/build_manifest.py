import argparse
import hashlib
import zipfile
import csv
import os
import sys

def get_file_type(bytes_head: bytes) -> str:
    """Detect file type using magic signatures."""
    if bytes_head.startswith(b'%PDF-'):
        return 'pdf'
    # DOCX files are essentially zip archives
    if bytes_head.startswith(b'PK\x03\x04'):
        return 'docx'
    if bytes_head.startswith(b'\xFF\xD8\xFF'):
        return 'jpg'
    if bytes_head.startswith(b'\x89PNG\r\n\x1a\n'):
        return 'png'
    return 'unsupported'

def main():
    parser = argparse.ArgumentParser(description="Build dataset manifest from a ZIP or Directory of resumes.")
    parser.add_argument("--zip-path", help="Path to the resumes dataset ZIP.")
    parser.add_argument("--dir-path", help="Path to the resumes dataset directory.")
    args = parser.parse_args()

    zip_path = args.zip_path
    dir_path = args.dir_path
    
    if not zip_path and not dir_path:
        print("Error: Must provide either --zip-path or --dir-path")
        sys.exit(1)
        
    manifest_dir = os.path.join(os.path.dirname(__file__), '..', 'manifests')
    os.makedirs(manifest_dir, exist_ok=True)
    manifest_path = os.path.join(manifest_dir, 'resume_labels.csv')
    
    seen_hashes = {}
    rows = []
    
    def process_file_bytes(file_bytes, filename):
        if len(file_bytes) == 0:
            return
            
        resume_id = hashlib.sha256(file_bytes).hexdigest()
        file_type = get_file_type(file_bytes[:20])
        
        is_duplicate = False
        duplicate_of = ""
        
        if resume_id in seen_hashes:
            is_duplicate = True
            duplicate_of = seen_hashes[resume_id]
        else:
            seen_hashes[resume_id] = filename
        
        parse_status = "pending"
        if file_type in ['jpg', 'png']:
            parse_status = "manual_review_required"
        elif file_type == 'unsupported':
            parse_status = "unsupported"
            
        include_in_training = not is_duplicate and file_type in ['pdf', 'docx']
            
        rows.append({
            "resume_id": resume_id,
            "source_file": filename,
            "file_type": file_type,
            "parse_status": parse_status,
            "is_duplicate": is_duplicate,
            "duplicate_of": duplicate_of,
            "label": "unreviewed",
            "target_domain": "",
            "include_in_training": include_in_training,
            "review_notes": ""
        })

    if zip_path:
        if not os.path.exists(zip_path):
            print(f"Error: Archive {zip_path} not found.")
            sys.exit(1)
        with zipfile.ZipFile(zip_path, 'r') as z:
            for info in z.infolist():
                if info.is_dir() or '__MACOSX' in info.filename or info.filename.endswith('.DS_Store'):
                    continue
                try:
                    with z.open(info) as f:
                        process_file_bytes(f.read(), info.filename)
                except Exception as e:
                    print(f"Skipping {info.filename}: {e}")
                    
    if dir_path:
        if not os.path.exists(dir_path):
            print(f"Error: Directory {dir_path} not found.")
            sys.exit(1)
        for root, _, files in os.walk(dir_path):
            for file in files:
                if '__MACOSX' in file or file.endswith('.DS_Store'):
                    continue
                file_path = os.path.join(root, file)
                try:
                    with open(file_path, 'rb') as f:
                        # Store relative path
                        rel_path = os.path.relpath(file_path, dir_path)
                        process_file_bytes(f.read(), rel_path)
                except Exception as e:
                    print(f"Skipping {file}: {e}")
                
    with open(manifest_path, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=[
            "resume_id", "source_file", "file_type", "parse_status", 
            "is_duplicate", "duplicate_of", "label", "target_domain", 
            "include_in_training", "review_notes"
        ])
        writer.writeheader()
        for row in rows:
            writer.writerow(row)
            
    print(f"Manifest built successfully at {manifest_path}")
    print(f"Total files processed: {len(rows)}")
    print(f"Unique files: {len(seen_hashes)}")

if __name__ == "__main__":
    main()
