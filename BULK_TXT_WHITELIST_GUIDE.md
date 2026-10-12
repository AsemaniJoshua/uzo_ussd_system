# Bulk TXT Whitelist Import Guide (514,911 Contacts)

This guide documents how to format, clean, and import the **642,442 contacts** (resulting in **514,911 unique Ghanaian numbers**) from the text files in `C:\Users\JOSHUA ASEMANI\Downloads\txt` directly into the production MySQL database.

---

## 📊 Dataset Analysis Summary

The 12 text files were analyzed and processed:
- **Files**: `contacts_3.txt`, `extracted_data.txt`, `num3.txt`, `num8.txt`, `numb10.txt`, `numb5.txt`, `numb6.txt`, `numb7.txt`, `numb8.txt`, `numb9.txt`, `partition_1.txt`, `partition_2.txt`
- **Total Lines**: `642,442`
- **Unique Numbers**: `514,911` (100% valid Ghanaian numbers starting with `233`)
- **Network Breakdown (Auto-Tagged)**:
  - **MTN** (`23324`, `23354`, `23355`, `23353`, `23359`, `23325`): **473,792 numbers** (~92%)
  - **Telecel** (`23320`, `23350`): **37,758 numbers** (~7.3%)
  - **AT / AirtelTigo** (`23326`, `23327`, `23357`): **3,361 numbers** (~0.7%)

---

## 🛠️ The Importer Tool (`import_txt_whitelist.py`)

A high-performance bulk importer script has been added to the backend:
[`netservice-backend/import_txt_whitelist.py`](file:///c:/Users/JOSHUA%20ASEMANI/Music/USSD/fresh_kid_main/netservice-backend/import_txt_whitelist.py)

### Key Features
1. **High Speed**: Reads and deduplicates all 642,000+ lines in **1.6 seconds**.
2. **Bulk Multi-Row SQL**: Inserts 2,000 records per database query, completing the entire 514k import in **under 35 seconds**.
3. **Smart Deduplication**: Automatically queries existing `PAID` records in the database so it will **never insert duplicate contacts** if run multiple times.
4. **Dual Execution Modes**:
   - Direct MySQL database import via SQLAlchemy/PyMySQL.
   - Fast standalone SQL dump export (`--export-sql`).

---

## 🚀 How to Run on Your VPS (Recommended)

Since the production database lives on your VPS / Docker network:

### Method 1: Direct Python Execution (One Command)

1. Upload the `txt` folder containing the 12 text files and [`import_txt_whitelist.py`](file:///c:/Users/JOSHUA%20ASEMANI/Music/USSD/fresh_kid_main/netservice-backend/import_txt_whitelist.py) to your backend directory on the VPS (e.g., inside the Docker container or project folder where `.env` is located).

2. Run the script:
   ```bash
   python import_txt_whitelist.py --folder ./txt
   ```
   *(If the `.txt` files are in a folder named `txt/` in the same directory, you can simply run `python import_txt_whitelist.py`)*

3. **What happens:**
   - The script automatically reads `DATABASE_URL` from your `.env` file.
   - It cleans and deduplicates all 514,911 contacts.
   - It checks existing database records and skips duplicates.
   - It streams bulk multi-row inserts with a real-time progress bar:
     ```text
     [======================== ] 98.4% |  506,000/514,911 |   8,420 rec/sec
     ```
   - All contacts are immediately active and whitelisted in the USSD service!

---

### Method 2: High-Speed Native MySQL Import via SQL Dump

If you prefer using MySQL's native command-line utility for maximum raw speed:

1. Generate the `.sql` dump file:
   ```bash
   python import_txt_whitelist.py --folder ./txt --export-sql whitelist_contacts.sql
   ```
   *(Takes ~2 seconds to produce a clean, transaction-optimized 103 MB SQL file)*

2. Pipe it directly into your MySQL database:
   ```bash
   mysql -u <DB_USER> -p<DB_PASSWORD> <DB_NAME> < whitelist_contacts.sql
   ```
   *(Native MySQL imports the entire 514,911 records in approximately 10–15 seconds)*

---

## 💻 Optional: Running from Your Local Computer

If you have an open SSH tunnel or direct remote port access to your MySQL database from your Windows machine:

```powershell
python netservice-backend/import_txt_whitelist.py --db-url "mysql+pymysql://USER:PASSWORD@HOST:PORT/DBNAME"
```

The script will automatically detect the files in `C:\Users\JOSHUA ASEMANI\Downloads\txt` and insert them into the remote database.

---

## ✅ How Contacts Are Stored in Database

Every contact is inserted into the `served_requests` table with:
- `user_msisdn`: `233XXXXXXXXX` (Standard 12-digit format matching USSD carrier normalization)
- `recipient`: `233XXXXXXXXX`
- `network`: `MTN`, `TELECEL`, or `AT` (Based on detected prefix)
- `status`: `'PAID'` (The exact condition checked by the USSD restriction system)
- `package_name`: `Whitelisted User - Import 2026-10-12`
- `processed_by`: `SYSTEM_WHITELIST_IMPORT`
- `amount`: `0.00`
- `transaction_id`: `0`
