import os
import json
import uuid

BANKS_DIR = os.path.join(os.path.dirname(__file__), '..', 'app', 'data', 'question_banks')

DOMAINS = {
    'full_stack': ['React', 'Node.js', 'PostgreSQL', 'Express', 'TypeScript', 'REST API'],
    'frontend': ['React', 'Vue', 'CSS', 'HTML', 'JavaScript', 'Web APIs'],
    'backend': ['Python', 'Django', 'FastAPI', 'Node.js', 'SQL', 'System Design'],
    'ai_ml': ['Python', 'PyTorch', 'TensorFlow', 'Machine Learning', 'NLP', 'Computer Vision'],
    'data': ['SQL', 'Pandas', 'Data Warehousing', 'ETL', 'Python', 'Spark'],
    'mobile': ['React Native', 'Flutter', 'Swift', 'Kotlin', 'Mobile UI'],
    'general': ['Algorithms', 'Data Structures', 'Git', 'Agile', 'Testing', 'Communication']
}

def generate_questions(domain, skills, count=35):
    questions = []
    difficulties = ['easy', 'medium', 'hard']
    
    for i in range(count):
        skill = skills[i % len(skills)]
        diff = difficulties[i % 3]
        
        q_id = f"{domain}_{skill.lower().replace(' ', '_').replace('.', '')}_{i+1:03d}"
        
        questions.append({
            "id": q_id,
            "skill": skill,
            "difficulty": diff,
            "question": f"Sample {diff} question about {skill} for the {domain} domain?",
            "options": [
                f"Incorrect option A for {skill}",
                f"Correct option for {skill}",
                f"Incorrect option C for {skill}",
                f"Incorrect option D for {skill}"
            ],
            "correct_option": 1
        })
    return questions

def main():
    os.makedirs(BANKS_DIR, exist_ok=True)
    
    for domain, skills in DOMAINS.items():
        filepath = os.path.join(BANKS_DIR, f"{domain}.json")
        questions = generate_questions(domain, skills)
        
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(questions, f, indent=2)
            
        print(f"Generated {len(questions)} questions for {domain} in {filepath}")

if __name__ == '__main__':
    main()
