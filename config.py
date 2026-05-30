import os
from supabase import create_client, Client

# Fetch environment variables (Set these up in Railway.app dashboard later)
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    raise ValueError("Missing SUPABASE_URL or SUPABASE_KEY environment variables!")

# Initialize the single database client used across the app
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)