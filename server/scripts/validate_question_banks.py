import os
import json

BANKS_DIR = os.path.join(os.path.dirname(__file__), '..', 'app', 'data', 'question_banks')

def validate_banks():
    if not os.path.exists(BANKS_DIR):
        print(f"Error: {BANKS_DIR} does not exist.")
        return False
        
    all_valid = True
    global_ids = set()
    
    for filename in os.listdir(BANKS_DIR):
        if not filename.endswith('.json'):
            continue
            
        filepath = os.path.join(BANKS_DIR, filename)
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                questions = json.load(f)
                
            if not isinstance(questions, list):
                print(f"Error: {filename} root is not a list.")
                all_valid = False
                continue
                
            for i, q in enumerate(questions):
                # Check required fields
                required = ['id', 'skill', 'difficulty', 'question', 'options', 'correct_option']
                for req in required:
                    if req not in q:
                        print(f"Error: {filename} Question index {i} missing '{req}'.")
                        all_valid = False
                
                if not all_valid:
                    continue
                    
                # Validate ID uniqueness
                q_id = q['id']
                if q_id in global_ids:
                    print(f"Error: Duplicate Question ID '{q_id}' in {filename}.")
                    all_valid = False
                global_ids.add(q_id)
                
                # Validate Options
                opts = q['options']
                if not isinstance(opts, list) or len(opts) < 2:
                    print(f"Error: Question '{q_id}' has fewer than 2 options.")
                    all_valid = False
                    
                # Validate Correct Option
                correct = q['correct_option']
                if not isinstance(correct, int) or correct < 0 or correct >= len(opts):
                    print(f"Error: Question '{q_id}' correct_option {correct} is out of bounds.")
                    all_valid = False
                    
        except Exception as e:
            print(f"Exception reading {filename}: {e}")
            all_valid = False
            
    if all_valid:
        print("Validation Successful: All question banks are valid.")
    else:
        print("Validation Failed: Found errors in question banks.")
        
    return all_valid

if __name__ == '__main__':
    validate_banks()
