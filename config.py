import os
from dotenv import load_dotenv # <-- Add this import
from supabase import create_client, Client

load_dotenv() # <-- Add this line to read the .env file

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    raise ValueError("Missing SUPABASE_URL or SUPABASE_KEY environment variables!")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)