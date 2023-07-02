import express from 'express'
import cors from 'cors'
import { spawn } from 'child_process'
import { getCollection, getNfts } from './openSea.js'
import Queue from 'bull'
import { DynamoDBClient, GetItemCommand, DeleteItemCommand, PutItemCommand, ScanCommand } from '@aws-sdk/client-dynamodb'

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
    const schema = collection.primary_asset_contracts[0].schema_name
    const imageUrl = collection.image_url
    const creatorFee = {
        isEnforced: collection.is_creator_fees_enforced,
        fee: collection.dev_seller_fee_basis_points
    }

    if (schema === 'ERC1155') {
        const { count, nfts } = await getNfts(collectionSlug)
        res.send({ contractInfo, name, traits, stats, schema, creatorFee, imageUrl, nfts })
        return
    } else {
        res.send({ contractInfo, name, traits, stats, schema, creatorFee, imageUrl })
        return
    }
})

app.post('/start', async (req, res) => {
    const collectionSlug = req.body.collectionSlug;
    const margin = req.body.margin;
    const increment = req.body.increment;
    const schema = req.body.schema;

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

    const putCommand = new PutItemCommand({
        TableName: 'arb_anderson_scans',
        Item: {
            slug: { S: collectionSlug },
            margin: { N: margin.toString() },
            increment: { N: increment.toString() },
            schema: { S: schema }
        }
    });

    await dbClient.send(putCommand)

    // Schedule the job to run immediately
    await scanQueue.add({
      collectionSlug,
      margin,
      increment,
      schema
    });

    // Then schedule the job to run every 3 minutes afterwards
    intervals[collectionSlug] = setInterval(async () => {
      await scanQueue.add({
        collectionSlug,
        margin,
        increment,
        schema
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

    const deleteCommand = new DeleteItemCommand({
        TableName: 'arb_anderson_scans',
        Key: {
          slug: { S: collectionSlug }
        }
    });

    dbClient.send(deleteCommand)
  
    clearInterval(intervals[collectionSlug])
    delete intervals[collectionSlug]
  
    res.send(`Stopped scanning collection ${collectionSlug}`)
})

app.get('/active', (req, res) => {
    res.send(Object.keys(intervals))
})

const scanCollection = async (collectionSlug, margin, increment, schema) => {

    await scanQueue.add({
      collectionSlug,
      margin,
      increment,
      schema
    });

    intervals[collectionSlug] = setInterval(async () => {
      await scanQueue.add({
        collectionSlug,
        margin,
        increment,
        schema
      });
    }, 3 * 60 * 1000);
}

scanQueue.process(2, (job, done) => {
  const { collectionSlug, margin, increment, schema } = job.data;
  
  const worker = spawn('node', ['index.js', collectionSlug, margin, increment, schema]);

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
  
app.listen(3000, async () => {
    console.log('Server started on port 3000')

    try {
      const command = new ScanCommand({
        TableName: 'arb_anderson_scans'
      });

      const data = await dbClient.send(command)

      if (data.Items) {
        for (let item of data.Items) {
          const { slug: collectionSlug, margin, increment, schema } = item
          console.log(`Resuming scan for ${collectionSlug}`)
          await scanCollection(collectionSlug.S, margin.N, increment.N, schema.S)
        }
      }
    } catch (err) {
      console.error(`Error resuming scans: ${err}`)
    }

})