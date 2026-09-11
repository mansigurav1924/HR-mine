from typing import List, Dict, Tuple

class SkillMatchingService:
    @staticmethod
    def _normalize_skill(skill: str) -> str:
        """Lowercases and trims spaces for deterministic comparison."""
        return skill.strip().lower()
        
    @staticmethod
    def match_skills(candidate_skills: List[str], required_skills: List[str], preferred_skills: List[str]) -> Tuple[List[str], List[str]]:
        """
        Returns a tuple of (matching_skills, missing_skills) where 
        'matching_skills' are the ones from candidate that match required OR preferred,
        and 'missing_skills' are the required skills the candidate lacks.
        """
        if not candidate_skills:
            candidate_skills = []
        if not required_skills:
            required_skills = []
        if not preferred_skills:
            preferred_skills = []
            
        cand_norm = {SkillMatchingService._normalize_skill(s): s for s in candidate_skills}
        req_norm = {SkillMatchingService._normalize_skill(s): s for s in required_skills}
        pref_norm = {SkillMatchingService._normalize_skill(s): s for s in preferred_skills}
        
        target_norm = {**req_norm, **pref_norm}
        
        matching = []
        missing = []
        
        # Check missing REQUIRED skills
        for r_norm, r_orig in req_norm.items():
            if r_norm not in cand_norm:
                missing.append(r_orig)
                
        # Check matching skills (intersect of candidate and all target skills)
        for c_norm in cand_norm.keys():
            if c_norm in target_norm:
                matching.append(target_norm[c_norm])
                
        return matching, missing
