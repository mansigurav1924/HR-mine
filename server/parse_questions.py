import re
import json
import os

def parse_txt_to_json(input_path, output_path):
    with open(input_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()

    questions = []
    
    current_skill = None
    current_difficulty = None
    
    current_q_id = None
    current_q_text = []
    current_options = []
    current_answer = None
    
    in_question_block = False
    in_options_block = False
    
    skill_re = re.compile(r'^## Skill \d+:\s*(.*)')
    diff_re = re.compile(r'^### (Beginner|Intermediate|Advanced)')
    q_start_re = re.compile(r'^Q\d+\s+\[(.*?)\]')
    opt_re = re.compile(r'^[A-D]\.\s*(.*)')
    ans_re = re.compile(r'^Correct Answer:\s*([A-D])')
    
    def save_current_question():
        nonlocal current_q_id, current_q_text, current_options, current_answer
        if current_q_id and current_q_text and len(current_options) == 4 and current_answer:
            
            diff_map = {"Beginner": "easy", "Intermediate": "medium", "Advanced": "hard"}
            diff = diff_map.get(current_difficulty, "medium")
            
            ans_map = {"A": 0, "B": 1, "C": 2, "D": 3}
            correct_option_index = ans_map.get(current_answer, 0)
            
            questions.append({
                "id": current_q_id,
                "skill": current_skill,
                "difficulty": diff,
                "question": "\n".join(current_q_text).strip(),
                "options": current_options.copy(),
                "correct_option": correct_option_index
            })
            
        current_q_id = None
        current_q_text.clear()
        current_options.clear()
        current_answer = None

    for line in lines:
        line_s = line.strip()
        
        m_skill = skill_re.match(line_s)
        if m_skill:
            current_skill = m_skill.group(1).strip()
            continue
            
        m_diff = diff_re.match(line_s)
        if m_diff:
            current_difficulty = m_diff.group(1)
            continue
            
        m_q = q_start_re.match(line_s)
        if m_q:
            save_current_question()
            current_q_id = m_q.group(1).strip()
            in_question_block = True
            in_options_block = False
            continue
            
        if current_q_id:
            m_ans = ans_re.match(line_s)
            if m_ans:
                current_answer = m_ans.group(1)
                save_current_question()
                in_question_block = False
                in_options_block = False
                continue
                
            m_opt = opt_re.match(line_s)
            if m_opt:
                in_options_block = True
                in_question_block = False
                current_options.append(line_s) 
                continue
                
            if in_options_block and line_s == "":
                continue
                
            if in_question_block:
                if line_s != "" or len(current_q_text) > 0:
                    current_q_text.append(line_s)
            elif in_options_block and line_s != "":
                if current_options:
                    current_options[-1] += "\n" + line_s

    save_current_question()
    
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(questions, f, indent=2)
        
    print(f"Successfully parsed {len(questions)} questions into {output_path}")

if __name__ == "__main__":
    input_file = r"c:\Users\mgura\OneDrive\Desktop\internship\HR_Portal\HR-Recruitment-System\question_bank\Full_stack_question.txt"
    output_file = r"c:\Users\mgura\OneDrive\Desktop\internship\HR_Portal\HR-Recruitment-System\server\app\data\question_banks\full_stack.json"
    parse_txt_to_json(input_file, output_file)
