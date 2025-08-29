# IBDB Deployment Guide

## Overview

IBDB is designed for deployment on Vercel with PostgreSQL database support. The application uses automatic builds, migrations, and environment-based configuration.

## Deployment Platforms

### Vercel (Recommended)
Optimized for Next.js applications with automatic builds and serverless functions.

**Features:**
- Automatic builds from Git commits
- Environment variable management
- Edge network deployment
- Built-in analytics and monitoring

### Alternative Platforms
- **Netlify**: Requires adapter configuration
- **Railway**: Good PostgreSQL integration
- **DigitalOcean App Platform**: Full-stack deployment option
- **AWS**: Custom deployment with RDS

## Pre-Deployment Setup

### 1. Database Setup

#### PostgreSQL Requirements
- **Version**: PostgreSQL 13+ recommended
- **Connection Pooling**: Recommended for production
- **SSL**: Required for most cloud providers

#### Database Providers
```bash
# Supabase (Recommended)
DATABASE_URL="postgresql://postgres:password@db.project.supabase.co:5432/postgres?sslmode=require"

# PlanetScale (MySQL adapter needed)
DATABASE_URL="mysql://username:password@host:3306/database?sslaccept=strict"

# Railway PostgreSQL
DATABASE_URL="postgresql://postgres:password@containers-us-west-xxx.railway.app:5432/railway"

# Neon
DATABASE_URL="postgresql://username:password@ep-xxx.us-east-1.aws.neon.tech/neondb?sslmode=require"
```

### 2. External Service Accounts

#### ISBNdb API
1. Sign up at [isbndb.com](https://isbndb.com)
2. Generate API key
3. Note rate limits and pricing tier

#### Optional External Services
- **OpenLibrary**: No API key required
- **Goodreads**: API deprecated, data import only
- **Hardcover**: Manual ID updates via CLI

### 3. Environment Variables
```bash
# Core Database
DATABASE_URL="postgresql://..."

# External APIs
ISBNDB_API_KEY="your_isbndb_api_key"

# Authentication
SECRET="secure_random_string_for_admin_endpoints"

# Next.js Configuration
NEXTAUTH_URL="https://your-domain.com"
NEXT_PUBLIC_APP_URL="https://your-domain.com"
```

## Vercel Deployment

### 1. Initial Setup
```bash
# Install Vercel CLI
npm install -g vercel

# Login to Vercel
vercel login

# Link project
vercel link
```

### 2. Environment Configuration
Set environment variables in Vercel dashboard:
- Go to Project Settings → Environment Variables
- Add all required environment variables
- Set appropriate environment scopes (Production, Preview, Development)

### 3. Build Configuration

#### vercel.json (Optional)
```json
{
  "framework": "nextjs",
  "buildCommand": "npm run vercel-build",
  "installCommand": "npm install",
  "functions": {
    "app/**": {
      "maxDuration": 30
    }
  }
}
```

#### Build Script
```json
{
  "scripts": {
    "vercel-build": "prisma generate && prisma migrate deploy && next build"
  }
}
```

### 4. Database Migration on Deploy
The build script automatically:
1. Generates Prisma client
2. Runs pending migrations
3. Builds Next.js application

### 5. Custom Domain Setup
1. Add domain in Vercel project settings
2. Configure DNS records:
   ```
   Type: CNAME
   Name: your-subdomain (or @)
   Value: cname.vercel-dns.com
   ```
3. Enable HTTPS (automatic)

## Manual Deployment

### 1. Build Application
```bash
# Install dependencies
npm install

# Generate Prisma client
npx prisma generate

# Run database migrations
npx prisma migrate deploy

# Build Next.js app
npm run build
```

### 2. Start Production Server
```bash
npm run start
```

### 3. Process Management (PM2)
```bash
# Install PM2
npm install -g pm2

# Start application
pm2 start npm --name "ibdb" -- run start

# Save PM2 configuration
pm2 save

# Setup startup script
pm2 startup
```

## Database Management

### Migration Strategy

#### Development to Production
1. **Test Migrations**: Always test migrations on staging database
2. **Backup**: Create database backup before migration
3. **Deploy**: Migration runs automatically during build
4. **Verify**: Check application functionality after deployment

#### Manual Migration (if needed)
```bash
# Connect to production database
npx prisma migrate deploy

# Generate client (if schemas changed)
npx prisma generate
```

### Backup Strategy
```bash
# Create backup
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql

# Restore backup
psql $DATABASE_URL < backup_file.sql
```

### Performance Monitoring
- Monitor slow queries with database analytics
- Check connection pool usage
- Monitor API response times

## Security Considerations

### Environment Security
- **Never commit**: `.env` files to version control
- **Rotate secrets**: Change SECRET and API keys regularly
- **Scope access**: Use principle of least privilege for database users

### API Security
- **Rate limiting**: Implement at reverse proxy level
- **Input validation**: Validate all user inputs
- **Error handling**: Don't expose internal errors to clients

### Database Security
- **SSL connections**: Always use SSL for database connections
- **Connection limits**: Set appropriate connection pool limits
- **Access control**: Restrict database access by IP if possible

## Monitoring and Analytics

### Vercel Analytics
- **Web Vitals**: Core web vitals monitoring
- **Function Metrics**: Serverless function performance
- **Edge Logs**: Request and error logging

### External Monitoring
```bash
# Health check endpoint (implement if needed)
GET /api/health

# Response format
{
  "status": "ok",
  "timestamp": "2025-01-01T00:00:00.000Z",
  "database": "connected",
  "services": {
    "isbndb": "available"
  }
}
```

### Log Management
- **Vercel Logs**: Built-in function logs
- **Database Logs**: Enable query logging for performance monitoring
- **Error Tracking**: Consider Sentry or similar service

## Scaling Considerations

### Database Scaling
- **Connection Pooling**: Use PgBouncer or similar
- **Read Replicas**: For high-read workloads
- **Caching**: Implement Redis for query caching

### Application Scaling
- **Serverless Benefits**: Automatic scaling with Vercel
- **Edge Functions**: For geographically distributed users
- **CDN**: Static asset optimization

### Cost Optimization
- **Function Duration**: Optimize for faster execution
- **Database Queries**: Minimize query complexity
- **External API Calls**: Implement efficient caching

## Troubleshooting

### Common Deployment Issues

#### Build Failures
```bash
# Check build logs
vercel logs

# Local build test
npm run vercel-build
```

#### Database Connection Issues
- Verify DATABASE_URL format
- Check SSL mode requirements
- Validate database permissions

#### Migration Failures
```bash
# Check migration status
npx prisma migrate status

# Reset and redeploy (destructive)
npx prisma migrate reset
```

### Performance Issues
- Monitor function execution time
- Check database query performance
- Verify external API response times

## Rollback Strategy

### Quick Rollback
1. **Vercel**: Revert to previous deployment in dashboard
2. **Database**: Restore from backup if schema changes
3. **DNS**: Update DNS if domain issues

### Database Rollback
```bash
# Create schema backup before major changes
npx prisma db pull --print > schema_backup.prisma

# Manual rollback (if needed)
# Restore from backup and redeploy
```

## Cross-References

- **Development Setup**: [DEVELOPMENT.md](./DEVELOPMENT.md)
- **API Reference**: [API_REFERENCE.md](./API_REFERENCE.md)
- **Database Schema**: [DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md)
- **Project Structure**: [PROJECT_STRUCTURE.md](./PROJECT_STRUCTURE.md)