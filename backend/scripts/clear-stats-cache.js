#!/usr/bin/env node
// Clears Redis keys matching stats:svg:*
require('dotenv').config();
const Redis = require('ioredis');

async function main(){
  const url = process.env.REDIS_URL;
  if(!url){
    console.error('REDIS_URL not set in environment or .env');
    process.exit(2);
  }
  const client = new Redis(url);
  try{
    let cursor = '0';
    let total = 0;
    do{
      const [next, keys] = await client.scan(cursor, 'MATCH', 'stats:svg:*', 'COUNT', 1000);
      cursor = next;
      if(keys && keys.length){
        // delete in batches
        for(let i=0;i<keys.length;i+=100){
          const batch = keys.slice(i,i+100);
          const del = await client.del(...batch);
          total += del;
        }
      }
    }while(cursor !== '0');
    console.log(`Deleted ${total} keys matching stats:svg:*`);
  }catch(err){
    console.error('Error clearing keys', err);
    process.exitCode = 3;
  }finally{
    client.disconnect();
  }
}

main();
