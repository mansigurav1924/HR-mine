import os
import datetime
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

url = os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_KEY") or os.environ.get("SUPABASE_KEY")

if not url or not key:
    print("Missing Supabase credentials")
    exit(1)

supabase: Client = create_client(url, key)

# 1. Create a department
dept_res = supabase.table("departments").insert({
    "name": "Engineering",
    "description": "Software Engineering Department"
}).execute()

dept_id = dept_res.data[0]["department_id"]

# 2. Create positions
positions = [
    {
        "position_title": "Frontend Engineer Intern",
        "department_id": dept_id,
        "department": "Engineering",
        "job_code": "ENG-001",
        "description": "Work on React frontend.",
        "number_of_openings": 2,
        "employment_type": "Internship",
        "work_mode": "Remote",
        "location": "Global",
        "publication_status": "PUBLISHED",
        "application_open_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "manual_application_status": "OPEN",
    },
    {
        "position_title": "Backend Engineer Intern",
        "department_id": dept_id,
        "department": "Engineering",
        "job_code": "ENG-002",
        "description": "Work on Python backend.",
        "number_of_openings": 1,
        "employment_type": "Internship",
        "work_mode": "Hybrid",
        "location": "New York",
        "publication_status": "PUBLISHED",
        "application_open_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "manual_application_status": "OPEN",
    }
]

supabase.table("job_requirements").insert(positions).execute()
print("Database seeded with 1 department and 2 positions.")
