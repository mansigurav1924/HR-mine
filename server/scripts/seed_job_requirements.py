import os
import sys
from app.services.supabase_client import supabase

TARGET_POSITIONS = [
    {
        "position_title": "Full Stack Intern",
        "department": "Engineering",
        "required_skills": ["JavaScript", "HTML5", "CSS3", "React.js", "Node.js", "SQL", "Git", "REST API", "Data Structures & Algorithms"],
        "preferred_skills": ["TypeScript", "Python", "Java", "PHP", "C#", "Next.js", "Angular", "Vue.js", "Svelte", "Bootstrap", "Tailwind CSS", "Material UI", "Redux", "Express.js", "Django", "Flask", "FastAPI", "Spring Boot", "Laravel", "ASP.NET", "MySQL", "PostgreSQL", "Microsoft SQL Server", "MongoDB", "Firebase", "Redis", "SQLite", "MariaDB", "GraphQL", "WebSockets", "JSON", "XML", "OAuth 2.0", "JWT", "Webhooks", "Third-Party API Integration", "GitHub", "Docker", "CI/CD", "GitHub Actions", "Linux", "Vercel", "Netlify", "Render", "Railway", "AWS", "Microsoft Azure", "Google Cloud", "Unit Testing", "Integration Testing", "API Testing", "End-to-End Testing", "Postman", "Jest", "PyTest", "Selenium", "Playwright", "Cypress", "Object-Oriented Programming (OOP)", "Design Patterns", "SOLID Principles", "System Design", "Software Architecture", "API Design", "Microservices", "Agile/Scrum"],
        "education": "Student / New grad",
        "experience_min": 0,
        "experience_max": 1,
        "is_active": True
    },
    {
        "position_title": "Social Media Intern",
        "department": "Marketing",
        "required_skills": ["Social Media Management", "Content Creation", "Instagram Growth", "LinkedIn", "Canva"],
        "preferred_skills": ["Video Editing", "Analytics", "Copywriting", "Community Management"],
        "education": "Student / New grad",
        "experience_min": 0,
        "experience_max": 1,
        "is_active": True
    },
    {
        "position_title": "Sales Development Intern",
        "department": "Sales",
        "required_skills": ["Lead Generation", "Outreach", "Communication", "B2B Sales", "CRM"],
        "preferred_skills": ["Email Campaigning", "Prospecting", "Market Research", "Negotiation"],
        "education": "Student / New grad",
        "experience_min": 0,
        "experience_max": 1,
        "is_active": True
    },
    {
        "position_title": "HR Intern",
        "department": "Human Resources",
        "required_skills": ["Talent Sourcing", "Screening", "Interview Coordination", "Communication", "HR Operations"],
        "preferred_skills": ["Documentation", "HRIS", "Candidate Engagement", "Spreadsheets"],
        "education": "Student / New grad",
        "experience_min": 0,
        "experience_max": 1,
        "is_active": True
    },
    {
        "position_title": "AI Engineering Intern",
        "department": "Data & AI",
        "required_skills": ["Python", "Machine Learning", "PyTorch", "TensorFlow", "Scikit-Learn", "NLP"],
        "preferred_skills": ["Deep Learning", "LLMs", "FastAPI", "Pandas", "NumPy"],
        "education": "Student / New grad",
        "experience_min": 0,
        "experience_max": 1,
        "is_active": True
    },
    {
        "position_title": "Business Analyst Intern",
        "department": "Analytics & Strategy",
        "required_skills": ["Business Analysis", "Requirements Gathering", "SQL", "Excel", "Data Visualization"],
        "preferred_skills": ["Power BI", "Tableau", "Process Mapping", "Agile"],
        "education": "Student / New grad",
        "experience_min": 0,
        "experience_max": 1,
        "is_active": True
    },
    {
        "position_title": "Content Creator Intern",
        "department": "Creative & Content",
        "required_skills": ["Content Creation", "Copywriting", "Storytelling", "Social Media", "Video Scripting"],
        "preferred_skills": ["Graphic Design", "Video Editing", "SEO", "Blog Writing"],
        "education": "Student / New grad",
        "experience_min": 0,
        "experience_max": 1,
        "is_active": True
    },
    {
        "position_title": "Others",
        "department": "General",
        "required_skills": ["Communication", "Problem Solving", "Adaptability", "Collaboration", "Critical Thinking"],
        "preferred_skills": ["Project Management", "Leadership", "Technical Aptitude", "Initiative"],
        "education": "Student / New grad",
        "experience_min": 0,
        "experience_max": 1,
        "is_active": True
    }
]

def sync_exact_intern_positions():
    print("Deactivating all previous non-matching positions...")
    target_titles = [p["position_title"] for p in TARGET_POSITIONS]
    
    # Get all jobs
    all_jobs = supabase.table("job_requirements").select("position_id, position_title").execute()
    for job in all_jobs.data or []:
        if job["position_title"] not in target_titles:
            # Set is_active = False or delete if unused
            try:
                supabase.table("job_requirements").delete().eq("position_id", job["position_id"]).execute()
                print(f"Deleted old position: {job['position_title']}")
            except Exception:
                supabase.table("job_requirements").update({"is_active": False}).eq("position_id", job["position_id"]).execute()
                print(f"Deactivated old position: {job['position_title']}")

    print("\nUpserting the 8 exact requested intern positions...")
    for pos in TARGET_POSITIONS:
        existing = supabase.table("job_requirements").select("position_id").eq("position_title", pos["position_title"]).execute()
        if existing.data and len(existing.data) > 0:
            pos_id = existing.data[0]["position_id"]
            supabase.table("job_requirements").update(pos).eq("position_id", pos_id).execute()
            print(f"[OK] Updated: {pos['position_title']} ({pos['department']})")
        else:
            supabase.table("job_requirements").insert(pos).execute()
            print(f"[OK] Created: {pos['position_title']} ({pos['department']})")

    print("\nAll positions synchronized successfully!")

if __name__ == "__main__":
    sync_exact_intern_positions()
