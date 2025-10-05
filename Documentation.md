# Documentation for BudgetWise

## Architecture Overview

### What Architecture Pattern Is This?

This application follows a **Three-Tier Architecture** pattern, also known as **"Full-Stack MVC-like Architecture"** with clear separation of concerns. Think of it like a restaurant:

- **Client** = The dining area (what customers see and interact with)
- **Server** = The kitchen (where food is prepared and business logic happens)
- **Shared** = The menu (understood by both customers and kitchen staff)

### Why This Structure?

This separation makes the code:
- **Easier to understand** - Each folder has a clear purpose
- **Easier to maintain** - Fix frontend bugs without touching backend code
- **Easier to scale** - Multiple developers can work on different parts simultaneously
- **Reusable** - Share code between frontend and backend (types, schemas)

---

## Folder Structure Explained

### 📁 `client/` - The Frontend (What Users See)

This is everything that runs in the user's web browser.

**Key Folders:**
- `client/src/pages/` - Different screens of your app (login, dashboard, upload, etc.)
- `client/src/components/` - Reusable UI pieces (buttons, forms, cards)
- `client/src/lib/` - Helper functions and utilities for the frontend

**Think of it like:** The storefront of a shop - the displays, the checkout counter, the signs.

---

### 📁 `shared/` - The Contract (Agreed Upon Rules)

Code that BOTH frontend and backend need to understand.

**Main File:**
- `shared/schema.ts` - Defines what data looks like (user structure, validation rules)

**Why it's shared:**
Imagine you order a pizza:
- **You (client)** need to know what toppings are valid
- **The kitchen (server)** needs to know what toppings to put on

Instead of writing these rules twice, you write them once in `shared/` and both sides use them.

**Think of it like:** A contract or instruction manual that both parties follow.

---

### 📁 `server/` - The Backend (The Brain)

This is everything that runs on the server (not in the browser).

**Key Folders & Files:**

#### `server/routes.ts` - The Reception Desk
- **What it does:** Receives requests from the frontend and directs them to the right place
- **Example:** When you click "Login", the request goes to `/api/auth/login` route
- **Analogy:** Like a receptionist who says "Login requests? Go to the authentication service"

#### `server/storage.ts` - The Database Manager
- **What it does:** All code that talks to the database (save, read, update, delete data)
- **Why separate?** If you change databases later, you only update this file
- **Analogy:** The filing cabinet manager - knows where everything is stored

#### `server/services/` - The Specialists
Each service handles one specific job:
- `auth.ts` - Handles login, signup, password resets (the security guard)
- `email.ts` - Sends emails (the mail carrier)
- `ai-analysis.ts` - Analyzes expenses with AI (the accountant)

**Why services?** Keeps routes.ts clean. Routes just say "do this", services do the actual work.

#### `server/middleware/` - The Security Checkpoints
- **What it does:** Checks things BEFORE processing requests
- `auth.ts` - Verifies you're logged in before accessing protected pages
- **Analogy:** Bouncers at a club checking IDs before letting you in

---

## Core Components Deep Dive

### 🗂️ `schema.ts` - The Blueprint

**What is it?**
Defines the structure of your data and validation rules.

**Example:**
```typescript
// This says: "A user MUST have these fields with these rules"
export const users = pgTable("users", {
  id: serial("id").primaryKey(),           // Unique ID number
  email: varchar("email", { length: 255 }), // Email (max 255 characters)
  password: text("password"),               // Password (hashed)
  fullName: varchar("full_name", { length: 255 })
});
```

**Student Explanation:**
Think of it like a form template. Before saving a user to the database, we check:
- ✅ Does it have an email?
- ✅ Is the email valid format?
- ✅ Is the password long enough?

If anything fails, we reject it BEFORE it reaches the database.

---

### 🚦 `routes.ts` - The Traffic Director

**What is it?**
Maps URLs to functions that handle them.

**Example:**
```typescript
app.post("/api/auth/login", async (req, res) => {
  const data = loginSchema.parse(req.body);    // Validate
  const result = await authService.login(data); // Process
  res.json(result);                             // Respond
});
```

**Flow:**
1. User clicks "Login" button
2. Frontend sends data to `/api/auth/login`
3. Route validates data with schema
4. Route calls authService to do the work
5. Route sends response back to frontend

**Student Explanation:**
Routes are like a switchboard operator. When a call (request) comes in, they check what the caller wants and connect them to the right department (service).

---

### 💾 `storage.ts` - The Database Interface

**What is it?**
A layer between your business logic and the actual database.

**Why not use database directly in routes?**

