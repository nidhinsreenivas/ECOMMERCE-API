# E-Commerce REST API

A RESTful E-Commerce backend built with **Node.js, Express.js, MongoDB and Mongoose**.

The API supports customer authentication, admin management, unlimited-depth product categories, product management, order processing and inventory management.

## Features

- JWT authentication and role-based authorization (Admin and Customer).
- Secure password hashing using bcrypt.
- Customer profile management and admin user controls.
- Unlimited-depth nested categories with circular-reference prevention.
- Product CRUD, unique SKU validation, search and filtering.
- Sorting and pagination.
- Automatic order total calculation on the backend.
- Stock validation, atomic updates and MongoDB transactions.
- Customer order privacy and admin order management.
- Centralized error handling and request validation.
- Helmet, CORS, rate limiting and request logging.

## Technology Stack

| Technology | Purpose |
|---|---|
| Node.js | Runtime |
| Express.js | REST API |
| MongoDB | Database |
| Mongoose | Database modelling |
| JWT | Authentication |
| bcryptjs | Password hashing |
| Zod | Request validation |
| Docker | MongoDB setup |
| Jest & Supertest | API testing |

## Project Structure

```text
ecommerce-api/
├── scripts/
│   └── createAdmin.js
├── src/
│   ├── config/
│   ├── middleware/
│   ├── models/
│   ├── modules/
│   │   ├── auth/
│   │   ├── users/
│   │   ├── admin/
│   │   ├── categories/
│   │   ├── products/
│   │   └── orders/
│   ├── app.js
│   └── server.js
├── tests/
│   ├── auth.test.js
│   ├── categories.test.js
│   ├── product.test.js
│   └── orders.test.js
├── scripts/
├── .env.example
├── .gitignore
├── docker-compose.yml
├── package.json
└── README.md
```

## Installation and Setup

### Prerequisites

- Node.js 20 or later
- npm
- Docker Desktop

### 1. Clone the repository

```bash
git clone https://github.com/nidhinsreenivas/ECOMMERCE-API
cd ecommerce-api
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Create a `.env` file in the project root using `.env.example` as a reference.

```env
PORT=5000
NODE_ENV=development

MONGODB_URI=mongodb://127.0.0.1:27018/ecommerce?directConnection=true

JWT_SECRET=your_long_random_secret
JWT_EXPIRES_IN=1d

CLIENT_URL=http://localhost:5173

ADMIN_NAME=System Administrator
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=your_strong_password
```

Use your own strong credentials. Never commit `.env` to Git.

### 4. Start MongoDB

```bash
docker compose up -d
```

The MongoDB deployment must support replica-set transactions for order creation and cancellation.

### 5. Create the administrator

```bash
npm run seed:admin
```

### 6. Start the API

Development:

```bash
npm run dev
```

Production:

```bash
npm start
```

**Base URL:** `http://localhost:5000`

**API Base URL:** `http://localhost:5000/api`

Health check: `GET /api/health`

## API Endpoints

All protected endpoints require:

```http
Authorization: Bearer YOUR_JWT_TOKEN
```

### Authentication

| Method | Endpoint | Access |
|---|---|---|
| POST | `/auth/register` | Public |
| POST | `/auth/login` | Public |

### User Profile

| Method | Endpoint | Access |
|---|---|---|
| GET | `/users/profile` | Authenticated |
| PUT | `/users/profile` | Authenticated |

### Admin and User Management

| Method | Endpoint | Access |
|---|---|---|
| GET | `/admin/users` | Admin |
| GET | `/admin/users/:id` | Admin |
| PATCH | `/admin/users/:id/status` | Admin |

### Categories

| Method | Endpoint | Access |
|---|---|---|
| GET | `/categories` | Public |
| GET | `/categories/tree` | Public |
| GET | `/categories/:id` | Public |
| POST | `/categories` | Admin |
| PATCH | `/categories/:id` | Admin |
| DELETE | `/categories/:id` | Admin |

### Products

