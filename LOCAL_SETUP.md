# BudgetWise - Local Setup Instructions

## Prerequisites

You'll need to install the following on your local machine:

1. **Node.js** (version 18 or higher)
   - Download from https://nodejs.org/
   - Verify installation: `node --version`

2. **PostgreSQL** (version 13 or higher)
   - **macOS**: `brew install postgresql`
   - **Windows**: Download from https://www.postgresql.org/download/windows/
   - **Linux**: `sudo apt install postgresql postgresql-contrib`

3. **Ollama** (for AI analysis)
   - Download from https://ollama.ai/
   - Install and run: `ollama pull llama2`

## Database Setup

### 1. Create PostgreSQL Database

```bash
# Start PostgreSQL service (if not running)
# macOS/Linux:
brew services start postgresql
# or
sudo systemctl start postgresql

# Connect to PostgreSQL
psql -U postgres

# Create database and user
CREATE DATABASE budgetwise;
CREATE USER budgetwise_user WITH PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE budgetwise TO budgetwise_user;
\q
```

### 2. Environment Variables

Create a `.env` file in the root directory with these settings:

```env
# Database Configuration
DATABASE_URL=postgresql://budgetwise_user:your_secure_password@localhost:5432/budgetwise
PGHOST=localhost
PGPORT=5432
PGUSER=budgetwise_user
PGPASSWORD=your_secure_password
PGDATABASE=budgetwise

# JWT Configuration
JWT_SECRET=your_super_secure_jwt_secret_key_here_make_it_long
JWT_EXPIRES_IN=7d

# MailerSend Configuration (for email verification)
MAILERSEND_API_KEY=your_mailersend_api_key_here
FROM_EMAIL=noreply@yourdomain.com
FROM_NAME=BudgetWise

# Ollama Configuration
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama2

# File Upload Configuration
UPLOADS_DIR=./uploads
MAX_FILE_SIZE=10485760

# Environment
NODE_ENV=development
```

## Installation & Running

### 1. Clone and Install Dependencies

```bash
# Navigate to project directory
cd budgetwise

# Install all dependencies
npm install
```

### 2. Database Migration

```bash
# Push database schema
npm run db:push
```

### 3. Create Test User (Optional)

Connect to your database and run:

```sql
INSERT INTO users (email, full_name, password, monthly_income, email_verified) 
VALUES (
  'test@budgetwise.com', 
  'Test User', 
  '$2b$12$SlVRmlzQjvbhTPYIkRoEk.DsFNJNeKwMh268wKFjtTFjiHI8dz3ji', 
  '5000', 
  true
);
```

Test credentials:
- **Email**: test@budgetwise.com
- **Password**: password123

### 4. Start the Application

```bash
# Start development server
npm run dev
```

The application will be available at: **http://localhost:5000**

## Configuration Files

### Database Configuration
- **File**: `server/db.ts`
- **Connection**: Uses DATABASE_URL environment variable
- **ORM**: Drizzle ORM with PostgreSQL

### Server Configuration
- **File**: `server/config.ts`
- **Environment Variables**: All external service configurations

### Database Schema
- **File**: `shared/schema.ts`
- **Tables**: users, budget_analyses, sessions

## External Services Setup

### 1. MailerSend (Email Verification)
1. Sign up at https://www.mailersend.com/
2. Create API key in dashboard
3. Add API key to `.env` file
4. Verify domain for sending emails

### 2. Ollama (AI Analysis)
```bash
# Make sure Ollama is running
ollama serve

# Pull required model
ollama pull llama2
```

## Production Build

```bash
# Build for production
npm run build

# Start production server
npm start
```

## Troubleshooting

### Common Issues:

1. **Database Connection Error**
   - Check PostgreSQL is running
   - Verify DATABASE_URL in `.env`
   - Ensure database and user exist

2. **Ollama Connection Error**
   - Start Ollama service: `ollama serve`
   - Check model is installed: `ollama list`

3. **File Upload Issues**
   - Ensure uploads directory exists
   - Check file permissions

4. **Email Verification Not Working**
   - Add valid MailerSend API key
   - Verify domain in MailerSend dashboard

### Database Commands:

```bash
# Reset database (if needed)
npm run db:push

# Check database connection
psql $DATABASE_URL -c "SELECT 1;"

# View tables
psql $DATABASE_URL -c "\dt"
```

## Development vs Production

- **Development**: Hot reloading with Vite
- **Production**: Optimized builds with esbuild
- **Database**: Same PostgreSQL setup for both
- **Files**: Local storage in `uploads/` directory

## Project Structure

```
budgetwise/
├── client/           # React frontend
├── server/           # Express backend
├── shared/           # Shared types/schemas
├── uploads/          # File storage
├── .env             # Environment variables
└── package.json     # Dependencies
```