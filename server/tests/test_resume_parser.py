import pytest
from app.services.profile_extractor import extract_skills, extract_education, extract_experience, extract_projects

def test_extract_skills():
    text = "I am proficient in Python, React, and Node.js. Also some C++ and c."
    skills = extract_skills(text)
    assert "Python" in skills
    assert "React" in skills
    assert "Node.js" in skills
    assert "C++" in skills
    assert "C" in skills
    
def test_extract_skills_boundaries():
    text = "I like action movies and cats."
    skills = extract_skills(text)
    assert "C" not in skills
    assert "React" not in skills
    
def test_extract_education():
    text = """
Education
B.Tech in Computer Science
M.Sc Physics
    """
    edu = extract_education(text)
    assert len(edu) == 2
    assert "B.Tech in Computer Science" in edu[0]['degree']
    
def test_extract_experience():
    text = """
Experience
Software Engineer at Google
2020 - 2022
Worked on search.

Education
B.Sc
    """
    exp = extract_experience(text)
    assert len(exp) == 1
    assert "Software Engineer at Google" in exp[0]['title']
    assert "Worked on search." in exp[0]['description']

def test_extract_projects():
    text = """
Projects
HR Recruitment System
Built with React and Python.
    """
    proj = extract_projects(text)
    assert len(proj) == 1
    assert "HR Recruitment System" in proj[0]['name']
    assert "Built with React and Python." in proj[0]['description']
    assert "React" in proj[0]['technologies']
    assert "Python" in proj[0]['technologies']
