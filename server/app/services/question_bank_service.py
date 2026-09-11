import os
import json
import random
from typing import List, Dict, Any

BANKS_DIR = os.path.join(os.path.dirname(__file__), '..', 'data', 'question_banks')

class QuestionBankService:
    def __init__(self):
        self.banks_cache = {}
        self._load_banks()

    def _load_banks(self):
        if not os.path.exists(BANKS_DIR):
            return
        for filename in os.listdir(BANKS_DIR):
            if filename.endswith('.json'):
                domain = filename[:-5]
                filepath = os.path.join(BANKS_DIR, filename)
                with open(filepath, 'r', encoding='utf-8') as f:
                    self.banks_cache[domain] = json.load(f)

    def select_questions(self, required_skills: List[str], preferred_skills: List[str], candidate_skills: List[str], count: int) -> List[Dict[str, Any]]:
        """Selects questions randomly, favoring required, then preferred, then candidate skills, then general."""
        selected = []
        selected_ids = set()
        
        # Flatten all questions from all banks
        all_questions = []
        for domain_questions in self.banks_cache.values():
            all_questions.extend(domain_questions)
            
        def sample_from_skills(skill_list, target_count):
            nonlocal selected, selected_ids, all_questions
            skill_list_lower = [s.lower() for s in skill_list]
            matching = [q for q in all_questions if q['skill'].lower() in skill_list_lower and q['id'] not in selected_ids]
            random.shuffle(matching)
            
            for q in matching:
                if len(selected) >= target_count:
                    break
                selected.append(q)
                selected_ids.add(q['id'])
                
        # Proportional distribution attempt:
        # 50% required, 25% preferred, 25% general/candidate
        sample_from_skills(required_skills, int(count * 0.5))
        sample_from_skills(preferred_skills, int(count * 0.75))
        sample_from_skills(candidate_skills, count)
        
        # Fill remaining with general or randomly
        if len(selected) < count:
            remaining = [q for q in all_questions if q['id'] not in selected_ids]
            random.shuffle(remaining)
            for q in remaining:
                if len(selected) >= count:
                    break
                selected.append(q)
                selected_ids.add(q['id'])
                
        return selected
