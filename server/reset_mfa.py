import os
import requests
from dotenv import load_dotenv

load_dotenv()
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SECRET_KEY")

def reset_mfa():
    user_id = "69803ee5-3de4-4c0e-9602-46f18c3f87f5"
    headers = {
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}"
    }
    
    # Get factors
    r = requests.get(f"{SUPABASE_URL}/auth/v1/admin/users/{user_id}/factors", headers=headers)
    factors = r.json()
    print("Factors:", factors)
    
    for factor in factors:
        factor_id = factor["id"]
        # Delete factor
        print(f"Deleting factor {factor_id}...")
        del_r = requests.delete(f"{SUPABASE_URL}/auth/v1/admin/users/{user_id}/factors/{factor_id}", headers=headers)
        print("Delete response:", del_r.status_code, del_r.text)
        
if __name__ == "__main__":
    reset_mfa()
