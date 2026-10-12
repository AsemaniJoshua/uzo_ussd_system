#!/usr/bin/env python3
"""
High-Performance Bulk Whitelist Importer from TXT Files
=========================================================
Processes, cleans, deduplicates, and whitelists large contact lists
from multiple .txt files directly into the MySQL database.

Features:
- Fast multi-row bulk SQL inserts (2,000+ records per batch)
- Ghanaian phone number cleaning & normalization (233 / 0 / +233)
- Automatic network detection (MTN, Telecel, AT)
- Prevents database duplicates
- Optional SQL dump export (--export-sql)
- Runs on local machine or VPS

Usage:
    # 1. Run direct import using .env database connection:
    python import_txt_whitelist.py

    # 2. Specify a custom folder containing .txt files:
    python import_txt_whitelist.py --folder "/path/to/txt_folder"

    # 3. Specify custom database URL directly:
    python import_txt_whitelist.py --db-url "mysql+pymysql://user:pass@host:3306/dbname"

    # 4. Generate standalone .sql file without connecting to DB:
    python import_txt_whitelist.py --export-sql whitelist_contacts.sql
"""

import os
import sys
import glob
import re
import argparse
import time
from datetime import datetime
from decimal import Decimal
from pathlib import Path

# Fix Windows console encoding
if sys.platform == 'win32':
    os.system('chcp 65001 >nul 2>&1')
    try:
        sys.stdout.reconfigure(encoding='utf-8')
        sys.stderr.reconfigure(encoding='utf-8')
    except Exception:
        pass


def clean_phone_number(raw: str) -> str | None:
    """
    Clean and normalize Ghanaian phone numbers to standard 233XXXXXXXXX format.
    Returns normalized 12-digit string or None if invalid.
    """
    digits = re.sub(r'\D', '', str(raw).strip())
    if not digits:
        return None

    # Handle 10-digit local format: 0244123456 -> 233244123456
    if len(digits) == 10 and digits.startswith('0'):
        digits = '233' + digits[1:]
    # Handle 9-digit format without leading zero: 244123456 -> 233244123456
    elif len(digits) == 9:
        digits = '233' + digits
    # Handle standard 12-digit format with 233
    elif len(digits) == 12 and digits.startswith('233'):
        pass
    else:
        # Check if valid international number (10 to 15 digits)
        if len(digits) < 10 or len(digits) > 15:
            return None

    return digits


def detect_network(msisdn: str) -> str:
    """Detect Ghanaian telecom network from MSISDN prefix"""
    if len(msisdn) >= 5 and msisdn.startswith('233'):
        prefix = msisdn[:5]
        # MTN: 024, 054, 055, 053, 059, 025
        if prefix in ('23324', '23354', '23355', '23353', '23359', '23325'):
            return 'MTN'
        # Telecel (Vodafone): 020, 050
        elif prefix in ('23320', '23350'):
            return 'TELECEL'
        # AT (AirtelTigo): 026, 027, 057, 056
        elif prefix in ('23326', '23327', '23357', '23356'):
            return 'AT'
    return 'MTN'


def find_txt_files(folder_path: str | None = None) -> list[str]:
    """Find all .txt files in the given path or auto-detected locations"""
    candidates = []
    if folder_path and os.path.exists(folder_path):
        candidates.append(folder_path)

    # Standard locations
    win_download = r"C:\Users\JOSHUA ASEMANI\Downloads\txt"
    if os.path.exists(win_download):
        candidates.append(win_download)

    candidates.append(os.path.join(os.getcwd(), "txt"))
    candidates.append(os.getcwd())

    for c in candidates:
        if os.path.isdir(c):
            files = sorted(glob.glob(os.path.join(c, "*.txt")))
            if files:
                return files
        elif os.path.isfile(c) and c.endswith('.txt'):
            return [c]

    return []


def read_and_clean_contacts(txt_files: list[str]) -> tuple[dict[str, str], int, int]:
    """
    Stream-read all txt files, clean, validate, and deduplicate numbers.
    Returns:
        (unique_contacts_dict: {msisdn: network}, total_lines_read, invalid_count)
    """
    unique_contacts = {}  # msisdn -> network
    total_lines = 0
    invalid_count = 0

    print(f"\n📂 Reading {len(txt_files)} file(s)...")
    for f in txt_files:
        filename = os.path.basename(f)
        file_lines = 0
        file_valid = 0
        with open(f, 'r', encoding='utf-8', errors='ignore') as fp:
            for line in fp:
                total_lines += 1
                file_lines += 1
                clean = clean_phone_number(line)
                if clean:
                    if clean not in unique_contacts:
                        unique_contacts[clean] = detect_network(clean)
                    file_valid += 1
                else:
                    invalid_count += 1
        print(f"   ✓ {filename:25} : {file_lines:>8,d} lines -> {file_valid:>8,d} valid")

    return unique_contacts, total_lines, invalid_count


