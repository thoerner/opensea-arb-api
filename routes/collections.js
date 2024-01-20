import express from 'express'
const router = express.Router()

import { getCollectionInfo, getNFTsByCollection } from '../controllers/collectionsController.js'

router.get('/:collectionSlug', getCollectionInfo)
router.get('/tokenInfo/:collectionSlug', getNFTsByCollection)

export default router