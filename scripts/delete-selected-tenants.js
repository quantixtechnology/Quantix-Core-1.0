#!/usr/bin/env node
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

const PRESERVE_MODELS = new Set(['User','Lead','SalesTeamMember','PlatformPlan','PlatformConfig','RolePermission','ProposalDocument','AuditLog','HRMS','OfferLetter','Payslip','Workflow','WebsiteContent']);

const CHILD_FIRST_ORDER = ['OrderItem','OrderStatusHistory','Delivery','Payment','Invoice','CustomerNote','CustomerSubscription','InventoryLog','Inventory','ProductVariant','POSSession','StoreTiming','Notification','PromoCode'];

function lowerFirst(s){return s.charAt(0).toLowerCase()+s.slice(1);} 

function parseSchemaForFKs(schemaPath){
  const txt = fs.readFileSync(schemaPath,'utf-8');
  const re = /model\s+(\w+)\s*\{([\s\S]*?)\n\}/g; const fkNames=['businessId','storeId','customerId','productId','inventoryId','orderId'];
  const results=[]; let m;
  while((m=re.exec(txt))){ const model=m[1]; const body=m[2]; const props=[]; for(const fk of fkNames) if(body.indexOf(fk)!==-1) props.push(fk); if(props.length>0) results.push({model,props,body}); }
  return results;
}

