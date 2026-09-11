import asyncio
import os
import requests
from dotenv import load_dotenv
from app.services.supabase_client import supabase

load_dotenv()
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SECRET_KEY = os.getenv("SUPABASE_SECRET_KEY")

async def create_or_confirm_hr_user():
    email = "hr@company.com"
    password = "password123"
    
    print(f"Provisioning HR Admin User: {email}")
    headers = {
        "apikey": SUPABASE_SECRET_KEY,
        "Authorization": f"Bearer {SUPABASE_SECRET_KEY}",
        "Content-Type": "application/json"
    }
    
    user_id = None
    
    # 1. Search if user already exists via Admin API
    try:
        r = requests.get(f"{SUPABASE_URL}/auth/v1/admin/users", headers=headers)
        if r.status_code == 200:
            users = r.json().get("users", [])
            for u in users:
                if u.get("email") == email:
                    user_id = u.get("id")
                    print(f"Found existing auth user: {user_id}")
                    # Update password & confirm email
                    up_r = requests.put(
                        f"{SUPABASE_URL}/auth/v1/admin/users/{user_id}",
                        headers=headers,
                        json={"password": password, "email_confirm": True}
                    )
                    print("Updated password and confirmed email:", up_r.status_code)
                    break
    except Exception as e:
        print("Admin user list error:", e)

    # 2. If not found, create user via Admin API with email_confirm=True
    if not user_id:
        try:
            create_r = requests.post(
                f"{SUPABASE_URL}/auth/v1/admin/users",
                headers=headers,
                json={"email": email, "password": password, "email_confirm": True}
            )
            if create_r.status_code in (200, 201):
                data = create_r.json()
                user_id = data.get("id")
                print(f"Created new auto-confirmed auth user: {user_id}")
            else:
                print("Admin user creation error:", create_r.status_code, create_r.text)
        except Exception as e:
            print("Admin create error:", e)

    # 3. Ensure public.users record exists with role 'hr_admin'
    if user_id:
        try:
            exist = supabase.table("users").select("*").eq("user_id", user_id).execute()
            if not exist.data:
                supabase.table("users").insert({
                    "user_id": user_id,
                    "email": email,
                    "role": "hr_admin",
                    "mfa_enabled": False
                }).execute()
                print("Inserted into public.users with role 'hr_admin'.")
            else:
                supabase.table("users").update({
                    "role": "hr_admin",
                    "mfa_enabled": False
                }).eq("user_id", user_id).execute()
                print("Updated public.users record with role 'hr_admin'.")
                
            print("\n==========================================")
            print("✅ HR Admin Account Ready:")
            print(f"   Email:    {email}")
            print(f"   Password: {password}")
            print(f"   Role:     hr_admin")
            print("==========================================\n")
        except Exception as err:
            print("Error upserting public.users:", err)
    else:
        print("❌ Could not configure HR user.")

if __name__ == "__main__":
    asyncio.run(create_or_confirm_hr_user())