def generate_sql_dump(contacts: dict[str, str], output_file: str):
    """Generate a clean, fast multi-row SQL insert file"""
    timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    package_name = f"Whitelisted User - Import {datetime.now().strftime('%Y-%m-%d')}"
    
    print(f"\n📝 Writing SQL dump to: {output_file}...")
    batch_size = 2000
    contact_list = list(contacts.items())
    total = len(contact_list)

    with open(output_file, 'w', encoding='utf-8') as f:
        f.write("-- Bulk Whitelist Import SQL Script\n")
        f.write(f"-- Generated: {timestamp}\n")
        f.write(f"-- Total Contacts: {total:,d}\n\n")
        f.write("SET autocommit=0;\n")
        f.write("SET unique_checks=0;\n")
        f.write("SET foreign_key_checks=0;\n\n")

        for i in range(0, total, batch_size):
            batch = contact_list[i:i + batch_size]
            batch_num = (i // batch_size) + 1
            f.write(f"-- Batch {batch_num} ({len(batch)} records)\n")
            f.write("INSERT INTO served_requests (\n")
            f.write("    transaction_id, network, package_name, amount, recipient,\n")
            f.write("    processed_by, payment_reference, status, session_id, user_msisdn, served_at\n")
            f.write(") VALUES\n")

            rows = []
            for idx, (msisdn, net) in enumerate(batch):
                ref = f"WHITELIST_{int(time.time())}_{batch_num}_{idx}"
                sess = f"whitelist_sess_{batch_num}_{idx}"
                row_str = f"    (0, '{net}', '{package_name}', 0.00, '{msisdn}', 'SYSTEM_WHITELIST_IMPORT', '{ref}', 'PAID', '{sess}', '{msisdn}', '{timestamp}')"
                rows.append(row_str)

            f.write(",\n".join(rows))
            f.write(";\n\n")

        f.write("COMMIT;\n")
        f.write("SET unique_checks=1;\n")
        f.write("SET foreign_key_checks=1;\n")

    print(f"✅ SQL dump created successfully! ({os.path.getsize(output_file) / (1024*1024):.2f} MB)")
    print(f"👉 You can run this directly in MySQL via: mysql -u <user> -p <db_name> < {output_file}")


def get_database_url() -> str | None:
    """Retrieve DATABASE_URL from environment or .env file"""
    db_url = os.environ.get("DATABASE_URL")
    if db_url:
        return db_url

    # Check .env in current directory or parent directory
    env_paths = [".env", "../.env", "netservice-backend/.env"]
    for p in env_paths:
        if os.path.exists(p):
            with open(p, 'r', encoding='utf-8', errors='ignore') as f:
                for line in f:
                    line = line.strip()
                    if line.startswith("DATABASE_URL=") and not line.startswith("#"):
                        val = line.split("=", 1)[1].strip().strip('"').strip("'")
                        if val:
                            return val
    return None


def run_database_import(contacts: dict[str, str], db_url: str, batch_size: int = 2000):
    """Import contacts directly into MySQL using bulk multi-row inserts"""
    from sqlalchemy import create_engine, text

    # Convert async mysql URL to sync pymysql if needed
    sync_url = db_url.replace("mysql+aiomysql://", "mysql+pymysql://")
    if not sync_url.startswith("mysql"):
        sync_url = "mysql+pymysql://" + sync_url.split("://")[-1]

    print(f"\n🔌 Connecting to MySQL database...")
    engine = create_engine(sync_url, pool_pre_ping=True)

    with engine.connect() as conn:
        print("🔍 Checking existing whitelisted numbers in database...")
        existing_result = conn.execute(text("""
            SELECT user_msisdn FROM served_requests 
            WHERE status = 'PAID' AND user_msisdn IS NOT NULL
        """))
        existing_msisdns = {row[0] for row in existing_result if row[0]}
        print(f"   Found {len(existing_msisdns):,d} already whitelisted numbers in database.")

        # Filter out existing
        new_contacts = [(m, net) for m, net in contacts.items() if m not in existing_msisdns]
        duplicates_skipped = len(contacts) - len(new_contacts)
        print(f"   Skipping {duplicates_skipped:,d} duplicates already in database.")
        print(f"🚀 New contacts to insert: {len(new_contacts):,d}")

        if not new_contacts:
            print("✅ All contacts are already whitelisted! Nothing to insert.")
            return

        total = len(new_contacts)
        total_batches = (total + batch_size - 1) // batch_size
        timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        package_name = f"Whitelisted User - Import {datetime.now().strftime('%Y-%m-%d')}"
        inserted_total = 0
        start_time = time.time()

        print(f"\n📦 Inserting in {total_batches} batches of {batch_size} records...")

        for i in range(0, total, batch_size):
            batch = new_contacts[i:i + batch_size]
            batch_num = (i // batch_size) + 1

            # Build multi-row values
            values_clauses = []
            params = {}
            for idx, (msisdn, net) in enumerate(batch):
                p_prefix = f"b{idx}_"
                values_clauses.append(f"""
                    (0, :{p_prefix}net, :{p_prefix}pkg, 0.00, :{p_prefix}rec, 
                     'SYSTEM_WHITELIST_IMPORT', :{p_prefix}ref, 'PAID', :{p_prefix}sess, :{p_prefix}user, :{p_prefix}time)
                """)
                params[f"{p_prefix}net"] = net
                params[f"{p_prefix}pkg"] = package_name
                params[f"{p_prefix}rec"] = msisdn
                params[f"{p_prefix}ref"] = f"WHITELIST_{int(time.time())}_{batch_num}_{idx}"
                params[f"{p_prefix}sess"] = f"whitelist_sess_{batch_num}_{idx}"
                params[f"{p_prefix}user"] = msisdn
                params[f"{p_prefix}time"] = timestamp

            sql_stmt = f"""
                INSERT INTO served_requests (
                    transaction_id, network, package_name, amount, recipient,
                    processed_by, payment_reference, status, session_id, user_msisdn, served_at
                ) VALUES {', '.join(values_clauses)}
            """

            conn.execute(text(sql_stmt), params)
            conn.commit()
            inserted_total += len(batch)

            # Progress bar
            pct = (inserted_total / total) * 100
            elapsed = time.time() - start_time
            rate = inserted_total / elapsed if elapsed > 0 else 0
            sys.stdout.write(f"\r   [{'=' * int(pct // 4):25}] {pct:5.1f}% | {inserted_total:>8,d}/{total:,d} | {rate:6.0f} rec/sec")
            sys.stdout.flush()

        print(f"\n\n🎉 Successfully imported {inserted_total:,d} contacts into MySQL in {elapsed:.1f}s!")


def main():
    parser = argparse.ArgumentParser(description="Bulk Whitelist Importer from TXT files into MySQL")
    parser.add_argument("--folder", type=str, default=None, help="Directory containing .txt files")
    parser.add_argument("--db-url", type=str, default=None, help="MySQL Database connection URL")
    parser.add_argument("--batch-size", type=int, default=2000, help="Batch size for bulk insertion (default: 2000)")
    parser.add_argument("--export-sql", type=str, default=None, help="Export to a .sql file instead of direct DB insert")
    args = parser.parse_args()

    print("=" * 70)
    print("🔐 HIGH-PERFORMANCE TXT WHITELIST IMPORTER - NetService USSD")
    print("=" * 70)
    print(f"⏰ Start Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

    # 1. Locate TXT files
    txt_files = find_txt_files(args.folder)
    if not txt_files:
        print("\n❌ No .txt files found!")
        print("Please place the .txt files in a 'txt/' folder or pass --folder <path>")
        sys.exit(1)

    print(f"📁 Located {len(txt_files)} file(s).")

    # 2. Read and deduplicate contacts
    t0 = time.time()
    contacts, total_lines, invalid_count = read_and_clean_contacts(txt_files)
    t_read = time.time() - t0

    print("\n" + "=" * 70)
    print("📊 DATASET SUMMARY")
    print("=" * 70)
    print(f"  • Total raw lines read   : {total_lines:>10,d}")
    print(f"  • Invalid/empty lines    : {invalid_count:>10,d}")
    print(f"  • Unique valid contacts  : {len(contacts):>10,d}")
    print(f"  • Processing duration    : {t_read:>10.2f}s")
    print("=" * 70)

    # 3. Handle SQL dump export if requested
    if args.export_sql:
        generate_sql_dump(contacts, args.export_sql)
        return

    # 4. Handle direct database import
    db_url = args.db_url or get_database_url()
    if not db_url:
        print("\n⚠️  No DATABASE_URL found in environment or .env file.")
        print("Generating a ready-to-run SQL file instead: 'whitelist_contacts.sql'...")
        generate_sql_dump(contacts, "whitelist_contacts.sql")
        print("\n💡 To run direct database import later, either:")
        print("   1. Put your DATABASE_URL in .env, OR")
        print("   2. Run: python import_txt_whitelist.py --db-url \"mysql+pymysql://user:pass@host/db\"")
        print("   3. Run the generated SQL on MySQL: mysql -u user -p db < whitelist_contacts.sql")
        return

    try:
        run_database_import(contacts, db_url, batch_size=args.batch_size)
    except Exception as e:
        print(f"\n❌ Database import error: {e}")
        print("Generating a fallback SQL dump file: 'whitelist_contacts.sql'...")
        generate_sql_dump(contacts, "whitelist_contacts.sql")


if __name__ == "__main__":
    main()
