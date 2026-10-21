const fs=require('fs');
const path=require('path');
const mysql=require('mysql2/promise');
require('dotenv').config();

async function init(){
  const connectionUrl=process.env.MYSQL_URL||process.env.MYSQL_PUBLIC_URL;
  const sslEnabled=String(process.env.DB_SSL||process.env.NODE_ENV==='production').toLowerCase()==='true';
  const ssl=sslEnabled?{rejectUnauthorized:String(process.env.DB_SSL_REJECT_UNAUTHORIZED||'true').toLowerCase()!=='false',...(process.env.DB_SSL_CA_BASE64?{ca:Buffer.from(process.env.DB_SSL_CA_BASE64,'base64').toString('utf8')}:{})}:undefined;
  let config;
  if(connectionUrl){
    const parsed=new URL(connectionUrl);
    config={host:parsed.hostname,port:Number(parsed.port||3306),user:decodeURIComponent(parsed.username),password:decodeURIComponent(parsed.password),database:decodeURIComponent(parsed.pathname.replace(/^\//,'')),ssl};
  }else{
    config={host:process.env.DB_HOST||'localhost',port:Number(process.env.DB_PORT||3306),user:process.env.DB_USER||'root',password:process.env.DB_PASSWORD||'',database:process.env.DB_NAME||'shades_strokes',ssl};
  }
  const conn=await mysql.createConnection({...config,multipleStatements:true});
  const schema=fs.readFileSync(path.join(__dirname,'../config/schema.sql'),'utf8')
    .replace(/CREATE DATABASE IF NOT EXISTS[\s\S]*?;/i,'')
    .replace(/USE\s+shades_strokes\s*;/i,'');
  await conn.query(schema);
  console.log('Database tables are ready');
  await conn.end();
}

init().catch(error=>{console.error('Database initialization failed:',error.message);process.exit(1);});