| Method | Endpoint | Access |
|---|---|---|
| GET | `/products` | Public |
| GET | `/products/:id` | Public |
| POST | `/products` | Admin |
| PATCH | `/products/:id` | Admin |
| DELETE | `/products/:id` | Admin |

**Product listing query parameters:**

| Parameter | Purpose |
|---|---|
| `search` | Search product name, SKU or description |
| `category` | Filter by category, including descendants |
| `minPrice` | Minimum effective price |
| `maxPrice` | Maximum effective price |
| `sort` | `newest`, `oldest`, `price_asc`, `price_desc`, `name_asc`, `name_desc` |
| `page` | Page number |
| `limit` | Results per page (maximum 100) |

Example:

```http
GET /api/products?search=phone&minPrice=10000&maxPrice=60000&sort=price_asc&page=1&limit=10
```

### Orders

| Method | Endpoint | Access |
|---|---|---|
| POST | `/orders` | Authenticated |
| GET | `/orders/my-orders` | Customer |
| GET | `/orders/my-orders/:id` | Customer |
| GET | `/orders` | Admin |
| PATCH | `/orders/:id/status` | Admin |

Admin order listing supports status filtering, order ID search, sorting and pagination.

## Example: Place an Order

```http
POST /api/orders
Authorization: Bearer CUSTOMER_TOKEN
Content-Type: application/json
```

```json
{
  "items": [
    {
      "product": "PRODUCT_OBJECT_ID",
      "quantity": 2
    }
  ],
  "shippingAddress": {
    "fullName": "Test Customer",
    "phone": "9876543210",
    "addressLine": "123 Main Street",
    "city": "Kochi",
    "state": "Kerala",
    "postalCode": "682001",
    "country": "India"
  }
}
```

The backend retrieves product prices, calculates the total, checks stock and creates the order. Customers cannot submit their own prices or order totals.

## Order Status

Supported statuses:

- `pending`
- `confirmed`
- `processing`
- `shipped`
- `delivered`
- `cancelled`

Order status transitions are validated. Cancelling an eligible order restores product stock through a database transaction.

## Error Handling

The API uses centralized error handling and consistent JSON responses.

Example:

```json
{
  "success": false,
  "message": "Product not found"
}
```

| HTTP Status | Meaning |
|---|---|
| 200 | Success |
| 201 | Resource created |
| 400 | Validation error or invalid request |
| 401 | Authentication required |
| 403 | Permission denied |
| 404 | Resource not found |
| 409 | Duplicate or conflicting resource |
| 500 | Internal server error |

## Automated Testing

The project uses **Jest, Supertest and MongoDB Memory Server** for automated API testing.

Run all tests:

```bash
npm test
```

Run tests in watch mode:

```bash
npm run test:watch
```

### Test Results

**41 tests passed across 4 test suites.**

| Test Suite | Main Test Coverage |
|---|---|
| `auth.test.js` | Registration, login, authentication and authorization |
| `categories.test.js` | Category CRUD, hierarchy and circular-reference prevention |
| `product.test.js` | Product CRUD, validation, filtering, sorting and pagination |
| `orders.test.js` | Order creation, pricing, stock handling, privacy and status updates |

### Important Scenarios Tested

- Duplicate email and invalid login.
- Protected routes and role permissions.
- Admin activation and last-admin protection.
- Nested categories and invalid parent relationships.
- Duplicate SKU and invalid sale price.
- Product search, category filtering and pagination.
- Order price calculation and insufficient stock.
- Duplicate order items and stock deduction.
- Customer order ownership and privacy.
- Order cancellation and stock restoration.
- Invalid order status transitions.

## Important Implementation Notes

- Customers can only access their own orders.
- Only administrators can manage products, categories and other users.
- Product prices and order totals are calculated on the server.
- MongoDB transactions protect order and inventory operations.
- Database indexes support important search and query operations.
- Environment variables keep sensitive configuration outside source code.

## Author

**Nidhin Sreenivas**

E-Commerce REST API — Node.js Developer Machine Test
