import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import bodyParser from 'body-parser'
import collectionRoutes from './routes/collections.js'
import scanRoutes from './routes/scans.js'
import { jobs } from './jobs.js'
import { getAllItems } from './config/db.js'
import { addRepeatableJob } from './config/queue.js'

const PORT = 3000

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

app.get('/', (req, res) => {
  res.send('Hello World!')
})

const startup = async () => {
  try {
    const items = await getAllItems()
    if (items) {
      for (let item of items) {
        const { slug, margin, increment, schema, token, superblaster } = item

        console.log(`Adding ${slug.S} to scan queue`)

        const job = await addRepeatableJob(slug, margin, increment, schema, token, superblaster)

        jobs[`${slug.S}-${token.S}`] = job.id;
      }
    }
    console.log(`Done adding scans to queue`)
  } catch (err) {
    console.error(`Error adding scans to queue: ${err}`)
  }
}

app.listen(PORT, async () => {
  console.log(`Server started on port ${PORT}`)
  await startup()
})

export default app