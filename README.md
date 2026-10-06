# ReferTrack — Hospital Reference (Referral) Management System

ReferTrack is a production-ready, three-tier Hospital Reference Management System built to facilitate patient registration, clinician referral creation, document attachment upload, real-time referral tracking, and role-based access control.

## System Architecture

- **Presentation Layer**: HTML5 + EJS templates utilizing a custom flat CSS design system (all classes prefixed with `href-`) and structural layouts optimized via Bootstrap 5 CDN.
- **Application Layer**: Node.js + Express.js backend. Core business logic (status transition checks, notification triggers, and transaction logging) is encapsulated in a dedicated file (`engine/hrefEngine.js`), isolated from the routing handlers.
- **Data Layer**: MySQL database storing patients, users, references, status logs, files metadata, and session trails. Built with parameterized queries to prevent SQL injection.

## Project Structure

```
├── .agents/                    # Auto-generated UI/UX skills
├── config/
│   └── db.js                   # Connection pooling and auto-schema creation
├── engine/
│   └── hrefEngine.js           # Core business and transactional logic
├── middleware/
│   └── auth.js                 # Authentication, role access, and HIPPA files access control
├── public/
│   ├── css/
│   │   └── style.css           # Prefixed flat CSS design system
│   └── js/
│   │   └── app.js              # Live patient lookup and notification drawer polling
├── routes/
│   ├── api/                    # JSON REST API routes (auth, patients, references, reports)
│   └── pages/                  # EJS page rendering routes
├── views/
│   ├── partials/               # Shared templates (header, footer, nav, sidebar)
│   ├── login.ejs               # Access portal
│   ├── dashboard_*.ejs         # Role-specific dashboard layouts
│   ├── patient_*.ejs           # Patient search and profile management
│   ├── reference_*.ejs         # Referral creation and audit details timeline
│   └── reports.ejs             # Administrator metrics and analytics
├── uploads/                    # Directory for uploaded clinical files
├── Dockerfile                  # Node image compiler
├── docker-compose.yml          # App & database service orchestrator
├── schema.sql                  # Database tables creation script
├── seed.sql                    # Initial testing data seeding script
├── server.js                   # Bootstrapping script
└── package.json                # Dependencies and run scripts
```

## Running the Application

### Method 1: Using Docker Compose (Recommended)

1. Ensure you have Docker and Docker Compose installed.
2. In the project root, build and start the services:
   ```bash
   docker-compose up --build
   ```
3. Docker will start the MySQL database and the Node app. The database container automatically runs `schema.sql` and `seed.sql` on startup.
4. The system will be online at [http://localhost:3000](http://localhost:3000).

### Method 2: Running Locally

1. Ensure you have Node.js (version 18+) and a MySQL server running locally.
2. Create a database named `refertrack_db`.
3. Create a `.env` file in the root directory matching your local MySQL credentials:
   ```env
   PORT=3000
   SESSION_SECRET=refertrack_secure_session_secret_12345
   DB_HOST=localhost
   DB_USER=root
   DB_PASSWORD=your_mysql_password
   DB_NAME=refertrack_db
   DB_PORT=3306
   ```
4. Install npm dependencies:
   ```bash
   npm install
   ```
5. Start the server (on startup, the app automatically creates schema tables and seeds them if they are missing):
   ```bash
   npm start
   ```
6. The system will be online at [http://localhost:3000](http://localhost:3000).

To apply the schema and load the sample data manually, run:

```bash
npm run seed
```

## Default Seeded Credentials

Use the following email addresses and the shared password **`password123`** to access the system under different roles:

| Role | User Name | Email Address | Department |
| :--- | :--- | :--- | :--- |
| **Administrator** | System Administrator | `admin@refertrack.com` | N/A |
| **Doctor** | Dr. Alice Smith | `alice.smith@refertrack.com` | General Medicine |
| **Doctor** | Dr. Bob Johnson | `bob.johnson@refertrack.com` | Pediatrics |
| **Receptionist** | Carol Davis | `carol.davis@refertrack.com` | N/A |
| **Specialist** | Dr. Charles Xavier | `charles.xavier@refertrack.com` | Cardiology |
| **Specialist** | Dr. Diana Prince | `diana.prince@refertrack.com` | Pediatrics |

## System Workflows for Verification

1. **Patient Registration**:
   - Log in as **Carol Davis** (Receptionist).
   - Go to **Register Patient**, enter details (e.g. John Doe, DOB 1985-05-15) and submit.
   - You can also look up patient records under **Patient Lookup**.
2. **Referral Submission**:
   - Log in as **Dr. Alice Smith** (Doctor).
   - Go to **Patient Lookup**, search for "John Doe" or select "Baby Timmy" and click **Refer Patient**.
   - Fill out the form (e.g., Destination Department: Cardiology), choose a clinical file attachment, and submit.
   - The status is set to `Pending` and a log is written to the audit trail. An in-app notification is routed to Cardiology.
3. **Incoming Referral Processing**:
   - Log in as **Dr. Charles Xavier** (Cardiology Specialist).
   - View the referral under **Incoming Referrals** on your dashboard.
   - Click **Review & Act** to view details, download the doctor's clinical upload, or upload progress files.
   - Click **Accept & Mark In Progress** or **Mark as Resolved**. The system updates the status and appends to the audit timeline. An in-app alert is dispatched back to Dr. Alice Smith.
4. **Hospital Analytics**:
   - Log in as **System Administrator**.
   - View total workload metric count cards.
   - Click **Workload & Turnaround Reports** in the sidebar.
   - View turnaround time metrics, workload volumes, pattern graphs, and download the full **CSV Spreadsheet**.
