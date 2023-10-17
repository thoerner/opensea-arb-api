import express from 'express'
import { body } from 'express-validator'
import { 
    startScan,
    stopScan,
    getActiveScans
} from '../controllers/scansController.js'

const router = express.Router()

router.post('/start', 
    [
        body('collectionSlug').isString(),
        body('margin').isNumeric(),
        body('increment').isNumeric(),
        body('schema').isString(),
        body('token').isString().optional(),
    ],
    startScan
)
router.post('/stop', 
    [
        body('collectionSlug').isString()
    ],
    stopScan
)
router.get('/active', getActiveScans)

export default router