**Bad approach:**
```typescript
// In routes.ts - MESSY!
app.post("/api/users", async (req, res) => {
  await db.insert(users).values(req.body); // Database code mixed with route
});
```

**Good approach:**
```typescript
// In routes.ts - CLEAN!
app.post("/api/users", async (req, res) => {
  await storage.createUser(req.body); // Simple, readable
});

// In storage.ts - Database details hidden here
async createUser(data: NewUser) {
  return await db.insert(users).values(data);
}
```

**Benefits:**
- Routes stay simple and readable
- If you switch databases, only update storage.ts
- Easy to test (can mock storage)

**Student Explanation:**
Storage is like a librarian. You don't need to know the Dewey Decimal System - just ask the librarian "get me the book about X" and they handle the details.

---

## Request Flow Example

Let's trace what happens when you click "Login":

```
1. USER CLICKS LOGIN BUTTON
   ↓
2. FRONTEND (client/pages/login.tsx)
   - Validates form with Zod schema
   - Sends POST request to /api/auth/login
   ↓
3. ROUTE (server/routes.ts)
   - Receives request
   - Validates data with loginSchema (shared/schema.ts)
   - Calls authService.login()
   ↓
4. SERVICE (server/services/auth.ts)
   - Checks business logic
   - Calls storage.getUserByEmail()
   ↓
5. STORAGE (server/storage.ts)
   - Queries database
   - Returns user data
   ↓
6. BACK UP THE CHAIN
   - Storage → Service → Route → Frontend
   - Each layer processes and returns result
   ↓
7. FRONTEND UPDATES
   - Shows success/error message
   - Redirects to dashboard
```

---

## Important Libraries Reference

### 🎨 **Frontend Libraries**

| Library | What It Does | Why We Use It |
|---------|-------------|---------------|
| **React** | UI framework | Builds interactive user interfaces with components |
| **TypeScript** | JavaScript with types | Catches errors before code runs, like spell-check for code |
| **Wouter** | Routing library | Handles navigation between pages (lightweight alternative to React Router) |
| **TanStack Query** | Data fetching | Manages server data, caching, and automatic refetching |
| **React Hook Form** | Form management | Handles form state and validation efficiently |
| **Zod** | Data validation | Ensures data has the right shape before processing |
| **Tailwind CSS** | Styling framework | Write CSS using utility classes (bg-blue-500 instead of custom CSS) |
| **shadcn/ui** | Component library | Pre-built, accessible UI components (buttons, dialogs, forms) |
| **Lucide React** | Icon library | Provides consistent, beautiful icons |

### ⚙️ **Backend Libraries**

