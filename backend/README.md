# Project 404 Backend (Aza)

A robust, secure, and scalable Spring Boot backend for the Aza fintech application. This service handles user authentication, KYC processing, wallet transactions, contact management, and more.

## 🚀 Technologies

- **Java 21**: Core programming language.
- **Spring Boot 4.0.6**: Application framework.
- **Spring Security & JWT**: For secure authentication and authorization.
- **PostgreSQL**: Primary relational database for persistent storage.
- **Redis**: High-performance caching and rate limiting.
- **Cloudinary**: Profile image management and storage.
- **Arkesel & Gmail SMTP**: SMS and Email notification services.
- **SpringDoc OpenAPI (Swagger)**: Automated API documentation.
- **Lombok**: Reducing boilerplate code.

## 🛠️ Prerequisites

Before you begin, ensure you have the following installed:
- [JDK 21](https://www.oracle.com/java/technologies/downloads/#java21)
- [Maven 3.x](https://maven.apache.org/download.cgi)
- [Docker](https://www.docker.com/products/docker-desktop/) (optional, for Redis/Postgres)
- [PostgreSQL](https://www.postgresql.org/download/)
- [Redis](https://redis.io/download/)

## ⚙️ Configuration

1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd backend
   ```

2. **Set up Environment Variables**:
   Copy the `.env.example` file to `.env` and fill in your credentials:
   ```bash
   cp .env.example .env
   ```
   Required variables include:
   - `ARKESEL_API_KEY`: For SMS notifications.
   - `GMAIL_APP_PASSWORD`: For email services.
   - `JWT_SECRET`: A secure key (at least 64 characters).
   - `DB_URL`, `DB_USERNAME`, `DB_PASSWORD`: PostgreSQL connection details.
   - `REDIS_HOST`, `REDIS_PORT`: Redis connection details.
   - `CLOUDINARY_*`: Cloudinary credentials for image uploads.

## 🏃 Running the Application

### Using Maven
To start the application locally:
```bash
./mvnw spring-boot:run
```

### Using Docker (Optional)
If you want to run the database and Redis using Docker:
```bash
docker-compose up -d
```

## 📖 API Documentation

Once the application is running, you can access the interactive Swagger UI at:
`http://localhost:8080/swagger-ui/index.html`

## 📂 Project Structure

- `com.aza.backend.controller`: REST API endpoints.
- `com.aza.backend.service`: Business logic implementation.
- `com.aza.backend.repository`: Database access layer (Spring Data JPA).
- `com.aza.backend.entity`: JPA entities (User, Wallet, Transaction, etc.).
- `com.aza.backend.dto`: Data Transfer Objects for API requests/responses.
- `com.aza.backend.security`: Security configuration and JWT utilities.
- `com.aza.backend.config`: General configuration (Redis, SpringDoc, etc.).

## ✨ Core Features

- **Authentication**: Secure login/signup with OTP verification and passcode support.
- **Wallet & Transactions**: peer-to-peer transfers, money requests, and transaction history.
- **KYC Processing**: Identity verification and compliance checks (PEP, Source of Funds).
- **Contact Management**: Sync and manage contacts for easier transfers.
- **Profile Management**: Update user information, privacy settings, and profile images.
- **Rate Limiting**: Built-in protection against brute-force and spam using Redis.

## 🤝 Contributing

1. Fork the project.
2. Create your feature branch (`git checkout -b feature/AmazingFeature`).
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`).
4. Push to the branch (`git push origin feature/AmazingFeature`).
5. Open a Pull Request.

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.
