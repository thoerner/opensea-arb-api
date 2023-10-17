import { jobs } from '../jobs.js'
import { addRepeatableJob, removeJobById } from '../config/queue.js'
import { getItem, putItem, deleteItem } from '../config/db.js'

export const startScan = async (req, res) => {
  const collectionSlug = req.body.collectionSlug
  const margin = req.body.margin
  const increment = req.body.increment
  const schema = req.body.schema
  const token = req.body.token || '0'
  const superblaster = req.body.superblaster
  const isCollectionOffer = req.body.isCollectionOffer
  console.log(isCollectionOffer)

  const dbItem = await getItem(collectionSlug, token)

  if (dbItem) {
    res.send(`Already scanning collection ${collectionSlug}`)
    return
  }

  if (schema === 'ERC1155') {
    if (!req.body.token && !isCollectionOffer) {
      res.send(`No token provided for ERC1155 collection ${collectionSlug}`)
      return
    }
  }

  const job = await addRepeatableJob(collectionSlug, margin, increment, schema, token, superblaster, isCollectionOffer)

  const item = {
      slug: { S: collectionSlug },
      margin: { N: margin.toString() },
      increment: { N: increment.toString() },
      schema: { S: schema },
      token: { S: token.toString() },
      superblaster: { BOOL: superblaster },
      isCollectionOffer: { BOOL: isCollectionOffer }
  }

  const result = await putItem(item)
  if (result.error) {
    res.send(`Error adding ${collectionSlug}-${token} to database: ${result.error}`)
    return
  }

  jobs[`${collectionSlug}-${token}`] = job.id;

  console.log(`Added ${collectionSlug}-${token} to scan queue`)
  res.send(`Added ${collectionSlug}-${token} to scan queue`)
  return
}

export const stopScan = async (req, res) => {
  const slugWithToken = req.body.collectionSlug
  const collectionSlug = slugWithToken.substring(0, slugWithToken.lastIndexOf('-') !== -1 ? slugWithToken.lastIndexOf('-') : slugWithToken.length);
  const token = slugWithToken.substring(slugWithToken.lastIndexOf('-') !== -1 ? slugWithToken.lastIndexOf('-') + 1 : 0, slugWithToken.length);

  if (!jobs[`${collectionSlug}-${token}`]) {
    res.send(`Not scanning collection ${collectionSlug}-${token}`)
    return
  }

  await removeJobById(`${collectionSlug}-${token}`)
  delete jobs[`${collectionSlug}-${token}`]
  await deleteItem(collectionSlug, token)

  console.log(`Stopped scanning collection ${collectionSlug}-${token}`)
  res.send(`Stopped scanning collection ${collectionSlug}-${token}`)
  return
}

export const getActiveScans = async (req, res) => {
  const activeScans = Object.keys(jobs)
  console.log(`Active scans: ${activeScans}`)
  res.send(activeScans)
  return
}