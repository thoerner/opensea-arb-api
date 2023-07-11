import { GetItemCommand, DeleteItemCommand, PutItemCommand } from '@aws-sdk/client-dynamodb'
import { jobs } from '../jobs.js'
import { addRepeatableJob, removeJobById } from '../config/queue.js'
import { dbClient } from '../config/db.js'

export const startScan = async (req, res) => {
  const collectionSlug = req.body.collectionSlug;
  const margin = req.body.margin;
  const increment = req.body.increment;
  const schema = req.body.schema;
  const token = req.body.token;
  const interval = req.body.superblaster ? 12 * 1000 : 3 * 60 * 1000;

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

  // await addJob(collectionSlug, margin, increment, schema, token)
  const job = await addRepeatableJob(collectionSlug, margin, increment, schema, token, interval)

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
  console.log(`Removed job ${collectionSlug} from queue`)
  
  delete jobs[collectionSlug];

  const deleteCommand = new DeleteItemCommand({
    TableName: 'arb_anderson_scans',
    Key: {
      slug: { S: collectionSlug }
    }
  });

  await dbClient.send(deleteCommand)

  console.log(`Stopped scanning collection ${collectionSlug}`)
  res.send(`Stopped scanning collection ${collectionSlug}`)
  return
}

export const getActiveScans = async (req, res) => {
  const activeScans = Object.keys(jobs);
  console.log(`Active scans: ${activeScans}`)
  res.send(activeScans);
  return
}