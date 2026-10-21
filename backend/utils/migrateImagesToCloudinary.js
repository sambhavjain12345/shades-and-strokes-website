require('dotenv').config();
const fs=require('fs');
const path=require('path');
const mysql=require('mysql2/promise');
const cloudinary=require('../config/cloudinary');
const localPool=require('../config/db');

async function migrate(){
  if(!process.env.PRODUCTION_MYSQL_URL)throw new Error('PRODUCTION_MYSQL_URL is required');
  if(!process.env.CLOUDINARY_CLOUD_NAME||!process.env.CLOUDINARY_API_KEY||!process.env.CLOUDINARY_API_SECRET)throw new Error('Cloudinary credentials are required');
  const parsed=new URL(process.env.PRODUCTION_MYSQL_URL);
  const remote=mysql.createPool({host:parsed.hostname,port:Number(parsed.port||3306),user:decodeURIComponent(parsed.username),password:decodeURIComponent(parsed.password),database:decodeURIComponent(parsed.pathname.slice(1)),ssl:{rejectUnauthorized:false},connectionLimit:2});
  const [products]=await localPool.query("SELECT id,image_url FROM products WHERE image_url LIKE '%/uploads/artworks/%'");
  let migrated=0;
  try{
    for(const product of products){
      const filename=path.basename(new URL(product.image_url).pathname);
      const filePath=path.join(__dirname,'..','uploads','artworks',filename);
      if(!fs.existsSync(filePath)){console.warn(`Skipped missing file for product ${product.id}`);continue;}
      const publicId=`shades-and-strokes/artworks/${path.parse(filename).name}`;
      const uploaded=await cloudinary.uploader.upload(filePath,{public_id:publicId,overwrite:false,resource_type:'image'});
      await localPool.query('UPDATE products SET image_url=? WHERE id=?',[uploaded.secure_url,product.id]);
      await remote.query('UPDATE products SET image_url=? WHERE id=?',[uploaded.secure_url,product.id]);
      migrated+=1;
    }
    console.log(`Migrated ${migrated} artwork image(s) to Cloudinary`);
  }finally{
    await localPool.end();await remote.end();
  }
}
migrate().catch(error=>{console.error(error.message);process.exit(1);});
