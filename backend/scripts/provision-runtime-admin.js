"use strict";
const bcrypt=require('bcryptjs');
async function provision({pool,env=process.env}){
 const email=String(env.PROVISION_ADMIN_EMAIL||'').trim().toLowerCase(),password=env.PROVISION_ADMIN_PASSWORD||'',tenantId=String(env.GOVERNANCE_TENANT_ID||env.TENANT_ID||'runtime-tenant').trim();
 if(!email.includes('@')||password.length<12||!tenantId)throw Error('Runtime admin email, 12+ character password, and tenant are required');
 const client=await pool.connect();
 try{await client.query('BEGIN');await client.query("SELECT pg_advisory_xact_lock(hashtext('printing-native-admin-provision'))");const existing=(await client.query('SELECT * FROM users WHERE email=$1 FOR UPDATE',[email])).rows[0];
  if(existing){if(!(await bcrypt.compare(password,existing.password_hash)))throw Error('Configured local login does not match the existing native account. Existing password and permissions were preserved.');await client.query('COMMIT');return{inserted:0,preserved:true,actorId:existing.id};}
  const hash=await bcrypt.hash(password,12);const result=await client.query("INSERT INTO users(name,email,password_hash,role,tenant_id) VALUES('Runtime Administrator',$1,$2,'admin',$3) RETURNING id",[email,hash,tenantId]);await client.query('COMMIT');return{inserted:1,preserved:false,actorId:result.rows[0].id};
 }catch(error){await client.query('ROLLBACK').catch(()=>{});throw error;}finally{client.release();}
}
module.exports={provision};
if(require.main===module){const pool=require('../db');provision({pool}).then(result=>{console.log(result.preserved?'Existing native account preserved.':'Missing configured runtime administrator provisioned.');return pool.end();}).catch(async error=>{console.error(error.message);await pool.end().catch(()=>{});process.exitCode=1;});}
