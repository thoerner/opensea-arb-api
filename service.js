import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import bodyParser from 'body-parser'
import { ScanCommand, PutItemCommand } from '@aws-sdk/client-dynamodb'
import collectionRoutes from './routes/collections.js'
import scanRoutes from './routes/scans.js'
import { jobs } from './jobs.js'
import { dbClient } from './config/db.js'
import { scanQueue, registerProcessor, addJob, addRepeatableJob } from './config/queue.js'

const INTERVAL = 3 * 60 * 1000

const app = express()
app.use(cors({
  origin: '*'
}))
app.use(express.json())
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: true }))
app.use(helmet())

app.use('/collectionInfo', collectionRoutes)
app.use('/', scanRoutes)

const startup = async () => {
  scanQueue.obliterate({ force: true })

  try {
    const command = new ScanCommand({
      TableName: 'arb_anderson_scans'
    });

    const data = await dbClient.send(command)

    if (data.Items) {
      for (let item of data.Items) {
        const { slug: collectionSlug, margin, increment, schema } = item
        let token = null
        if (schema.S === 'ERC1155') {
          token = item.token.S
        }

        console.log(`Resuming scan for ${collectionSlug.S}`)

        registerProcessor(collectionSlug.S)
        await addJob(collectionSlug, margin, increment, schema, token)
        const job = await addRepeatableJob(collectionSlug, margin, increment, schema, token, INTERVAL)

        let dbItem = {}

        if (schema.S === 'ERC1155') {
          dbItem = {
            slug: { S: collectionSlug.S },
            margin: { N: margin.N },
            increment: { N: increment.N },
            schema: { S: schema.S },
            jobId: { S: job.id },
            token: { S: token}
          }
        } else if (schema.S === 'ERC721') {
          dbItem = {
            slug: { S: collectionSlug.S },
            margin: { N: margin.N },
            increment: { N: increment.N },
            schema: { S: schema.S },
            jobId: { S: job.id },
          }
        }

        const putCommand = new PutItemCommand({
          TableName: 'arb_anderson_scans',
          Item: dbItem
        });

        await dbClient.send(putCommand)

        jobs[collectionSlug.S] = job.id;
      }
    }
    console.log(`Done resuming scans`)
  } catch (err) {
    console.error(`Error resuming scans: ${err}`)
  }
}

app.listen(3000, async () => {
  console.log('Server started on port 3000')
  await startup()
})