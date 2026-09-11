import os
import json

BANKS_DIR = os.path.join(os.path.dirname(__file__), '..', 'app', 'data', 'interview_questions')

def validate_banks():
    if not os.path.exists(BANKS_DIR):
        print(f"Error: Directory {BANKS_DIR} does not exist.")
        return False
        
    all_ids = set()
    valid = True
    
    for filename in os.listdir(BANKS_DIR):
        if not filename.endswith('.json'):
            continue
            
        filepath = os.path.join(BANKS_DIR, filename)
        with open(filepath, 'r', encoding='utf-8') as f:
            questions = json.load(f)
            
        if not isinstance(questions, list):
            print(f"Error in {filename}: Root must be a list.")
            valid = False
            continue
            
        for i, q in enumerate(questions):
            if 'id' not in q:
                print(f"Error in {filename}[{i}]: Missing 'id'")
                valid = False
                continue
                
            if q['id'] in all_ids:
                print(f"Error in {filename}[{i}]: Duplicate id '{q['id']}'")
                valid = False
            all_ids.add(q['id'])
            
            if 'question' not in q or not q['question'].strip():
                print(f"Error in {filename} ({q['id']}): Missing or empty question")
                valid = False
                
            if 'skills' not in q or not isinstance(q['skills'], list):
                print(f"Error in {filename} ({q['id']}): 'skills' must be a list")
                valid = False
                
            if 'domain' not in q or q['domain'] != filename[:-5]:
                print(f"Error in {filename} ({q['id']}): 'domain' mismatch or missing")
                valid = False
                
            # Specifically check for LLM / assessment fields which are forbidden for this open ended interview
            forbidden = ['correct_option', 'correct_answer', 'ai_score', 'ai_reasoning', 'options']
            for f_field in forbidden:
                if f_field in q:
                    print(f"Error in {filename} ({q['id']}): Forbidden field '{f_field}' found")
                    valid = False
                    
    if valid:
        print(f"Success: Validated {len(all_ids)} interview questions across all banks.")
        
    return valid

if __name__ == '__main__':
    validate_banks()
