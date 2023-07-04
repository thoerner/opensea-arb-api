import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import bodyParser from 'body-parser'
import { spawn } from 'child_process'
import collectionRoutes from './routes/collections.js'
import scanRoutes from './routes/scans.js'
import { ScanCommand, PutItemCommand } from '@aws-sdk/client-dynamodb'
import { jobs } from './jobs.js'
import { v4 as uuidv4 } from 'uuid'
import { dbClient } from './config/db.js'
import { scanQueue } from './config/queue.js'

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

scanQueue.process(2, (job, done) => {
  const { collectionSlug, margin, increment, schema, token } = job.data;
  
  const worker = spawn('node', ['scan.js', collectionSlug, margin, increment, schema, token]);

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
          const { slug: collectionSlug, margin, increment, schema, jobId } = item
          let token = null
          if (schema.S === 'ERC1155') {
            token = item.token.S
          } 

          if (jobId) {
            const oldJob = await scanQueue.getJob(jobId.S)
            if (oldJob) {
              await oldJob.remove()
            }
          }

          console.log(`Resuming scan for ${collectionSlug.S}`)
          const job = await scanQueue.add({
            collectionSlug: collectionSlug.S,
            margin: margin.N,
            increment: increment.N,
            schema: schema.S,
            token
          }, {
            jobId: uuidv4(),
            repeat: {
              every: 3 * 60 * 1000
            }
          });

          let dbItem = {}

          if (schema.S === 'ERC1155') {
            dbItem = {
              slug: {S: collectionSlug.S},
              margin: {N: margin.N},
              increment: {N: increment.N},
              schema: {S: schema.S},
              jobId: {S: job.id},
              token
            }
          } else if (schema.S === 'ERC721') {
            dbItem = {
              slug: {S: collectionSlug.S},
              margin: {N: margin.N},
              increment: {N: increment.N},
              schema: {S: schema.S},
              jobId: {S: job.id},
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
    } catch (err) {
      console.error(`Error resuming scans: ${err}`)
    }
})