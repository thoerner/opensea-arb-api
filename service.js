import express from 'express'
import cors from 'cors'
import { spawn } from 'child_process'
import { getCollection } from './openSea.js'
import Queue from 'bull'
import { DynamoDBClient, GetItemCommand, DeleteItemCommand } from '@aws-sdk/client-dynamodb'

const dbClient = new DynamoDBClient({ region: 'us-east-1' })

const scanQueue = new Queue('scan', 'redis://127.0.0.1:6379')
let intervals = {}

const app = express()
app.use(cors({
    origin: '*'
}))
app.use(express.json())

app.get('/collectionInfo/:collectionSlug', async (req, res) => {
    const collectionSlug = req.params.collectionSlug

    const collection = await getCollection(collectionSlug)
    const contractInfo = collection.primary_asset_contracts[0]
    const name = collection.name
    const traits = collection.traits
    const stats = collection.stats
    const imageUrl = collection.image_url
    const creatorFee = {
        isEnforced: collection.is_creator_fees_enforced,
        fee: collection.dev_seller_fee_basis_points
    }

    res.send({ contractInfo, name, traits, stats, creatorFee, imageUrl })
})

app.post('/start', async (req, res) => {
    const collectionSlug = req.body.collectionSlug;
    const margin = req.body.margin;
    const increment = req.body.increment;

    const command = new GetItemCommand({
        TableName: 'arb-anderson-scans',
        Key: {
          slug: { S: collectionSlug }
        }
    });

    const response = await dbClient.send(command);

    if (response.Item) {
        res.send(`Already scanning collection ${collectionSlug}`)
        return
    }

    // if (intervals[collectionSlug]) {
    //     res.send(`Already scanning collection ${collectionSlug}`)
    //     return
    // }
  
    // Schedule the job to run immediately
    await scanQueue.add({
      collectionSlug,
      margin,
      increment
    });

    // Then schedule the job to run every 3 minutes afterwards
    intervals[collectionSlug] = setInterval(async () => {
      await scanQueue.add({
        collectionSlug,
        margin,
        increment
      });
    }, 3 * 60 * 1000);
  
    res.send(`Started scanning collection ${collectionSlug}`)
});

app.post('/stop', (req, res) => {
    const collectionSlug = req.body.collectionSlug

    if (!intervals[collectionSlug]) {
        res.send(`Not scanning collection ${collectionSlug}`)
        return
    }

    const command = new DeleteItemCommand({
        TableName: 'arb-anderson-scans',
        Key: {
          slug: { S: collectionSlug }
        }
    });

    dbClient.send(command)
  
    clearInterval(intervals[collectionSlug])
    delete intervals[collectionSlug]
  
    res.send(`Stopped scanning collection ${collectionSlug}`)
})

app.get('/active', (req, res) => {
    res.send(Object.keys(intervals))
})

scanQueue.process(2, (job, done) => {
    const { collectionSlug, margin, increment } = job.data;
    
    const worker = spawn('node', ['index.js', collectionSlug, margin, increment]);
  
    worker.stdout.on('data', (data) => {
      console.log(`stdout: ${data}`);
    });
  
    worker.stderr.on('data', (data) => {
      console.error(`stderr: ${data}`);
    });
  
    worker.on('close', (code) => {
      console.log(`${collectionSlug} scan completed with code: ${code}`);
      done();
    });
});
  
app.listen(3000, () => {
    console.log('Server started on port 3000')
})