import asyncio
from app.services.supabase_client import supabase

async def run():
    res = supabase.table("applications").select("application_id, candidate_name, current_status").execute()
    for row in res.data:
        print(f"{row['candidate_name']}: {row['current_status']}")

if __name__ == "__main__":
    asyncio.run(run())