| Library | What It Does | Why We Use It |
|---------|-------------|---------------|
| **Express** | Web server framework | Handles HTTP requests and routing |
| **Drizzle ORM** | Database toolkit | Talk to PostgreSQL without writing raw SQL |
| **Bcrypt** | Password hashing | Securely encrypt passwords (can't be reversed) |
| **JWT (jsonwebtoken)** | Authentication tokens | Create secure tokens to verify user identity |
| **Multer** | File upload handler | Process file uploads (bank statements) |
| **MailerSend** | Email service | Send verification and password reset emails |
| **pdf-parse** | PDF reader | Extract text from PDF bank statements |
| **xlsx** | Excel reader | Extract data from Excel spreadsheets |

### 🔗 **Shared/Utility Libraries**

| Library | What It Does | Why We Use It |
|---------|-------------|---------------|
| **Zod** | Schema validation | Shared validation rules between frontend and backend |
| **Drizzle-Zod** | Schema to validation | Auto-generate Zod schemas from database schemas |
| **nanoid** | ID generation | Create short, unique IDs (alternative to UUID) |

### 🗄️ **Database**

| Technology | What It Does | Why We Use It |
|-----------|-------------|---------------|
| **PostgreSQL** | Database system | Reliable, powerful database for storing user and analysis data |
| **Neon** | Serverless Postgres | PostgreSQL hosting that scales automatically |

---

## Key Concepts Explained Simply

### 🔐 Middleware
**What:** Code that runs BEFORE your route handler

**Example:**
```typescript
// This middleware runs before protected routes
app.get("/api/user/profile", authMiddleware, async (req, res) => {
  // Only runs if authMiddleware approves
});
```

**Real-world analogy:** Security checkpoint at an airport. Everyone passes through before boarding.

---

### 📊 ORM (Drizzle)
**What:** Object-Relational Mapping - talk to database using JavaScript instead of SQL

**Without ORM (raw SQL):**
```sql
SELECT * FROM users WHERE email = 'user@example.com';
```

**With ORM (Drizzle):**
```typescript
await db.select().from(users).where(eq(users.email, 'user@example.com'));
```

**Benefit:** Easier to write, catches errors, works across different databases.

---

### ✅ Schema Validation
**What:** Checking data matches expected format before processing

**Example:**
```typescript
const emailSchema = z.string().email();

emailSchema.parse("user@example.com"); // ✅ Pass
emailSchema.parse("not-an-email");     // ❌ Throws error
```

**Real-world analogy:** Quality control inspector - rejects defective products.

---

### 🔄 API Request/Response
**What:** Frontend asks for data, backend responds

**Request:**
```typescript
// Frontend sends
POST /api/auth/login
Body: { email: "user@example.com", password: "secret123" }
```

**Response:**
```typescript
// Backend sends back
{ token: "abc123...", user: { id: 1, email: "user@example.com" } }
```

---

## Development Workflow

### When You Need to Add a New Feature:

1. **Define Data Structure** (`shared/schema.ts`)
   - What does this data look like?
   - What are the validation rules?

2. **Update Storage** (`server/storage.ts`)
   - How do we save/load this data?

3. **Create Service** (`server/services/`)
   - What business logic is needed?

4. **Add Routes** (`server/routes.ts`)
   - What URL endpoints do we need?

5. **Build Frontend** (`client/src/pages/`)
   - What does the user see?
   - How do they interact with it?

### Example: Adding "Export to Excel" Feature

1. **Schema:** Define export data structure
2. **Storage:** Create method to fetch analysis data
3. **Service:** Create ExcelService to format data
4. **Route:** Add `GET /api/analysis/:id/export`
5. **Frontend:** Add "Export" button that calls the route

---

## Common Patterns

### Pattern 1: Protected Routes
```typescript
// Route that requires login
app.get("/api/protected", authMiddleware, async (req, res) => {
  // req.userId is available because authMiddleware set it
});
```

### Pattern 2: Error Handling
```typescript
app.post("/api/something", async (req, res) => {
  try {
    const data = schema.parse(req.body);
    const result = await service.doSomething(data);
    res.json(result);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});
```

### Pattern 3: Data Fetching (Frontend)
```typescript
const { data, isLoading } = useQuery({
  queryKey: ['/api/users'],
  // Automatically fetches and caches
});

if (isLoading) return <div>Loading...</div>;
return <div>{data.name}</div>;
```

---

## Tips for Understanding the Code

### 1. Start with the Flow
- Find a feature you understand (like login)
- Trace it from button click → route → service → storage → database
- Once you see the pattern, everything else follows it

### 2. Read the Schema First
- `shared/schema.ts` tells you what data exists
- Understanding data structure helps understand everything else

### 3. Routes Are the Map
- `server/routes.ts` shows all available endpoints
- Like a table of contents for the API

### 4. Services Contain the Logic
- Routes are simple (just receive and respond)
- Services contain the actual business logic
- Start here when fixing bugs

### 5. Frontend Pages Are Entry Points
- Each page in `client/src/pages/` is a complete feature
- Good place to start understanding user workflows

---

## Glossary

| Term | Simple Explanation |
|------|-------------------|
| **API** | A way for frontend and backend to talk (like a waiter taking orders to kitchen) |
| **Endpoint** | A specific URL path like `/api/auth/login` |
| **Middleware** | Code that runs between receiving request and handling it |
| **ORM** | Tool to talk to database using code instead of SQL |
| **Schema** | Rules defining what data should look like |
| **Route** | Function that handles requests to a specific URL |
| **Service** | Module that handles specific business logic |
| **Storage** | Layer that manages database operations |
| **Validation** | Checking if data meets requirements before processing |
| **Token** | A secure string that proves who you are (like a ticket) |
| **Hash** | One-way encryption (can't be reversed) |

---

## Need Help?

### Understanding a File?
1. Look at the imports - tells you what it depends on
2. Look at the exports - tells you what it provides
3. Read the function names - usually descriptive

### Understanding a Feature?
1. Find the frontend page (client/src/pages/)
2. Find the route it calls (server/routes.ts)
3. Follow the chain: route → service → storage

### Finding Where Something Happens?
1. Search for the text/error message
2. Search for the URL endpoint
3. Search for the function name

---

## Summary

This architecture separates concerns into:
- **Client** - What users see (React, Tailwind, shadcn)
- **Server** - Business logic (Express, Services, Routes)
- **Shared** - Common definitions (Schemas, Types)
- **Storage** - Database operations (Drizzle ORM)

Each layer has a clear job, making the code organized, maintainable, and easy to understand once you see the pattern.

**Remember:** Every feature follows the same flow. Once you understand one feature completely, you understand the architecture!
