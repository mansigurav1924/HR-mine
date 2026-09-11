import asyncio
from app.services.supabase_client import supabase

async def run():
    res = supabase.table("interviews").select("status, application_id, applications(candidate_name, current_status)").execute()
    for row in res.data:
        app = row.get("applications", {}) or {}
        print(f"Interview Status: {row['status']} | App Name: {app.get('candidate_name')} | App Status: {app.get('current_status')}")

if __name__ == "__main__":
    asyncio.run(run())
