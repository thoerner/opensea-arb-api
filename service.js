import express from 'express'
import { spawn } from 'child_process'

const app = express()
app.use(express.json())

let workers = {}

app.post('/start', (req, res) => {
    const collectionSlug = req.body.collectionSlug
    const margin = req.body.margin
    const increment = req.body.increment

    if (workers[collectionSlug]) {
        return res.status(400).send('Collection already being scanned')
    }

    const worker = spawn('node', ['index.js', collectionSlug, margin, increment])

    worker.stdout.on('data', (data) => {
        console.log(`stdout: ${data}`)
    })

    worker.stderr.on('data', (data) => {
        console.error(`stderr: ${data}`)
    })

    worker.on('close', (code) => {
        console.log(`${collectionSlug} scan stopped with code: ${code}`)
        delete workers[collectionSlug]
    })

    workers[collectionSlug] = worker

    res.send('Started scanning collection')
})

app.post('/stop', (req, res) => {
    const collectionSlug = req.body.collectionSlug
  
    const worker = workers[collectionSlug]
    if (!worker) {
      return res.status(400).send('Collection is not being scanned')
    }
  
    worker.kill();
    delete workers[collectionSlug]
  
    res.send('Stopped scanning collection')
})

app.get('/active', (req, res) => {
    res.send(Object.keys(workers))
})
  
app.listen(3000, () => {
    console.log('Server started on port 3000')
})