# QUANTIX CORE — GO LIVE CHECKLIST

## PHASE 1 — DEPLOY CORE ✅

Deploy script: `deploy.sh`

```bash
chmod +x deploy.sh
./deploy.sh production
```

### Pre-Deployment
- [ ] Node.js 18+ installed
- [ ] PostgreSQL database accessible
- [ ] SSL certificates installed
- [ ] Domain configured (DNS, reverse proxy)
- [ ] `.env` configured with:
  - [ ] DATABASE_URL (PostgreSQL connection)
  - [ ] NEXT_PUBLIC_STOREFRONT_DOMAIN
  - [ ] SMTP_HOST, SMTP_USER, SMTP_PASS (email)
  - [ ] RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET (live keys)
  - [ ] CREDENTIAL_ENCRYPT_KEY (64-char hex)

### Deployment
- [ ] Run `./deploy.sh production`
- [ ] Database migrations complete
- [ ] Application builds successfully
- [ ] No build errors or warnings

### Verification
- [ ] Start server: `npm run start` (or `pm2 start ecosystem.config.js`)
- [ ] Health check passes:
  ```bash
  curl https://app.yourdomain.com/api/admin/config/health
  ```
  Expected: `"status": "READY"`
- [ ] No startup errors in logs
- [ ] Structured logging enabled

---

## PHASE 2 — DEPLOY PRODUCT WORKSPACES ⚠️

### Commerce OS
- [ ] Code deployed to `commerce.quantixtechnology.in`
- [ ] SSL certificate valid
- [ ] Health endpoint responds: `https://commerce.quantixtechnology.in/health`
- [ ] Status code: 200 OK
- [ ] Runtime Registry updated
- [ ] Workspace authentication working

### Laundry OS
- [ ] Code deployed to `laundry.quantixtechnology.in`
- [ ] SSL certificate valid
- [ ] Health endpoint responds: `https://laundry.quantixtechnology.in/health`
- [ ] Status code: 200 OK
- [ ] Runtime Registry updated
- [ ] Workspace authentication working

### Verification
```bash
curl https://app.yourdomain.com/api/admin/products/runtime
```
Expected: Both COMMERCE and LAUNDRY with deployed URLs

---

## PHASE 3 — LIVE CUSTOMER TEST ✅

### Create First Real Business
- [ ] Customer identity (email, name, phone)
- [ ] Business information (name, type, location)
- [ ] No seed data, completely new account

### Complete Journey
- [ ] Business creation succeeds
- [ ] Owner account auto-created
- [ ] Product selection works (COMMERCE or LAUNDRY visible)
- [ ] Plan selection works (STARTER, PROFESSIONAL visible)
- [ ] Provisioning completes (10/10 steps)
- [ ] Workspace launches (correct product environment)
- [ ] Owner receives OTP email
- [ ] Owner can verify OTP
- [ ] Owner dashboard loads
- [ ] First transaction possible

### Test Command
```bash
node scripts/test-transaction-flow.mjs
```
Expected: Both flows show ✅ READY

---

## PHASE 4 — PRODUCTION VERIFICATION

### Email Delivery
- [ ] OTP email sent successfully
- [ ] Email contains: OTP code, business name, login link
- [ ] Delivery time: < 5 seconds
- [ ] No spam folder

### Payment Integration
- [ ] Razorpay webhook configured
- [ ] Test payment succeeds
- [ ] Invoice generated
- [ ] Email receipt sent
- [ ] Accounting records correct

### File Uploads
- [ ] Business logo upload works
- [ ] Product images upload works
- [ ] Files accessible via URL
- [ ] Storage quota enforced

### Image Serving
- [ ] Product images load quickly
- [ ] Proper cache headers
- [ ] CORS configured correctly

### Audit Logs
- [ ] All business actions logged
- [ ] Admin actions tracked
- [ ] Payment events recorded
- [ ] Provisioning logged
- [ ] User access logged

