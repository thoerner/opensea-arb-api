import { GetItemCommand, DeleteItemCommand, PutItemCommand } from '@aws-sdk/client-dynamodb'
import Redis from 'ioredis'
import { v4 as uuidv4 } from 'uuid'
import { jobs } from '../jobs.js'
import { scanQueue } from '../config/queue.js'
import { dbClient } from '../config/db.js'

const redisClient = new Redis()

redisClient.on('error', (err) => {
    console.log('Redis error: ', err)
})

redisClient.on('connect', () => {
    console.log('Redis client connected')
})

export const startScan = async (req, res) => {
    const collectionSlug = req.body.collectionSlug;
    const margin = req.body.margin;
    const increment = req.body.increment;
    const schema = req.body.schema;
    const token = req.body.token;

    const getCommand = new GetItemCommand({
        TableName: 'arb_anderson_scans',
        Key: {
          slug: { S: collectionSlug }
        }
    });

    const response = await dbClient.send(getCommand)

    if (response.Item) {
        res.send(`Already scanning collection ${collectionSlug}`)
        return
    }

    if (schema === 'ERC1155') {
      if (!token) {
        res.send(`No token provided for ERC1155 collection ${collectionSlug}`)
        return
      }
    }

    // Schedule the job to run immediately and repeat every 3 minutes
    const job = await scanQueue.add({
        collectionSlug,
        margin,
        increment,
        schema,
        token
      }, {
        jobId: uuidv4(),
        repeat: {
          every: 3 * 60 * 1000
        }
      });

      let item = {}
  
      if (schema === 'ERC721') {
        item = {
          slug: { S: collectionSlug },
          margin: { N: margin.toString() },
          increment: { N: increment.toString() },
          schema: { S: schema },
          jobId: { S: job.id }
        }
      } else if (schema === 'ERC1155') {
        item = {
          slug: { S: collectionSlug },
          margin: { N: margin.toString() },
          increment: { N: increment.toString() },
          schema: { S: schema },
          jobId: { S: job.id },
          token: { S: token }
        }
      } else {
        res.send(`Invalid schema ${schema}`)
        return
      }
  
      const putCommand = new PutItemCommand({
          TableName: 'arb_anderson_scans',
          Item: item
      });
  
      await dbClient.send(putCommand)

      jobs[collectionSlug] = job.id;
  
    res.send(`Started scanning collection ${collectionSlug}`)
}

export const stopScan = async (req, res) => {
    const collectionSlug = req.body.collectionSlug

    if (!jobs[collectionSlug]) {
      res.send(`Not scanning collection ${collectionSlug}`)
      return
    }
  
    const jobId = jobs[collectionSlug];
    const job = await scanQueue.getJob(jobId);
    
    if (job) {
      await job.remove();
    }
    
    delete jobs[collectionSlug];
  
    const deleteCommand = new DeleteItemCommand({
      TableName: 'arb_anderson_scans',
      Key: {
        slug: { S: collectionSlug }
      }
    });
  
    await dbClient.send(deleteCommand)
    
    res.send(`Stopped scanning collection ${collectionSlug}`)
}

export const getActiveScans = async (req, res) => {
    const activeScans = Object.keys(jobs);
    res.send(activeScans);
}