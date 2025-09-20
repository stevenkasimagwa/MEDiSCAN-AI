Migration instructions
----------------------

This folder contains SQL migrations and a small runner script for the `main-api` service.

Files:
- `0001_add_bp_weight.sql` - Adds `blood_pressure` and `weight` columns to `medical_records`.
- `run_migrations.py` - Simple Python runner that checks `information_schema` and applies missing ALTER TABLE statements.

How to run (PowerShell):

1. Ensure Python and the `pymysql` package are available in your environment.
   You can install pymysql with:
     python -m pip install pymysql

2. Set DB environment variables or ensure defaults are correct.
   Example:
     $env:MYSQL_HOST = '127.0.0.1'; $env:MYSQL_USER='root'; $env:MYSQL_PASSWORD='yourpass'; $env:MYSQL_DB='meddigitize'

3. Run the migration runner from this directory:
     python run_migrations.py

4. Verify the table now has the new columns.

Notes:
- Always backup your database before applying schema changes in production.
- This runner is intentionally simple and safe for one-off local migrations. For production workflows consider using a proper migration tool (Alembic, Flyway, Liquibase, etc.).
