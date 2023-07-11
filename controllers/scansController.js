import { jobs } from '../jobs.js'
import { addRepeatableJob, removeJobById } from '../config/queue.js'
import { getItem, putItem, deleteItem } from '../config/db.js'

export const startScan = async (req, res) => {
  const collectionSlug = req.body.collectionSlug
  const margin = req.body.margin
  const increment = req.body.increment
  const schema = req.body.schema
  const token = req.body.token || null
  const superblaster = req.body.superblaster || false

  const dbItem = await getItem(collectionSlug)

  if (dbItem) {
    res.send(`Already scanning collection ${collectionSlug}`)
    return
  }

  if (schema === 'ERC1155') {
    if (!token) {
      res.send(`No token provided for ERC1155 collection ${collectionSlug}`)
      return
    }
  }

  const job = await addRepeatableJob(collectionSlug, margin, increment, schema, token, superblaster)

  let item = {}
  if (schema === 'ERC721') {
    item = {
      slug: { S: collectionSlug },
      margin: { N: margin.toString() },
      increment: { N: increment.toString() },
      schema: { S: schema },
      superblaster: { BOOL: superblaster }
    }
  } else if (schema === 'ERC1155') {
    item = {
      slug: { S: collectionSlug },
      margin: { N: margin.toString() },
      increment: { N: increment.toString() },
      schema: { S: schema },
      token: { S: token },
      superblaster: { BOOL: superblaster }
    }
  } else {
    res.send(`Invalid schema ${schema}`)
    return
  }

  const result = await putItem(item)
  if (result.error) {
    res.send(`Error adding ${collectionSlug} to database: ${result.error}`)
    return
  }

  jobs[collectionSlug] = job.id;

  console.log(`Added ${collectionSlug} to scan queue`)
  res.send(`Added ${collectionSlug} to scan queue`)
  return
}

export const stopScan = async (req, res) => {
  const collectionSlug = req.body.collectionSlug

  if (!jobs[collectionSlug]) {
    res.send(`Not scanning collection ${collectionSlug}`)
    return
  }

  await removeJobById(collectionSlug)
  delete jobs[collectionSlug]
  await deleteItem(collectionSlug)

  console.log(`Stopped scanning collection ${collectionSlug}`)
  res.send(`Stopped scanning collection ${collectionSlug}`)
  return
}

export const getActiveScans = async (req, res) => {
  const activeScans = Object.keys(jobs)
  console.log(`Active scans: ${activeScans}`)
  res.send(activeScans)
  return
}