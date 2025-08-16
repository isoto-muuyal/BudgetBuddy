# BudgetWise - Personal Finance Management App

## Overview

BudgetWise is a full-stack web application that helps users manage their personal finances using the popular 50/30/20 budgeting rule. The application allows users to upload bank statements (PDF or Excel files), which are then analyzed by AI to categorize expenses and provide personalized budgeting recommendations. Users can track their spending across three main categories: 50% for needs, 30% for wants, and 20% for savings.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React with TypeScript using Vite as the build tool
- **UI Components**: shadcn/ui component library built on Radix UI primitives
- **Styling**: Tailwind CSS with custom CSS variables for theming
- **State Management**: TanStack Query (React Query) for server state management
- **Routing**: Wouter for lightweight client-side routing
- **Form Handling**: React Hook Form with Zod validation

### Backend Architecture
- **Runtime**: Node.js with Express.js framework
- **Language**: TypeScript with ESM module system
- **Database ORM**: Drizzle ORM with PostgreSQL dialect
- **Authentication**: JWT-based authentication with bcrypt for password hashing
- **File Processing**: Multer for file uploads with support for PDF and Excel files
- **API Design**: RESTful API endpoints with proper error handling middleware

### Database Design
- **Primary Database**: PostgreSQL with Neon serverless hosting
- **Schema**: Two main tables - users and budget_analyses
- **User Management**: Email verification system with verification tokens
- **Data Storage**: JSON fields for storing expense arrays and analysis results

### Authentication & Authorization
- **Strategy**: JWT token-based authentication
- **Password Security**: Bcrypt with 12 salt rounds
- **Email Verification**: Token-based email verification system
- **Middleware**: Custom authentication middleware for protected routes

### AI Integration
- **Service**: Ollama for local AI model inference
- **Model**: Configurable model (default: llama2) for expense analysis
- **Processing**: Automated categorization of expenses into 50/30/20 budget categories
- **Analysis**: Generates personalized financial recommendations

### File Processing System
- **Supported Formats**: PDF and Excel (.xlsx, .xls) files
- **Upload Limits**: 10MB maximum file size
- **Processing Pipeline**: File upload → text extraction → AI analysis → database storage
- **Storage**: Local file system with configurable upload directory

### Development & Deployment
- **Build System**: Vite for frontend, esbuild for backend bundling
- **Development**: Hot module replacement with Vite dev server
- **Production**: Static file serving with Express in production mode
- **Environment**: Replit-optimized with runtime error overlay and cartographer integration

## External Dependencies

### Database & Storage
- **Neon Database**: Serverless PostgreSQL hosting
- **Drizzle Kit**: Database migrations and schema management

### AI & Machine Learning
- **Ollama**: Local AI model hosting and inference
- **PDF Parser**: pdf-parse library for PDF text extraction
- **Excel Parser**: xlsx library for spreadsheet processing

### Email Services
- **MailerSend**: Transactional email service for user verification
- **Email Templates**: Custom HTML email templates for verification

### UI & Styling
- **Radix UI**: Comprehensive component primitives
- **Tailwind CSS**: Utility-first CSS framework
- **Lucide React**: Icon library for consistent iconography
- **Class Variance Authority**: Component variant management

### Development Tools
- **TypeScript**: Static type checking across frontend and backend
- **Zod**: Schema validation for API endpoints and forms
- **TanStack Query**: Server state synchronization and caching
- **React Hook Form**: Form state management with validation

### Hosting & Deployment
- **Replit**: Primary hosting platform with integrated development environment
- **Environment Variables**: Configuration for database, email, and AI services