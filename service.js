import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import bodyParser from 'body-parser'
import collectionRoutes from './routes/collections.js'
import scanRoutes from './routes/scans.js'
import { jobs } from './jobs.js'
import { getAllItems } from './config/db.js'
import { addRepeatableJob } from './config/queue.js'

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
  try {
    const items = await getAllItems()
    if (items) {
      for (let item of items) {
        const { slug: collectionSlug, margin, increment, schema, superblaster } = item
        let token = null
        if (schema.S === 'ERC1155') {
          token = item.token.S
        }

        console.log(`Adding ${collectionSlug.S} to scan queue`)

        const job = await addRepeatableJob(collectionSlug, margin, increment, schema, token, superblaster)

        jobs[collectionSlug.S] = job.id;
      }
    }
    console.log(`Done adding scans to queue`)
  } catch (err) {
    console.error(`Error adding scans to queue: ${err}`)
  }
}

app.listen(3000, async () => {
  console.log('Server started on port 3000')
  await startup()
})