                            MEDISCAN AI                           

MeDiScan AI is an innovative solution designed to digitize paper-based medical records using Artificial Intelligence. It leverages OCR (Optical Character Recognition) and Natural Language Processing (NLP) to extract, organize, and securely store patient data in a digital database.

*                     THIS IS AN OFFLINE VERSION                        *


1. System Design
Core Features 
Scanning & OCR – Convert handwritten/typed paper records into digital text. 
AI Data Cleaning & Structuring – NLP models classify and extract fields like Patient Name, Age, Diagnosis, Prescription, Lab Results. 
Electronic Medical Record (EMR) System – Database to store, search, and update records. 
Search & Retrieval – Doctors can type patient name/ID and instantly view their medical history. 
Analytics Dashboard – Showing trends like most common illnesses, drug prescriptions, patient demographics. 
Security – Encrypted storage + access control for different user roles (doctor, nurse, patient).


2. Technology Stack Used;
FrontEnd:
React.js
HTML
CSS (TailWind)
Security: Role-based access + SSL encryption.


Backend:
Mysql
Node.js
Tesseract 
Python
TypeScript
Spacy AI

+ GITHUB COPILOT  :)

# Offline Medical Record System

This application an offline setup using local MySQL database and Tesseract OCR.

## Backend Requirements

You need to set up a local backend server that provides the following endpoints:

### API Endpoints

#### Authentication
- `POST /api/auth/signin` - Sign in with username and password
- `POST /api/auth/signup` - Create new user account  
- `GET /api/auth/me` - Get current user info

#### Medical Records
- `GET /api/medical-records` - Get all records for current user
- `POST /api/medical-records` - Create new medical record
- `PUT /api/medical-records/:id` - Update medical record
- `DELETE /api/medical-records/:id` - Delete medical record

#### Doctor Management (Admin)
- `GET /api/doctors` - Get all doctor profiles
- `POST /api/doctors` - Create new doctor profile
- `PUT /api/doctors/:id` - Update doctor profile
- `DELETE /api/doctors/:id` - Delete doctor profile

#### File Upload
- `POST /api/upload` - Upload image file

#### Audit Logs
- `GET /api/audit-logs` - Get audit logs
- `POST /api/audit-logs` - Create audit log entry

### OCR Service Endpoints

Set up a separate OCR service (port 3002) with:

- `POST /api/ocr/extract-text` - Extract text from image using Tesseract
- `POST /api/ocr/extract-fields` - Extract structured fields from text

## Configuration

Update the API URLs in:
- `src/services/apiService.ts` - Main API service (default: http://localhost:3001/api)
- `src/services/localOCRService.ts` - OCR service (default: http://localhost:3002/api)

## Database Schema

Your MySQL database should have tables for:
- users (authentication)
- medical_records (patient data)
- audit_logs (activity tracking)

The API service interfaces are defined in `src/services/apiService.ts` for reference.