### Monitoring
- [ ] Application metrics collected
- [ ] Error tracking enabled
- [ ] Request logging active
- [ ] Database query performance monitored
- [ ] Alerts configured

### Backups
- [ ] Database backups running
- [ ] File storage backups running
- [ ] Restore tested successfully
- [ ] Backup retention: 30 days

### Error Recovery
- [ ] Failed requests properly logged
- [ ] Error responses user-friendly
- [ ] Database connection recovery works
- [ ] Timeout handling correct
- [ ] No data corruption on failures

---

## PHASE 5 — LOAD TEST

### Concurrent Business Creations
- [ ] 10 simultaneous business creations
- [ ] All succeed without race conditions
- [ ] Slugs properly unique
- [ ] Database constraints enforced

### Concurrent Users
- [ ] 50 concurrent users
- [ ] No login failures
- [ ] Session handling correct
- [ ] Memory stable

### Concurrent API Requests
- [ ] 100 concurrent requests
- [ ] Response time < 2 seconds
- [ ] No dropped connections
- [ ] Database connection pool sufficient

### Provisioning Concurrency
- [ ] 5 simultaneous provisioning operations
- [ ] All complete successfully
- [ ] No workspace conflicts
- [ ] Storage allocation correct

### Resource Usage
- [ ] CPU usage < 80%
- [ ] Memory usage < 2GB
- [ ] Disk I/O normal
- [ ] Database connections < pool limit

### Bottleneck Identification
- [ ] Slowest endpoint identified
- [ ] Database queries optimized
- [ ] Caching implemented where needed

---

## PHASE 6 — FIRST CUSTOMER RELEASE

### Release Tag
```bash
git tag -a v1.0.0-production -m "First production release"
git push origin v1.0.0-production
```

### Production Deployment
- [ ] Code deployed to production
- [ ] Database migrations run
- [ ] Health check passes
- [ ] Monitoring active

### First Real Customer
- [ ] Customer account created
- [ ] Email verified
- [ ] Product selected and provisioned
- [ ] Workspace accessible
- [ ] First transaction completed

### Monitoring First 24 Hours
- [ ] Error rate < 0.1%
- [ ] All health checks passing
- [ ] Email delivery: 100%
- [ ] Payment processing: 100%
- [ ] No database issues
- [ ] No memory leaks
- [ ] Backups successful

### Issue Resolution
- [ ] Any issues fixed immediately
- [ ] Root cause analyzed
- [ ] Fix deployed to production
- [ ] Customer notified

---

## SUCCESS CRITERIA

Production is **LIVE** when:

✅ Real customer creates business  
✅ Receives OTP via email  
✅ Selects product (COMMERCE or LAUNDRY)  
✅ Selects plan (STARTER, PROFESSIONAL, or ENTERPRISE)  
✅ Provisioning completes in < 30 seconds  
✅ Opens workspace in correct product  
✅ Performs first business transaction  
✅ Uses platform without developer assistance  
✅ Error rate < 0.1%  
✅ All health checks passing  

---

## QUICK START COMMANDS

### Local Development
```bash
npm run dev
```

### Local Production Testing
```bash
npm run build
npm run start
```

### Validation
```bash
curl http://localhost:3000/api/admin/config/health
node scripts/test-transaction-flow.mjs
node scripts/test-failures.mjs
```

### Database
```bash
npx prisma db push        # Setup database
npx prisma studio        # Visual database browser
```

### Monitoring
```bash
pm2 logs
pm2 monit
```

---

## SUPPORT CONTACTS

**Critical Issues (24/7):**
- Emergency: ops-emergency@quantixtechnology.in

**Deployment Issues:**
- Deployment: devops@quantixtechnology.in

**Product Issues:**
- Support: support@quantixtechnology.in

---

**Status:** Ready for Production Deployment  
**Last Updated:** 2026-06-27  
**Next Step:** PHASE 1 — Run `./deploy.sh production`