async function main(){
  const arg = process.argv[2]; const raw = process.env.BUSINESS_IDS || arg; if(!raw){console.error('Usage: BUSINESS_IDS=<id1,id2,...> [DRY_RUN=true] node scripts/delete-selected-tenants.js'); process.exit(1);} const BUSINESS_IDS = raw.split(',').map(s=>s.trim()).filter(Boolean);
  const DRY_RUN = (process.env.DRY_RUN||'false').toLowerCase()==='true';
  console.log('Delete-selected-tenants — businessIds=',BUSINESS_IDS.join(', '),'DRY_RUN=',DRY_RUN);

  const schemaPath = path.resolve(process.cwd(),'prisma','schema.prisma');
  const modelFKs = parseSchemaForFKs(schemaPath);
  const preservingConflict = modelFKs.filter(m=>PRESERVE_MODELS.has(m.model) && m.props.includes('businessId'));
  if(preservingConflict.length>0){ console.error('Aborting: preserved platform models reference businessId. Manual review required:'); preservingConflict.forEach(p=>console.error(` - ${p.model} references ${p.props.join(', ')}`)); process.exit(2); }

  const discoveredMap = new Map(modelFKs.map(m=>[m.model,m.props]));
  const targets=[]; for(const t of CHILD_FIRST_ORDER) if(!PRESERVE_MODELS.has(t)) targets.push(t); for(const m of modelFKs) if(!PRESERVE_MODELS.has(m.model) && !targets.includes(m.model)) targets.push(m.model);
  console.log('Computed target models:',targets.join(', '));

  const storeIds = (await prisma.store.findMany({ where: { businessId: { in: BUSINESS_IDS } }, select: { id: true } })).map(r=>r.id);
  const customerIds = (await prisma.customer.findMany({ where: { businessId: { in: BUSINESS_IDS } }, select: { id: true } })).map(r=>r.id);
  const productIds = (await prisma.product.findMany({ where: { businessId: { in: BUSINESS_IDS } }, select: { id: true } })).map(r=>r.id);
  const inventoryIds = (await prisma.inventory.findMany({ where: { businessId: { in: BUSINESS_IDS } }, select: { id: true } })).map(r=>r.id);
  const orderIds = (await prisma.order.findMany({ where: { businessId: { in: BUSINESS_IDS } }, select: { id: true } })).map(r=>r.id);

  const before = {
    businesses: await prisma.business.count({ where: { id: { in: BUSINESS_IDS } } }),
    stores: await prisma.store.count({ where: { businessId: { in: BUSINESS_IDS } } }),
    products: await prisma.product.count({ where: { businessId: { in: BUSINESS_IDS } } }),
    customers: await prisma.customer.count({ where: { businessId: { in: BUSINESS_IDS } } }),
    orders: await prisma.order.count({ where: { businessId: { in: BUSINESS_IDS } } }),
    globalBusinessCount: await prisma.business.count()
  };

  console.log('\nCounts BEFORE deletion (targeted):'); console.log('Targeted Businesses:',before.businesses); console.log('Targeted Stores:',before.stores); console.log('Targeted Products:',before.products); console.log('Targeted Customers:',before.customers); console.log('Targeted Orders:',before.orders); console.log('Global Businesses:',before.globalBusinessCount);

  const deletedCounts={}; const wouldDeleteCounts={}; const start=Date.now();

  // Disable SQLite foreign keys during delete to avoid constraint enforcement issues
  try {
    await prisma.$executeRawUnsafe('PRAGMA foreign_keys = OFF;');
  } catch (e) {
    // ignore if not supported
  }

  await prisma.$transaction(async (tx)=>{
    for(const model of targets){ const modelProp = lowerFirst(model); const props = discoveredMap.get(model) || []; const ors=[]; if(props.includes('businessId')) ors.push({ businessId: { in: BUSINESS_IDS } }); if(props.includes('storeId') && storeIds.length) ors.push({ storeId: { in: storeIds } }); if(props.includes('customerId') && customerIds.length) ors.push({ customerId: { in: customerIds } }); if(props.includes('productId') && productIds.length) ors.push({ productId: { in: productIds } }); if(props.includes('inventoryId') && inventoryIds.length) ors.push({ inventoryId: { in: inventoryIds } }); if(props.includes('orderId') && orderIds.length) ors.push({ orderId: { in: orderIds } }); let where = {}; if(ors.length===0){ if(props.includes('businessId')) where={ businessId: { in: BUSINESS_IDS } }; else where={ id:'___none___' }; } else if(ors.length===1) where=ors[0]; else where={ OR: ors };
      try{ if(DRY_RUN){ wouldDeleteCounts[model] = await tx[modelProp].count({ where }); } else { const res = await tx[modelProp].deleteMany({ where }); deletedCounts[model] = res.count; } } catch(e){ console.error(`Error accessing model ${model}:`, e.message || e); throw e; }
    }

    if(DRY_RUN){ wouldDeleteCounts['Business'] = await (tx)['business'].count({ where: { id: { in: BUSINESS_IDS } } }); } else { const r = await (tx)['business'].deleteMany({ where: { id: { in: BUSINESS_IDS } } }); deletedCounts['Business'] = r.count; }
  });

  // Re-enable foreign keys (best-effort)
  try {
    await prisma.$executeRawUnsafe('PRAGMA foreign_keys = ON;');
  } catch (e) {}

  const end = Date.now(); const remaining = { businesses: await prisma.business.count(), customers: await prisma.customer.count(), orders: await prisma.order.count() };

  console.log('\n=== Delete-selected-tenants report ==='); console.log('DRY_RUN:',DRY_RUN); console.log('\nPer-table deleted/would-delete:'); for(const k of Object.keys(wouldDeleteCounts).sort()) if(DRY_RUN) console.log(`${k}: would delete ${wouldDeleteCounts[k]}`); for(const k of Object.keys(deletedCounts).sort()) if(!DRY_RUN) console.log(`${k}: deleted ${deletedCounts[k]}`);
  console.log('\nRemaining counts (global):'); console.log('Businesses:',remaining.businesses); console.log('Customers:',remaining.customers); console.log('Orders:',remaining.orders);
  console.log('\nExecution time (ms):', end-start); console.log('Status:', DRY_RUN ? 'dry-run-complete' : 'success');
  const checkTarget = await prisma.business.count({ where: { id: { in: BUSINESS_IDS } } }); console.log('\nTargeted businesses remaining count (should be 0 after destructive run):', checkTarget);
  await prisma.$disconnect();
}

main().catch(e=>{ console.error('delete-selected-tenants failed:', e); prisma.$disconnect(); process.exit(1); });
