import os
from dotenv import load_dotenv
# Make sure "create_client" is explicitly named here!
from supabase import create_client, Client

load_dotenv() 

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    raise ValueError("Missing SUPABASE_URL or SUPABASE_KEY environment variables!")

# This will now execute perfectly
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)