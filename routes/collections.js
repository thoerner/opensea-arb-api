import express from 'express'
const router = express.Router()

import { getCollectionInfo } from '../controllers/collectionsController.js'

router.get('/:collectionSlug', getCollectionInfo)

export default router